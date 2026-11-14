// Catálogo de integrações da Central de Integrações (Leads > Integrações).
// Apenas metadados — a apresentação fica nos componentes.
//
// IMPORTANTE: somente a Meta Ads é real e funcional. Seu status vem SEMPRE da
// conexão verdadeira (/meta/conexao), reutilizando o componente IntegracaoMeta.
// Todas as demais são "Em breve": não possuem backend e nunca aparecem como
// conectadas. Para ligar uma no futuro, basta trocar `disponivel` e apontar um
// componente de configuração.

export const CATEGORIAS = [
  { chave: "anuncios", rotulo: "Anúncios" },
  { chave: "crm", rotulo: "CRM" },
  { chave: "formularios", rotulo: "Formulários" },
  { chave: "automacoes", rotulo: "Automações" },
];

// Filtros horizontais da página.
export const FILTROS = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "conectadas", rotulo: "Conectadas" },
  { chave: "disponiveis", rotulo: "Disponíveis" },
  { chave: "anuncios", rotulo: "Anúncios" },
  { chave: "crm", rotulo: "CRM" },
  { chave: "formularios", rotulo: "Formulários" },
  { chave: "automacoes", rotulo: "Automações" },
];

// `tipo`: "meta" → fluxo real existente; "em_breve" → catálogo preparado.
// Logotipo: `slug` aponta o ícone oficial da marca (Simple Icons, carregado em
// SVG na cor da marca). `cor`/`sigla` são o fallback (bloco com a inicial)
// quando a marca não tem ícone na base ou o carregamento falha.
export const INTEGRACOES = [
  // ── ANÚNCIOS ──────────────────────────────────────────────────────────
  { id: "meta", nome: "Meta Ads", tipo: "meta", categoria: "anuncios", slug: "meta", cor: "#0866FF", sigla: "M",
    descricao: "Receba automaticamente leads dos anúncios do Facebook e Instagram." },
  { id: "google-ads", nome: "Google Ads", tipo: "em_breve", categoria: "anuncios", slug: "googleads", cor: "#4285F4", sigla: "G",
    descricao: "Receba leads gerados pelos formulários dos seus anúncios." },
  { id: "tiktok-ads", nome: "TikTok Ads", tipo: "em_breve", categoria: "anuncios", slug: "tiktok", cor: "#111111", sigla: "T",
    descricao: "Centralize contatos captados pelas campanhas do TikTok." },
  { id: "linkedin-ads", nome: "LinkedIn Ads", tipo: "em_breve", categoria: "anuncios", slug: "linkedin", cor: "#0A66C2", sigla: "in",
    descricao: "Receba leads dos formulários de campanhas profissionais." },

  // ── CRM ───────────────────────────────────────────────────────────────
  { id: "hubspot", nome: "HubSpot", tipo: "em_breve", categoria: "crm", slug: "hubspot", cor: "#FF7A59", sigla: "H",
    descricao: "Integre contatos e oportunidades do seu CRM." },
  { id: "rd-station", nome: "RD Station", tipo: "em_breve", categoria: "crm", slug: null, cor: "#19B9A7", sigla: "RD",
    descricao: "Sincronize leads e informações comerciais." },
  { id: "pipedrive", nome: "Pipedrive", tipo: "em_breve", categoria: "crm", slug: "pipedrive", cor: "#1A1A1A", sigla: "P",
    descricao: "Conecte contatos e oportunidades do funil de vendas." },
  { id: "salesforce", nome: "Salesforce", tipo: "em_breve", categoria: "crm", slug: "salesforce", cor: "#00A1E0", sigla: "S",
    descricao: "Integre dados comerciais e registros de clientes." },
  { id: "agendor", nome: "Agendor", tipo: "em_breve", categoria: "crm", slug: null, cor: "#2F80ED", sigla: "A",
    descricao: "Centralize contatos e oportunidades comerciais." },
  { id: "zoho-crm", nome: "Zoho CRM", tipo: "em_breve", categoria: "crm", slug: "zoho", cor: "#E42527", sigla: "Z",
    descricao: "Sincronize contatos e informações de vendas." },

  // ── FORMULÁRIOS E SITES ───────────────────────────────────────────────
  { id: "google-forms", nome: "Google Forms", tipo: "em_breve", categoria: "formularios", slug: "googleforms", cor: "#7248B9", sigla: "GF",
    descricao: "Receba respostas de formulários como novos leads." },
  { id: "typeform", nome: "Typeform", tipo: "em_breve", categoria: "formularios", slug: "typeform", cor: "#262627", sigla: "Tf",
    descricao: "Transforme respostas de formulários em oportunidades." },
  { id: "jotform", nome: "Jotform", tipo: "em_breve", categoria: "formularios", slug: "jotform", cor: "#FF6100", sigla: "J",
    descricao: "Centralize os contatos enviados pelos seus formulários." },
  { id: "wordpress", nome: "WordPress", tipo: "em_breve", categoria: "formularios", slug: "wordpress", cor: "#21759B", sigla: "W",
    descricao: "Receba leads captados pelo seu site." },
  { id: "webflow", nome: "Webflow", tipo: "em_breve", categoria: "formularios", slug: "webflow", cor: "#146EF5", sigla: "Wf",
    descricao: "Integre formulários e contatos do seu site." },

  // ── AUTOMAÇÕES E DESENVOLVEDORES ──────────────────────────────────────
  { id: "webhooks", nome: "Webhooks", tipo: "em_breve", categoria: "automacoes", slug: "webhooks", cor: "#6366F1", sigla: "{}",
    descricao: "Receba leads de sistemas externos automaticamente." },
  { id: "api-rycs", nome: "API RYCS", tipo: "em_breve", categoria: "automacoes", slug: null, cor: "#318CE7", sigla: "</>",
    descricao: "Conecte sistemas personalizados à plataforma." },
  { id: "zapier", nome: "Zapier", tipo: "em_breve", categoria: "automacoes", slug: "zapier", cor: "#FF4F00", sigla: "Z",
    descricao: "Automatize o envio de leads entre aplicativos." },
  { id: "make", nome: "Make", tipo: "em_breve", categoria: "automacoes", slug: "make", cor: "#6D00CC", sigla: "M",
    descricao: "Crie fluxos de integração entre diferentes ferramentas." },
  { id: "n8n", nome: "n8n", tipo: "em_breve", categoria: "automacoes", slug: "n8n", cor: "#EA4B71", sigla: "n8",
    descricao: "Conecte automações personalizadas à RYCS." },
  { id: "google-sheets", nome: "Google Sheets", tipo: "em_breve", categoria: "formularios", slug: "googlesheets", cor: "#0F9D58", sigla: "GS",
    descricao: "Importe contatos e leads de planilhas." },
];

export const rotuloCategoria = (chave) =>
  CATEGORIAS.find((c) => c.chave === chave)?.rotulo || chave;

// Deriva o status visual a partir da conexão REAL da Meta. Nunca inventa estado.
// Retorna: "conectado" | "atencao" | "nao_conectado" | "em_breve".
export function statusMeta(conexao) {
  if (!conexao) return "nao_conectado";
  if (!conexao.conectado) return "nao_conectado";
  if (conexao.status === "ativa") return "conectado";
  // conectado mas sem Página escolhida, expirado ou precisa reconfirmar
  return "atencao";
}

export const STATUS = {
  conectado:     { rotulo: "Conectado", acao: "Gerenciar", cor: "#16A34A" },
  atencao:       { rotulo: "Atenção necessária", acao: "Verificar", cor: "#D97706" },
  nao_conectado: { rotulo: "Não conectado", acao: "Conectar", cor: "#98A2B3" },
  em_breve:      { rotulo: "Em breve", acao: null, cor: "#98A2B3" },
};
