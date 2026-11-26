// Loja de Leads — busca de contatos comerciais via Google Places API (New).
//
// A empresa ou profissional pesquisa por categoria + região e recebe nome,
// telefone, endereço e site. Cada contato revelado é uma unidade de consumo;
// a cobrança é pós-paga por ciclo de 30 dias.

import db, { uid, agora } from "../db.js";

// ── Schema (aditivo, idempotente) ───────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS loja_leads_contatos (
    id TEXT PRIMARY KEY,
    placeId TEXT UNIQUE NOT NULL,
    nome TEXT DEFAULT '',
    telefone TEXT DEFAULT '',
    endereco TEXT DEFAULT '',
    site TEXT DEFAULT '',
    categoria TEXT DEFAULT '',
    cidade TEXT DEFAULT '',
    estado TEXT DEFAULT '',
    lat REAL,
    lng REAL,
    rating REAL,
    totalAvaliacoes INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_loja_contatos_place ON loja_leads_contatos(placeId);
  CREATE INDEX IF NOT EXISTS idx_loja_contatos_cat ON loja_leads_contatos(categoria, cidade);

  CREATE TABLE IF NOT EXISTS loja_leads_pastas (
    id TEXT PRIMARY KEY,
    entityId TEXT NOT NULL,
    entityRole TEXT NOT NULL,
    nome TEXT NOT NULL,
    cor TEXT DEFAULT '#2563EB',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_loja_pastas_entity ON loja_leads_pastas(entityId, entityRole);

  CREATE TABLE IF NOT EXISTS loja_leads_listas (
    id TEXT PRIMARY KEY,
    pastaId TEXT NOT NULL,
    entityId TEXT NOT NULL,
    entityRole TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    FOREIGN KEY (pastaId) REFERENCES loja_leads_pastas(id)
  );
  CREATE INDEX IF NOT EXISTS idx_loja_listas_pasta ON loja_leads_listas(pastaId);

  CREATE TABLE IF NOT EXISTS loja_leads_lista_contatos (
    listaId TEXT NOT NULL,
    contatoId TEXT NOT NULL,
    adicionadoEm INTEGER NOT NULL,
    PRIMARY KEY (listaId, contatoId),
    FOREIGN KEY (listaId) REFERENCES loja_leads_listas(id),
    FOREIGN KEY (contatoId) REFERENCES loja_leads_contatos(id)
  );

  CREATE TABLE IF NOT EXISTS loja_leads_historico (
    id TEXT PRIMARY KEY,
    contatoId TEXT NOT NULL,
    entityId TEXT NOT NULL,
    vendedorId TEXT,
    vendedorNome TEXT DEFAULT '',
    vendedorFoto TEXT DEFAULT '',
    tipo TEXT DEFAULT 'nota',
    texto TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (contatoId) REFERENCES loja_leads_contatos(id)
  );
  CREATE INDEX IF NOT EXISTS idx_loja_hist_contato ON loja_leads_historico(contatoId, criadoEm);

  CREATE TABLE IF NOT EXISTS loja_leads_responsavel (
    contatoId TEXT NOT NULL,
    entityId TEXT NOT NULL,
    vendedorId TEXT NOT NULL,
    vendedorNome TEXT DEFAULT '',
    vendedorFoto TEXT DEFAULT '',
    atribuidoEm INTEGER NOT NULL,
    PRIMARY KEY (contatoId, entityId)
  );

  CREATE TABLE IF NOT EXISTS loja_leads_consumo (
    id TEXT PRIMARY KEY,
    entityId TEXT NOT NULL,
    entityRole TEXT NOT NULL,
    contatoId TEXT NOT NULL,
    criadoEm INTEGER NOT NULL,
    UNIQUE(entityId, contatoId)
  );
  CREATE INDEX IF NOT EXISTS idx_loja_consumo_entity ON loja_leads_consumo(entityId, criadoEm);

  CREATE TABLE IF NOT EXISTS loja_leads_ciclos (
    id TEXT PRIMARY KEY,
    entityId TEXT NOT NULL,
    entityRole TEXT NOT NULL,
    inicio INTEGER NOT NULL,
    fim INTEGER NOT NULL,
    totalContatos INTEGER DEFAULT 0,
    valorUnitario REAL DEFAULT 0,
    valorTotal REAL DEFAULT 0,
    status TEXT DEFAULT 'aberto',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_loja_ciclos_entity ON loja_leads_ciclos(entityId, status);

  CREATE TABLE IF NOT EXISTS loja_leads_precos (
    id TEXT PRIMARY KEY,
    faixa TEXT NOT NULL,
    valorUnitario REAL NOT NULL,
    ativo INTEGER DEFAULT 1,
    criadoEm INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS loja_leads_vinculos (
    id TEXT PRIMARY KEY,
    listaId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    modo TEXT NOT NULL DEFAULT 'pontual',
    totalCopiados INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    FOREIGN KEY (listaId) REFERENCES loja_leads_listas(id)
  );
  CREATE INDEX IF NOT EXISTS idx_loja_vinculos_lista ON loja_leads_vinculos(listaId);
  CREATE INDEX IF NOT EXISTS idx_loja_vinculos_campanha ON loja_leads_vinculos(campaignId);
`);

// Preços padrão se a tabela estiver vazia (admin pode alterar depois)
{
  const tem = db.prepare("SELECT COUNT(*) n FROM loja_leads_precos").get().n;
  if (!tem) {
    const ts = agora();
    const ins = db.prepare("INSERT INTO loja_leads_precos (id, faixa, valorUnitario, ativo, criadoEm) VALUES (?, ?, ?, 1, ?)");
    ins.run(uid(), "1-100", 0.50, ts);
    ins.run(uid(), "101-500", 0.40, ts);
    ins.run(uid(), "501+", 0.30, ts);
  }
}

// ── Migração: revelar contatos órfãos que estão em listas mas sem consumo ──
{
  const orfaos = db.prepare(`
    SELECT DISTINCT lc.contatoId, l.entityId, l.entityRole
    FROM loja_leads_lista_contatos lc
    JOIN loja_leads_listas l ON l.id = lc.listaId
    LEFT JOIN loja_leads_consumo co ON co.contatoId = lc.contatoId AND co.entityId = l.entityId
    WHERE co.id IS NULL
  `).all();
  if (orfaos.length) {
    const ins = db.prepare("INSERT OR IGNORE INTO loja_leads_consumo (id, entityId, entityRole, contatoId, criadoEm) VALUES (?, ?, ?, ?, ?)");
    const ts = agora();
    for (const o of orfaos) ins.run(uid(), o.entityId, o.entityRole, o.contatoId, ts);
  }
}

// ── Migração: sub-listas (parentId) ──
{
  const cols = db.pragma("table_info(loja_leads_listas)").map((c) => c.name);
  if (!cols.includes("parentId")) {
    db.exec("ALTER TABLE loja_leads_listas ADD COLUMN parentId TEXT DEFAULT NULL");
  }
}

// ── Google Places API (New) ─────────────────────────────────────────────────
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

export async function buscarPlaces(textQuery, { regiao, quantidade } = {}) {
  if (!PLACES_KEY) return { error: "Chave da API Google Places não configurada no servidor." };
  if (!textQuery) return { error: "Informe o que buscar." };

  const total = Math.max(quantidade || 20, 1);
  const url = "https://places.googleapis.com/v1/places:searchText";
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": PLACES_KEY,
    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.location,nextPageToken",
  };

  const todos = [];
  const vistos = new Set();
  let nextToken = null;
  const maxPaginas = 50;

  try {
    for (let pg = 0; pg < maxPaginas && todos.length < total; pg++) {
      const pedido = Math.min(total - todos.length, 20);
      const body = {
        textQuery: regiao ? `${textQuery} em ${regiao}` : textQuery,
        languageCode: "pt-BR",
        maxResultCount: pedido,
      };
      if (nextToken) body.pageToken = nextToken;

      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text();
        console.error("[loja-leads] Places API erro:", res.status, txt);
        if (!todos.length) return { error: `Erro na API do Google Places (${res.status}).` };
        break;
      }
      const data = await res.json();
      for (const p of (data.places || [])) {
        if (vistos.has(p.id)) continue;
        vistos.add(p.id);
        todos.push(normalizar(p));
        if (todos.length >= total) break;
      }
      nextToken = data.nextPageToken || null;
      if (!nextToken) break;
    }
    return { contatos: todos };
  } catch (e) {
    console.error("[loja-leads] Places fetch erro:", e.message);
    if (todos.length) return { contatos: todos };
    return { error: "Falha ao conectar com a API do Google Places." };
  }
}

const TIPOS_GENERICOS = new Set(["point_of_interest", "establishment", "place", "premise", "street_address", "route", "political", "locality", "sublocality"]);
const TIPO_PT = {
  restaurant: "Restaurante", cafe: "Café", bar: "Bar", bakery: "Padaria",
  food: "Alimentação", meal_delivery: "Delivery", meal_takeaway: "Takeaway",
  dentist: "Dentista", doctor: "Médico", hospital: "Hospital", pharmacy: "Farmácia",
  health: "Saúde", physiotherapist: "Fisioterapeuta", veterinary_care: "Veterinário",
  gym: "Academia", spa: "Spa",
  real_estate_agency: "Imobiliária", insurance_agency: "Seguradora",
  lawyer: "Advocacia", accounting: "Contabilidade", finance: "Financeiro",
  hair_care: "Salão de beleza", beauty_salon: "Salão de beleza",
  clothing_store: "Loja de roupas", shoe_store: "Loja de calçados",
  shopping_mall: "Shopping", store: "Loja", supermarket: "Supermercado",
  convenience_store: "Conveniência", electronics_store: "Eletrônicos",
  furniture_store: "Móveis", hardware_store: "Ferragem", jewelry_store: "Joalheria",
  home_goods_store: "Casa e decoração", pet_store: "Pet shop",
  car_dealer: "Concessionária", car_repair: "Oficina mecânica", car_wash: "Lava-jato",
  gas_station: "Posto de combustível",
  lodging: "Hospedagem", hotel: "Hotel",
  school: "Escola", university: "Universidade",
  church: "Igreja", mosque: "Mesquita",
  plumber: "Encanador", electrician: "Eletricista", painter: "Pintor",
  roofing_contractor: "Telhados", locksmith: "Chaveiro",
  moving_company: "Mudanças", storage: "Armazenamento",
  travel_agency: "Agência de viagens",
  laundry: "Lavanderia",
  manufacturer: "Indústria",
  general_contractor: "Empreiteira",
};

function categoriaPt(types) {
  if (!types?.length) return "";
  const especifico = types.find((t) => !TIPOS_GENERICOS.has(t));
  const tipo = especifico || types[0];
  return TIPO_PT[tipo] || tipo.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizar(p) {
  return {
    placeId: p.id || "",
    nome: p.displayName?.text || "",
    telefone: p.nationalPhoneNumber || p.internationalPhoneNumber || "",
    endereco: p.formattedAddress || "",
    site: p.websiteUri || "",
    categoria: categoriaPt(p.types),
    lat: p.location?.latitude || null,
    lng: p.location?.longitude || null,
    rating: p.rating || 0,
    totalAvaliacoes: p.userRatingCount || 0,
  };
}

// ── Salvar contatos no cache ────────────────────────────────────────────────
export function salvarContatos(contatos) {
  const ts = agora();
  const upsert = db.prepare(`
    INSERT INTO loja_leads_contatos (id, placeId, nome, telefone, endereco, site, categoria, lat, lng, rating, totalAvaliacoes, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(placeId) DO UPDATE SET
      nome=excluded.nome, telefone=excluded.telefone, endereco=excluded.endereco,
      site=excluded.site, rating=excluded.rating, totalAvaliacoes=excluded.totalAvaliacoes,
      atualizadoEm=excluded.atualizadoEm
  `);
  const ids = [];
  for (const c of contatos) {
    const id = uid();
    upsert.run(id, c.placeId, c.nome, c.telefone, c.endereco, c.site, c.categoria, c.lat, c.lng, c.rating, c.totalAvaliacoes, ts, ts);
    const row = db.prepare("SELECT id FROM loja_leads_contatos WHERE placeId = ?").get(c.placeId);
    ids.push(row?.id || id);
  }
  return ids;
}

// ── Registrar consumo (revelar contato) ─────────────────────────────────────
export function revelarContato(entityId, entityRole, contatoId) {
  const ja = db.prepare("SELECT id FROM loja_leads_consumo WHERE entityId = ? AND contatoId = ?").get(entityId, contatoId);
  if (ja) return { jaRevelado: true };

  const contato = db.prepare("SELECT * FROM loja_leads_contatos WHERE id = ?").get(contatoId);
  if (!contato) return { error: "Contato não encontrado." };

  const ts = agora();
  db.prepare("INSERT INTO loja_leads_consumo (id, entityId, entityRole, contatoId, criadoEm) VALUES (?, ?, ?, ?, ?)")
    .run(uid(), entityId, entityRole, contatoId, ts);

  return { ok: true, contato };
}

// ── Contatos já revelados ───────────────────────────────────────────────────
export function contatosRevelados(entityId) {
  const rows = db.prepare(`
    SELECT c.*, r.criadoEm AS reveladoEm,
      resp.vendedorId AS respVendedorId, resp.vendedorNome AS respNome, resp.vendedorFoto AS respFoto
    FROM loja_leads_contatos c
    JOIN loja_leads_consumo r ON r.contatoId = c.id
    LEFT JOIN loja_leads_responsavel resp ON resp.contatoId = c.id AND resp.entityId = r.entityId
    WHERE r.entityId = ?
    ORDER BY r.criadoEm DESC
  `).all(entityId);
  for (const row of rows) {
    const ls = db.prepare(`
      SELECT l.id, l.nome, p.nome AS pastaNome FROM loja_leads_lista_contatos lc
      JOIN loja_leads_listas l ON l.id = lc.listaId
      JOIN loja_leads_pastas p ON p.id = l.pastaId
      WHERE lc.contatoId = ? AND l.entityId = ?
    `).all(row.id, entityId);
    row.listas = ls;
  }
  return rows;
}

export function historicoContato(contatoId, entityId) {
  return db.prepare("SELECT * FROM loja_leads_historico WHERE contatoId = ? AND entityId = ? ORDER BY criadoEm DESC").all(contatoId, entityId);
}

export function adicionarHistorico(contatoId, entityId, { vendedorId, vendedorNome, vendedorFoto, tipo, texto }) {
  const id = uid();
  const ts = agora();
  db.prepare("INSERT INTO loja_leads_historico (id, contatoId, entityId, vendedorId, vendedorNome, vendedorFoto, tipo, texto, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, contatoId, entityId, vendedorId || null, vendedorNome || "", vendedorFoto || "", tipo || "nota", texto || "", ts);
  return { id, criadoEm: ts };
}

export function atribuirResponsavel(contatoId, entityId, { vendedorId, vendedorNome, vendedorFoto }) {
  const ts = agora();
  db.prepare("INSERT OR REPLACE INTO loja_leads_responsavel (contatoId, entityId, vendedorId, vendedorNome, vendedorFoto, atribuidoEm) VALUES (?, ?, ?, ?, ?, ?)")
    .run(contatoId, entityId, vendedorId, vendedorNome || "", vendedorFoto || "", ts);
  return { ok: true };
}

export function removerResponsavel(contatoId, entityId) {
  db.prepare("DELETE FROM loja_leads_responsavel WHERE contatoId = ? AND entityId = ?").run(contatoId, entityId);
  return { ok: true };
}

// ── Consumo do período ──────────────────────────────────────────────────────
export function resumoConsumo(entityId) {
  const total = db.prepare("SELECT COUNT(*) n FROM loja_leads_consumo WHERE entityId = ?").get(entityId)?.n || 0;
  const trintaDias = agora() - 30 * 24 * 3600 * 1000;
  const periodo = db.prepare("SELECT COUNT(*) n FROM loja_leads_consumo WHERE entityId = ? AND criadoEm > ?").get(entityId, trintaDias)?.n || 0;
  const precos = db.prepare("SELECT * FROM loja_leads_precos WHERE ativo = 1 ORDER BY criadoEm").all();
  return { total, periodo, precos };
}

// ── Pastas ──────────────────────────────────────────────────────────────────
export function listarPastas(entityId, entityRole) {
  const pastas = db.prepare("SELECT * FROM loja_leads_pastas WHERE entityId = ? AND entityRole = ? ORDER BY criadoEm").all(entityId, entityRole);
  for (const p of pastas) {
    p.totalListas = db.prepare("SELECT COUNT(*) n FROM loja_leads_listas WHERE pastaId = ?").get(p.id)?.n || 0;
    p.totalContatos = db.prepare("SELECT COUNT(DISTINCT lc.contatoId) n FROM loja_leads_lista_contatos lc JOIN loja_leads_listas l ON l.id = lc.listaId WHERE l.pastaId = ?").get(p.id)?.n || 0;
  }
  return pastas;
}

export function criarPasta(entityId, entityRole, nome, cor) {
  const ts = agora();
  const id = uid();
  db.prepare("INSERT INTO loja_leads_pastas (id, entityId, entityRole, nome, cor, criadoEm, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, entityId, entityRole, nome || "Nova pasta", cor || "#2563EB", ts, ts);
  return { id, nome, cor };
}

// ── Listas ──────────────────────────────────────────────────────────────────
export function listarListas(pastaId) {
  const listas = db.prepare("SELECT * FROM loja_leads_listas WHERE pastaId = ? ORDER BY criadoEm").all(pastaId);
  for (const l of listas) {
    l.totalContatos = db.prepare("SELECT COUNT(*) n FROM loja_leads_lista_contatos WHERE listaId = ?").get(l.id)?.n || 0;
    l.subListas = db.prepare("SELECT * FROM loja_leads_listas WHERE parentId = ? ORDER BY criadoEm").all(l.id);
    for (const s of l.subListas) {
      s.totalContatos = db.prepare("SELECT COUNT(*) n FROM loja_leads_lista_contatos WHERE listaId = ?").get(s.id)?.n || 0;
    }
  }
  return listas.filter((l) => !l.parentId);
}

export function criarLista(pastaId, entityId, entityRole, nome, descricao, parentId) {
  const pasta = db.prepare("SELECT * FROM loja_leads_pastas WHERE id = ? AND entityId = ?").get(pastaId, entityId);
  if (!pasta) return { error: "Pasta não encontrada." };
  if (parentId) {
    const pai = db.prepare("SELECT id FROM loja_leads_listas WHERE id = ? AND pastaId = ?").get(parentId, pastaId);
    if (!pai) return { error: "Lista pai não encontrada." };
  }
  const ts = agora();
  const id = uid();
  db.prepare("INSERT INTO loja_leads_listas (id, pastaId, entityId, entityRole, nome, descricao, parentId, criadoEm, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, pastaId, entityId, entityRole, nome || "Nova lista", descricao || "", parentId || null, ts, ts);
  return { id, nome };
}

export function adicionarContatoLista(listaId, contatoId) {
  const ts = agora();
  try {
    db.prepare("INSERT OR IGNORE INTO loja_leads_lista_contatos (listaId, contatoId, adicionadoEm) VALUES (?, ?, ?)").run(listaId, contatoId, ts);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}

export function contatosDaLista(listaId) {
  return db.prepare(`
    SELECT c.* FROM loja_leads_contatos c
    JOIN loja_leads_lista_contatos lc ON lc.contatoId = c.id
    WHERE lc.listaId = ?
    ORDER BY lc.adicionadoEm DESC
  `).all(listaId);
}

// ── Renomear / excluir pasta ────────────────────────────────────────────────
export function renomearPasta(pastaId, entityId, nome, cor) {
  const pasta = db.prepare("SELECT * FROM loja_leads_pastas WHERE id = ? AND entityId = ?").get(pastaId, entityId);
  if (!pasta) return { error: "Pasta não encontrada." };
  const ts = agora();
  if (nome) db.prepare("UPDATE loja_leads_pastas SET nome = ?, atualizadoEm = ? WHERE id = ?").run(nome, ts, pastaId);
  if (cor) db.prepare("UPDATE loja_leads_pastas SET cor = ?, atualizadoEm = ? WHERE id = ?").run(cor, ts, pastaId);
  return { ok: true };
}

export function excluirPasta(pastaId, entityId) {
  const pasta = db.prepare("SELECT * FROM loja_leads_pastas WHERE id = ? AND entityId = ?").get(pastaId, entityId);
  if (!pasta) return { error: "Pasta não encontrada." };
  const listas = db.prepare("SELECT id FROM loja_leads_listas WHERE pastaId = ?").all(pastaId);
  db.transaction(() => {
    for (const l of listas) {
      db.prepare("DELETE FROM loja_leads_lista_contatos WHERE listaId = ?").run(l.id);
    }
    db.prepare("DELETE FROM loja_leads_listas WHERE pastaId = ?").run(pastaId);
    db.prepare("DELETE FROM loja_leads_pastas WHERE id = ?").run(pastaId);
  })();
  return { ok: true };
}

// ── Renomear / excluir lista ────────────────────────────────────────────────
export function renomearLista(listaId, entityId, nome, descricao) {
  const lista = db.prepare("SELECT * FROM loja_leads_listas WHERE id = ? AND entityId = ?").get(listaId, entityId);
  if (!lista) return { error: "Lista não encontrada." };
  const ts = agora();
  if (nome !== undefined) db.prepare("UPDATE loja_leads_listas SET nome = ?, atualizadoEm = ? WHERE id = ?").run(nome, ts, listaId);
  if (descricao !== undefined) db.prepare("UPDATE loja_leads_listas SET descricao = ?, atualizadoEm = ? WHERE id = ?").run(descricao, ts, listaId);
  return { ok: true };
}

export function excluirLista(listaId, entityId) {
  const lista = db.prepare("SELECT * FROM loja_leads_listas WHERE id = ? AND entityId = ?").get(listaId, entityId);
  if (!lista) return { error: "Lista não encontrada." };
  db.transaction(() => {
    db.prepare("DELETE FROM loja_leads_lista_contatos WHERE listaId = ?").run(listaId);
    db.prepare("DELETE FROM loja_leads_listas WHERE id = ?").run(listaId);
  })();
  return { ok: true };
}

export function removerContatoLista(listaId, contatoId) {
  db.prepare("DELETE FROM loja_leads_lista_contatos WHERE listaId = ? AND contatoId = ?").run(listaId, contatoId);
  return { ok: true };
}

// ── Ciclos de faturamento (Lote 3) ──────────────────────────────────────────
export function cicloAtual(entityId, entityRole) {
  let ciclo = db.prepare("SELECT * FROM loja_leads_ciclos WHERE entityId = ? AND entityRole = ? AND status = 'aberto' ORDER BY criadoEm DESC LIMIT 1").get(entityId, entityRole);
  if (!ciclo) {
    const ts = agora();
    const id = uid();
    const fim = ts + 30 * 24 * 3600 * 1000;
    db.prepare("INSERT INTO loja_leads_ciclos (id, entityId, entityRole, inicio, fim, totalContatos, valorUnitario, valorTotal, status, criadoEm, atualizadoEm) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 'aberto', ?, ?)")
      .run(id, entityId, entityRole, ts, fim, ts, ts);
    ciclo = db.prepare("SELECT * FROM loja_leads_ciclos WHERE id = ?").get(id);
  }
  // Recalcular totais
  const contatos = db.prepare("SELECT COUNT(*) n FROM loja_leads_consumo WHERE entityId = ? AND criadoEm >= ? AND criadoEm <= ?").get(entityId, ciclo.inicio, ciclo.fim)?.n || 0;
  const preco = calcularPrecoUnitario(contatos);
  const total = contatos * preco;
  if (contatos !== ciclo.totalContatos || Math.abs(total - ciclo.valorTotal) > 0.001) {
    db.prepare("UPDATE loja_leads_ciclos SET totalContatos = ?, valorUnitario = ?, valorTotal = ?, atualizadoEm = ? WHERE id = ?")
      .run(contatos, preco, total, agora(), ciclo.id);
    ciclo.totalContatos = contatos;
    ciclo.valorUnitario = preco;
    ciclo.valorTotal = total;
  }
  return ciclo;
}

function calcularPrecoUnitario(qtd) {
  const precos = db.prepare("SELECT * FROM loja_leads_precos WHERE ativo = 1 ORDER BY criadoEm").all();
  if (!precos.length) return 0.50;
  for (const p of precos) {
    const [min, max] = p.faixa.replace("+", "-999999").split("-").map(Number);
    if (qtd >= min && qtd <= (max || 999999)) return p.valorUnitario;
  }
  return precos[precos.length - 1].valorUnitario;
}

export function historicoFaturas(entityId, entityRole) {
  return db.prepare("SELECT * FROM loja_leads_ciclos WHERE entityId = ? AND entityRole = ? ORDER BY criadoEm DESC").all(entityId, entityRole);
}

export function fecharCiclo(cicloId) {
  const ciclo = db.prepare("SELECT * FROM loja_leads_ciclos WHERE id = ?").get(cicloId);
  if (!ciclo) return { error: "Ciclo não encontrado." };
  if (ciclo.status !== "aberto") return { error: "Ciclo já fechado." };
  db.prepare("UPDATE loja_leads_ciclos SET status = 'fechado', atualizadoEm = ? WHERE id = ?").run(agora(), cicloId);
  return { ok: true };
}

// ── Admin: visão geral e gestão de preços ───────────────────────────────────
export function adminResumo() {
  const totalContatos = db.prepare("SELECT COUNT(*) n FROM loja_leads_contatos").get().n;
  const totalConsumo = db.prepare("SELECT COUNT(*) n FROM loja_leads_consumo").get().n;
  const totalUsuarios = db.prepare("SELECT COUNT(DISTINCT entityId) n FROM loja_leads_consumo").get().n;
  const trintaDias = agora() - 30 * 24 * 3600 * 1000;
  const consumoMes = db.prepare("SELECT COUNT(*) n FROM loja_leads_consumo WHERE criadoEm > ?").get(trintaDias).n;
  const ciclosAbertos = db.prepare("SELECT COUNT(*) n FROM loja_leads_ciclos WHERE status = 'aberto'").get().n;
  const faturamento = db.prepare("SELECT SUM(valorTotal) s FROM loja_leads_ciclos WHERE status = 'fechado'").get()?.s || 0;
  const topUsuarios = db.prepare(`
    SELECT entityId, entityRole, COUNT(*) n FROM loja_leads_consumo
    GROUP BY entityId ORDER BY n DESC LIMIT 10
  `).all();
  return { totalContatos, totalConsumo, totalUsuarios, consumoMes, ciclosAbertos, faturamento, topUsuarios };
}

export function adminAtualizarPreco(id, valorUnitario) {
  const preco = db.prepare("SELECT * FROM loja_leads_precos WHERE id = ?").get(id);
  if (!preco) return { error: "Preço não encontrado." };
  db.prepare("UPDATE loja_leads_precos SET valorUnitario = ? WHERE id = ?").run(valorUnitario, id);
  return { ok: true };
}

export function adminListarCiclos(status) {
  if (status) return db.prepare("SELECT * FROM loja_leads_ciclos WHERE status = ? ORDER BY criadoEm DESC LIMIT 100").all(status);
  return db.prepare("SELECT * FROM loja_leads_ciclos ORDER BY criadoEm DESC LIMIT 100").all();
}

// ── Preços (admin) ──────────────────────────────────────────────────────────
export function listarPrecos() {
  return db.prepare("SELECT * FROM loja_leads_precos WHERE ativo = 1 ORDER BY criadoEm").all();
}

// ── Vincular lista à campanha ──────────────────────────────────────────────
export function vincularListaCampanha(listaId, campaignId, companyId, modo = "pontual") {
  const lista = db.prepare("SELECT * FROM loja_leads_listas WHERE id = ?").get(listaId);
  if (!lista) return { error: "Lista não encontrada." };

  const campanha = db.prepare("SELECT id, companyId, status FROM campaigns WHERE id = ?").get(campaignId);
  if (!campanha) return { error: "Campanha não encontrada." };
  if (campanha.companyId !== companyId) return { error: "Campanha não pertence a esta empresa." };

  const jaVinculada = db.prepare("SELECT id FROM loja_leads_vinculos WHERE listaId = ? AND campaignId = ?").get(listaId, campaignId);
  if (jaVinculada) return { error: "Esta lista já está vinculada a esta campanha." };

  if (!["pontual", "automatica"].includes(modo)) return { error: "Modo inválido. Use 'pontual' ou 'automatica'." };

  const ts = agora();
  const vinculoId = uid();

  const contatos = contatosDaLista(listaId);
  let copiados = 0;

  const existeTel = db.prepare("SELECT id FROM campaign_contacts WHERE campaignId = ? AND telefone = ? AND telefone != ''");
  const existeEmail = db.prepare("SELECT id FROM campaign_contacts WHERE campaignId = ? AND email = ? AND email != ''");
  const inserir = db.prepare(`
    INSERT INTO campaign_contacts (id, campaignId, companyId, nome, empresa, cargo, telefone, email, cidade, extra, status, origem, listaOrigemId, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disponivel', 'loja_leads', ?, ?)
  `);

  db.transaction(() => {
    for (const c of contatos) {
      const telNorm = String(c.telefone || "").replace(/\D/g, "");
      const emailNorm = String(c.site || "").trim().toLowerCase(); // loja_leads_contatos não tem email, usa site como referência
      const isDup = (telNorm && existeTel.get(campaignId, telNorm)) ||
                    (emailNorm && existeEmail.get(campaignId, emailNorm));
      if (isDup) continue;

      inserir.run(uid(), campaignId, companyId, c.nome, "", "", telNorm, emailNorm, c.cidade || "", JSON.stringify({ endereco: c.endereco, rating: c.rating, placeId: c.placeId }), listaId, ts);
      copiados++;
    }
    db.prepare(`INSERT INTO loja_leads_vinculos (id, listaId, campaignId, companyId, modo, totalCopiados, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(vinculoId, listaId, campaignId, companyId, modo, copiados, ts, ts);
  })();

  return { ok: true, vinculoId, copiados, totalNaLista: contatos.length };
}

export function desvincularLista(vinculoId, companyId) {
  const vinculo = db.prepare("SELECT * FROM loja_leads_vinculos WHERE id = ? AND companyId = ?").get(vinculoId, companyId);
  if (!vinculo) return { error: "Vínculo não encontrado." };
  db.prepare("DELETE FROM loja_leads_vinculos WHERE id = ?").run(vinculoId);
  return { ok: true };
}

export function listarVinculosDaLista(listaId) {
  return db.prepare(`
    SELECT v.*, c.titulo AS campanhaTitulo, c.status AS campanhaStatus
    FROM loja_leads_vinculos v
    JOIN campaigns c ON c.id = v.campaignId
    WHERE v.listaId = ?
    ORDER BY v.criadoEm DESC
  `).all(listaId);
}

export function listarVinculosDaCampanha(campaignId) {
  return db.prepare(`
    SELECT v.*, l.nome AS listaNome, p.nome AS pastaNome
    FROM loja_leads_vinculos v
    JOIN loja_leads_listas l ON l.id = v.listaId
    JOIN loja_leads_pastas p ON p.id = l.pastaId
    WHERE v.campaignId = ?
    ORDER BY v.criadoEm DESC
  `).all(campaignId);
}

export function sincronizarVinculosAutomaticos(campaignId) {
  const vinculos = db.prepare("SELECT * FROM loja_leads_vinculos WHERE campaignId = ? AND modo = 'automatica'").all(campaignId);
  let totalSincronizados = 0;

  const existeTel = db.prepare("SELECT id FROM campaign_contacts WHERE campaignId = ? AND telefone = ? AND telefone != ''");
  const existeEmail = db.prepare("SELECT id FROM campaign_contacts WHERE campaignId = ? AND email = ? AND email != ''");
  const inserir = db.prepare(`
    INSERT INTO campaign_contacts (id, campaignId, companyId, nome, empresa, cargo, telefone, email, cidade, extra, status, origem, listaOrigemId, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disponivel', 'loja_leads', ?, ?)
  `);

  for (const v of vinculos) {
    const contatos = contatosDaLista(v.listaId);
    let novos = 0;
    const ts = agora();

    db.transaction(() => {
      for (const c of contatos) {
        const telNorm = String(c.telefone || "").replace(/\D/g, "");
        const emailNorm = String(c.site || "").trim().toLowerCase();
        const isDup = (telNorm && existeTel.get(v.campaignId, telNorm)) ||
                      (emailNorm && existeEmail.get(v.campaignId, emailNorm));
        if (isDup) continue;
        inserir.run(uid(), v.campaignId, v.companyId, c.nome, "", "", telNorm, emailNorm, c.cidade || "", JSON.stringify({ endereco: c.endereco, rating: c.rating, placeId: c.placeId }), v.listaId, ts);
        novos++;
      }
      if (novos > 0) {
        db.prepare("UPDATE loja_leads_vinculos SET totalCopiados = totalCopiados + ?, atualizadoEm = ? WHERE id = ?").run(novos, ts, v.id);
      }
    })();
    totalSincronizados += novos;
  }
  return { totalSincronizados };
}

export function indicadoresLista(listaId) {
  const totalContatos = db.prepare("SELECT COUNT(*) n FROM loja_leads_lista_contatos WHERE listaId = ?").get(listaId)?.n || 0;
  const vinculos = db.prepare("SELECT COUNT(*) n FROM loja_leads_vinculos WHERE listaId = ?").get(listaId)?.n || 0;

  const campanhasVinculadas = db.prepare(`
    SELECT v.campaignId, c.titulo, c.status,
      (SELECT COUNT(*) FROM campaign_contacts WHERE campaignId = v.campaignId AND listaOrigemId = ?) AS contatosEnviados,
      (SELECT COUNT(*) FROM campaign_contacts WHERE campaignId = v.campaignId AND listaOrigemId = ? AND status = 'distribuido') AS distribuidos,
      (SELECT COUNT(*) FROM leads WHERE campaignId = v.campaignId AND origem = 'loja_leads') AS leadsGerados
    FROM loja_leads_vinculos v
    JOIN campaigns c ON c.id = v.campaignId
    WHERE v.listaId = ?
  `).all(listaId, listaId, listaId);

  return { totalContatos, vinculos, campanhasVinculadas };
}
