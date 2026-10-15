import { useState, useEffect } from "react";
import { Briefcase, MapPin, Users, Target, ArrowRight, Sparkles, Building2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { DIMENSOES } from "../../../shared/discQuiz.js";

export default function OnbOportunidades({ aviso, disc, aoConcluir }) {
  const [empresas, setEmpresas] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/onboarding-pro/oportunidades").then((r) => {
      if (r && !r.error) setEmpresas(r.empresas || []);
      else aviso?.(r?.error || "Erro ao carregar oportunidades");
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="vx-onb-estado">Carregando oportunidades…</div>;

  return (
    <div className="vx-fade" style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Header com perfil DISC resumido */}
      {disc?.predominante && (
        <div className="vx-onb-card" style={{ padding: 20, marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", flex: "none",
            background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={20} color="var(--brand)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: DIMENSOES[disc.predominante]?.cor }}>
              {disc.label}
            </div>
            <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2 }}>
              Perfil comercial definido. Veja as campanhas que combinam com você.
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div className="vx-onb-eyebrow">Passo 3 de 3</div>
        <h1 className="vx-disp" style={{ fontSize: 26, marginTop: 8 }}>Oportunidades disponíveis</h1>
        <p className="vx-mut" style={{ fontSize: 14, marginTop: 6 }}>
          {empresas?.length
            ? `${empresas.length} empresa${empresas.length > 1 ? "s" : ""} com campanhas ativas para você.`
            : "Nenhuma campanha ativa no momento. Novas oportunidades aparecerão aqui."}
        </p>
      </div>

      {empresas?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {empresas.map((emp) => (
            <div key={emp.id} className="vx-onb-card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Cabeçalho da empresa */}
              <div style={{
                padding: "16px 20px", display: "flex", alignItems: "center", gap: 14,
                borderBottom: "1px solid var(--border)",
              }}>
                {emp.logo ? (
                  <img src={emp.logo} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flex: "none" }} />
                ) : (
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flex: "none",
                    background: emp.cor || "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Building2 size={18} color="#fff" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{emp.nome}</div>
                  {emp.produto && <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2 }}>{emp.produto}</div>}
                </div>
                <span className="vx-badge" style={{ background: "var(--green-50)", color: "var(--green)", fontSize: 11 }}>
                  {emp.campanhas.length} campanha{emp.campanhas.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Lista de campanhas */}
              {emp.campanhas.map((c, i) => (
                <div key={c.id} style={{
                  padding: "14px 20px",
                  borderBottom: i < emp.campanhas.length - 1 ? "1px solid var(--border-light)" : "none",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                    {c.titulo || "Campanha sem título"}
                  </div>
                  {c.descricao && (
                    <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                      {c.descricao.length > 120 ? c.descricao.slice(0, 120) + "…" : c.descricao}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "var(--muted)" }}>
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
                    {c.vagas && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Users size={12} /> {c.vagas} vaga{c.vagas > 1 ? "s" : ""}
                      </span>
                    )}
                    {c.objetivo && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Target size={12} /> {c.objetivo}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <button className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" style={{ marginTop: 24 }}
        onClick={() => aoConcluir?.()}>
        Entrar na plataforma <ArrowRight size={16} />
      </button>
    </div>
  );
}
