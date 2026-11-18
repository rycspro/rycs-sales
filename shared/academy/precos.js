// Preços dos 24 cursos da RYCS Academy (grade de 134h).
//
// Único lugar com o valor de cada curso. Compra avulsa, pagamento único por Pix,
// acesso sem prazo. O banco recebe estes valores uma vez (server/services/
// academyPrecos.js); depois disso, quem manda é o painel do admin.
//
// Critério: gratuitos são a porta de entrada (Fundamentos) e a base de conduta
// que toda pessoa da plataforma precisa ter (Ética e LGPD). O resto segue a
// carga horária planejada; Challenger e Gerente Comercial, por serem avançados,
// ficam um degrau acima.

export const PRECOS_ACADEMY = {
  1: 0,    // Fundamentos de Vendas · 3h · gratuito
  2: 97,   // SDR · 8h
  3: 97,   // Cold Call na Prática · 8h
  4: 67,   // WhatsApp Comercial · 6h
  5: 57,   // Prospecção por E-mail e LinkedIn · 5h
  6: 57,   // Vendas por Instagram e Redes Sociais · 5h
  7: 47,   // Lista, ICP e Qualificação · 4h
  8: 67,   // Descoberta e Venda Consultiva · 6h
  9: 57,   // Objeções · 5h
  10: 47,  // Follow-up e Retomada · 4h
  11: 57,  // Apresentação e Proposta · 5h
  12: 87,  // Challenger 1 — Ensinar · 6h · avançado
  13: 87,  // Challenger 2 — Adaptar · 6h · avançado
  14: 87,  // Challenger 3 — Assumir o Controle · 6h · avançado
  15: 97,  // Closer · 8h
  16: 97,  // BDR — Contas Grandes · 8h
  17: 57,  // Porta a Porta · 5h · nicho
  18: 127, // Gerente Comercial · 8h · avançado
  19: 47,  // CRM, Rotina e Métricas · 4h
  20: 47,  // IA para Vendedores · 4h
  21: 0,   // Ética, LGPD e Contato Responsável · 3h · gratuito
  22: 67,  // Vender para EUA e Índia · 6h · nicho
  23: 57,  // Vendas para Saúde, Educação e Infoprodutos · 5h · nicho
  24: 67,  // Vendas B2B de Serviços · 6h · nicho
};

// Cursos de nicho: incluídos no Pro e no Premium (recurso `cursosNicho`).
export const CURSOS_NICHO = [17, 22, 23, 24];
// Trilha Challenger: incluída no Premium (recurso `descontoTrilhaChallenger` = 100%).
export const CURSOS_CHALLENGER = [12, 13, 14];

export const slugAcademy = (n) => `sales-academy-134h-${String(n).padStart(2, "0")}`;

// Número do curso (1..24) a partir do slug; null se não for da grade de 134h.
export function numeroAcademy(slug) {
  const m = /^sales-academy-134h-(\d{2})$/.exec(String(slug || ""));
  return m ? Number(m[1]) : null;
}

export const precoAcademy = (n) => PRECOS_ACADEMY[n] ?? null;

export const formatarPreco = (v) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
