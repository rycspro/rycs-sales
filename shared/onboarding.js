// Onboarding da empresa: as seis etapas, a ordem entre elas e as regras de
// acesso que o servidor e a tela precisam aplicar igual.
//
// A especificação mora em docs/onboarding/SPEC.md. Aqui fica só o que é regra:
// quem decide em qual etapa a empresa está é sempre o servidor, a partir do
// progresso salvo. A URL apenas pede; se pedir uma etapa à frente, volta para
// a primeira não concluída.

export const ETAPAS = [
  { n: 1, chave: "acesso", label: "Acesso" },
  { n: 2, chave: "empresa", label: "Empresa" },
  { n: 3, chave: "academy", label: "Marketing Academy" },
  { n: 4, chave: "ia", label: "IA RAG" },
  { n: 5, chave: "plano", label: "Plano" },
  { n: 6, chave: "campanha", label: "Campanha" },
];

export const CHAVES_ETAPAS = ETAPAS.map((e) => e.chave);

// Etapas já entregues. Enquanto o fluxo não está completo, só elas seguram a
// empresa fora do painel: parar numa etapa que ainda não existe trancaria a
// conta sem ter o que preencher. Cada passo entregue entra nesta lista.
export const ETAPAS_PRONTAS = ["acesso", "empresa", "academy", "ia", "plano", "campanha"];

// Decide se o onboarding fica na frente do painel.
//   - Concluído: nunca.
//   - Empresa que já existia antes do onboarding: só quando o fluxo inteiro
//     estiver pronto (ou se a operação ligar isso de propósito).
//   - Demais: só se a etapa atual já foi entregue.
export function onboardingBloqueia({ etapas, origem, exigirExistentes = false }) {
  const atual = etapaAtual(etapas);
  if (!atual) return false;
  const fluxoCompleto = CHAVES_ETAPAS.every((c) => ETAPAS_PRONTAS.includes(c));
  if (origem === "existente" && !fluxoCompleto && !exigirExistentes) return false;
  return ETAPAS_PRONTAS.includes(atual.chave);
}

// Trial do link de convite "com trial". Os links sem trial e o cadastro pelo
// site começam com cobrança normal.
export const TRIAL_ONBOARDING_DIAS = 3;

export const SENHA_MIN_EMPRESA = 8;

// Intervalo mínimo entre dois links de recuperação para o mesmo e-mail.
export const REENVIO_RESET_MS = 60 * 1000;

export const CONVITE_VALIDADE_PADRAO_DIAS = 7;
export const CONVITE_VALIDADE_MAX_DIAS = 90;

export const etapaDe = (chave) => ETAPAS.find((e) => e.chave === chave) || null;

// Progresso salvo: { acesso: "concluida", empresa: "pendente", ... }.
// Qualquer chave ausente ou com valor estranho conta como pendente.
export function normalizarEtapas(etapas) {
  const base = etapas && typeof etapas === "object" ? etapas : {};
  return Object.fromEntries(CHAVES_ETAPAS.map((c) => [c, base[c] === "concluida" ? "concluida" : "pendente"]));
}

// Primeira etapa não concluída. Com tudo concluído, devolve null.
export function etapaAtual(etapas) {
  const e = normalizarEtapas(etapas);
  return ETAPAS.find((x) => e[x.chave] !== "concluida") || null;
}

export const onboardingConcluido = (etapas) => etapaAtual(etapas) === null;

// Pode abrir etapas já concluídas (para revisar) e a atual. Nunca uma à frente.
export function podeAbrirEtapa(etapas, chave) {
  const alvo = etapaDe(chave);
  if (!alvo) return false;
  const atual = etapaAtual(etapas);
  return !atual || alvo.n <= atual.n;
}

// Concluir exige que todas as anteriores estejam concluídas. Devolve o novo
// progresso, ou null quando a ordem não permite.
export function concluirEtapa(etapas, chave) {
  const alvo = etapaDe(chave);
  if (!alvo) return null;
  const e = normalizarEtapas(etapas);
  const anterioresOk = ETAPAS.filter((x) => x.n < alvo.n).every((x) => e[x.chave] === "concluida");
  if (!anterioresOk) return null;
  return { ...e, [chave]: "concluida" };
}

export function validarSenhaEmpresa(senha) {
  if (!senha || String(senha).length < SENHA_MIN_EMPRESA)
    return `A senha precisa ter pelo menos ${SENHA_MIN_EMPRESA} caracteres.`;
  return null;
}

