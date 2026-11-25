// Catálogo de integrações da Central de Integrações (Leads > Integrações).
// Apenas metadados — a apresentação fica nos componentes.
//
// IMPORTANTE: são reais a Meta Ads (/meta/conexao), o Webhook
// (/webhooks/config), WhatsApp e Instagram (/canais), os ERPs (/erp) e o
// Google Sheets (/google-sheets): o status vem SEMPRE dessas rotas. As demais
// são "Em breve": catálogo preparado, sem conexão fictícia.
//
// O catálogo é organizado POR PAÍS (segue o idioma do login): ferramentas
// globais aparecem em todos; cada país acrescenta as suas ferramentas locais.
// Interface sempre em português do Brasil (regra do projeto), inclusive as
// descrições das ferramentas estrangeiras.

export const CATEGORIAS = [
  { chave: "anuncios", rotulo: "Anúncios" },
  { chave: "crm", rotulo: "CRM" },
  { chave: "formularios", rotulo: "Formulários" },
  { chave: "automacoes", rotulo: "Automações" },
  { chave: "erp", rotulo: "ERP" },
  { chave: "canais", rotulo: "Atendimento" },
];

export const FILTROS = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "conectadas", rotulo: "Conectadas" },
  { chave: "disponiveis", rotulo: "Disponíveis" },
  { chave: "anuncios", rotulo: "Anúncios" },
  { chave: "crm", rotulo: "CRM" },
  { chave: "formularios", rotulo: "Formulários" },
  { chave: "automacoes", rotulo: "Automações" },
  { chave: "erp", rotulo: "ERP" },
  { chave: "canais", rotulo: "Atendimento" },
];

