import { navegar } from "../lib/rotas.js";

const beneficios = [
  {
    icone: "🎯",
    titulo: "Campanha com IA",
    descricao: "Crie campanhas de vendas com inteligência artificial. O Jarvas estrutura objetivo, região, público e vagas em minutos.",
  },
  {
    icone: "💰",
    titulo: "Comissão real, sem vínculo",
    descricao: "Vendedores autônomos trabalham pelas suas campanhas e recebem por resultado. Sem CLT, sem custo fixo.",
  },
  {
    icone: "📊",
    titulo: "Gestão completa",
    descricao: "Acompanhe candidaturas, pontuação dos vendedores, saldo de caixa e histórico de pagamentos em um só lugar.",
  },
  {
    icone: "⚡",
    titulo: "Pagamento automatizado",
    descricao: "O sistema calcula e processa as comissões automaticamente. Você aprova, o dinheiro vai direto ao vendedor.",
  },
  {
    icone: "🏆",
    titulo: "Score de desempenho",
    descricao: "Cada vendedor acumula pontuação por entregas. Você contrata quem já provou resultado, sem apostar no escuro.",
  },
  {
    icone: "🔒",
    titulo: "Seguro e rastreável",
    descricao: "Todo lead, visita e venda fica registrado. Auditoria completa, sem achismo, sem briga por comissão.",
  },
];

const planos = [
  {
    nome: "Starter",
    para: "Empresas que estão começando",
    destaques: ["1 campanha ativa", "Até 5 vendedores", "Relatórios básicos"],
    cta: "Começar grátis",
    destaque: false,
  },
  {
    nome: "Growth",
    para: "Operações em expansão",
    destaques: ["Campanhas ilimitadas", "Vendedores ilimitados", "IA para criação de campanha", "Score avançado"],
    cta: "Quero o Growth",
    destaque: true,
  },
  {
    nome: "Enterprise",
    para: "Grandes times comerciais",
    destaques: ["Tudo do Growth", "Integração via API", "Suporte dedicado", "Personalização de marca"],
    cta: "Falar com vendas",
    destaque: false,
  },
];

