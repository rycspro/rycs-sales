import { uid, agora } from "./utils.js";

const cursoPadrao = (nomes) =>
  nomes.map((t) => ({ id: uid(), titulo: t[0], min: t[1], conteudo: t[2] }));

export const seed = () => {
  const e1 = uid(), e2 = uid(), e3 = uid(), s1 = uid(), s2 = uid(), s3 = uid();
  return {
    role: "vendedor",
    sellerId: s1,
    companyId: e1,
    sellers: [
      {
        id: s1, nome: "Rafa Lima", email: "rafa@email.com", whats: "(11) 9 8123-4477",
        cidade: "Guarulhos, SP", perfil: "sdr", experiencia: "6 meses em telecom",
        status: "aprovado", nota: 78, pix: "rafa@email.com",
        disponivel: 44, pendente: 0, sacado: 132,
        aplicacoes: { [e1]: "aprovado" }, curso: { [e1]: "todos" },
        criadoEm: agora() - 86400000 * 9,
      },
      {
        id: s2, nome: "Bruna Sato", email: "bruna@email.com", whats: "(21) 9 9670-1188",
        cidade: "Niterói, RJ", perfil: "closer", experiencia: "2 anos em software B2B",
        status: "triagem", nota: 88, pix: "", disponivel: 0, pendente: 0, sacado: 0,
        aplicacoes: {}, curso: {}, criadoEm: agora() - 3600000 * 5,
        respostas: ["Levanto a dor antes do preço", "Ligo no mesmo dia", "Peço o próximo passo na hora"],
      },
      {
        id: s3, nome: "Diego Moura", email: "diego@email.com", whats: "(31) 9 9004-2210",
        cidade: "Belo Horizonte, MG", perfil: "sem-exp", experiencia: "Primeira vez em vendas",
        status: "triagem", nota: 41, pix: "", disponivel: 0, pendente: 0, sacado: 0,
        aplicacoes: {}, curso: {}, criadoEm: agora() - 3600000 * 30,
        respostas: ["Mando proposta por e-mail", "Espero o cliente responder", "Falo o preço logo no começo"],
      },
    ],
    companies: [
      {
        id: e1, nome: "Nexo CRM", produto: "CRM para distribuidoras", ticket: "R$ 890/mês",
        icp: "Distribuidoras de 10 a 80 funcionários", plano: "saldo", destaque: true,
        saldo: 4200, vagas: 12, cor: "#0F766E", criadoEm: agora() - 86400000 * 41,
        totalAportado: 9800, aportes: [
          { valor: 5000, ts: agora() - 86400000 * 41 }, { valor: 3000, ts: agora() - 86400000 * 24 }, { valor: 1800, ts: agora() - 86400000 * 8 },
        ],
        comissoes: { agendamento: 5, venda: 250, realizada: 8, ligacao: 10, follow: 0.5 },
        curso: cursoPadrao([
          ["O que a Nexo vende", 4, "CRM com rota de vendedor externo e catálogo. Substitui planilha e WhatsApp solto. Implanta em 7 dias."],
          ["Quem é o cliente certo", 5, "Distribuidora com equipe de rua. Dor: pedido perdido, vendedor sem histórico, dono sem visão do funil."],
          ["Abordagem que funciona", 6, "Abra pelo prejuízo: 'quantos pedidos você perdeu esse mês por falta de follow?'. Nunca abra por funcionalidade."],
          ["Objeções e o que responder", 6, "'Já uso planilha' → mostre custo do retrabalho. 'Tá caro' → compare com um pedido médio perdido."],
        ]),
      },
      {
        id: e2, nome: "SolarUp Energia", produto: "Energia solar para comércio", ticket: "R$ 38.000",
        icp: "Comércios com conta de luz acima de R$ 1.500", plano: "destaque", destaque: true,
        saldo: 1560, vagas: 8, cor: "#B45309", criadoEm: agora() - 86400000 * 19,
        totalAportado: 6000, aportes: [
          { valor: 4000, ts: agora() - 86400000 * 19 }, { valor: 2000, ts: agora() - 86400000 * 6 },
        ],
        comissoes: { agendamento: 12, venda: 900, realizada: 20, ligacao: 6, follow: 0.5 },
        curso: cursoPadrao([
          ["Como funciona o sistema", 5, "Placa, inversor e homologação na concessionária. Payback médio de 38 meses."],
          ["Conta de luz é o filtro", 4, "Sem conta acima de R$ 1.500 não há economia relevante. Peça a conta antes de agendar."],
          ["Agendamento com o dono", 5, "Só o dono decide. Se falar com o gerente, o agendamento não conta."],
        ]),
      },
      {
        id: e3, nome: "Ativa Contábil", produto: "Contabilidade para prestadores", ticket: "R$ 320/mês",
        icp: "Autônomos abrindo CNPJ e MEIs migrando para ME", plano: "saldo", destaque: false,
        saldo: 700, vagas: 20, cor: "#3730A1", criadoEm: agora() - 86400000 * 63,
        totalAportado: 3400, aportes: [
          { valor: 2000, ts: agora() - 86400000 * 63 }, { valor: 1400, ts: agora() - 86400000 * 30 },
        ],
        comissoes: { agendamento: 4, venda: 120, realizada: 6, ligacao: 4, follow: 0.5 },
        curso: cursoPadrao([
          ["Abertura de CNPJ na prática", 4, "Prazo de 5 dias úteis, taxa inclusa no primeiro mês. Diferença entre MEI, ME e Simples."],
          ["Gatilho de troca de contador", 5, "Atraso em guia, multa e contador que some. É aí que a conversa abre."],
        ]),
      },
    ],
    submissions: [
      {
        id: uid(), sellerId: s1, companyId: e1, tipo: "agendamento", valor: 5,
        prova: { cliente: "Marcos — Distribuidora Vila Nova", telefone: "(11) 9 9812-3344", datahora: "20/08 às 10h", video: "https://drive.link/video-01" },
        status: "revisao", confianca: 58, motivo: "Primeira ação deste vendedor com esta empresa — confirme com o cliente antes de liberar.", fonte: "ia",
        criadoEm: agora() - 3600000 * 3,
      },
      {
        id: uid(), sellerId: s1, companyId: e1, tipo: "ligacao", valor: 10,
        prova: { cliente: "Sônia — Atacado Bela Vista", telefone: "(11) 9 9711-2200", duracao: "7", video: "https://drive.link/video-88" },
        status: "ia_aprovado", confianca: 91, motivo: "Dados específicos e coerentes, vídeo anexado. Consistente com a regra.", fonte: "ia",
        criadoEm: agora() - 3600000 * 20,
      },
      {
        id: uid(), sellerId: s1, companyId: e1, tipo: "follow", valor: 0.5,
        prova: { cliente: "Marcos — Distribuidora Vila Nova", telefone: "(11) 9 9812-3344", canal: "WhatsApp", video: "https://drive.link/video-02" },
        status: "liberado", liquido: 0.44, confianca: 88, motivo: "Aprovado automaticamente pela IA.", fonte: "ia",
        criadoEm: agora() - 86400000 * 2,
      },
    ],
    withdrawals: [],
    messages: [
      { id: uid(), companyId: e1, sellerId: s1, de: "empresa", texto: "Rafa, o agendamento das 10h da Vila Nova o cliente confirmou por aqui. Segue firme.", ts: agora() - 3600000 * 2 },
    ],
  };
};
