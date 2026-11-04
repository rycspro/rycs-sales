import { useState } from "react";
import { navegar } from "../lib/rotas.js";

const ABAS = ["empresa", "profissional"];

const conteudo = {
  empresa: {
    heroBadge: "Para empresas",
    heroTitle: "Monte seu time de vendas sem custo fixo",
    heroSub: "Conecte sua empresa a vendedores autônomos qualificados. Pague só por resultado. Campanha criada com IA em menos de 5 minutos.",
    ctaPrimario: { label: "Criar conta grátis", rota: "/cadastro/empresa" },
    ctaSecundario: { label: "Entrar na plataforma", rota: "/entrar" },
    passos: [
      { n: "1", t: "Crie sua campanha com IA", d: "Descreva seu produto e deixe o Jarvas estruturar objetivo, região, público e remuneração em minutos." },
      { n: "2", t: "Vendedores se candidatam", d: "Profissionais qualificados da rede RYCS se inscrevem. Você escolhe quem entra na sua campanha." },
      { n: "3", t: "Acompanhe em tempo real", d: "Veja leads, visitas e fechamentos acontecendo. Score e histórico de cada vendedor na tela." },
      { n: "4", t: "Pague por resultado", d: "Aprove as comissões no painel. O sistema processa e transfere automaticamente para o vendedor." },
    ],
    beneficios: [
      { icone: "🎯", t: "Campanha com IA", d: "O Jarvas estrutura toda a campanha por voz ou texto. Objetivo, região, público e vagas definidos em minutos." },
      { icone: "💰", t: "Pague só por resultado", d: "Sem CLT, sem custo fixo. Você define a comissão e paga apenas quando a venda acontece." },
      { icone: "📊", t: "Gestão completa", d: "Acompanhe candidaturas, pontuação dos vendedores, saldo e histórico de pagamentos em um só lugar." },
      { icone: "🏆", t: "Vendedores com score", d: "Contrate quem já provou resultado. Cada profissional tem histórico e pontuação verificados." },
      { icone: "⚡", t: "Pagamento automatizado", d: "O sistema calcula e processa as comissões. Você aprova, o dinheiro vai direto ao vendedor." },
      { icone: "🔒", t: "Auditoria total", d: "Todo lead, visita e venda fica registrado. Sem achismo, sem briga por comissão." },
    ],
  },
  profissional: {
    heroBadge: "Para vendedores autônomos",
    heroTitle: "Trabalhe pelas melhores campanhas e receba por resultado",
    heroSub: "Acesse campanhas de empresas selecionadas, construa seu histórico e aumente seus ganhos. Sem vínculo, sem burocracia.",
    ctaPrimario: { label: "Criar conta grátis", rota: "/cadastro/profissional" },
    ctaSecundario: { label: "Já tenho conta", rota: "/entrar" },
    passos: [
      { n: "1", t: "Crie seu perfil", d: "Cadastre suas especialidades, regiões de atuação e experiência. Leva menos de 5 minutos." },
      { n: "2", t: "Candidate-se a campanhas", d: "Veja as campanhas disponíveis e candidate-se às que combinam com seu perfil." },
      { n: "3", t: "Realize as atividades", d: "Execute as visitas, ligações ou reuniões definidas na campanha e registre tudo na plataforma." },
      { n: "4", t: "Receba sua comissão", d: "A empresa aprova e o pagamento cai direto na sua conta. Transparente, rastreável, sem atraso." },
    ],
    beneficios: [
      { icone: "🚀", t: "Acesso imediato a campanhas", d: "Empresas de diferentes segmentos publicando campanhas diariamente. Escolha o que faz sentido para você." },
      { icone: "💸", t: "Ganhe por resultado", d: "Comissões claras antes de começar. Você sabe exatamente quanto vai receber por cada venda ou reunião." },
      { icone: "🏆", t: "Construa seu score", d: "Cada entrega aumenta sua pontuação. Com score alto, você tem prioridade nas melhores campanhas." },
      { icone: "📍", t: "Trabalhe na sua região", d: "Filtre campanhas pela sua cidade ou estado. Atue onde você já conhece o mercado." },
      { icone: "📱", t: "Tudo no celular", d: "Registre visitas, leads e atividades direto pelo app. Sem papelada, sem planilha." },
      { icone: "🔓", t: "Sem vínculo empregatício", d: "Você é autônomo. Trabalhe quantas campanhas quiser, no horário que preferir." },
    ],
  },
};

