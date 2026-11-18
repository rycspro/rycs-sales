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