// Logotipo: `slug` = ícone oficial (Simple Icons, na cor da marca); senão
// `dominio` = logo real do site (favicon); senão `cor`+`sigla` (bloco com a
// inicial). `tipo`: "meta" e "webhook" são reais; o resto "em_breve".
export const FERRAMENTAS = {
  // ── Globais (todos os países) ─────────────────────────────────────────
  "meta":          { nome: "Meta Ads", tipo: "meta", categoria: "anuncios", slug: "meta", cor: "#0866FF", sigla: "M", descricao: "Receba automaticamente leads dos anúncios do Facebook e Instagram." },
  "whatsapp":      { nome: "WhatsApp", tipo: "canal", canal: "whatsapp", categoria: "canais", slug: "whatsapp", cor: "#25D366", sigla: "W", descricao: "Atenda os leads pelo WhatsApp da empresa ou do profissional, com auditoria da IA." },
  "instagram":     { nome: "Instagram", tipo: "canal", canal: "instagram", categoria: "canais", slug: "instagram", cor: "#E4405F", sigla: "I", descricao: "Receba directs e comentários do Instagram junto com os seus leads." },
  "erp-generico":  { nome: "Outro ERP", tipo: "erp", provedor: "generico", categoria: "erp", slug: null, cor: "#4338CA", sigla: "ERP", descricao: "Conecte qualquer ERP: receba produtos e clientes e envie os pedidos aprovados." },
  "google-ads":    { nome: "Google Ads", categoria: "anuncios", slug: "googleads", cor: "#4285F4", sigla: "G", descricao: "Receba leads gerados pelos formulários dos seus anúncios." },
  "tiktok-ads":    { nome: "TikTok Ads", categoria: "anuncios", slug: "tiktok", cor: "#111111", sigla: "T", descricao: "Centralize contatos captados pelas campanhas do TikTok." },
  "linkedin-ads":  { nome: "LinkedIn Ads", categoria: "anuncios", dominio: "linkedin.com", cor: "#0A66C2", sigla: "in", descricao: "Receba leads dos formulários de campanhas profissionais." },
  "google-forms":  { nome: "Google Forms", categoria: "formularios", slug: "googleforms", cor: "#7248B9", sigla: "GF", descricao: "Receba respostas de formulários como novos leads." },
  "typeform":      { nome: "Typeform", categoria: "formularios", slug: "typeform", cor: "#262627", sigla: "Tf", descricao: "Transforme respostas de formulários em oportunidades." },
  "jotform":       { nome: "Jotform", categoria: "formularios", dominio: "jotform.com", cor: "#FF6100", sigla: "J", descricao: "Centralize os contatos enviados pelos seus formulários." },
  "google-sheets": { nome: "Google Sheets", tipo: "google-sheets", categoria: "formularios", slug: "googlesheets", cor: "#0F9D58", sigla: "GS", descricao: "Importe contatos e leads de planilhas." },
  "wordpress":     { nome: "WordPress", categoria: "formularios", slug: "wordpress", cor: "#21759B", sigla: "W", descricao: "Receba leads captados pelo seu site." },
  "webflow":       { nome: "Webflow", categoria: "formularios", slug: "webflow", cor: "#146EF5", sigla: "Wf", descricao: "Integre formulários e contatos do seu site." },
  "webhooks":      { nome: "Webhooks", tipo: "webhook", categoria: "automacoes", slug: null, cor: "#6366F1", sigla: "{}", descricao: "Receba leads de sistemas externos automaticamente." },
  "api-rycs":      { nome: "API RYCS", categoria: "automacoes", slug: null, cor: "#318CE7", sigla: "</>", descricao: "Conecte sistemas personalizados à plataforma." },
  "zapier":        { nome: "Zapier", categoria: "automacoes", slug: "zapier", cor: "#FF4F00", sigla: "Z", descricao: "Automatize o envio de leads entre aplicativos." },
  "make":          { nome: "Make", categoria: "automacoes", slug: "make", cor: "#6D00CC", sigla: "Mk", descricao: "Crie fluxos de integração entre diferentes ferramentas." },
  "n8n":           { nome: "n8n", categoria: "automacoes", slug: "n8n", cor: "#EA4B71", sigla: "n8", descricao: "Conecte automações personalizadas à RYCS." },

  // ── CRMs multinacionais (reaproveitados em vários países) ──────────────
  "hubspot":       { nome: "HubSpot", categoria: "crm", slug: "hubspot", cor: "#FF7A59", sigla: "H", descricao: "Integre contatos e oportunidades do seu CRM." },
  "salesforce":    { nome: "Salesforce", categoria: "crm", dominio: "salesforce.com", cor: "#00A1E0", sigla: "S", descricao: "Integre dados comerciais e registros de clientes." },
  "zoho-crm":      { nome: "Zoho CRM", categoria: "crm", slug: "zoho", cor: "#E42527", sigla: "Z", descricao: "Sincronize contatos e informações de vendas." },
  "pipedrive":     { nome: "Pipedrive", categoria: "crm", dominio: "pipedrive.com", cor: "#1A1A1A", sigla: "P", descricao: "Conecte contatos e oportunidades do funil de vendas." },

  // ── Brasil ────────────────────────────────────────────────────────────
  "bling":         { nome: "Bling", tipo: "erp", provedor: "bling", categoria: "erp", dominio: "bling.com.br", cor: "#33AD5C", sigla: "B", descricao: "Use o catálogo e os clientes do Bling e envie os pedidos aprovados." },
  "tiny":          { nome: "Olist Tiny", tipo: "erp", provedor: "tiny", categoria: "erp", dominio: "tiny.com.br", cor: "#0B5FFF", sigla: "T", descricao: "Use o catálogo e os clientes do Tiny e envie os pedidos aprovados." },
  "omie":          { nome: "Omie", tipo: "erp", provedor: "omie", categoria: "erp", dominio: "omie.com.br", cor: "#001E27", sigla: "O", descricao: "Use o catálogo e os clientes do Omie e envie os pedidos aprovados." },
  "rd-station":    { nome: "RD Station", categoria: "crm", dominio: "rdstation.com", cor: "#19B9A7", sigla: "RD", descricao: "Sincronize leads e informações comerciais." },
  "agendor":       { nome: "Agendor", categoria: "crm", dominio: "agendor.com.br", cor: "#2F80ED", sigla: "A", descricao: "Centralize contatos e oportunidades comerciais." },

  // ── Estados Unidos ────────────────────────────────────────────────────
  "keap":          { nome: "Keap", categoria: "crm", dominio: "keap.com", cor: "#FF6B2C", sigla: "K", descricao: "Automatize vendas e marketing do seu negócio." },
  "activecampaign":{ nome: "ActiveCampaign", categoria: "crm", dominio: "activecampaign.com", cor: "#356AE6", sigla: "AC", descricao: "Sincronize contatos e automações de marketing." },
  "gohighlevel":   { nome: "GoHighLevel", categoria: "crm", dominio: "gohighlevel.com", cor: "#2A3B4D", sigla: "HL", descricao: "Centralize leads e funis da sua agência." },
  "mailchimp":     { nome: "Mailchimp", categoria: "automacoes", dominio: "mailchimp.com", cor: "#2A2A2A", sigla: "Mc", descricao: "Receba contatos das suas campanhas de e-mail." },
  "calendly":      { nome: "Calendly", categoria: "automacoes", dominio: "calendly.com", cor: "#006BFF", sigla: "C", descricao: "Transforme agendamentos em novos leads." },

  // ── Espanha ───────────────────────────────────────────────────────────
  "holded":        { nome: "Holded", categoria: "crm", dominio: "holded.com", cor: "#0066FF", sigla: "Ho", descricao: "Integre contatos e vendas do seu ERP/CRM." },
  "efficy":        { nome: "Efficy CRM", categoria: "crm", dominio: "efficy.com", cor: "#E6007E", sigla: "Ef", descricao: "Conecte contatos e oportunidades do CRM." },
  "teamleader":    { nome: "Teamleader", categoria: "crm", dominio: "teamleader.eu", cor: "#27C1C6", sigla: "TL", descricao: "Centralize clientes e orçamentos." },
  "brevo":         { nome: "Brevo", categoria: "automacoes", dominio: "brevo.com", cor: "#0B996E", sigla: "Br", descricao: "Sincronize contatos das suas campanhas (Brevo)." },

  // ── China ─────────────────────────────────────────────────────────────
  "baidu-ads":     { nome: "Baidu Ads", categoria: "anuncios", dominio: "baidu.com", cor: "#2932E1", sigla: "百", descricao: "Receba leads dos anúncios do Baidu." },
  "douyin-ads":    { nome: "Douyin Ads", categoria: "anuncios", dominio: "douyin.com", cor: "#111111", sigla: "抖", descricao: "Centralize contatos das campanhas do Douyin." },
  "weibo-ads":     { nome: "Weibo Ads", categoria: "anuncios", dominio: "weibo.com", cor: "#E6162D", sigla: "微", descricao: "Receba leads das campanhas do Weibo." },
  "xiaohongshu":   { nome: "Xiaohongshu", categoria: "anuncios", dominio: "xiaohongshu.com", cor: "#FF2442", sigla: "小", descricao: "Centralize contatos captados no Xiaohongshu." },
  "wecom":         { nome: "WeChat Work", categoria: "crm", dominio: "work.weixin.qq.com", cor: "#2E7CF6", sigla: "企", descricao: "Centralize contatos do WeChat corporativo." },
  "dingtalk":      { nome: "DingTalk", categoria: "crm", dominio: "dingtalk.com", cor: "#3296FA", sigla: "钉", descricao: "Receba leads e contatos do DingTalk." },
  "feishu":        { nome: "Feishu (Lark)", categoria: "crm", dominio: "feishu.cn", cor: "#3370FF", sigla: "飞", descricao: "Integre contatos e formulários do Feishu/Lark." },

  // ── Índia ─────────────────────────────────────────────────────────────
  "freshsales":    { nome: "Freshsales", categoria: "crm", dominio: "freshworks.com", cor: "#FF5A36", sigla: "Fr", descricao: "Sincronize contatos e negócios do Freshworks." },
  "leadsquared":   { nome: "LeadSquared", categoria: "crm", dominio: "leadsquared.com", cor: "#0A7CFF", sigla: "LS", descricao: "Centralize e distribua leads do LeadSquared." },
  "kylas":         { nome: "Kylas", categoria: "crm", dominio: "kylas.io", cor: "#1E3A8A", sigla: "Ky", descricao: "Conecte contatos e oportunidades do Kylas." },
  "razorpay":      { nome: "Razorpay", categoria: "automacoes", dominio: "razorpay.com", cor: "#0C2451", sigla: "Rz", descricao: "Receba leads de pagamentos e cobranças." },
  "justdial":      { nome: "Justdial", categoria: "formularios", dominio: "justdial.com", cor: "#008C44", sigla: "JD", descricao: "Receba contatos gerados no Justdial." },
  "exotel":        { nome: "Exotel", categoria: "automacoes", dominio: "exotel.com", cor: "#5B2EE0", sigla: "Ex", descricao: "Transforme chamadas em leads (Exotel)." },

  // ── França ────────────────────────────────────────────────────────────
  "sellsy":        { nome: "Sellsy", categoria: "crm", dominio: "sellsy.com", cor: "#6C5CE7", sigla: "Se", descricao: "Integre contatos e vendas do Sellsy." },
  "axonaut":       { nome: "Axonaut", categoria: "crm", dominio: "axonaut.com", cor: "#2D9CDB", sigla: "Ax", descricao: "Centralize clientes e orçamentos (Axonaut)." },

  // ── Arábia Saudita ────────────────────────────────────────────────────
  "snapchat-ads":  { nome: "Snapchat Ads", categoria: "anuncios", dominio: "snapchat.com", cor: "#111111", sigla: "Sc", descricao: "Receba leads dos anúncios do Snapchat." },
  "daftra":        { nome: "Daftra", categoria: "crm", dominio: "daftra.com", cor: "#2E7D32", sigla: "Da", descricao: "Integre contatos e faturamento (Daftra)." },
  "qoyod":         { nome: "Qoyod", categoria: "crm", dominio: "qoyod.com", cor: "#1565C0", sigla: "Qo", descricao: "Sincronize clientes e vendas (Qoyod)." },

  // ── Rússia ────────────────────────────────────────────────────────────
  "vk-ads":        { nome: "VK Ads", categoria: "anuncios", dominio: "vk.com", cor: "#0077FF", sigla: "VK", descricao: "Receba leads das campanhas do VK." },
  "yandex-direct": { nome: "Yandex Direct", categoria: "anuncios", dominio: "yandex.com", cor: "#FF0000", sigla: "Ya", descricao: "Receba leads dos anúncios do Yandex." },
  "bitrix24":      { nome: "Bitrix24", categoria: "crm", dominio: "bitrix24.com", cor: "#2FC7F7", sigla: "B24", descricao: "Centralize contatos e funil do Bitrix24." },
  "amocrm":        { nome: "amoCRM", categoria: "crm", dominio: "amocrm.com", cor: "#339DC7", sigla: "am", descricao: "Sincronize leads e negócios do amoCRM." },
  "megaplan":      { nome: "Megaplan", categoria: "crm", dominio: "megaplan.ru", cor: "#00A1E0", sigla: "Mp", descricao: "Conecte contatos e tarefas do Megaplan." },

  // ── Bangladesh ────────────────────────────────────────────────────────
  "bkash":         { nome: "bKash", categoria: "automacoes", dominio: "bkash.com", cor: "#E2136E", sigla: "bK", descricao: "Receba leads de cobranças e pagamentos (bKash)." },

  // ── Indonésia ─────────────────────────────────────────────────────────
  "qontak":        { nome: "Mekari Qontak", categoria: "crm", dominio: "qontak.com", cor: "#FF6B35", sigla: "Qt", descricao: "Centralize contatos e WhatsApp (Qontak)." },
  "barantum":      { nome: "Barantum", categoria: "crm", dominio: "barantum.com", cor: "#1EA7FD", sigla: "Ba", descricao: "Sincronize contatos e oportunidades (Barantum)." },
};

