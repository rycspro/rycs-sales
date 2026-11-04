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
  const [email, setEmail] = useState("");
  const c = conteudo[aba];

  return (
    <div style={s.page} data-landing-light="1">
      <style>{`
        [data-landing-light] { color-scheme: light !important; }
        [data-landing-light], [data-landing-light] * { color: inherit; }
      `}</style>

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
        <div style={s.footerInner}>
          <div style={s.footerGrid}>

            {/* Newsletter */}
            <div style={s.footerCol}>
              <h2 style={s.footerColTitle}>Fique por dentro</h2>
              <p style={s.footerColText}>
                Receba novidades sobre campanhas, dicas de vendas e atualizações da plataforma.
              </p>
              <form style={s.newsletterForm} onSubmit={(e) => { e.preventDefault(); if (email.trim()) { setEmail(""); } }}>
                <input
                  type="email"
                  placeholder="Seu melhor e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={s.newsletterInput}
                />
                <button type="submit" style={s.newsletterBtn} aria-label="Inscrever-se">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </form>
            </div>

            {/* Links rápidos */}
            <div style={s.footerCol}>
              <h3 style={s.footerColSubtitle}>Links rápidos</h3>
              <nav style={s.footerNav}>
                <button style={s.footerNavLink} onClick={() => navegar("/")}>Início</button>
                <button style={s.footerNavLink} onClick={() => navegar("/cadastro/empresa")}>Cadastro empresa</button>
                <button style={s.footerNavLink} onClick={() => navegar("/cadastro/profissional")}>Cadastro profissional</button>
                <button style={s.footerNavLink} onClick={() => navegar("/entrar")}>Entrar na plataforma</button>
              </nav>
            </div>

            {/* Contato */}
            <div style={s.footerCol}>
              <h3 style={s.footerColSubtitle}>Contato</h3>
              <div style={s.footerAddress}>
                <p>São Paulo, SP — Brasil</p>
                <p>contato@rycs.com.br</p>
              </div>
            </div>

            {/* Redes sociais */}
            <div style={s.footerCol}>
              <h3 style={s.footerColSubtitle}>Redes sociais</h3>
              <div style={s.socialRow}>
                {[
                  { label: "Instagram", path: "M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zm1.5-4.87h.01M6.5 2h11A4.5 4.5 0 0122 6.5v11a4.5 4.5 0 01-4.5 4.5h-11A4.5 4.5 0 012 17.5v-11A4.5 4.5 0 016.5 2z" },
                  { label: "LinkedIn", path: "M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 2a2 2 0 110 4 2 2 0 010-4z" },
                  { label: "Facebook", path: "M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3V2z" },
                ].map(({ label, path }) => (
                  <button key={label} style={s.socialBtn} title={label} aria-label={label}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={s.footerBottom}>
            <p style={s.footerCopy}>© {new Date().getFullYear()} RYCS Sales Solutions. Todos os direitos reservados.</p>
            <nav style={s.footerBottomNav}>
              <button style={s.footerBottomLink}>Política de privacidade</button>
              <button style={s.footerBottomLink}>Termos de uso</button>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

const BRAND = "#2563EB";
const BRAND_DARK = "#1D4ED8";
const BRAND_LIGHT = "#EFF6FF";
const BRAND_MID = "#BFDBFE";
const INK = "#0B1220";
const MUTED = "#64748B";
const MUTED2 = "#94A3B8";
const BORDER = "#E2E8F0";
const BG = "#FFFFFF";
const BG_PAGE = "#F8FAFF";

const s = {
  page: {
    minHeight: "100vh",
    background: BG_PAGE,
    color: INK,
    fontFamily: "'Inter', system-ui, sans-serif",
    WebkitFontSmoothing: "antialiased",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: `1px solid ${BORDER}`,
    background: BG,
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
    background: BG,
    borderBottom: `1px solid ${BORDER}`,
    display: "flex",
    justifyContent: "center",
    padding: "0 24px",
  },
  abaWrap: { display: "flex", gap: 0, maxWidth: 480, width: "100%" },
  abaBtn: {
    flex: 1,
    padding: "14px 20px",
    border: "none",
    background: "none",
    color: MUTED,
    fontWeight: 600,
    fontSize: 14.5,
    cursor: "pointer",
    borderBottom: "3px solid transparent",
    transition: "color .15s, border-color .15s",
  },
  abaBtnAtivo: { color: BRAND, borderBottom: `3px solid ${BRAND}` },
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
    color: INK,
  },
  heroSub: { fontSize: 17, color: "#475569", lineHeight: 1.65, margin: "0 0 40px" },
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
    boxShadow: "0 4px 14px -4px rgba(37,99,235,.4)",
    transition: "background .15s",
  },
  btnSecondary: {
    background: BG,
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
    color: INK,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
  },
  card: {
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    padding: "28px 24px",
    boxShadow: "0 1px 4px rgba(0,0,0,.04)",
  },
  cardIcon: { fontSize: 28, display: "block", marginBottom: 14 },
  cardTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600,
    fontSize: 15.5,
    color: INK,
    margin: "0 0 10px",
  },
  cardDesc: { color: MUTED, fontSize: 14, lineHeight: 1.6, margin: 0 },
  steps: { display: "flex", flexDirection: "column", gap: 28, maxWidth: 680, margin: "0 auto" },
  step: { display: "flex", gap: 20, alignItems: "flex-start" },
  stepNum: {
    minWidth: 40, height: 40, borderRadius: "50%", background: BRAND,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 16, color: "#fff", flexShrink: 0,
    boxShadow: "0 4px 12px -4px rgba(37,99,235,.5)",
  },
  stepTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600, fontSize: 15.5, color: INK, margin: "0 0 6px",
  },
  stepDesc: { color: MUTED, fontSize: 14, lineHeight: 1.6, margin: 0 },
  ctaFinal: { textAlign: "center", padding: "80px 24px", background: BRAND },
  ctaTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(24px, 3.5vw, 38px)",
    fontWeight: 700, color: "#fff", margin: "0 0 16px",
  },
  ctaSub: { color: "rgba(255,255,255,.8)", fontSize: 16, margin: "0 0 36px" },
  ctaBtn: {
    background: "#fff", color: BRAND, border: "none", borderRadius: 10,
    padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer", minHeight: 48,
  },

  /* ── FOOTER ──────────────────────────────────────────────────────────── */
  footer: {
    background: BG,
    borderTop: `1px solid ${BORDER}`,
    color: INK,
  },
  footerInner: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "48px 24px 0",
  },
  footerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "40px 32px",
  },
  footerCol: {},
  footerColTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 22,
    fontWeight: 700,
    margin: "0 0 10px",
    color: INK,
    letterSpacing: "-.01em",
  },
  footerColText: {
    fontSize: 13.5,
    color: MUTED,
    lineHeight: 1.6,
    margin: "0 0 16px",
  },
  footerColSubtitle: {
    fontSize: 15,
    fontWeight: 600,
    margin: "0 0 14px",
    color: INK,
  },
  newsletterForm: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  newsletterInput: {
    width: "100%",
    padding: "11px 44px 11px 14px",
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    fontSize: 13.5,
    background: BG_PAGE,
    color: INK,
    outline: "none",
    fontFamily: "inherit",
  },
  newsletterBtn: {
    position: "absolute",
    right: 5,
    top: "50%",
    transform: "translateY(-50%)",
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: BRAND,
    color: "#fff",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "transform .15s",
  },
  footerNav: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  footerNavLink: {
    background: "none",
    border: "none",
    padding: 0,
    color: MUTED,
    fontSize: 13.5,
    cursor: "pointer",
    textAlign: "left",
    transition: "color .15s",
  },
  footerAddress: {
    fontSize: 13.5,
    color: MUTED,
    lineHeight: 1.8,
  },
  socialRow: {
    display: "flex",
    gap: 10,
  },
  socialBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: `1px solid ${BORDER}`,
    background: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: MUTED,
    transition: "color .15s, border-color .15s",
  },
  footerBottom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 40,
    paddingTop: 20,
    paddingBottom: 24,
    borderTop: `1px solid ${BORDER}`,
  },
  footerCopy: {
    fontSize: 12.5,
    color: MUTED2,
    margin: 0,
  },
  footerBottomNav: {
    display: "flex",
    gap: 16,
  },
  footerBottomLink: {
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 12.5,
    color: MUTED2,
    cursor: "pointer",
    transition: "color .15s",
  },
};
