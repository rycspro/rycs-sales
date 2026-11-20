import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularDias, calcularPainel, ausenciasSeguidas, sugerirMeta, calibracaoTerminou, feriadosNacionais, foraDaJornada,
  preencherContrato, camposDoContrato, reducoes, mudouContrato, regraPadrao, presencaPadrao, cpfValido, tendencia, dataBR,
} from '../shared/colaboradores.js';

const regra = (extra = {}) => ({ ...regraPadrao({ vinculo: 'clt', regime: 'presencial', hoje: '2026-11-02' }), ...extra });

test('dia previsto sem envio é ausente; feriado, folga e ausência justificada não contam como falta', () => {
  const dias = calcularDias({
    inicio: '2026-11-13', fim: '2026-11-20', regra: regra(), hoje: '2026-11-20',
    atividades: { '2026-11-13': { envios: 1 }, '2026-11-14': { envios: 1 } },
    ausencias: [{ dataInicio: '2026-11-17', dataFim: '2026-11-17', tipo: 'atestado', status: 'aprovada' }],
    feriados: new Set(feriadosNacionais(2026).map((f) => f.data)),
  });
  const s = Object.fromEntries(dias.map((d) => [d.data, d.situacao]));
  assert.equal(s['2026-11-13'], 'presente');      // sexta com envio
  assert.equal(s['2026-11-14'], 'extra');         // sábado com envio
  assert.equal(s['2026-11-15'], 'feriado');       // domingo e Proclamação da República
  assert.equal(s['2026-11-16'], 'ausente');       // segunda sem envio
  assert.equal(s['2026-11-17'], 'justificada');   // atestado aprovado
  assert.equal(s['2026-11-20'], 'feriado');       // Consciência Negra
});

test('o dia de hoje fica em andamento até fechar', () => {
  const [d] = calcularDias({ inicio: '2026-11-19', fim: '2026-11-19', regra: regra(), hoje: '2026-11-19' });
  assert.equal(d.situacao, 'em_andamento');
});

test('sequência de dias sem atividade ignora fim de semana', () => {
  const dias = calcularDias({ inicio: '2026-11-12', fim: '2026-11-18', regra: regra(), hoje: '2026-11-19', atividades: { '2026-11-12': { envios: 1 } } });
  assert.deepEqual(ausenciasSeguidas(dias), { dias: 4, desde: '2026-11-13' });
});

test('nota é fórmula fixa: a mesma situação dá a mesma nota, e meta em calibração fica fora', () => {
  const dias = calcularDias({ inicio: '2026-11-09', fim: '2026-11-13', regra: regra(), hoje: '2026-11-19', atividades: { '2026-11-09': { envios: 1 }, '2026-11-10': { envios: 1 }, '2026-11-11': { envios: 1 }, '2026-11-12': { envios: 1 } } });
  const ocs = [{ status: 'aprovada' }, { status: 'aprovada' }, { status: 'aprovada' }, { status: 'recusada' }];
  const p = calcularPainel({ dias, ocorrencias: ocs, regra: regra() });
  assert.equal(p.meta, null);
  assert.equal(p.presenca, 80);
  assert.equal(p.taxaAprovacao, 75);
  assert.equal(p.nota, Math.round(((0.75 * 30 + 0.8 * 30) / 60) * 100));
  assert.deepEqual(calcularPainel({ dias, ocorrencias: ocs, regra: regra() }), p);
  const comMeta = calcularPainel({ dias, ocorrencias: ocs, regra: regra({ meta: { periodo: 'dia', quantidade: 1, status: 'ativa' } }) });
  assert.equal(comMeta.meta, 5);
  assert.equal(comMeta.componentes.meta, 60);
});

test('sem vínculo: presença desligada por padrão e fora da nota', () => {
  assert.equal(presencaPadrao('outro', ''), false);
  assert.equal(presencaPadrao('clt', 'teletrabalho_producao'), false);
  const r = regraPadrao({ vinculo: 'outro' });
  const dias = calcularDias({ inicio: '2026-11-09', fim: '2026-11-13', regra: r, hoje: '2026-11-19' });
  const p = calcularPainel({ dias, ocorrencias: [{ status: 'aprovada' }], regra: r });
  assert.equal(p.presenca, null);
  assert.equal(p.nota, 100);
});

test('calibração de 4 semanas e meta sugerida pela média real', () => {
  const r = regra({ meta: { periodo: 'dia', quantidade: null, status: 'calibrando', calibracaoDesde: '2026-10-01' } });
  assert.equal(calibracaoTerminou(r, '2026-10-28'), false);
  assert.equal(calibracaoTerminou(r, '2026-10-29'), true);
  const dias = calcularDias({ inicio: '2026-11-09', fim: '2026-11-13', regra: r, hoje: '2026-11-19' });
  const ocs = Array.from({ length: 10 }, () => ({ status: 'enviada' }));
  assert.equal(sugerirMeta({ dias, ocorrencias: ocs, regra: r }), 2);
  assert.equal(sugerirMeta({ dias, ocorrencias: [], regra: r }), null);
});

test('envio à noite, no fim de semana ou em feriado é fora da jornada', () => {
  const r = regra();
  assert.equal(foraDaJornada(Date.parse('2026-11-18T10:00:00-03:00'), r), false);
  assert.equal(foraDaJornada(Date.parse('2026-11-18T22:30:00-03:00'), r), true);
  assert.equal(foraDaJornada(Date.parse('2026-11-21T10:00:00-03:00'), r), true);
  assert.equal(foraDaJornada(Date.parse('2026-11-20T10:00:00-03:00'), r, new Set(['2026-11-20'])), true);
  assert.equal(dataBR(Date.parse('2026-11-19T01:00:00Z')), '2026-11-18');
});

test('contrato só troca campos e aponta o que falta', () => {
  const campos = camposDoContrato({ nome: 'Fulana de Tal', cpf: '52998224725', funcao: 'Atendimento', vinculo: 'clt', regime: 'presencial', dataInicio: '2026-10-01', jornadaHoras: 44 }, regra({ fixoCents: 150000 }), '2026-11-19');
  const { texto, faltando } = preencherContrato('Contratada: {{nome}}, CPF {{cpf}}, início {{dataInicio}}, fixo {{fixo}}. {{inexistente}}', campos);
  assert.match(texto, /Fulana de Tal, CPF 529\.982\.247-25, início 01\/10\/2026/);
  assert.deepEqual(faltando, ['inexistente']);
});

test('redução de valor é detectada (art. 468) e mudança de remuneração pede aditivo', () => {
  const a = regra({ fixoCents: 200000 });
  const b = regra({ fixoCents: 180000 });
  assert.deepEqual(reducoes(a, b), ['Fixo por mês']);
  assert.equal(mudouContrato(a, b), true);
  assert.equal(mudouContrato(a, { ...a, meta: { periodo: 'dia', quantidade: 3, status: 'ativa' } }), false);
});

test('auxiliares', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('111.111.111-11'), false);
  assert.equal(tendencia(70, 80), 'caindo');
  assert.equal(tendencia(80, 78), 'estavel');
  assert.ok(feriadosNacionais(2026).some((f) => f.data === '2026-04-03'));
});