export default function LandingPage() {
  return (
    <div style={s.page}>
      {/* NAV */}
      <nav style={s.nav}>
        <span style={s.logo}>RYCS</span>
        <div style={s.navLinks}>
          <button style={s.navLink} onClick={() => navegar("/entrar")}>Entrar</button>
          <button style={s.btnPrimary} onClick={() => navegar("/cadastro")}>Criar conta grátis</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={s.hero}>
        <div style={s.heroBadge}>Plataforma de vendas por comissão</div>
        <h1 style={s.heroTitle}>
          Monte seu time de vendas<br />
          <span style={s.heroGrad}>sem custo fixo</span>
        </h1>
        <p style={s.heroSub}>
          Conecte sua empresa a vendedores autônomos qualificados. Pague só por resultado.
          Campanha criada com IA em menos de 5 minutos.
        </p>
        <div style={s.heroCtas}>
          <button style={s.btnPrimary} onClick={() => navegar("/cadastro/empresa")}>
            Quero contratar vendedores
          </button>
          <button style={s.btnSecondary} onClick={() => navegar("/cadastro/profissional")}>
            Sou vendedor autônomo
          </button>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Tudo que você precisa para vender mais</h2>
        <div style={s.grid}>
          {beneficios.map((b) => (
            <div key={b.titulo} style={s.card}>
              <span style={s.cardIcon}>{b.icone}</span>
              <h3 style={s.cardTitle}>{b.titulo}</h3>
              <p style={s.cardDesc}>{b.descricao}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section style={s.sectionAlt}>
        <h2 style={s.sectionTitle}>Como funciona</h2>
        <div style={s.steps}>
          {[
            { n: "1", t: "Crie sua campanha", d: "Descreva seu produto e deixe o Jarvas (IA) estruturar objetivo, região, público e remuneração." },
            { n: "2", t: "Vendedores se candidatam", d: "Profissionais qualificados da rede RYCS se inscrevem. Você escolhe quem entra na campanha." },
            { n: "3", t: "Acompanhe em tempo real", d: "Veja leads, visitas e fechamentos acontecendo. Score e histórico de cada vendedor na tela." },
            { n: "4", t: "Pague por resultado", d: "Aprove as comissões no painel. O sistema processa e transfere automaticamente para o vendedor." },
          ].map((s2) => (
            <div key={s2.n} style={s.step}>
              <div style={s.stepNum}>{s2.n}</div>
              <div>
                <h3 style={s.stepTitle}>{s2.t}</h3>
                <p style={s.stepDesc}>{s2.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PLANOS */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Planos</h2>
        <p style={s.sectionSub}>Comece grátis. Escale quando precisar.</p>
        <div style={s.planosGrid}>
          {planos.map((p) => (
            <div key={p.nome} style={{ ...s.planoCard, ...(p.destaque ? s.planoDestaque : {}) }}>
              {p.destaque && <div style={s.planoBadge}>Mais popular</div>}
              <h3 style={s.planoNome}>{p.nome}</h3>
              <p style={s.planoPara}>{p.para}</p>
              <ul style={s.planoList}>
                {p.destaques.map((d) => (
                  <li key={d} style={s.planoItem}>
                    <span style={s.planoCheck}>✓</span> {d}
                  </li>
                ))}
              </ul>
              <button
                style={p.destaque ? s.btnPrimary : s.btnOutline}
                onClick={() => navegar("/cadastro/empresa")}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={s.ctaFinal}>
        <h2 style={s.ctaTitle}>Pronto para montar seu time?</h2>
        <p style={s.ctaSub}>Crie sua conta em minutos e lance sua primeira campanha hoje.</p>
        <button style={s.btnPrimary} onClick={() => navegar("/cadastro/empresa")}>
          Começar agora — é grátis
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

const s = {
  page: {
    minHeight: "100vh",
    background: "#0D1424",
    color: "#E8F0FE",
    fontFamily: "'Inter', system-ui, sans-serif",
    WebkitFontSmoothing: "antialiased",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 24px",
    borderBottom: "1px solid rgba(255,255,255,.07)",
    position: "sticky",
    top: 0,
    background: "rgba(13,20,36,.92)",
    backdropFilter: "blur(12px)",
    zIndex: 100,
  },
  logo: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    color: "#60A5FA",
    letterSpacing: "0.04em",
  },
  navLinks: { display: "flex", alignItems: "center", gap: 12 },
  navLink: {
    background: "none",
    border: "none",
    color: "#B0C4E0",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    padding: "8px 12px",
  },
  hero: {
    textAlign: "center",
    padding: "80px 24px 72px",
    maxWidth: 720,
    margin: "0 auto",
  },
  heroBadge: {
    display: "inline-block",
    background: "rgba(37,99,235,.18)",
    color: "#60A5FA",
    border: "1px solid rgba(37,99,235,.35)",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: ".04em",
    padding: "5px 14px",
    marginBottom: 28,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(32px, 5vw, 52px)",
    fontWeight: 700,
    lineHeight: 1.15,
    margin: "0 0 20px",
    color: "#E8F0FE",
  },
  heroGrad: {
    background: "linear-gradient(135deg,#2563EB 0%,#38BDF8 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  heroSub: {
    fontSize: 17,
    color: "#7C93B5",
    lineHeight: 1.65,
    margin: "0 0 40px",
  },
  heroCtas: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" },
  btnPrimary: {
    background: "linear-gradient(135deg,#2563EB 0%,#4338CA 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "13px 24px",
    fontWeight: 600,
    fontSize: 14.5,
    cursor: "pointer",
    minHeight: 44,
    boxShadow: "0 4px 16px -4px rgba(37,99,235,.5)",
  },
  btnSecondary: {
    background: "rgba(255,255,255,.07)",
    color: "#E8F0FE",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 10,
    padding: "13px 24px",
    fontWeight: 600,
    fontSize: 14.5,
    cursor: "pointer",
    minHeight: 44,
  },
  btnOutline: {
    background: "transparent",
    color: "#60A5FA",
    border: "1px solid rgba(37,99,235,.5)",
    borderRadius: 10,
    padding: "13px 24px",
    fontWeight: 600,
    fontSize: 14.5,
    cursor: "pointer",
    minHeight: 44,
    width: "100%",
  },
  section: { padding: "72px 24px", maxWidth: 1100, margin: "0 auto" },
  sectionAlt: {
    padding: "72px 24px",
    maxWidth: 1100,
    margin: "0 auto",
    background: "rgba(255,255,255,.025)",
    borderRadius: 24,
  },
  sectionTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(24px, 3vw, 34px)",
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 12,
    color: "#E8F0FE",
  },
  sectionSub: { textAlign: "center", color: "#7C93B5", fontSize: 15, marginBottom: 48, marginTop: 0 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
    marginTop: 48,
  },
  card: {
    background: "rgba(255,255,255,.045)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 16,
    padding: "28px 24px",
  },
  cardIcon: { fontSize: 28, display: "block", marginBottom: 16 },
  cardTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: "#E8F0FE", margin: "0 0 10px" },
  cardDesc: { color: "#7C93B5", fontSize: 14, lineHeight: 1.6, margin: 0 },
  steps: { display: "flex", flexDirection: "column", gap: 28, marginTop: 48, maxWidth: 680, margin: "48px auto 0" },
  step: { display: "flex", gap: 20, alignItems: "flex-start" },
  stepNum: {
    minWidth: 40,
    height: 40,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#2563EB,#4338CA)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 16,
    color: "#fff",
    flexShrink: 0,
  },
  stepTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: "#E8F0FE", margin: "0 0 6px" },
  stepDesc: { color: "#7C93B5", fontSize: 14, lineHeight: 1.6, margin: 0 },
  planosGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 20,
    marginTop: 48,
  },
  planoCard: {
    background: "rgba(255,255,255,.045)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 16,
    padding: "28px 24px",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  planoDestaque: {
    background: "rgba(37,99,235,.12)",
    border: "1px solid rgba(37,99,235,.4)",
    boxShadow: "0 0 40px -12px rgba(37,99,235,.4)",
  },
  planoBadge: {
    position: "absolute",
    top: -12,
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(135deg,#2563EB,#4338CA)",
    color: "#fff",
    fontSize: 11.5,
    fontWeight: 700,
    padding: "4px 14px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    letterSpacing: ".04em",
  },
  planoNome: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: "#E8F0FE", margin: 0 },
  planoPara: { color: "#7C93B5", fontSize: 13.5, margin: 0 },
  planoList: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 },
  planoItem: { color: "#B0C4E0", fontSize: 14, display: "flex", alignItems: "center", gap: 8 },
  planoCheck: { color: "#2563EB", fontWeight: 700 },
  ctaFinal: {
    textAlign: "center",
    padding: "80px 24px",
    background: "linear-gradient(180deg, transparent 0%, rgba(37,99,235,.08) 100%)",
  },
  ctaTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(26px, 4vw, 40px)",
    fontWeight: 700,
    color: "#E8F0FE",
    margin: "0 0 16px",
  },
  ctaSub: { color: "#7C93B5", fontSize: 16, margin: "0 0 36px" },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    padding: "24px",
    borderTop: "1px solid rgba(255,255,255,.07)",
  },
  footerText: { color: "#4E6688", fontSize: 13 },
  footerLink: {
    background: "none",
    border: "none",
    color: "#60A5FA",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
  },
};
