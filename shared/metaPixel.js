// Rastreamento da própria RYCS na Meta (anúncios de cadastro de profissionais
// e empresas). O ID do pixel é público — aparece no código de qualquer página
// que usa o pixel. O token da API de Conversões não: fica só no servidor.

export const META_PIXEL_ID = "1690802939434598";
// Conta de anúncios "RYCS SALES MACHINE": de onde vem o gasto no admin (Campanhas).
export const META_AD_ACCOUNT_ID = "4047463885388488";
// Página "Rycs Sales Machine": dona dos formulários instantâneos (Lead Ads) da RYCS.
export const META_PAGE_ID = "1500235606487832";

// Escolha do visitante sobre cookies de marketing. Cookie (e não
// localStorage) no domínio .rycs.pro, para valer igual em rycs.pro e no app.
export const COOKIE_CONSENTIMENTO = "rycs_consentimento";
export const CONSENTIU = "aceito";
export const RECUSOU = "recusado";

// Como cada papel aparece nos eventos da Meta (content_category), para criar
// conversões personalizadas separadas: cadastro de profissional x de empresa.
export const CATEGORIA_META = { vendedor: "profissional", empresa: "empresa" };

// ── Correspondência avançada ───────────────────────────────────────────
// Os mesmos dados, normalizados do mesmo jeito, vão pelo pixel (o navegador
// manda e a Meta faz o hash) e pela API de Conversões (o servidor faz o
// SHA-256). Assim os dois lados batem.

export const letras = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

// Telefone com DDI, só dígitos. Número brasileiro sem DDI ganha o 55.
export function normalizarTelefone(valor, pais = "BR") {
  let d = String(valor ?? "").replace(/\D/g, "");
  if (String(pais || "BR").toUpperCase() === "BR" && (d.length === 10 || d.length === 11)) d = `55${d}`;
  return d.length >= 8 && d.length <= 15 ? d : "";
}

// AAAAMMDD, a partir de "AAAA-MM-DD" ou "DD/MM/AAAA".
function normalizarNascimento(valor) {
  const v = String(valor ?? "").trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}${m[2]}${m[1]}` : "";
}

function normalizarGenero(valor) {
  const v = letras(valor);
  if (v.startsWith("fem")) return "f";
  if (v.startsWith("masc")) return "m";
  return "";
}

// Campos no formato da Meta, ainda sem hash; só os preenchidos. `idsExternos`
// liga o evento à pessoa na RYCS: id do visitante (antes da conta) e id da conta.
export function camposCorrespondencia({ email, telefone, nome, cidade, estado, pais, nascimento, genero, idsExternos = [] } = {}) {
  const c = {};
  const incluir = (chave, valor) => { if (valor) c[chave] = valor; };
  incluir("em", String(email ?? "").trim().toLowerCase());
  incluir("ph", normalizarTelefone(telefone, pais));
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length) incluir("fn", letras(partes[0]));
  if (partes.length > 1) incluir("ln", letras(partes.at(-1)));
  // O cadastro manda "Cidade, UF" no Brasil.
  incluir("ct", letras(String(cidade ?? "").split(",")[0]));
  const uf = letras(estado);
  if (uf.length === 2) incluir("st", uf);
  const p = letras(pais);
  if (p.length === 2) incluir("country", p);
  incluir("db", normalizarNascimento(nascimento));
  incluir("ge", normalizarGenero(genero));
  const ids = [...new Set(idsExternos.filter(Boolean).map(String))];
  if (ids.length) c.external_id = ids;
  return c;
}