// Países (seguem os 5 primeiros idiomas do seletor de login). `ids` define a
// ordem das ferramentas no catálogo daquele país.
export const PAISES = [
  { chave: "br", pais: "Brasil", bandeira: "🇧🇷", locales: ["pt-BR", "pt"],
    ids: ["meta", "google-ads", "tiktok-ads", "linkedin-ads", "rd-station", "pipedrive", "agendor", "hubspot", "salesforce", "zoho-crm", "google-forms", "typeform", "jotform", "wordpress", "webflow", "google-sheets", "webhooks", "api-rycs", "zapier", "make", "n8n"] },
  { chave: "us", pais: "Estados Unidos", bandeira: "🇺🇸", locales: ["en"],
    ids: ["meta", "google-ads", "tiktok-ads", "linkedin-ads", "hubspot", "salesforce", "zoho-crm", "keap", "activecampaign", "gohighlevel", "mailchimp", "calendly", "google-forms", "typeform", "jotform", "wordpress", "webflow", "google-sheets", "webhooks", "api-rycs", "zapier", "make", "n8n"] },
  { chave: "es", pais: "Espanha", bandeira: "🇪🇸", locales: ["es"],
    ids: ["meta", "google-ads", "tiktok-ads", "linkedin-ads", "salesforce", "hubspot", "pipedrive", "holded", "efficy", "teamleader", "brevo", "google-forms", "typeform", "jotform", "wordpress", "webflow", "google-sheets", "webhooks", "api-rycs", "zapier", "make", "n8n"] },
  { chave: "cn", pais: "China", bandeira: "🇨🇳", locales: ["zh"],
    ids: ["meta", "google-ads", "tiktok-ads", "linkedin-ads", "baidu-ads", "douyin-ads", "weibo-ads", "xiaohongshu", "wecom", "dingtalk", "feishu", "google-forms", "jotform", "google-sheets", "webhooks", "api-rycs", "make", "n8n"] },
  { chave: "in", pais: "Índia", bandeira: "🇮🇳", locales: ["hi"],
    ids: ["meta", "google-ads", "tiktok-ads", "linkedin-ads", "zoho-crm", "freshsales", "leadsquared", "kylas", "hubspot", "salesforce", "razorpay", "justdial", "exotel", "google-forms", "typeform", "jotform", "wordpress", "google-sheets", "webhooks", "api-rycs", "zapier", "make", "n8n"] },
  { chave: "fr", pais: "França", bandeira: "🇫🇷", locales: ["fr"],
    ids: ["meta", "google-ads", "tiktok-ads", "linkedin-ads", "salesforce", "hubspot", "pipedrive", "sellsy", "axonaut", "brevo", "google-forms", "typeform", "jotform", "wordpress", "webflow", "google-sheets", "webhooks", "api-rycs", "zapier", "make", "n8n"] },
  { chave: "sa", pais: "Arábia Saudita", bandeira: "🇸🇦", locales: ["ar"],
    ids: ["meta", "google-ads", "tiktok-ads", "snapchat-ads", "linkedin-ads", "salesforce", "hubspot", "zoho-crm", "daftra", "qoyod", "google-forms", "jotform", "google-sheets", "webhooks", "api-rycs", "zapier", "make", "n8n"] },
  { chave: "ru", pais: "Rússia", bandeira: "🇷🇺", locales: ["ru"],
    ids: ["meta", "google-ads", "tiktok-ads", "vk-ads", "yandex-direct", "linkedin-ads", "bitrix24", "amocrm", "megaplan", "google-forms", "jotform", "google-sheets", "webhooks", "api-rycs", "make", "n8n"] },
  { chave: "bd", pais: "Bangladesh", bandeira: "🇧🇩", locales: ["bn"],
    ids: ["meta", "google-ads", "tiktok-ads", "linkedin-ads", "zoho-crm", "hubspot", "salesforce", "bkash", "google-forms", "typeform", "jotform", "wordpress", "google-sheets", "webhooks", "api-rycs", "zapier", "make", "n8n"] },
  { chave: "id", pais: "Indonésia", bandeira: "🇮🇩", locales: ["id"],
    ids: ["meta", "google-ads", "tiktok-ads", "linkedin-ads", "hubspot", "salesforce", "zoho-crm", "qontak", "barantum", "google-forms", "typeform", "jotform", "wordpress", "google-sheets", "webhooks", "api-rycs", "zapier", "make", "n8n"] },
];