export default function LandingPage() {
  const [aba, setAba] = useState("empresa");
  const c = conteudo[aba];

  return (
    <div style={s.page}>
      {/* NAV */}
      <nav style={s.nav}>
        <span style={s.logo}>RYCS</span>
        <div style={s.navLinks}>
          <button style={s.navLink} onClick={() => navegar("/entrar")}>Entrar</button>
          <button style={s.btnPrimary} onClick={() => navegar(c.ctaPrimario.rota)}>Criar conta grátis</button>
        </div>
      </nav>

      {/* ABAS */}
      <div style={s.abaBar}>
        <div style={s.abaWrap}>
          {ABAS.map((a) => (
            <button
              key={a}
              style={{ ...s.abaBtn, ...(aba === a ? s.abaBtnAtivo : {}) }}
              onClick={() => setAba(a)}
            >
              {a === "empresa" ? "🏢 Para empresas" : "🤝 Para vendedores"}
            </button>
          ))}
        </div>
      </div>

      {/* HERO */}
      <section style={s.hero}>
        <div style={s.heroBadge}>{c.heroBadge}</div>
        <h1 style={s.heroTitle}>{c.heroTitle}</h1>
        <p style={s.heroSub}>{c.heroSub}</p>
        <div style={s.heroCtas}>
          <button style={s.btnPrimary} onClick={() => navegar(c.ctaPrimario.rota)}>{c.ctaPrimario.label}</button>
          <button style={s.btnSecondary} onClick={() => navegar(c.ctaSecundario.rota)}>{c.ctaSecundario.label}</button>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Por que usar a RYCS?</h2>
        <div style={s.grid}>
          {c.beneficios.map((b) => (
            <div key={b.t} style={s.card}>
              <span style={s.cardIcon}>{b.icone}</span>
              <h3 style={s.cardTitle}>{b.t}</h3>
              <p style={s.cardDesc}>{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section style={s.sectionAlt}>
        <h2 style={s.sectionTitle}>Como funciona</h2>
        <div style={s.steps}>
          {c.passos.map((p) => (
            <div key={p.n} style={s.step}>
              <div style={s.stepNum}>{p.n}</div>
              <div>
                <h3 style={s.stepTitle}>{p.t}</h3>
                <p style={s.stepDesc}>{p.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={s.ctaFinal}>
        <h2 style={s.ctaTitle}>
          {aba === "empresa" ? "Pronto para montar seu time?" : "Pronto para começar a vender?"}
        </h2>
        <p style={s.ctaSub}>
          {aba === "empresa"
            ? "Crie sua conta grátis e lance sua primeira campanha hoje."
            : "Cadastre-se e candidate-se às melhores campanhas agora."}
        </p>
        <button style={s.ctaBtn} onClick={() => navegar(c.ctaPrimario.rota)}>
          {c.ctaPrimario.label}
        </button>
      </section>

      {/* FOOTER */}
      <footer style={s.footer}>
        <span style={s.logo}>RYCS</span>
        <span style={s.footerText}>© {new Date().getFullYear()} RYCS Sales Solutions · Todos os direitos reservados</span>
        <button style={s.footerLink} onClick={() => navegar("/entrar")}>Entrar na plataforma</button>
      </footer>
    </div>
  );
}

const BRAND = "#2563EB";
const BRAND_DARK = "#1D4ED8";
const BRAND_LIGHT = "#EFF6FF";
const BRAND_MID = "#BFDBFE";

const s = {
  page: {
    minHeight: "100vh",
    background: "#F8FAFF",
    color: "#0B1220",
    fontFamily: "'Inter', system-ui, sans-serif",
    WebkitFontSmoothing: "antialiased",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: "1px solid #E2E8F0",
    background: "#fff",
    position: "sticky",
    top: 0,
    zIndex: 100,
    boxShadow: "0 1px 4px rgba(0,0,0,.06)",
  },
  logo: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    color: BRAND,
    letterSpacing: "0.04em",
  },
  navLinks: { display: "flex", alignItems: "center", gap: 12 },
  navLink: {
    background: "none",
    border: "none",
    color: "#475569",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    padding: "8px 12px",
  },
  abaBar: {
    background: "#fff",
    borderBottom: "1px solid #E2E8F0",
    display: "flex",
    justifyContent: "center",
    padding: "0 24px",
  },
  abaWrap: {
    display: "flex",
    gap: 0,
    maxWidth: 480,
    width: "100%",
  },
  abaBtn: {
    flex: 1,
    padding: "14px 20px",
    border: "none",
    background: "none",
    color: "#64748B",
    fontWeight: 600,
    fontSize: 14.5,
    cursor: "pointer",
    borderBottom: "3px solid transparent",
    transition: "color .15s, border-color .15s",
  },
  abaBtnAtivo: {
    color: BRAND,
    borderBottom: `3px solid ${BRAND}`,
  },
  hero: {
    textAlign: "center",
    padding: "72px 24px 64px",
    maxWidth: 720,
    margin: "0 auto",
  },
  heroBadge: {
    display: "inline-block",
    background: BRAND_LIGHT,
    color: BRAND,
    border: `1px solid ${BRAND_MID}`,
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: ".04em",
    padding: "5px 14px",
    marginBottom: 24,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(28px, 4.5vw, 46px)",
    fontWeight: 700,
    lineHeight: 1.18,
    margin: "0 0 20px",
    color: "#0B1220",
  },
  heroSub: {
    fontSize: 17,
    color: "#475569",
    lineHeight: 1.65,
    margin: "0 0 40px",
  },
  heroCtas: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" },
  btnPrimary: {
    background: BRAND,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "13px 24px",
    fontWeight: 600,
    fontSize: 14.5,
    cursor: "pointer",
    minHeight: 44,
    boxShadow: `0 4px 14px -4px rgba(37,99,235,.4)`,
    transition: "background .15s",
  },
  btnSecondary: {
    background: "#fff",
    color: BRAND,
    border: `1.5px solid ${BRAND_MID}`,
    borderRadius: 10,
    padding: "13px 24px",
    fontWeight: 600,
    fontSize: 14.5,
    cursor: "pointer",
    minHeight: 44,
  },
  section: { padding: "72px 24px", maxWidth: 1100, margin: "0 auto" },
  sectionAlt: {
    padding: "72px 24px",
    background: BRAND_LIGHT,
    borderTop: `1px solid ${BRAND_MID}`,
    borderBottom: `1px solid ${BRAND_MID}`,
  },
  sectionTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(22px, 3vw, 32px)",
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 48,
    marginTop: 0,
    color: "#0B1220",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
  },
  card: {
    background: "#fff",
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    padding: "28px 24px",
    boxShadow: "0 1px 4px rgba(0,0,0,.04)",
  },
  cardIcon: { fontSize: 28, display: "block", marginBottom: 14 },
  cardTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600,
    fontSize: 15.5,
    color: "#0B1220",
    margin: "0 0 10px",
  },
  cardDesc: { color: "#64748B", fontSize: 14, lineHeight: 1.6, margin: 0 },
  steps: {
    display: "flex",
    flexDirection: "column",
    gap: 28,
    maxWidth: 680,
    margin: "0 auto",
  },
  step: { display: "flex", gap: 20, alignItems: "flex-start" },
  stepNum: {
    minWidth: 40,
    height: 40,
    borderRadius: "50%",
    background: BRAND,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 16,
    color: "#fff",
    flexShrink: 0,
    boxShadow: `0 4px 12px -4px rgba(37,99,235,.5)`,
  },
  stepTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600,
    fontSize: 15.5,
    color: "#0B1220",
    margin: "0 0 6px",
  },
  stepDesc: { color: "#64748B", fontSize: 14, lineHeight: 1.6, margin: 0 },
  ctaFinal: {
    textAlign: "center",
    padding: "80px 24px",
    background: BRAND,
  },
  ctaTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(24px, 3.5vw, 38px)",
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 16px",
  },
  ctaSub: { color: "rgba(255,255,255,.8)", fontSize: 16, margin: "0 0 36px" },
  ctaBtn: {
    background: "#fff",
    color: BRAND,
    border: "none",
    borderRadius: 10,
    padding: "14px 28px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    minHeight: 48,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    padding: "24px",
    borderTop: "1px solid #E2E8F0",
    background: "#fff",
  },
  footerText: { color: "#94A3B8", fontSize: 13 },
  footerLink: {
    background: "none",
    border: "none",
    color: BRAND,
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    fontWeight: 500,
  },
};
