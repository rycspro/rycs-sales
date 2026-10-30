import db, { uid, agora } from "../db.js";

// Eventos de funil do onboarding. Usados para medir conversão e abandono por etapa.
// Eventos possíveis:
//   criou_conta        — empresa criou conta pelo caminho "livre" (Criar conta)
//   iniciou_onboarding — empresa clicou em "Iniciar vendas" / "Continuar"
//   etapa_concluida    — etapa concluída (dados: { etapa, n })
//   etapa_abandonada   — frontend: saiu sem concluir (dados: { etapa, n })
//   cadastro_concluido — etapa 6 concluída com saldo

export function registrarEvento(companyId, evento, dados = {}) {
  if (!companyId || !evento) return;
  try {
    db.prepare(
      "INSERT INTO onboarding_eventos (id, companyId, evento, dados, criadoEm) VALUES (?, ?, ?, ?, ?)"
    ).run(uid(), companyId, evento, JSON.stringify(dados), agora());
  } catch (e) {
    console.error("[onboarding-eventos]", e?.message);
  }
}

// Resumo do funil para o painel admin: total por evento e conversão por etapa.
export function metricas() {
  const totais = db.prepare(
    "SELECT evento, COUNT(*) as total FROM onboarding_eventos GROUP BY evento ORDER BY evento"
  ).all();

  const porEtapa = db.prepare(`
    SELECT dados, COUNT(*) as total, evento
    FROM onboarding_eventos
    WHERE evento IN ('etapa_concluida', 'etapa_abandonada')
    GROUP BY dados, evento
  `).all().map((r) => {
    let dados = {};
    try { dados = JSON.parse(r.dados); } catch { /* ignorar */ }
    return { ...r, dados };
  });

  return { totais, porEtapa };
}