// Monta a lista de integrações de um país (id → objeto, com o id embutido).
export function integracoesDoPais(chave) {
  const pais = PAISES.find((p) => p.chave === chave) || PAISES[0];
  // Atendimento e ERP existem em todos os países; os ERPs brasileiros, só no Brasil.
  const ids = ["whatsapp", "instagram", ...(pais.chave === "br" ? ["bling", "tiny", "omie"] : []), "erp-generico", ...pais.ids];
  return ids.map((id) => ({ id, ...FERRAMENTAS[id] })).filter((x) => x.nome);
}

// País inicial a partir do idioma logado (localStorage do i18n); cai no Brasil.
export function paisDoIdioma() {
  let loc = "pt-BR";
  try { loc = window.localStorage?.getItem("rycs-idioma") || "pt-BR"; } catch { /* ignore */ }
  return PAISES.find((p) => p.locales.includes(loc))?.chave
      || PAISES.find((p) => p.locales.some((l) => loc.startsWith(l)))?.chave
      || "br";
}

export const rotuloCategoria = (chave) =>
  CATEGORIAS.find((c) => c.chave === chave)?.rotulo || chave;

// Deriva o status visual a partir da conexão REAL da Meta. Nunca inventa estado.
export function statusMeta(conexao) {
  if (!conexao) return "nao_conectado";
  if (!conexao.conectado) return "nao_conectado";
  if (conexao.status === "ativa") return "conectado";
  return "atencao";
}

export const STATUS = {
  conectado:     { rotulo: "Conectado", acao: "Gerenciar", cor: "#16A34A" },
  atencao:       { rotulo: "Atenção necessária", acao: "Verificar", cor: "#D97706" },
  nao_conectado: { rotulo: "Não conectado", acao: "Conectar", cor: "#98A2B3" },
  em_breve:      { rotulo: "Em breve", acao: null, cor: "#98A2B3" },
};

// Ordem de exibição: ativas primeiro, depois as conectáveis, "Em breve" por
// último. Ao configurar uma ferramenta, ela sobe para o topo.
export const ORDEM_STATUS = { conectado: 0, atencao: 1, nao_conectado: 2, em_breve: 3 };
