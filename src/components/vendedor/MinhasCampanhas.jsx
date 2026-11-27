import { useMemo, useState } from "react";
import { ChevronRight, Megaphone, Building2, Search } from "lucide-react";

export default function MinhasCampanhas({ eu, db, aviso, abrirCampanha }) {
  const [busca, setBusca] = useState("");

  const empresasMap = useMemo(() => Object.fromEntries((db.companies || []).map((e) => [e.id, e])), [db.companies]);

  const minhas = useMemo(() => {
    const apps = eu.aplicacoes || {};
    return (db.campaigns || []).filter((c) => {
      const st = apps[c.companyId];
      return st === "aprovado" && c.status === "ativa";
    });
  }, [db.campaigns, eu.aplicacoes]);

  const filtradas = useMemo(() => {
    if (!busca.trim()) return minhas;
    const q = busca.toLowerCase();
    return minhas.filter((c) => {
      const emp = empresasMap[c.companyId] || {};
      return c.titulo?.toLowerCase().includes(q) || emp.nome?.toLowerCase().includes(q);
    });
  }, [minhas, busca, empresasMap]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Minhas Campanhas</h1>
      <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 20px" }}>
        Campanhas ativas onde você está aprovado
      </p>

      {minhas.length > 5 && (
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }} />
          <input
            type="text"
            placeholder="Buscar campanha ou empresa…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px 9px 36px", borderRadius: 10,
              border: "1px solid var(--border)", background: "var(--bg)", color: "var(--fg)",
              font: "inherit", fontSize: 13.5, outline: "none",
            }}
          />
        </div>
      )}

      {filtradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
          <Megaphone size={40} strokeWidth={1.3} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 14, margin: 0 }}>
            {minhas.length === 0
              ? "Você ainda não está aprovado em nenhuma campanha. Explore as oportunidades disponíveis."
              : "Nenhuma campanha encontrada para essa busca."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtradas.map((c) => {
            const emp = empresasMap[c.companyId] || {};
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => abrirCampanha(c)}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                  borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)",
                  cursor: "pointer", textAlign: "left", font: "inherit", width: "100%",
                  transition: "border-color .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                {emp.logo ? (
                  <img src={emp.logo} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--brand-light, #EFF6FF)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Building2 size={18} style={{ color: "var(--brand)" }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.titulo || "Campanha sem título"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                    {emp.nome || "Empresa"}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