// WhatsApp brasileiro: DDD + número (10 ou 11 dígitos), com ou sem o 55.
// Guardado só com dígitos e sempre com o 55, para o link wa.me funcionar.
export function normalizarWhatsapp(valor) {
  let d = String(valor || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!/^55\d{10,11}$/.test(d)) return null;
  return d;
}

export function formatarWhatsapp(digitos) {
  const d = String(digitos || "").replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export const podeReenviarReset = (ultimoEnvio, agora = Date.now()) =>
  !ultimoEnvio || agora - ultimoEnvio >= REENVIO_RESET_MS;

// ---------------------------------------------------------------------------
// Convite de onboarding
//
// Gerado no admin para uma empresa específica: preso a um e-mail, uso único,
// validade escolhida por quem gera, com ou sem trial. O banco guarda só o hash
// do token, como nos convites de trial.

export const MOTIVOS_CONVITE_ONBOARDING = {
  inexistente: "Este convite não existe ou o endereço está incompleto.",
  usado: "Este convite já foi utilizado.",
  expirado: "Este convite expirou. Peça um novo link à RYCS.",
  revogado: "Este convite foi cancelado. Peça um novo link à RYCS.",
  outroEmail: "Este convite foi gerado para outro e-mail.",
};

export function estadoConviteOnboarding(convite, agora = Date.now()) {
  if (!convite) return { ok: false, motivo: "inexistente" };
  if (convite.revogadoEm) return { ok: false, motivo: "revogado" };
  if (convite.usadoEm) return { ok: false, motivo: "usado" };
  if (convite.expiraEm && agora > convite.expiraEm) return { ok: false, motivo: "expirado" };
  return { ok: true };
}

export function conviteServeParaEmail(convite, email, agora = Date.now()) {
  const estado = estadoConviteOnboarding(convite, agora);
  if (!estado.ok) return estado;
  const a = String(convite.email || "").trim().toLowerCase();
  const b = String(email || "").trim().toLowerCase();
  if (!a || a !== b) return { ok: false, motivo: "outroEmail" };
  return { ok: true };
}

export function validadeConviteDias(valor) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n) || n < 1) return CONVITE_VALIDADE_PADRAO_DIAS;
  return Math.min(CONVITE_VALIDADE_MAX_DIAS, n);
}

// ---------------------------------------------------------------------------
// Etapa 2: perfil da empresa
//
// Nome, produto e público são obrigatórios; o resto é recomendado. Os textos
// longos alimentam a IA da etapa 4, então o limite é generoso.

export const TEXTO_CURTO_MAX = 100;
export const TEXTO_LONGO_MAX = 4000;

// O que a IA pode fazer sozinha numa conversa. Tudo começa desligado: a
// empresa liga o que quiser.
export const PERMISSOES_MARCA = [
  { chave: "informarPrecos", label: "Informar preços ao cliente" },
  { chave: "oferecerDescontos", label: "Oferecer descontos e condições especiais" },
  { chave: "combinarPrazos", label: "Combinar prazos de entrega ou atendimento" },
  { chave: "usarEmojis", label: "Usar emojis nas mensagens" },
];

export function normalizarPermissoes(valor) {
  const base = valor && typeof valor === "object" ? valor : {};
  return Object.fromEntries(PERMISSOES_MARCA.map((p) => [p.chave, base[p.chave] === true]));
}

