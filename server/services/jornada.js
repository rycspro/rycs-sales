import db, { uid, agora } from "../db.js";
import {
  ETAPAS_VENDEDOR, ETAPAS_EMPRESA, ETAPAS_CADASTRO, EVENTOS_PUBLICOS, ORIGENS,
  limparOrigem, classificarOrigem, montarJornada, agregarFunil,
} from "../../shared/jornada.js";

const ID_VALIDO = /^[A-Za-z0-9_-]{8,64}$/;
const DIA = 24 * 60 * 60 * 1000;

const json = (texto) => { try { return JSON.parse(texto || "{}") || {}; } catch { return {}; } };
const mapa = (linhas) => new Map(linhas.map((l) => [l.id, l.em]));

export function registrarEventoPublico({ visitanteId, evento, papel, etapa, origem }) {
  if (!ID_VALIDO.test(String(visitanteId || ""))) return { error: "Visitante inválido." };
  if (!EVENTOS_PUBLICOS.includes(evento)) return { error: "Evento não permitido." };
  const papelOk = ["vendedor", "empresa"].includes(papel) ? papel : "";
  const etapaOk = String(etapa ?? "").slice(0, 40);
  const origemOk = limparOrigem(origem);
  const t = agora();

  db.prepare("INSERT OR IGNORE INTO jornada_visitantes (visitanteId, origem, papel, primeiroEm) VALUES (?, ?, ?, ?)")
    .run(visitanteId, JSON.stringify(origemOk), papelOk, t);
  // Primeiro toque vale; só completa a origem se ela ainda estiver vazia.
  if (Object.keys(origemOk).length)
    db.prepare("UPDATE jornada_visitantes SET origem = ? WHERE visitanteId = ? AND origem = '{}'")
      .run(JSON.stringify(origemOk), visitanteId);
  if (papelOk)
    db.prepare("UPDATE jornada_visitantes SET papel = ? WHERE visitanteId = ? AND papel = ''").run(papelOk, visitanteId);
  db.prepare("INSERT OR IGNORE INTO jornada_eventos (id, visitanteId, evento, papel, etapa, criadoEm) VALUES (?, ?, ?, ?, ?, ?)")
    .run(uid(), visitanteId, evento, papelOk, etapaOk, t);
  return { ok: true };
}

// Chamado na criação da conta: liga o visitante anônimo ao usuário e guarda a origem.
export function vincularVisitante(userId, corpo = {}) {
  if (!userId) return;
  try {
    const visitanteId = ID_VALIDO.test(String(corpo.visitanteId || "")) ? corpo.visitanteId : "";
    let origem = limparOrigem(corpo.origem);
    if (!Object.keys(origem).length && visitanteId) {
      const v = db.prepare("SELECT origem FROM jornada_visitantes WHERE visitanteId = ?").get(visitanteId);
      origem = limparOrigem(json(v?.origem));
    }
    db.prepare("UPDATE users SET visitanteId = ?, origem = ? WHERE id = ?").run(visitanteId, JSON.stringify(origem), userId);
  } catch (e) {
    console.error("[jornada] vincular visitante:", e?.message);
  }
}

function primeiroAcessoPorVisitante() {
  return mapa(db.prepare("SELECT visitanteId AS id, MIN(criadoEm) AS em FROM jornada_eventos GROUP BY visitanteId").all());
}

