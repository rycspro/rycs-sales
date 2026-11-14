import { useState } from "react";
import { ArrowRight, Briefcase, SlidersHorizontal, BadgeDollarSign, UserRound, Search, ClipboardCheck, Wallet, GraduationCap, Sparkles } from "lucide-react";
import { useI18n } from "../../lib/i18n.jsx";

// Onboarding de apresentação do profissional — 4 etapas antes de criar a conta.
//
// Reformulação visual e editorial (White Editorial). A lógica de navegação é a
// mesma de sempre: `step` local avança com "Próximo"/CTA e `onConcluir` atende
// tanto "Pular" quanto o botão final "Criar minha conta". Textos via i18n.

const AZUL = "#318CE7";
const VERDE = "#0F9D6A";

// Exemplos de remuneração — valores ILUSTRATIVOS da interface atual, mantidos
// literais (a política é não converter reais para outras moedas sem regra).
const GANHOS = [
  { k: "c1", faixa: "R$ 15 – R$ 50" },
  { k: "c2", faixa: "R$ 30 – R$ 80" },
  { k: "c3", faixa: "R$ 50 – R$ 500+" },
  { k: "c4", faixa: "R$ 5 – R$ 25" },
];

const CTA = ["onbProf.s1.cta", "onbProf.s2.cta", "onbProf.s3.cta", "onbProf.s4.cta"];
const EYEBROW = ["onbProf.s1.eyebrow", "onbProf.s2.eyebrow", "onbProf.s3.eyebrow", "onbProf.s4.eyebrow"];
const TITULO = ["onbProf.s1.titulo", "onbProf.s2.titulo", "onbProf.s3.titulo", "onbProf.s4.titulo"];
const DESCRICAO = ["onbProf.s1.descricao", "onbProf.s2.descricao", "onbProf.s3.descricao", "onbProf.s4.descricao"];

// Caixinha de ícone com leve tinta azul, reutilizada nas listas de benefícios.
function IconeCaixa({ Icone, cor = AZUL }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
      background: "rgba(49,140,231,.10)", color: cor,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icone size={19} aria-hidden="true" />
    </div>
  );
}

