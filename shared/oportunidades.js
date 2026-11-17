// Regras de alcance geográfico das campanhas (marketplace Oportunidades).
//
// A campanha declara `alcance` (nacional | internacional | ambas) e a lista
// `paisesAceitos` (ISO-2). A classificação nas abas Nacional/Internacional é
// SEMPRE relativa ao país do profissional que está olhando:
//   Nacional      = país da empresa é o mesmo do profissional e a campanha o aceita
//   Internacional = país da empresa é diferente do profissional e a campanha o aceita
// Uma campanha "ambas" aparece na Nacional (para quem é do país da empresa) e na
// Internacional (para profissionais de outros países aceitos).
//
// Compartilhado entre servidor (validação/normalização) e frontend
// (classificação para montar as abas), para a regra viver num lugar só.

import { PAISES } from "./paises.js";

export const ALCANCES = ["nacional", "internacional", "ambas"];
const ALCANCE_SET = new Set(ALCANCES);
const CODES = new Set(PAISES.map((p) => p.code));

const strip = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Mapa nome-do-país (sem acento) → código ISO-2, para resolver sellers.pais que
// é texto livre ("Brasil") contra companies.pais que é ISO-2 ("BR").
const NOME_PARA_CODE = {};
for (const p of PAISES) NOME_PARA_CODE[strip(p.nome)] = p.code;

// Aceita um código ISO-2 ("BR"), um nome ("Brasil") ou vazio → código ISO-2.
export function codigoPais(valor, fallback = "BR") {
  const v = String(valor || "").trim();
  if (!v) return fallback;
  const up = v.toUpperCase();
  if (CODES.has(up)) return up;
  const porNome = NOME_PARA_CODE[strip(v)];
  return porNome || fallback;
}

export function sanearAlcance(alcance) {
  return ALCANCE_SET.has(alcance) ? alcance : "nacional";
}

// Normaliza a lista de países aceitos conforme o alcance.
//   nacional      → sempre apenas o país da empresa
//   internacional → os países escolhidos (fallback: país da empresa)
//   ambas         → país da empresa + os escolhidos
export function sanearPaisesAceitos(lista, paisEmpresa, alcance) {
  const home = codigoPais(paisEmpresa);
  const alc = sanearAlcance(alcance);
  let arr = Array.isArray(lista)
    ? lista.map((c) => String(c || "").toUpperCase().trim()).filter((c) => CODES.has(c))
    : [];
  if (alc === "nacional") return [home];
  if (alc === "ambas" && !arr.includes(home)) arr = [home, ...arr];
  if (!arr.length) arr = [home];
  return [...new Set(arr)];
}

export function parsePaisesAceitos(valor) {
  if (Array.isArray(valor)) return valor;
  try { const a = JSON.parse(valor || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}

// Classifica uma campanha para um profissional. paisEmpresa e paisProfissional
// podem vir como código ou nome; a função normaliza.
export function classificarCampanha({ alcance, paisesAceitos, paisEmpresa, paisProfissional }) {
  const home = codigoPais(paisEmpresa);
  const prof = codigoPais(paisProfissional);
  const alc = sanearAlcance(alcance);
  const aceitos = new Set(sanearPaisesAceitos(parsePaisesAceitos(paisesAceitos), home, alc));
  const elegivel = aceitos.has(prof);
  return {
    elegivel,
    nacional: elegivel && prof === home,
    internacional: elegivel && prof !== home,
    paisEmpresa: home,
    aceitos: [...aceitos],
  };
}