// "1.490,50", "1490.5" ou "R$ 1.490" → 1490.5. Vazio ou inválido → null.
export function ticketParaNumero(valor) {
  const t = String(valor ?? "").replace(/[^\d.,]/g, "");
  if (!t) return null;
  let n;
  if (t.includes(",")) n = Number(t.replace(/\./g, "").replace(",", "."));
  else if (/\.\d{1,2}$/.test(t)) n = Number(t);
  else n = Number(t.replace(/\./g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export const formatarTicket = (n) =>
  n == null ? "" : `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Valida e limpa o que a tela mandou. Devolve { perfil, erros }; erros por
// campo, com a mensagem que a tela mostra.
export function validarPerfilEmpresa(dados = {}) {
  const txt = (v, max) => String(v ?? "").trim().slice(0, max);
  const perfil = {
    nome: txt(dados.nome, TEXTO_CURTO_MAX),
    produto: txt(dados.produto, TEXTO_LONGO_MAX),
    ticket: null,
    nicho: txt(dados.nicho, TEXTO_LONGO_MAX),
    diferencial: txt(dados.diferencial, TEXTO_LONGO_MAX),
    publico: txt(dados.publico, TEXTO_LONGO_MAX),
    regrasMarca: txt(dados.regrasMarca, TEXTO_LONGO_MAX),
    permissoesMarca: normalizarPermissoes(dados.permissoesMarca),
  };
  const erros = {};
  if (perfil.nome.length < 2) erros.nome = "Informe o nome da empresa.";
  if (perfil.produto.length < 3) erros.produto = "Conte o que a empresa vende.";
  if (perfil.publico.length < 3) erros.publico = "Conte para quem a empresa vende.";
  if (String(dados.ticket ?? "").trim()) {
    perfil.ticket = ticketParaNumero(dados.ticket);
    if (perfil.ticket == null) erros.ticket = "Informe o valor em reais, por exemplo 1.490,00.";
  }
  return { perfil, erros };
}

// Logo: PNG ou SVG (de preferência com fundo transparente); JPG e WebP também
// passam. Guardado como data URI, como o logo que a plataforma já usa.
export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_TIPOS = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];

export function avaliarLogo({ mimetype, tamanhoBytes, svgTexto = "" }) {
  if (!LOGO_TIPOS.includes(mimetype)) return "Use PNG ou SVG (JPG e WebP também funcionam).";
  if (!(tamanhoBytes > 0) || tamanhoBytes > LOGO_MAX_BYTES) return "O logo precisa ter até 1 MB.";
  // SVG é texto e pode carregar script. Num <img> ele não roda, mas o arquivo
  // fica guardado: melhor recusar do que guardar algo ativo.
  if (mimetype === "image/svg+xml" && /<script|\son\w+\s*=|javascript:|<foreignObject/i.test(svgTexto))
    return "Este SVG tem conteúdo ativo (script). Exporte o logo de novo ou envie em PNG.";
  return null;
}

// ---------------------------------------------------------------------------
// Etapa 3: Marketing Academy
//
// Limites por tipo definidos com o dono do produto. A extensão decide o tipo:
// o navegador manda mimetype vazio para .key, .m4a e outros.

const MB = 1024 * 1024;

export const CATEGORIAS_ACADEMY = [
  { chave: "apresentacao", label: "Apresentações", formatos: ["pdf", "ppt", "pptx", "key"], limite: 50 * MB },
  { chave: "material", label: "Material explicativo detalhado", formatos: ["pdf", "doc", "docx", "xls", "xlsx", "txt"], limite: 50 * MB },
  { chave: "foto", label: "Fotos", formatos: ["jpg", "jpeg", "png", "webp"], limite: 20 * MB },
  { chave: "video", label: "Vídeos", formatos: ["mp4", "mov"], limite: 500 * MB },
  { chave: "audio", label: "Áudios", formatos: ["mp3", "wav", "m4a"], limite: 100 * MB },
];

export const categoriaAcademy = (chave) => CATEGORIAS_ACADEMY.find((c) => c.chave === chave) || null;

export const extensaoDe = (nome) => (String(nome || "").toLowerCase().match(/\.([a-z0-9]{1,5})$/) || [])[1] || "";

export const formatarTamanho = (bytes) =>
  bytes >= MB ? `${(bytes / MB).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function validarArquivoAcademy({ categoria, nome, tamanho }) {
  const cat = categoriaAcademy(categoria);
  if (!cat) return "Tipo de material inválido.";
  const ext = extensaoDe(nome);
  if (!cat.formatos.includes(ext)) return `${cat.label}: use ${cat.formatos.map((f) => f.toUpperCase()).join(", ")}.`;
  if (!(tamanho > 0)) return "O arquivo está vazio.";
  if (tamanho > cat.limite) return `${cat.label}: até ${formatarTamanho(cat.limite)} por arquivo.`;
  return null;
}

// Só aceita http(s), sem credenciais embutidas na URL.
export function normalizarLink(valor) {
  let texto = String(valor || "").trim();
  if (!texto) return null;
  if (!/^https?:\/\//i.test(texto)) texto = `https://${texto}`;
  try {
    const u = new URL(texto);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || !u.hostname.includes(".")) return null;
    return u.toString().slice(0, 2000);
  } catch { return null; }
}

const EMAIL_SUPORTE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Contato para quem a IA encaminha quando precisa de uma pessoa. Opcional,
// mas quem começar a preencher precisa de pelo menos um meio de contato.
export function validarSuporte(dados = {}) {
  const suporte = {
    nome: String(dados.nome || "").trim().slice(0, 100),
    whatsapp: dados.whatsapp ? normalizarWhatsapp(dados.whatsapp) : "",
    email: String(dados.email || "").trim().toLowerCase().slice(0, 200),
  };
  const erros = {};
  if (dados.whatsapp && !suporte.whatsapp) erros.whatsapp = "Informe um WhatsApp válido, com DDD.";
  if (suporte.email && !EMAIL_SUPORTE.test(suporte.email)) erros.email = "Informe um e-mail válido.";
  if (suporte.nome && !suporte.whatsapp && !suporte.email && !erros.whatsapp)
    erros.whatsapp = "Informe o WhatsApp ou o e-mail do contato.";
  return { suporte: { ...suporte, whatsapp: suporte.whatsapp || "" }, erros };
}

// ---------------------------------------------------------------------------
// Etapa 4: IA RAG

export const FASES_IA = [
  { chave: "analise", titulo: "Analisando as informações", frase: "Lendo o perfil da empresa e os materiais enviados." },
  { chave: "script", titulo: "Criando o script", frase: "Montando abertura, qualificação, oferta e fechamento." },
  { chave: "funil", titulo: "Criando as estratégias do funil de WhatsApp", frase: "Desenhando cada etapa da conversa, das boas-vindas ao fechamento." },
  { chave: "followups", titulo: "Criando os follow-ups", frase: "Escrevendo as mensagens de retomada e quando enviar cada uma." },
  { chave: "aprovacao", titulo: "Aguardando a sua aprovação", frase: "Tudo pronto para você revisar." },
];

// As três partes que o dono aprova. Nada fica ativo antes disso.
export const PARTES_IA = [
  { chave: "script", label: "Script de vendas", campos: [["abertura", "Abertura"], ["qualificacao", "Qualificação"], ["oferta", "Oferta"], ["fechamento", "Fechamento"]] },
  { chave: "funil", label: "Funil de WhatsApp", campos: [["boasVindas", "Boas-vindas"], ["qualificacao", "Qualificação"], ["oferta", "Oferta"], ["objecoes", "Objeções"], ["fechamento", "Fechamento"]] },
  { chave: "followups", label: "Follow-ups" },
];

export const VARIAVEIS_IA = ["{nome}", "{empresa}", "{produto}", "{ticket}", "{diferencial}", "{contato de suporte}"];

// Fases de geração (sem a de aprovação), na ordem em que rodam.
export const FASES_GERACAO = FASES_IA.filter((f) => f.chave !== "aprovacao").map((f) => f.chave);

export function proximaFase(fases = {}) {
  return FASES_GERACAO.find((f) => fases[f] !== "concluida") || null;
}

// Conteúdo editado pelo dono: mantém só os campos conhecidos, como texto.
export function normalizarParte(parte, conteudo) {
  const def = PARTES_IA.find((p) => p.chave === parte);
  if (!def) return null;
  if (parte === "followups") {
    const lista = Array.isArray(conteudo) ? conteudo : [];
    return lista.slice(0, 12).map((f) => ({
      quando: String(f?.quando || "").trim().slice(0, 80),
      mensagem: String(f?.mensagem || "").trim().slice(0, 2000),
    })).filter((f) => f.quando && f.mensagem);
  }
  const base = conteudo && typeof conteudo === "object" ? conteudo : {};
  return Object.fromEntries(def.campos.map(([c]) => [c, String(base[c] || "").trim().slice(0, 4000)]));
}

export function parteCompleta(parte, conteudo) {
  if (parte === "followups") return Array.isArray(conteudo) && conteudo.length > 0;
  const def = PARTES_IA.find((p) => p.chave === parte);
  return !!def && def.campos.every(([c]) => String(conteudo?.[c] || "").trim());
}

// ---------------------------------------------------------------------------
// Etapa 5: documento do titular (CPF ou CNPJ, só dígitos)

export function normalizarDocumento(valor) {
  const d = String(valor || "").replace(/\D/g, "");
  return d.length === 11 || d.length === 14 ? d : null;
}
