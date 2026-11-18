import { readFileSync } from 'node:fs';

const ler = (id, idioma) => JSON.parse(readFileSync(new URL(`../../content/academy/basico/${String(id).padStart(2, '0')}/${idioma}.json`, import.meta.url), 'utf8'));

export function carregarEdicaoBasica(id) {
  const pt = ler(id, 'pt-BR');
  const en = ler(id, 'en-US');
  const india = ler(id, 'en-IN');
  const secao = (a, titulo) => `**${titulo}**\n${a.conteudo}\n\n**Exercício / Exercise**\n${a.exercicio.instrucoes.map((s) => `- ${s}`).join('\n')}\n\n**Resposta comentada / Answer guide**\n${a.exercicio.gabarito}\n${a.exercicio.justificativa}`;
  return {
    slug: pt.id,
    subtitulo: `Edição básica · ${pt.modulos.reduce((n, m) => n + m.aulas.length, 0)} aulas · PT / EN-US / EN-IN`,
    descricao: `Edição básica para estudo, com exercícios comentados e casos fictícios. A grade completa prevê ${pt.carga_horaria_planejada_h}h; esta versão enxuta não comprova essa duração. Avaliação discursiva para prática, sem emissão de certificado nesta edição. Aprofundamento, revisão especializada e vídeos pendentes.`,
    modulos: pt.modulos.map((m, mi) => ({ titulo: m.titulo, aulas: m.aulas.map((a, ai) => {
      const contexto = ai === 0 ? `**Caso fictício do curso**\n${pt.caso.texto}\n\n` : '';
      const fim = mi === pt.modulos.length - 1 && ai === m.aulas.length - 1;
      let conteudo = contexto + secao(a, 'Português');
      conteudo += `\n\n${ai === 0 ? `**Fictional case — United States**\n${en.caso.texto}\n` : ''}${secao(en.modulos[mi].aulas[ai], 'English — United States')}`;
      conteudo += `\n\n${ai === 0 ? `**Fictional case — India**\n${india.caso.texto}\n` : ''}${secao(india.modulos[mi].aulas[ai], 'English — India')}`;
      if (fim) for (const doc of [pt, en, india]) {
        conteudo += `\n\n**Projeto / Project — ${doc.locale}**\n${doc.projeto.instrucoes}\n\n**Resposta / Answer**\n${doc.projeto.gabarito}\n\n**Avaliação de prática / Practice assessment**\n${doc.avaliacao_basica.questoes.map((q) => `- ${q.pergunta}`).join('\n')}\n\n**Simulação / Role-play**\n${doc.simulacao.instrucao_ator}\n${doc.simulacao.instrucao_avaliador}\n${doc.simulacao.rubrica.map((r) => `- ${r.criterio}: ${r.pontos}/100`).join('\n')}\n0 = ausente / absent; 10 = parcial / partial; 20 = demonstrado / demonstrated.\n${doc.simulacao.falhas_criticas.map((f) => `- ${f}`).join('\n')}\nFalha crítica impede aprovação prática. / Critical failure prevents a practical pass.\nAtividade de estudo; não emite certificado. / Learning activity; no certificate issued.`;
      }
      // Tempo estimado de leitura de uma versão + exercício, não as horas planejadas da grade.
      const duracaoMin = Math.max(5, Math.ceil(a.conteudo.split(/\s+/).length / 180) + 4);
      return { titulo: a.titulo, conteudo, duracaoMin, tipo: 'texto' };
    }) })),
  };
}
