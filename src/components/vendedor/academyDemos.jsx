// Widgets de demonstração embutidos nas aulas da Academy.
//
// São DEMONSTRAÇÕES didáticas, não a ferramenta real e não dados reais: ilustram
// estrutura e fluxo (as abas do menu, o ciclo da jornada, o caminho da evidência,
// as dimensões do score, os estados da carteira). Por decisão de produto, nenhum
// widget inventa número financeiro nem perfil — quando o aluno precisa ver dado
// de verdade, a aula usa um passo `[[ir:...]]` que leva à tela real.
import { useState } from "react";
import {
  BarChart3, Target, GraduationCap, Wallet, Gift, User as UserIcon,
  CheckCircle2, Circle, ShieldCheck, FileCheck2, Banknote, ChevronRight, ArrowRight,
} from "lucide-react";

// Moldura comum: deixa explícito que é demonstração, nunca a tela real.
function Moldura({ titulo, children }) {
  return (
    <div className="vx-card" style={{ padding: 16, margin: "16px 0", background: "var(--surface-2)" }}>
      <div className="vx-row" style={{ marginBottom: 10 }}>
        <span className="vx-eyebrow" style={{ margin: 0 }}>Demonstração</span>
        {titulo && <span className="vx-mut" style={{ fontSize: 12 }}>{titulo}</span>}
      </div>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ menu ----
const ABAS_MENU = [
  { key: "painel", label: "Painel", Icon: BarChart3, texto: "Sua visão geral: score, atividade recente e para onde ir." },
  { key: "oportunidades", label: "Oportunidades", Icon: Target, texto: "As empresas e campanhas disponíveis para o seu perfil." },
  { key: "academy", label: "Academy", Icon: GraduationCap, texto: "Os cursos e certificações — você está aqui agora." },
  { key: "carteira", label: "Carteira", Icon: Wallet, texto: "Seu saldo, o que está liberado e o saque." },
  { key: "indicar", label: "Indicar", Icon: Gift, texto: "Convidar outros profissionais e ser reconhecido por isso." },
  { key: "perfil", label: "Perfil", Icon: UserIcon, texto: "Seu score por função, nível e o que a empresa vê de você." },
];

function DemoMenu({ navegar }) {
  return (
    <Moldura titulo="As 6 telas do profissional">
      <div className="vx-grid" style={{ gap: 8 }}>
        {ABAS_MENU.map(({ key, label, Icon, texto }) => (
          <div key={key} className="vx-row" style={{ gap: 10, padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)" }}>
            <Icon size={16} color="var(--brand)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 13 }}>{label}</b>
              <div className="vx-mut" style={{ fontSize: 11.5 }}>{texto}</div>
            </div>
            {navegar && key !== "academy" && (
              <button type="button" className="vx-btn vx-btn-sm" style={{ flexShrink: 0, minHeight: 44 }}
                aria-label={`Abrir ${label}`} onClick={() => navegar(key)}>
                Abrir <ChevronRight size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 10 }}>
        Toque em “Abrir” para conhecer a tela de verdade — depois use “Voltar ao curso” para continuar aqui.
      </div>
    </Moldura>
  );
}

// ----------------------------------------------------------------- ciclo ----
const PASSOS_CICLO = [
  ["Cadastro e onboarding", "A plataforma te conhece: dados, função e como você trabalha."],
  ["Triagem", "Você é avaliado e liberado para representar empresas."],
  ["Oportunidades", "Você encontra empresas e campanhas para o seu perfil."],
  ["Treinamento e certificação", "Você fica apto no produto e no público daquela empresa."],
  ["Trabalho com evidência", "Você executa a atividade e registra a prova dela."],
  ["Auditoria", "A plataforma valida se a evidência é real e única."],
  ["Carteira e saque", "A evidência aprovada vira saldo, e você saca."],
  ["Score e níveis", "O histórico te coloca na frente da próxima campanha."],
];

function DemoCiclo() {
  const [ativo, setAtivo] = useState(0);
  return (
    <Moldura titulo="O ciclo, do cadastro ao pagamento">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PASSOS_CICLO.map(([titulo, texto], i) => {
          const on = i === ativo;
          return (
            <button key={i} type="button" onClick={() => setAtivo(i)}
              aria-expanded={on} aria-label={`Passo ${i + 1}: ${titulo}`}
              style={{
                display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", width: "100%",
                padding: "10px 12px", minHeight: 44, borderRadius: 10, cursor: "pointer",
                border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`,
                background: on ? "var(--brand-100)" : "var(--surface)", font: "inherit",
              }}>
              <span className="vx-mono" style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: 7, fontSize: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: on ? "var(--brand)" : "var(--surface-2)", color: on ? "#fff" : "var(--muted)",
              }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13, color: on ? "var(--brand)" : "var(--ink)" }}>{titulo}</b>
                {on && <div className="vx-mut" style={{ fontSize: 12, marginTop: 3 }}>{texto}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </Moldura>
  );
}

// ------------------------------------------------------------- evidencia ----
const ETAPAS_EV = [
  { Icon: FileCheck2, titulo: "1. Você registra", texto: "Conversa, reunião ou venda — sempre com a prova: o contato e o que aconteceu." },
  { Icon: ShieldCheck, titulo: "2. A RYCS audita", texto: "A plataforma confere se a atividade é real, única e bate com a campanha." },
  { Icon: Banknote, titulo: "3. Vira saldo", texto: "Aprovada, a atividade entra na sua Carteira. Recusada, não vira dinheiro." },
];

function DemoEvidencia() {
  const [passo, setPasso] = useState(0);
  return (
    <Moldura titulo="O caminho de uma atividade">
      <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
        {ETAPAS_EV.map(({ Icon, titulo, texto }, i) => {
          const on = i <= passo;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 160px" }}>
              <div style={{
                flex: 1, padding: "12px 12px", borderRadius: 10, minWidth: 0,
                border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`,
                background: on ? "var(--brand-100)" : "var(--surface)", opacity: on ? 1 : 0.6,
              }}>
                <Icon size={18} color={on ? "var(--brand)" : "var(--muted)"} />
                <b style={{ display: "block", fontSize: 12.5, marginTop: 6 }}>{titulo}</b>
                <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2 }}>{texto}</div>
              </div>
              {i < ETAPAS_EV.length - 1 && <ArrowRight size={16} color="var(--muted)" style={{ flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>
      <button type="button" className="vx-btn vx-btn-sm" style={{ marginTop: 12, minHeight: 44 }}
        onClick={() => setPasso((p) => (p + 1) % ETAPAS_EV.length)}>
        {passo < ETAPAS_EV.length - 1 ? "Avançar no fluxo" : "Recomeçar"}
      </button>
    </Moldura>
  );
}

// ---------------------------------------------------------------- score ----
const DIMENSOES = [
  ["Desempenho", "Quanto resultado você entrega no período."],
  ["Conhecimento", "O quanto você domina produto e processo (inclui Academy)."],
  ["Comunicação", "Clareza e postura no contato com o cliente."],
  ["Confiabilidade", "Evidência honesta e consistente, sem recusa por fraude."],
  ["Conversão", "Quanto do que você trabalha de fato avança."],
  ["Qualidade", "O padrão do que você entrega, não só o volume."],
  ["Consistência", "Manter o nível ao longo do tempo, não só num dia bom."],
];

function DemoScore() {
  const [sel, setSel] = useState(0);
  return (
    <Moldura titulo="As dimensões do RYCS Score">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {DIMENSOES.map(([nome], i) => (
          <button key={i} type="button" onClick={() => setSel(i)}
            aria-pressed={i === sel} className="vx-chip" style={{
              cursor: "pointer", minHeight: 36,
              borderColor: i === sel ? "var(--brand)" : "var(--border)",
              background: i === sel ? "var(--brand-100)" : "transparent",
              color: i === sel ? "var(--brand)" : "var(--ink)",
            }}>{nome}</button>
        ))}
      </div>
      <div className="vx-notice" style={{ marginTop: 10 }}>
        <b style={{ fontSize: 13 }}>{DIMENSOES[sel][0]}</b>
        <div className="vx-mut" style={{ fontSize: 12, marginTop: 2 }}>{DIMENSOES[sel][1]}</div>
      </div>
      <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 8 }}>
        O score é medido <b>por função</b> e o que é recente pesa mais. Aqui mostramos as dimensões,
        não uma nota — a sua você vê no Perfil.
      </div>
    </Moldura>
  );
}

// -------------------------------------------------------------- carteira ----
const ESTADOS_CARTEIRA = [
  ["Saldo total", "Tudo o que suas atividades aprovadas já somaram."],
  ["Saldo liberado", "A parte já disponível para saque, conforme as regras."],
  ["Sacado", "O que você já transferiu para fora da plataforma."],
];

function DemoCarteira() {
  return (
    <Moldura titulo="Os estados do seu dinheiro na Carteira">
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {ESTADOS_CARTEIRA.map(([nome, texto], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 150px" }}>
            <div style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", minWidth: 0 }}>
              <Wallet size={16} color="var(--brand)" />
              <b style={{ display: "block", fontSize: 12.5, marginTop: 6 }}>{nome}</b>
              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2 }}>{texto}</div>
            </div>
            {i < ESTADOS_CARTEIRA.length - 1 && <ArrowRight size={16} color="var(--muted)" style={{ flexShrink: 0 }} />}
          </div>
        ))}
      </div>
      <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 10 }}>
        Esta é a estrutura, sem valores. Os seus números reais estão na tela da Carteira.
      </div>
    </Moldura>
  );
}

// --------------------------------------------------------------- registro ----
export const DEMOS = {
  menu: DemoMenu,
  ciclo: DemoCiclo,
  evidencia: DemoEvidencia,
  score: DemoScore,
  carteira: DemoCarteira,
};

export function temDemo(chave) {
  return Object.prototype.hasOwnProperty.call(DEMOS, chave);
}
