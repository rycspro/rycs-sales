import { useState } from "react";
import { ArrowRight, Briefcase, DollarSign, GraduationCap, Rocket, ShieldCheck, Target, TrendingUp, Users } from "lucide-react";

const STEPS = [
  {
    icone: Rocket,
    cor: "#3B82F6",
    titulo: "Bem-vindo à RYCS Sales Machine",
    descricao: "A plataforma que conecta profissionais de vendas a empresas reais. Você escolhe as campanhas, executa e é remunerado por cada resultado comprovado.",
    destaques: [
      { icon: Briefcase, texto: "Trabalhe com empresas de verdade" },
      { icon: DollarSign, texto: "Ganhe por cada ação aprovada" },
      { icon: GraduationCap, texto: "Treinamentos gratuitos na plataforma" },
    ],
  },
  {
    icone: Target,
    cor: "#8B5CF6",
    titulo: "Como funciona na prática",
    descricao: "Empresas publicam campanhas com metas reais — agendar reuniões, fazer visitas, fechar vendas. Você se candidata, executa e registra cada ação.",
    passos: [
      { num: "1", texto: "Crie sua conta e complete seu perfil" },
      { num: "2", texto: "Candidate-se às campanhas disponíveis" },
      { num: "3", texto: "Execute as tarefas e registre as evidências" },
      { num: "4", texto: "A empresa aprova e você recebe" },
    ],
  },
  {
    icone: TrendingUp,
    cor: "#059669",
    titulo: "Quanto você pode ganhar",
    descricao: "Cada campanha define comissões por tipo de ação. Quanto melhor seu desempenho e seu score, mais campanhas premium você desbloqueia.",
    exemplos: [
      { acao: "Reunião agendada", faixa: "R$ 15 – R$ 50" },
      { acao: "Visita realizada", faixa: "R$ 30 – R$ 80" },
      { acao: "Venda fechada", faixa: "R$ 50 – R$ 500+" },
      { acao: "Lead qualificado", faixa: "R$ 5 – R$ 25" },
    ],
  },
  {
    icone: ShieldCheck,
    cor: "#0EA5E9",
    titulo: "Triagem rápida e RYCS Academy",
    descricao: "Ao criar sua conta, passamos por uma triagem automática. Se precisar de ajuste, a RYCS Academy oferece trilhas curtas para você se qualificar e tentar novamente.",
    destaques: [
      { icon: ShieldCheck, texto: "Triagem automática em minutos" },
      { icon: GraduationCap, texto: "Cursos gratuitos para se qualificar" },
      { icon: Users, texto: "Suporte direto da equipe RYCS" },
    ],
  },
];

export default function OnboardingProfissional({ onConcluir }) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const atual = STEPS[step];
  const Icone = atual.icone;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
      <div className="vx-fade" style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img className="vx-logo" src="/logo-rycs.png" alt="RYCS Sales Machine"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            style={{ width: 100, margin: "0 auto 10px" }} />
        </div>

        <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Header colorido */}
          <div style={{
            background: `linear-gradient(135deg, ${atual.cor}, ${atual.cor}dd)`,
            padding: "32px 24px", textAlign: "center", color: "#fff",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,.2)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
            }}>
              <Icone size={28} strokeWidth={1.8} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", lineHeight: 1.3 }}>{atual.titulo}</h2>
            <p style={{ fontSize: 13.5, opacity: 0.9, margin: 0, lineHeight: 1.55 }}>{atual.descricao}</p>
          </div>

          {/* Conteúdo */}
          <div style={{ padding: "20px 24px 24px" }}>
            {/* Destaques (steps 0 e 3) */}
            {atual.destaques && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {atual.destaques.map((d, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `color-mix(in srgb, ${atual.cor} 12%, transparent)`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <d.icon size={18} color={atual.cor} />
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{d.texto}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Passos numerados (step 1) */}
            {atual.passos && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {atual.passos.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", background: atual.cor, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0,
                    }}>
                      {p.num}
                    </div>
                    <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{p.texto}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Exemplos de ganho (step 2) */}
            {atual.exemplos && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {atual.exemplos.map((ex, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 14px", background: "var(--surface-2)", borderRadius: 10,
                  }}>
                    <span style={{ fontSize: 13, color: "var(--ink)" }}>{ex.acao}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: atual.cor }}>{ex.faixa}</span>
                  </div>
                ))}
                <p className="vx-mut" style={{ fontSize: 11.5, textAlign: "center", margin: "4px 0 0" }}>
                  Valores variam por campanha e empresa.
                </p>
              </div>
            )}

            {/* Dots + botões */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, gap: 12 }}>
              {/* Dots */}
              <div style={{ display: "flex", gap: 6 }}>
                {STEPS.map((_, i) => (
                  <div key={i} style={{
                    width: i === step ? 20 : 7, height: 7, borderRadius: 10,
                    background: i === step ? atual.cor : "var(--border)",
                    transition: "all .2s",
                  }} />
                ))}
              </div>

              {/* Ações */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="vx-btn vx-btn-ghost vx-btn-sm"
                  onClick={onConcluir}
                  style={{ fontSize: 12.5 }}
                >
                  Pular
                </button>
                {step < total - 1 ? (
                  <button
                    type="button"
                    className="vx-btn vx-btn-primary vx-btn-sm"
                    onClick={() => setStep((s) => s + 1)}
                    style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}
                  >
                    Próximo <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="vx-btn vx-btn-primary vx-btn-sm"
                    onClick={onConcluir}
                    style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}
                  >
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
