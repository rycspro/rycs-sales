import { Shield } from "lucide-react";

const ROTULOS = {
  pagamento: "Caixa em dia",
  conferencia: "Confere no prazo",
  aprovacao: "Aceita as ações",
  clareza: "Campanha clara",
  retencao: "Retém profissionais",
};

const EXPLICA = {
  pagamento: "Mantém saldo suficiente para honrar o que está em aberto.",
  conferencia: "Decide as ações enviadas em vez de deixá-las paradas.",
  aprovacao: "Proporção de ações aceitas sobre as decididas.",
  clareza: "Campanha com treinamento, comissões e cliente ideal definidos.",
  retencao: "Profissionais aprovados que seguem ativos com ela.",
};

const cor = (n) => (n >= 80 ? "var(--brand)" : n >= 60 ? "var(--indigo)" : n >= 40 ? "var(--amber)" : "var(--red)");
const rotulo = (n) => (n >= 80 ? "Excelente" : n >= 60 ? "Boa" : n >= 40 ? "Regular" : "Atenção");

// Nota compacta, para a vitrine que o profissional vê antes de se candidatar.
export function CompanyScoreChip({ nota }) {
  if (nota === undefined || nota === null) return null;
  return (
    <span className="vx-badge" style={{ background: "var(--surface-2)", color: cor(nota) }}>
      <Shield size={11} /> {nota}
    </span>
  );
}

// Painel completo, com as dimensões abertas.
export default function CompanyScore({ nota, dimensoes, compacto = false }) {
  const dims = dimensoes || {};
  const temDados = Object.keys(dims).length > 0;

  return (
    <div className="vx-card" style={{ padding: compacto ? 16 : 20 }}>
      <div className="vx-row" style={{ marginBottom: temDados ? 14 : 0 }}>
        <div>
          <div className="vx-eyebrow">Company Score</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 3 }}>
            <span className="vx-disp vx-mono" style={{ fontSize: 30, color: cor(nota) }}>{nota ?? 0}</span>
            <span className="vx-mut" style={{ fontSize: 13 }}>{rotulo(nota ?? 0)}</span>
          </div>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--surface-2)",
        }}>
          <Shield size={19} color={cor(nota ?? 0)} strokeWidth={2.1} />
        </div>
      </div>

      {temDados && (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {Object.entries(ROTULOS).map(([k, label]) => {
            const v = dims[k] ?? 0;
            return (
              <div key={k}>
                <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 5 }}>
                  <span className="vx-mut" title={EXPLICA[k]}>{label}</span>
                  <b className="vx-mono" style={{ color: cor(v) }}>{v}</b>
                </div>
                <div className="vx-meter-track">
                  <div className="vx-meter-fill" style={{ width: `${v}%`, background: cor(v) }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!compacto && (
        <p className="vx-mut" style={{ fontSize: 11.5, marginTop: 14 }}>
          A nota é visível para os profissionais antes de se candidatarem — do mesmo modo
          que você vê o score deles.
        </p>
      )}
    </div>
  );
}
