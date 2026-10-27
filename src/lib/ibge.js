// Estados brasileiros — 27 UFs
export const UFS = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

// Cache em memória por sigla de estado
const _cache = {};

export async function buscarMunicipios(uf) {
  if (!uf) return [];
  if (_cache[uf]) return _cache[uf];
  try {
    const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
    if (!r.ok) return capitaisFallback(uf);
    const data = await r.json();
    const lista = data.map((m) => m.nome).sort();
    _cache[uf] = lista;
    return lista;
  } catch {
    return capitaisFallback(uf);
  }
}

// Fallback com capitais caso a API do IBGE esteja indisponível
function capitaisFallback(uf) {
  const capitais = {
    AC: ["Rio Branco"], AL: ["Maceió"], AP: ["Macapá"], AM: ["Manaus"],
    BA: ["Salvador"], CE: ["Fortaleza"], DF: ["Brasília"], ES: ["Vitória"],
    GO: ["Goiânia"], MA: ["São Luís"], MT: ["Cuiabá"], MS: ["Campo Grande"],
    MG: ["Belo Horizonte"], PA: ["Belém"], PB: ["João Pessoa"], PR: ["Curitiba"],
    PE: ["Recife"], PI: ["Teresina"], RJ: ["Rio de Janeiro"], RN: ["Natal"],
    RS: ["Porto Alegre"], RO: ["Porto Velho"], RR: ["Boa Vista"], SC: ["Florianópolis"],
    SP: ["São Paulo"], SE: ["Aracaju"], TO: ["Palmas"],
  };
  return capitais[uf] || [];
}

// Coordenadas aproximadas de capitais brasileiras para geoposicionamento
export const COORDS_CAPITAIS = {
  "Rio Branco": [-9.975, -67.824], "Maceió": [-9.666, -35.735], "Macapá": [0.034, -51.066],
  "Manaus": [-3.119, -60.022], "Salvador": [-12.971, -38.501], "Fortaleza": [-3.717, -38.543],
  "Brasília": [-15.780, -47.930], "Vitória": [-20.315, -40.312], "Goiânia": [-16.686, -49.264],
  "São Luís": [-2.529, -44.303], "Cuiabá": [-15.601, -56.097], "Campo Grande": [-20.469, -54.620],
  "Belo Horizonte": [-19.917, -43.934], "Belém": [-1.455, -48.503], "João Pessoa": [-7.115, -34.863],
  "Curitiba": [-25.428, -49.273], "Recife": [-8.054, -34.881], "Teresina": [-5.091, -42.804],
  "Rio de Janeiro": [-22.906, -43.173], "Natal": [-5.793, -35.209], "Porto Alegre": [-30.034, -51.218],
  "Porto Velho": [-8.761, -63.900], "Boa Vista": [2.820, -60.672], "Florianópolis": [-27.594, -48.548],
  "São Paulo": [-23.548, -46.636], "Aracaju": [-10.910, -37.045], "Palmas": [-10.240, -48.358],
};

// Retorna coordenadas aproximadas para uma cidade/estado. Usa capital do estado como fallback.
export function coordsAproximadas(cidade, estado) {
  if (COORDS_CAPITAIS[cidade]) return COORDS_CAPITAIS[cidade];
  const uf = UFS.find((u) => u.sigla === estado);
  if (!uf) return null;
  const capital = Object.keys(COORDS_CAPITAIS).find((c) => capitaisFallback(estado).includes(c));
  return capital ? COORDS_CAPITAIS[capital] : null;
}
