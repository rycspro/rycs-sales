import { useState } from "react";
import { Brain, BookOpen, Sparkles } from "lucide-react";
import CerebroOnboarding from "./CerebroOnboarding.jsx";
import CerebroScore from "./CerebroScore.jsx";

export default function AcademyEmpresaHub({ emp, aviso }) {
  const [modo, setModo] = useState("hub"); // hub | onboarding | score

  if (modo === "onboarding") {
    return (
      <div className="vx-fade">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button className="vx-btn vx-btn-sm" onClick={() => setModo("hub")}>← Voltar</button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Ensine a RYCS sobre sua empresa</h2>
        </div>
        <CerebroOnboarding aviso={aviso} onConcluir={() => setModo("score")} />
      </div>
    );
  }

  if (modo === "score") {
    return (
      <div className="vx-fade">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button className="vx-btn vx-btn-sm" onClick={() => setModo("hub")}>← Voltar</button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Cérebro da Operação</h2>
        </div>
        <CerebroScore aviso={aviso} onIniciarOnboarding={() => setModo("onboarding")} />
      </div>
    );
  }

  return (
    <div className="vx-fade">
      <div className="vx-page-head" style={{ marginBottom: 28 }}>
        <div>
          <div className="vx-eyebrow">Academy da empresa</div>
          <h1 className="vx-disp">Ensine a RYCS</h1>
          <p>Em aproximadamente 15 minutos, a RYCS organiza seu produto, ICP, argumentos, objeções e processo comercial.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {/* Cérebro CTA principal */}
        <div style={{ background: "linear-gradient(135deg, var(--brand-50, #eff6ff), var(--brand-100, #dbeafe))", border: "2px solid var(--brand-200, #bfdbfe)", borderRadius: 16, padding: "22px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 36 }}>🧠</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Cérebro da Operação</h2>
          <p className="vx-mut" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
            Conte o que sabe. A RYCS organiza para você — produto, ICP, objeções, processo e muito mais.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="vx-btn vx-btn-primary" style={{ flex: 1, gap: 7, fontSize: 14 }} onClick={() => setModo("onboarding")}>
              <Brain size={15} /> Começar
            </button>
            <button className="vx-btn" style={{ fontSize: 13 }} onClick={() => setModo("score")}>
              Ver score
            </button>
          </div>
        </div>

        {/* Base de Conhecimento */}
        <div style={{ background: "var(--surface-1, #f8fafc)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 36 }}>📚</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Completar lacunas</h2>
          <p className="vx-mut" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
            Veja o que está faltando e responda perguntas rápidas para melhorar sua base de conhecimento.
          </p>
          <button className="vx-btn" style={{ gap: 7, fontSize: 14, marginTop: 4 }} onClick={() => setModo("score")}>
            <Sparkles size={14} /> Ver lacunas
          </button>
        </div>
      </div>
    </div>
  );
}
