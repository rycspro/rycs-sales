import { useState } from "react";
import { ArrowRight, Briefcase, CheckCircle2, DollarSign, GraduationCap, Rocket, ShieldCheck, Target, TrendingUp, Users, Zap } from "lucide-react";

const STEPS = [
  {
    cor: "#2563EB",
    grad: "linear-gradient(135deg, #2563EB 0%, #4338CA 100%)",
    icone: Rocket,
    ilustracao: (
      <svg viewBox="0 0 382 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block" }}>
        <rect width="382" height="180" rx="12" fill="url(#g1)" />
        <defs><linearGradient id="g1" x1="0" y1="0" x2="382" y2="180"><stop stopColor="#2563EB" /><stop offset="1" stopColor="#4338CA" /></linearGradient></defs>
        <circle cx="191" cy="90" r="44" fill="rgba(255,255,255,.12)" />
        <circle cx="191" cy="90" r="28" fill="rgba(255,255,255,.18)" />
        {/* Rocket */}
        <path d="M191 72 l-8 20 h6 v10 h4 v-10 h6z" fill="#fff" opacity=".9" />
        {/* Floating cards */}
        <rect x="52" y="50" width="72" height="48" rx="8" fill="rgba(255,255,255,.13)" />
        <rect x="58" y="58" width="36" height="4" rx="2" fill="rgba(255,255,255,.35)" />
        <rect x="58" y="66" width="52" height="3" rx="1.5" fill="rgba(255,255,255,.2)" />
        <rect x="58" y="73" width="44" height="3" rx="1.5" fill="rgba(255,255,255,.15)" />
        <rect x="58" y="82" width="24" height="8" rx="4" fill="rgba(255,255,255,.25)" />
        <rect x="258" y="56" width="72" height="48" rx="8" fill="rgba(255,255,255,.13)" />
        <rect x="264" y="64" width="28" height="4" rx="2" fill="rgba(255,255,255,.35)" />
        <rect x="264" y="72" width="52" height="3" rx="1.5" fill="rgba(255,255,255,.2)" />
        <rect x="264" y="79" width="40" height="3" rx="1.5" fill="rgba(255,255,255,.15)" />
        <circle cx="310" y="88" r="6" fill="rgba(255,255,255,.25)" />
        {/* Sparkles */}
        <circle cx="120" cy="42" r="3" fill="rgba(255,255,255,.4)" />
        <circle cx="270" cy="38" r="2.5" fill="rgba(255,255,255,.35)" />
        <circle cx="85" cy="130" r="2" fill="rgba(255,255,255,.3)" />
        <circle cx="300" cy="140" r="3" fill="rgba(255,255,255,.25)" />
        <circle cx="155" cy="145" r="2.5" fill="rgba(255,255,255,.2)" />
      </svg>
    ),
    titulo: "Bem-vindo à RYCS Sales Machine",
    descricao: "A plataforma que conecta profissionais de vendas a empresas reais. Escolha campanhas, execute e seja remunerado por resultado.",
    corpo: (cor) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { icon: Briefcase, texto: "Trabalhe com empresas de verdade" },
          { icon: DollarSign, texto: "Ganhe por cada ação aprovada" },
          { icon: GraduationCap, texto: "Treinamentos gratuitos na plataforma" },
        ].map((d, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "11px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `color-mix(in srgb, ${cor} 10%, transparent)`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <d.icon size={17} color={cor} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{d.texto}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    cor: "#7C3AED",
    grad: "linear-gradient(135deg, #7C3AED 0%, #4338CA 100%)",
    icone: Target,
    ilustracao: (
      <svg viewBox="0 0 382 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block" }}>
        <rect width="382" height="180" rx="12" fill="url(#g2)" />
        <defs><linearGradient id="g2" x1="0" y1="0" x2="382" y2="180"><stop stopColor="#7C3AED" /><stop offset="1" stopColor="#4338CA" /></linearGradient></defs>
        {/* Step circles with connecting lines */}
        <line x1="96" y1="82" x2="166" y2="82" stroke="rgba(255,255,255,.3)" strokeWidth="2" strokeDasharray="4 4" />
        <line x1="216" y1="82" x2="286" y2="82" stroke="rgba(255,255,255,.3)" strokeWidth="2" strokeDasharray="4 4" />
        <line x1="156" y1="96" x2="226" y2="96" stroke="rgba(255,255,255,.3)" strokeWidth="2" strokeDasharray="4 4" />
        {/* Step 1 */}
        <circle cx="76" cy="82" r="22" fill="rgba(255,255,255,.18)" />
        <circle cx="76" cy="82" r="14" fill="rgba(255,255,255,.25)" />
        <text x="76" y="87" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">1</text>
        <text x="76" y="118" textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="10" fontWeight="500">Perfil</text>
        {/* Step 2 */}
        <circle cx="156" cy="96" r="22" fill="rgba(255,255,255,.18)" />
        <circle cx="156" cy="96" r="14" fill="rgba(255,255,255,.25)" />
        <text x="156" y="101" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">2</text>
        <text x="156" y="132" textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="10" fontWeight="500">Campanhas</text>
        {/* Step 3 */}
        <circle cx="226" cy="82" r="22" fill="rgba(255,255,255,.18)" />
        <circle cx="226" cy="82" r="14" fill="rgba(255,255,255,.25)" />
        <text x="226" y="87" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">3</text>
        <text x="226" y="118" textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="10" fontWeight="500">Execute</text>
        {/* Step 4 */}
        <circle cx="306" cy="96" r="22" fill="rgba(255,255,255,.18)" />
        <circle cx="306" cy="96" r="14" fill="rgba(255,255,255,.25)" />
        <text x="306" y="101" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">4</text>
        <text x="306" y="132" textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="10" fontWeight="500">Receba</text>
        {/* Sparkles */}
        <circle cx="40" cy="50" r="2.5" fill="rgba(255,255,255,.3)" />
        <circle cx="340" cy="55" r="3" fill="rgba(255,255,255,.25)" />
        <circle cx="120" cy="45" r="2" fill="rgba(255,255,255,.2)" />
      </svg>
    ),
    titulo: "Como funciona na prática",
    descricao: "Empresas publicam campanhas com metas reais. Você se candidata, executa e registra cada ação.",
    corpo: (cor) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { num: "1", texto: "Crie sua conta e complete seu perfil" },
          { num: "2", texto: "Candidate-se às campanhas disponíveis" },
          { num: "3", texto: "Execute as tarefas e registre evidências" },
          { num: "4", texto: "A empresa aprova e você recebe" },
        ].map((p, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", background: cor, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {p.num}
            </div>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{p.texto}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    cor: "#059669",
    grad: "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
    icone: TrendingUp,
    ilustracao: (
      <svg viewBox="0 0 382 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block" }}>
        <rect width="382" height="180" rx="12" fill="url(#g3)" />
        <defs><linearGradient id="g3" x1="0" y1="0" x2="382" y2="180"><stop stopColor="#059669" /><stop offset="1" stopColor="#0D9488" /></linearGradient></defs>
        {/* Chart bars */}
        <rect x="60" y="120" width="28" height="30" rx="4" fill="rgba(255,255,255,.2)" />
        <rect x="100" y="100" width="28" height="50" rx="4" fill="rgba(255,255,255,.25)" />
        <rect x="140" y="80" width="28" height="70" rx="4" fill="rgba(255,255,255,.3)" />
        <rect x="180" y="60" width="28" height="90" rx="4" fill="rgba(255,255,255,.35)" />
        <rect x="220" y="45" width="28" height="105" rx="4" fill="rgba(255,255,255,.4)" />
        {/* Trend line */}
        <path d="M74 115 L114 95 L154 75 L194 55 L234 40" stroke="rgba(255,255,255,.7)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="234" cy="40" r="5" fill="#fff" opacity=".8" />
        {/* Dollar sign */}
        <circle cx="310" cy="80" r="28" fill="rgba(255,255,255,.15)" />
        <text x="310" y="88" textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize="28" fontWeight="700">$</text>
        {/* Sparkles */}
        <circle cx="290" cy="45" r="3" fill="rgba(255,255,255,.35)" />
        <circle cx="340" cy="120" r="2.5" fill="rgba(255,255,255,.25)" />
        <circle cx="50" cy="60" r="2" fill="rgba(255,255,255,.2)" />
      </svg>
    ),
    titulo: "Quanto você pode ganhar",
    descricao: "Cada campanha define comissões por tipo de ação. Melhor score = mais campanhas premium.",
    corpo: (cor) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { acao: "Reunião agendada", faixa: "R$ 15 – R$ 50" },
          { acao: "Visita realizada", faixa: "R$ 30 – R$ 80" },
          { acao: "Venda fechada", faixa: "R$ 50 – R$ 500+" },
          { acao: "Lead qualificado", faixa: "R$ 5 – R$ 25" },
        ].map((ex, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}>
            <span style={{ fontSize: 13, color: "var(--ink)" }}>{ex.acao}</span>
            <span className="vx-mono" style={{ fontSize: 13, fontWeight: 600, color: cor }}>{ex.faixa}</span>
          </div>
        ))}
        <p className="vx-mut" style={{ fontSize: 11.5, textAlign: "center", margin: "6px 0 0" }}>
          Valores variam por campanha e empresa.
        </p>
      </div>
    ),
  },
  {
    cor: "#0EA5E9",
    grad: "linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)",
    icone: ShieldCheck,
    ilustracao: (
      <svg viewBox="0 0 382 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block" }}>
        <rect width="382" height="180" rx="12" fill="url(#g4)" />
        <defs><linearGradient id="g4" x1="0" y1="0" x2="382" y2="180"><stop stopColor="#0EA5E9" /><stop offset="1" stopColor="#2563EB" /></linearGradient></defs>
        {/* Shield */}
        <path d="M160 55 L160 110 Q160 135 191 145 Q222 135 222 110 L222 55 L191 42z" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" />
        <path d="M180 95 l6 6 l16-16" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".8" />
        {/* Graduation cap */}
        <path d="M300 75 L330 60 L360 75 L330 90z" fill="rgba(255,255,255,.25)" />
        <rect x="325" y="75" width="10" height="20" rx="2" fill="rgba(255,255,255,.2)" />
        {/* Arrow connecting them */}
        <path d="M230 95 Q260 95 270 80" stroke="rgba(255,255,255,.3)" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
        {/* Stars */}
        <circle cx="80" cy="60" r="10" fill="rgba(255,255,255,.12)" />
        <circle cx="80" cy="60" r="4" fill="rgba(255,255,255,.25)" />
        <circle cx="60" cy="120" r="8" fill="rgba(255,255,255,.1)" />
        <circle cx="100" cy="130" r="6" fill="rgba(255,255,255,.08)" />
        <circle cx="340" cy="130" r="2.5" fill="rgba(255,255,255,.3)" />
        <circle cx="50" cy="80" r="2" fill="rgba(255,255,255,.25)" />
      </svg>
    ),
    titulo: "Triagem rápida e RYCS Academy",
    descricao: "Sua conta passa por uma triagem automática. Se precisar evoluir, a Academy tem trilhas gratuitas.",
    corpo: (cor) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { icon: Zap, texto: "Triagem automática em minutos" },
          { icon: GraduationCap, texto: "Cursos gratuitos para se qualificar" },
          { icon: Users, texto: "Suporte direto da equipe RYCS" },
        ].map((d, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "11px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `color-mix(in srgb, ${cor} 10%, transparent)`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <d.icon size={17} color={cor} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{d.texto}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export default function OnboardingProfissional({ onConcluir }) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const s = STEPS[step];

  return (
    <div className="vx-app" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div className="vx-fade" style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <img className="vx-logo" src="/logo-rycs.png" alt="RYCS"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            style={{ width: 90, margin: "0 auto" }} />
        </div>

        {/* Card principal */}
        <div style={{
          background: "var(--surface)", backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-border)", borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card)", overflow: "hidden",
        }}>
          {/* Ilustração topo */}
          <div style={{ padding: 8, paddingBottom: 0 }}>
            <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              {s.ilustracao}
            </div>
          </div>

          {/* Conteúdo */}
          <div style={{ padding: "16px 22px 22px" }}>
            <h2 className="vx-disp" style={{ fontSize: 18, margin: "0 0 6px", color: "var(--ink)" }}>{s.titulo}</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, margin: "0 0 16px" }}>{s.descricao}</p>

            {s.corpo(s.cor)}

            {/* Rodapé: dots + botões */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {STEPS.map((_, i) => (
                  <div key={i} style={{
                    width: i === step ? 18 : 6, height: 6, borderRadius: "var(--radius-pill)",
                    background: i === step ? s.cor : "var(--border-strong)",
                    transition: "all .25s ease",
                  }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onConcluir} style={{ fontSize: 12.5 }}>
                  Pular
                </button>
                {step < total - 1 ? (
                  <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => setStep(step + 1)}
                    style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
                    Próximo <ArrowRight size={14} />
                  </button>
                ) : (
                  <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" onClick={onConcluir}
                    style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
                    Criar minha conta <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