// Exportadas também para a API de Conversões (services/metaConversoes.js).
export function jornadasVendedores(desde) {
  const linhas = db.prepare(`
    SELECT s.id, s.nome, s.email, s.criadoEm, s.bio, s.pix, s.pais,
           length(COALESCE(s.foto, '')) > 0 AS temFoto,
           COALESCE(s.emailVerificado, 0) OR COALESCE(u.emailVerificado, 0) AS emailOk,
           u.origem, u.visitanteId
    FROM sellers s LEFT JOIN users u ON u.entityId = s.id AND u.role = 'vendedor'
    WHERE s.criadoEm >= ?
  `).all(desde);
  const acesso = primeiroAcessoPorVisitante();
  const academy = mapa(db.prepare("SELECT sellerId AS id, MIN(atualizadoEm) AS em FROM academy_progress GROUP BY sellerId").all());
  const candidatura = mapa(db.prepare("SELECT sellerId AS id, MIN(criadoEm) AS em FROM campaign_applications GROUP BY sellerId").all());
  const aprovado = mapa(db.prepare("SELECT sellerId AS id, MIN(criadoEm) AS em FROM campaign_applications WHERE status = 'aprovado' GROUP BY sellerId").all());
  const acao = mapa(db.prepare("SELECT sellerId AS id, MIN(criadoEm) AS em FROM submissions GROUP BY sellerId").all());
  const acaoOk = mapa(db.prepare("SELECT sellerId AS id, MIN(COALESCE(reviewedEm, criadoEm)) AS em FROM submissions WHERE status = 'liberado' GROUP BY sellerId").all());
  const pagamento = mapa(db.prepare("SELECT sellerId AS id, MIN(criadoEm) AS em FROM withdrawals WHERE status = 'pago' GROUP BY sellerId").all());

  return linhas.map((s) => ({
    id: s.id, nome: s.nome, email: s.email, criadoEm: s.criadoEm, pais: s.pais || "", origemBruta: json(s.origem),
    marcos: {
      acesso: Math.min(acesso.get(s.visitanteId) || s.criadoEm, s.criadoEm),
      conta: s.criadoEm,
      email: !!s.emailOk,
      perfil: !!(s.temFoto && String(s.bio || "").trim() && String(s.pix || "").trim()),
      academy: academy.get(s.id),
      candidatura: candidatura.get(s.id),
      aprovado: aprovado.get(s.id),
      acao: acao.get(s.id),
      acao_aprovada: acaoOk.get(s.id),
      pagamento: pagamento.get(s.id),
    },
  }));
}

export function jornadasEmpresas(desde) {
  const linhas = db.prepare(`
    SELECT c.id, c.nome, c.criadoEm, c.tipoEmpresa, c.pais, u.email, u.origem, u.visitanteId, u.emailVerificado AS emailOk, o.etapas
    FROM companies c
    JOIN users u ON u.entityId = c.id AND u.role = 'empresa'
    LEFT JOIN onboarding o ON o.companyId = c.id
    WHERE c.criadoEm >= ?
  `).all(desde);
  const acesso = primeiroAcessoPorVisitante();
  const etapasOnb = new Map();
  for (const l of db.prepare(`
    SELECT companyId, json_extract(dados, '$.etapa') AS etapa, MIN(criadoEm) AS em
    FROM onboarding_eventos WHERE evento = 'etapa_concluida' GROUP BY companyId, etapa
  `).all()) etapasOnb.set(`${l.companyId}:${l.etapa}`, l.em);
  const campanha = mapa(db.prepare("SELECT companyId AS id, MIN(criadoEm) AS em FROM campaigns GROUP BY companyId").all());
  const publicada = mapa(db.prepare("SELECT companyId AS id, MIN(criadoEm) AS em FROM campaigns WHERE status IN ('ativa','pausada','encerrada') GROUP BY companyId").all());
  const saldo = mapa(db.prepare("SELECT companyId AS id, MIN(COALESCE(confirmadoEm, criadoEm)) AS em FROM deposit_requests WHERE status = 'confirmado' GROUP BY companyId").all());
  const profissional = mapa(db.prepare(`
    SELECT c.companyId AS id, MIN(ca.criadoEm) AS em FROM campaign_applications ca
    JOIN campaigns c ON c.id = ca.campaignId WHERE ca.status = 'aprovado' GROUP BY c.companyId
  `).all());
  const acao = mapa(db.prepare("SELECT companyId AS id, MIN(criadoEm) AS em FROM submissions GROUP BY companyId").all());
  const conversao = mapa(db.prepare("SELECT companyId AS id, MIN(COALESCE(reviewedEm, criadoEm)) AS em FROM submissions WHERE status = 'liberado' GROUP BY companyId").all());

  return linhas.map((c) => {
    const onb = json(c.etapas);
    const etapaOnb = (chave) => onb[chave] === "concluida" ? (etapasOnb.get(`${c.id}:${chave}`) || true) : null;
    return {
      id: c.id, nome: c.nome, email: c.email, criadoEm: c.criadoEm, pais: c.pais || "", origemBruta: json(c.origem),
      marcos: {
        acesso: Math.min(acesso.get(c.visitanteId) || c.criadoEm, c.criadoEm),
        conta: c.criadoEm,
        // Fora de ETAPAS_EMPRESA (não entra no funil); usado pela API de Conversões.
        email: !!c.emailOk,
        empresa: etapaOnb("empresa"),
        academy: etapaOnb("academy"),
        ia: etapaOnb("ia"),
        plano: etapaOnb("plano") || (c.tipoEmpresa === "premium" ? true : null),
        campanha: campanha.get(c.id),
        publicada: publicada.get(c.id),
        saldo: saldo.get(c.id),
        profissional: profissional.get(c.id),
        acao: acao.get(c.id),
        conversao: conversao.get(c.id),
      },
    };
  });
}

