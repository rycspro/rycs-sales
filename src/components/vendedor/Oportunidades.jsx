import { useState } from "react";
import { Briefcase, MapPin, Users, Target, Wallet, Building2, ChevronRight } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";

export default function Oportunidades({ eu, db, aviso, recarregar, abrirCampanha }) {
  const [candidatando, setCandidatando] = useState(null);
  const [mensagens, setMensagens] = useState({});

  const campanhas = (db.campaigns || []).filter((c) => c.status === "ativa");
  const empresasMap = {};
  for (const c of db.companies || []) empresasMap[c.id] = c;

  const candidatar = async (campanha) => {
    setCandidatando(campanha.id);
    const r = await api(`/campaigns/${campanha.id}/apply`, { mensagem: (mensagens[campanha.id] || "").trim() });
    setCandidatando(null);
    if (r?.error) return aviso(r.error);
    aviso("Candidatura enviada! A empresa vai analisar seu perfil.");
    setMensagens((m) => ({ ...m, [campanha.id]: "" }));
    recarregar?.();
  };

  const statusCandidatura = (campanha) => {
    const cands = campanha.candidaturas || [];
    if (!cands.length) return null;
    return cands[0]?.status;
  };

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="vx-disp" style={{ fontSize: 19, margin: 0 }}>Oportunidades disponíveis</h2>
          <p className="vx-mut" style={{ fontSize: 13, marginTop: 4 }}>
            Campanhas ativas das empresas. Candidate-se às que combinam com seu perfil.
          </p>
        </div>
        <span className="vx-chip vx-mono">{campanhas.length}</span>
      </div>

      {campanhas.length === 0 && (
        <div className="vx-vazio">
          <Target size={36} color="var(--muted)" />
          <div className="vx-disp" style={{ fontSize: 17, marginTop: 10 }}>Nenhuma oportunidade disponível</div>
          <p className="vx-mut" style={{ fontSize: 13 }}>Quando as empresas criarem campanhas ativas, elas aparecerão aqui.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {campanhas.map((c) => {
          const empresa = empresasMap[c.companyId] || {};
          const st = statusCandidatura(c);
          const comissoes = typeof c.comissoes === "string" ? JSON.parse(c.comissoes || "{}") : (c.comissoes || {});
          const comissoesAtivas = ORDEM_ACOES.filter((k) => comissoes[k]);

          return (
            <div key={c.id} className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Topo com logo e nome */}
              <div style={{
                padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14,
                borderBottom: "1px solid var(--border)",
              }}>
                {/* Logo da empresa */}
                <div style={{ flex: "none" }}>
                  {empresa.logo ? (
                    <img src={empresa.logo} alt="" style={{
                      width: 44, height: 44, borderRadius: 10, objectFit: "cover",
                    }} />
                  ) : (
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: empresa.cor || "var(--brand)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 14, fontWeight: 700,
                    }}>
                      {String(empresa.nome || "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                    {c.titulo || "Campanha sem título"}
                  </div>
                  <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {empresa.nome}
                  </div>
                </div>

                {st === "aprovado" && (
                  <span className="vx-badge" style={{ background: "var(--green-50)", color: "var(--green)", fontSize: 11, flex: "none" }}>
                    Aprovado
                  </span>
                )}
                {st === "pendente" && (
                  <span className="vx-badge" style={{ background: "var(--amber-50)", color: "var(--amber)", fontSize: 11, flex: "none" }}>
                    Em análise
                  </span>
                )}
              </div>

              {/* Descrição */}
              {c.descricao && (
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-light)" }}>
                  <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                    {c.descricao.length > 200 ? c.descricao.slice(0, 200) + "…" : c.descricao}
                  </p>
                </div>
              )}

              {/* Info cards: saldo e valor por tarefa */}
              <div style={{
                padding: "12px 20px", display: "flex", gap: 16, flexWrap: "wrap",
                borderBottom: "1px solid var(--border-light)",
              }}>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div className="vx-eyebrow" style={{ fontSize: 10.5 }}>Saldo da campanha</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--brand)", marginTop: 2 }}>
                    <Wallet size={13} style={{ marginRight: 4, verticalAlign: "-1px" }} />
                    {money(c.orcamento || 0)}
                  </div>
                </div>
                {comissoesAtivas.length > 0 && (
                  <div style={{ flex: 2, minWidth: 140 }}>
                    <div className="vx-eyebrow" style={{ fontSize: 10.5 }}>Valor por tarefa</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      {comissoesAtivas.map((k) => (
                        <span key={k} className="vx-chip vx-mono" style={{ fontSize: 11.5 }}>
                          {ACOES[k]?.nome || k} <b style={{ color: "var(--brand)" }}>{money(comissoes[k])}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Meta-info */}
              <div style={{
                padding: "10px 20px", display: "flex", flexWrap: "wrap", gap: 14,
                fontSize: 12, color: "var(--muted)",
              }}>
                {c.funcao && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Briefcase size={12} /> {c.funcao}
                  </span>
                )}
                {c.regiao && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={12} /> {c.regiao}
                  </span>
                )}
                {c.objetivo && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Target size={12} /> {c.objetivo}
                  </span>
                )}
              </div>

              {/* Ação */}
              <div style={{ padding: "12px 20px" }}>
                {st === "aprovado" ? (
                  <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => abrirCampanha?.(c)}>
                    Acessar campanha <ChevronRight size={14} />
                  </button>
                ) : st === "pendente" ? (
                  <button className="vx-btn vx-btn-block" disabled>Candidatura em análise</button>
                ) : c.candidaturasAbertas === false ? (
                  <button className="vx-btn vx-btn-block" disabled>Candidaturas encerradas</button>
                ) : st === "recusado" ? (
                  <button className="vx-btn vx-btn-block" onClick={() => candidatar(c)}
                    disabled={candidatando === c.id}>
                    {candidatando === c.id ? "Enviando…" : "Tentar novamente"}
                  </button>
                ) : (
                  <>
                    <textarea
                      className="vx-input" rows={2} maxLength={1000}
                      value={mensagens[c.id] || ""}
                      onChange={(e) => setMensagens((m) => ({ ...m, [c.id]: e.target.value }))}
                      placeholder="Mensagem para a empresa (opcional): conte por que você é ideal para esta campanha."
                      style={{ resize: "vertical", marginBottom: 8, fontSize: 13 }}
                    />
                    <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => candidatar(c)}
                      disabled={candidatando === c.id}>
                      {candidatando === c.id ? "Enviando…" : "Candidatar-se a esta campanha"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
