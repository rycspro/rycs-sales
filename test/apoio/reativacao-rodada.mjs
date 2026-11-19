// Roda a reativação num banco temporário (processo à parte: o better-sqlite3
// do Node 24 local pode abortar dentro do executor de testes). Imprime JSON.
// Uso: DB_PATH=/tmp/x.db node test/apoio/reativacao-rodada.mjs
const { default: db, uid } = await import("../../server/db.js");
const reativacao = await import("../../server/services/reativacaoEmpresas.js");

const H = 60 * 60 * 1000;
const DIA = 24 * H;
// Quarta, 18/11/2026, 9h30 em Brasília.
const QUA_0930 = Date.UTC(2026, 10, 18, 12, 30);
const passo = (d, h = 0) => QUA_0930 + d * DIA + h * H;

function empresa({ id, criadoEm, aceite = true, whatsapp = "5515999990000", email }) {
  db.prepare(`INSERT INTO companies (id, nome, produto, criadoEm, statusCadastro, whatsapp, representanteLegal, whatsappMarketingEm)
    VALUES (?, ?, 'x', ?, 'aprovada', ?, 'JOÃO DA SILVA', ?)`).run(id, `Empresa ${id}`, criadoEm, whatsapp, aceite ? criadoEm : null);
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'empresa', ?, ?)")
    .run(uid(), email, id, criadoEm);
}

const contar = (sql, ...p) => db.prepare(sql).get(...p).n;
const emails = (id) => db.prepare("SELECT chave, status, erro FROM email_sequencia_envios WHERE destinatarioId = ? ORDER BY enviadoEm, chave").all(id);
const inscricao = (id) => db.prepare("SELECT * FROM reativacao_inscricoes WHERE companyId = ? ORDER BY inicioEm DESC LIMIT 1").get(id);
const r = {};

empresa({ id: "nova", criadoEm: QUA_0930 - 1 * DIA, email: "nova@teste.local" });   // 1 dia: fora
empresa({ id: "parada", criadoEm: QUA_0930 - 10 * DIA, email: "parada@teste.local" }); // nunca ativou
empresa({ id: "descad", criadoEm: QUA_0930 - 10 * DIA, email: "descad@teste.local" });
db.prepare("INSERT INTO email_descadastros (email, em) VALUES ('descad@teste.local', ?)").run(QUA_0930);

// Antes das 9h: nada.
r.antes = await reativacao.rodada(QUA_0930 - 2 * H, { simular: false });
r.inscricoesAntes = contar("SELECT COUNT(*) AS n FROM reativacao_inscricoes");

// Simulação não grava.
r.simulacao = await reativacao.rodada(QUA_0930, { simular: true });
r.inscricoesDepoisSimulacao = contar("SELECT COUNT(*) AS n FROM reativacao_inscricoes");

// Dia 1, duas rodadas no mesmo horário: um e-mail só.
r.d1a = await reativacao.rodada(QUA_0930, { simular: false });
r.d1b = await reativacao.rodada(QUA_0930 + 15 * 60 * 1000, { simular: false });
r.inscritas = db.prepare("SELECT companyId, segmento, diaAtual FROM reativacao_inscricoes ORDER BY companyId").all();
r.emailsD1 = emails("parada");

// 14h30: WhatsApp do dia 1 (sem configuração → pulado), uma vez só.
await reativacao.rodada(passo(0, 5), { simular: false });
await reativacao.rodada(passo(0, 5.25), { simular: false });
r.whatsappD1 = db.prepare("SELECT dia, status, erro FROM reativacao_whatsapp").all();

// Quinta: dia 2 (sem vendedores ativos → e-mail pulado, mas o dia avança).
await reativacao.rodada(passo(1), { simular: false });
r.diaQuinta = inscricao("parada").diaAtual;
// Sábado: nada.
await reativacao.rodada(passo(3), { simular: false });
r.diaSabado = inscricao("parada").diaAtual;

// Criou campanha: sai como reativada.
db.prepare("INSERT INTO campaigns (id, companyId, titulo, status, criadoEm) VALUES ('k1', 'parada', 'Campanha', 'ativa', ?)").run(passo(4));
await reativacao.rodada(passo(5), { simular: false });
r.saida = (({ status, motivoSaida }) => ({ status, motivoSaida }))(inscricao("parada"));
r.emailsFinal = emails("parada");

// Resposta no WhatsApp: "Parar mensagens" registra uma vez e marca a saída.
empresa({ id: "zap", criadoEm: QUA_0930 - 30 * DIA, email: "zap@teste.local" });
await reativacao.rodada(passo(5) + 30 * 60 * 1000, { simular: false });
const iz = inscricao("zap");
const aviso = {
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: { messages: [{ id: "wamid.resp1", from: "5515999990000", type: "button",
    button: { text: "Parar mensagens", payload: `reativacao:parar:${iz.id}` } }] } }] }],
};
r.respostas = [await reativacao.processarRespostas(aviso), await reativacao.processarRespostas(aviso)];
r.saidaZap = inscricao("zap").motivoSaida;
r.zapSaiu = !!db.prepare("SELECT whatsappMarketingSaiuEm AS em FROM companies WHERE id = 'zap'").get().em;
r.metricas = reativacao.metricas().totais;

console.log(`RESULTADO ${JSON.stringify(r)}`);
process.exit(0);