// Funil anônimo: quem visitou e abriu o cadastro, até qual passo do formulário
// chegou, e quantos viraram conta.
function funilCadastro(papel, desde, filtroOrigem) {
  const visitantes = db.prepare(`
    SELECT v.visitanteId, v.origem FROM jornada_visitantes v
    WHERE v.primeiroEm >= ? AND (v.papel = ? OR v.papel = '')
  `).all(desde, papel)
    .filter((v) => !filtroOrigem || classificarOrigem(json(v.origem)) === filtroOrigem);
  const ids = new Set(visitantes.map((v) => v.visitanteId));
  const eventos = db.prepare("SELECT visitanteId, evento, papel, etapa FROM jornada_eventos WHERE criadoEm >= ?").all(desde)
    .filter((e) => ids.has(e.visitanteId));
  const role = papel === "empresa" ? "empresa" : "vendedor";
  const contas = new Set(db.prepare("SELECT visitanteId FROM users WHERE role = ? AND visitanteId != ''").all(role).map((u) => u.visitanteId));

  const com = (filtro) => new Set(eventos.filter(filtro).map((e) => e.visitanteId)).size;
  const passos = [
    { chave: "visita", label: "Visitaram o site", total: com((e) => e.evento === "visita") },
    { chave: "cadastro_aberto", label: "Abriram o cadastro", total: com((e) => e.evento === "cadastro_aberto" && e.papel === papel) },
    ...ETAPAS_CADASTRO[papel].map((p) => ({
      chave: `etapa_${p.chave}`, label: `Formulário: ${p.label}`,
      total: com((e) => e.evento === "cadastro_etapa" && e.papel === papel && e.etapa === p.chave),
    })),
    { chave: "conta", label: "Criaram a conta", total: [...ids].filter((id) => contas.has(id)).length },
  ];
  const base = passos[0].total || 0;
  return passos.map((p) => ({ ...p, pct: base ? Math.round((p.total / base) * 100) : 0 }));
}

export function relatorioJornada({ tipo = "vendedor", dias = 0, origem = "" } = {}) {
  const papel = tipo === "empresa" ? "empresa" : "vendedor";
  const desde = Number(dias) > 0 ? agora() - Number(dias) * DIA : 0;
  const definicao = papel === "empresa" ? ETAPAS_EMPRESA : ETAPAS_VENDEDOR;
  const brutos = papel === "empresa" ? jornadasEmpresas(desde) : jornadasVendedores(desde);
  const t = agora();

  const todos = brutos.map((b) => {
    const origemChave = classificarOrigem(b.origemBruta);
    return {
      id: b.id, nome: b.nome, email: b.email, criadoEm: b.criadoEm,
      origem: origemChave, origemLabel: ORIGENS[origemChave],
      campanhaOrigem: b.origemBruta.utm_campaign || "",
      ...montarJornada(definicao, b.marcos, t),
    };
  });

  const origens = Object.keys(ORIGENS)
    .map((chave) => ({ chave, label: ORIGENS[chave], total: todos.filter((j) => j.origem === chave).length }))
    .filter((o) => o.total > 0);
  const itens = origem ? todos.filter((j) => j.origem === origem) : todos;

  return {
    tipo: papel,
    funil: agregarFunil(definicao, itens),
    cadastro: funilCadastro(papel, desde, origem),
    origens,
    itens: itens.sort((a, b) => b.criadoEm - a.criadoEm),
  };
}
