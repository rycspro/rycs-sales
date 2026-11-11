import { useEffect, useState } from "react";
import { Brain, X } from "lucide-react";
import { api } from "../../lib/api.js";

export default function BannerCerebro({ onIr }) {
  const [dados, setDados] = useState(null);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    api("/brain/score").then((r) => setDados(r));
  }, []);

  // Não mostrar se score alto ou já fechou nesta sessão
  if (!dados || fechado || dados.score >= 85 || dados.onboarding?.ativado) return null;

  const { score, lacunas, tempoEstimadoMin } = dados;
  const top3 = (lacunas || []).slice(0, 3);

  return (
    <div style={{ background: "linear-gradient(135deg, var(--brand-50) 0%, var(--brand-100) 100%)", border: "1.5px solid var(--brand-200)", borderRadius: 14, padding: "16px 18px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>🧠</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
          Seu Cérebro da Operação está {score}% completo.
        </div>
        <div style={{ fontSize: 13, color: "var(--brand-600)" }}>
          {top3.length > 0
            ? `Complete mais ${top3.length} informação(ões) para melhorar campanhas e treinamentos.`
            : "Continue preenchendo sua base de conhecimento."}
        </div>
      </div>
      <button className="vx-btn vx-btn-primary" style={{ fontSize: 13, padding: "8px 16px", gap: 6, whiteSpace: "nowrap" }} onClick={onIr}>
        <Brain size={13} /> Completar em {tempoEstimadoMin || 5} minuto(s)
      </button>
      <button onClick={() => setFechado(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--brand-600)", flexShrink: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
}
