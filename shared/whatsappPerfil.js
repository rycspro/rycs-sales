// Perfil público do WhatsApp da RYCS (o que aparece ao tocar no nome do número).
// Limites da Meta para cada campo; a tela do admin e o servidor usam os mesmos.

export const LIMITES_PERFIL_WHATSAPP = { about: 139, address: 256, description: 512, email: 128, website: 256, websites: 2 };

export const VERTICAIS_WHATSAPP = [
  ["UNDEFINED", "Não definida"], ["PROF_SERVICES", "Serviços profissionais"], ["EDU", "Educação"], ["FINANCE", "Finanças"],
  ["RETAIL", "Varejo"], ["AUTO", "Automotivo"], ["BEAUTY", "Beleza"], ["APPAREL", "Moda"], ["ENTERTAIN", "Entretenimento"],
  ["EVENT_PLAN", "Eventos"], ["GROCERY", "Mercado"], ["GOVT", "Governo"], ["HOTEL", "Hotelaria"], ["HEALTH", "Saúde"],
  ["NONPROFIT", "Sem fins lucrativos"], ["RESTAURANT", "Restaurante"], ["TRAVEL", "Viagens"], ["OTHER", "Outra"],
];

// Devolve { erro } ou { campos } prontos para a Meta.
export function validarPerfilWhatsapp(d = {}) {
  const L = LIMITES_PERFIL_WHATSAPP;
  const txt = (v) => String(v ?? "").trim();
  const campos = { about: txt(d.about), address: txt(d.address), description: txt(d.description), email: txt(d.email) };
  if (!campos.about) return { erro: "O recado (sobre) não pode ficar vazio." };
  for (const k of ["about", "address", "description", "email"]) {
    if (campos[k].length > L[k]) return { erro: `Texto muito longo em "${k}" (máximo ${L[k]} caracteres).` };
  }
  if (campos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.email)) return { erro: "E-mail inválido." };
  const websites = (Array.isArray(d.websites) ? d.websites : []).map(txt).filter(Boolean);
  if (websites.length > L.websites) return { erro: `No máximo ${L.websites} sites.` };
  for (const w of websites) {
    if (!/^https?:\/\/\S+$/i.test(w) || w.length > L.website) return { erro: `Site inválido: ${w}. Use o endereço completo, com https://.` };
  }
  const vertical = txt(d.vertical) || "UNDEFINED";
  if (!VERTICAIS_WHATSAPP.some(([v]) => v === vertical)) return { erro: "Categoria inválida." };
  return { campos: { ...campos, websites, vertical } };
}