// Linha de benefício: ícone + título + descrição.
function Beneficio({ Icone, titulo, desc, cor }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <IconeCaixa Icone={Icone} cor={cor} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{titulo}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

// Barra-placeholder (skeleton) — sugere a interface sem inventar dados reais.
const Barra = ({ w = "100%", h = 8, op = 1 }) => (
  <div style={{ width: w, height: h, borderRadius: 4, background: "var(--surface-3)", opacity: op }} />
);

function Visual({ step }) {
  const moldura = {
    background: "var(--surface-2)", border: "1px solid var(--border-strong)",
    borderRadius: 14, padding: 20, height: "100%", minHeight: 210,
    display: "flex", flexDirection: "column", justifyContent: "center", gap: 14,
  };
  if (step === 0) {
    return (
      <div style={moldura}>
        {/* Prévia de cards de oportunidade (sem dados reais) */}
        <div style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: AZUL }} />
            <Barra w={90} />
            <span style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 700, color: VERDE, background: "rgba(15,157,106,.10)", borderRadius: 999, padding: "3px 8px" }}>R$</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Barra w="80%" /><Barra w="55%" op={0.6} />
          </div>
        </div>
        <div style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: AZUL }} />
            <Barra w={90} />
            <span style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 700, color: VERDE, background: "rgba(15,157,106,.10)", borderRadius: 999, padding: "3px 8px" }}>R$</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Barra w="80%" /><Barra w="55%" op={0.6} />
          </div>
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div style={moldura}>
        {[Briefcase, Search, ClipboardCheck].map((Ic, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
            <IconeCaixa Icone={Ic} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <Barra w="70%" /><Barra w="45%" op={0.6} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (step === 2) {
    return (
      <div style={{ ...moldura, justifyContent: "center", alignItems: "center" }}>
        <BadgeDollarSign size={30} color={VERDE} aria-hidden="true" />
        <div className="vx-mono" style={{ fontSize: 34, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.02em" }}>R$ 50 – 500+</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < 3 ? VERDE : "var(--border-strong)" }} />)}
        </div>
      </div>
    );
  }
  return (
    <div style={moldura}>
      <div style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <IconeCaixa Icone={UserRound} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}><Barra w="60%" /><Barra w="40%" op={0.6} /></div>
      </div>
      <div style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <IconeCaixa Icone={GraduationCap} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}><Barra w="70%" /><Barra w="50%" op={0.6} /></div>
        <Sparkles size={16} color={AZUL} aria-hidden="true" />
      </div>
    </div>
  );
}

export default function OnboardingProfissional({ onConcluir }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const total = 4;
  const ultimo = step === total - 1;
  const avancar = () => { if (ultimo) onConcluir(); else setStep(step + 1); };

  const corpo = () => {
    if (step === 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Beneficio Icone={Briefcase} titulo={t("onbProf.s1.i1t")} desc={t("onbProf.s1.i1d")} />
          <Beneficio Icone={SlidersHorizontal} titulo={t("onbProf.s1.i2t")} desc={t("onbProf.s1.i2d")} />
          <Beneficio Icone={BadgeDollarSign} titulo={t("onbProf.s1.i3t")} desc={t("onbProf.s1.i3d")} cor={VERDE} />
        </div>
      );
    }
    if (step === 1) {
      const passos = [["p1t", "p1d"], ["p2t", "p2d"], ["p3t", "p3d"], ["p4t", "p4d"]];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {passos.map(([tk, dk], i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: "50%", background: "rgba(49,140,231,.10)", color: AZUL, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12.5 }}>{`0${i + 1}`}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t(`onbProf.s2.${tk}`)}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45, marginTop: 2 }}>{t(`onbProf.s2.${dk}`)}</div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (step === 2) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {GANHOS.map((g) => (
            <div key={g.k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 14px", background: "var(--surface-solid)", border: "1px solid var(--border-strong)", borderRadius: 10 }}>
              <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{t(`onbProf.s3.${g.k}`)}</span>
              <span className="vx-mono" style={{ fontSize: 14, fontWeight: 700, color: VERDE, whiteSpace: "nowrap" }}>{g.faixa}</span>
            </div>
          ))}
          <p style={{ fontSize: 11.5, color: "var(--muted-2)", lineHeight: 1.45, margin: "4px 0 0" }}>{t("onbProf.s3.aviso")}</p>
          <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45, margin: "2px 0 0" }}>{t("onbProf.s3.complemento")}</p>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Beneficio Icone={UserRound} titulo={t("onbProf.s4.i1t")} desc={t("onbProf.s4.i1d")} />
        <Beneficio Icone={GraduationCap} titulo={t("onbProf.s4.i2t")} desc={t("onbProf.s4.i2d")} />
        <Beneficio Icone={Search} titulo={t("onbProf.s4.i3t")} desc={t("onbProf.s4.i3d")} />
        <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>{t("onbProf.s4.encerramento")}</p>
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 16px" }}>
      <style>{`
        .vx-onbp-grid{display:grid;grid-template-columns:1fr;gap:0}
        @media(min-width:760px){.vx-onbp-grid{grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr)}}
        .vx-onbp-fade{animation:vxOnbpFade .3s ease}
        @keyframes vxOnbpFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        .vx-onbp-cta:focus-visible,.vx-onbp-skip:focus-visible{outline:2px solid ${AZUL};outline-offset:2px}
        @media(prefers-reduced-motion:reduce){.vx-onbp-fade{animation:none}}
      `}</style>
      <div style={{ width: "100%", maxWidth: 860 }}>
        <div className="vx-onbp-grid" style={{ background: "var(--surface-solid)", border: "1px solid var(--border-strong)", borderRadius: 16, overflow: "hidden" }}>
          {/* Coluna visual */}
          <div style={{ padding: 16, background: "var(--bg)" }}>
            <Visual step={step} key={`v${step}`} />
          </div>
          {/* Coluna de conteúdo */}
          <div style={{ padding: "24px 26px 22px", display: "flex", flexDirection: "column" }}>
            <img src="/logo-rycs-sm.png" alt="RYCS Sales Machine"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              style={{ height: 26, width: "auto", display: "block", marginBottom: 16 }} />
            <div className="vx-onbp-fade" key={`c${step}`} style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: AZUL, marginBottom: 8 }}>{t(EYEBROW[step])}</div>
              <h2 className="vx-disp" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.22, color: "var(--ink)", margin: "0 0 8px" }}>{t(TITULO[step])}</h2>
              <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55, margin: "0 0 18px" }}>{t(DESCRICAO[step])}</p>
              {corpo()}
            </div>

            {/* Progresso segmentado */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 22 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ height: 4, flex: 1, borderRadius: 999, background: i <= step ? AZUL : "var(--border-strong)", transition: "background .3s ease" }} />
              ))}
              <span style={{ marginInlineStart: 10, fontSize: 12, fontWeight: 600, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{`0${step + 1} / 0${total}`}</span>
            </div>

            {/* Navegação */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
              <button type="button" className="vx-onbp-skip" onClick={onConcluir}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, fontWeight: 500, padding: "8px 4px" }}>
                {t("onbProf.pular")}
              </button>
              <button type="button" className="vx-onbp-cta" onClick={avancar}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#2b7cd0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = AZUL; }}
                style={{ display: "flex", alignItems: "center", gap: 8, background: AZUL, color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer", minHeight: 46, transition: "background .15s" }}>
                {t(CTA[step])} <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
