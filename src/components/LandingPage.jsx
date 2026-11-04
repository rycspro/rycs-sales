import { useState, useEffect, useRef } from "react";
import { navegar } from "../lib/rotas.js";

const ABAS = ["empresa", "profissional"];

const conteudo = {
  empresa: {
    heroBadge: "Para empresas",
    heroTitle: "Monte seu time de vendas sem custo fixo",
    heroSub: "Conecte sua empresa a vendedores autônomos qualificados. Pague só por resultado. Campanha criada com IA em menos de 5 minutos.",
    ctaPrimario: { label: "Criar conta grátis", rota: "/cadastro/empresa" },
    ctaSecundario: { label: "Entrar na plataforma", rota: "/entrar" },
    stats: [
      { valor: "500+", label: "Empresas ativas" },
      { valor: "98%", label: "Satisfação" },
      { valor: "5 min", label: "Para criar campanha" },
    ],
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
    stats: [
      { valor: "2.000+", label: "Profissionais" },
      { valor: "R$ 4.500", label: "Comissão média/mês" },
      { valor: "100%", label: "Transparência" },
    ],
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

const avatars = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%232563EB'/%3E%3Ctext x='20' y='25' text-anchor='middle' fill='white' font-size='16' font-family='sans-serif'%3EM%3C/text%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%234338CA'/%3E%3Ctext x='20' y='25' text-anchor='middle' fill='white' font-size='16' font-family='sans-serif'%3ER%3C/text%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%230EA5E9'/%3E%3Ctext x='20' y='25' text-anchor='middle' fill='white' font-size='16' font-family='sans-serif'%3EA%3C/text%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%2316A34A'/%3E%3Ctext x='20' y='25' text-anchor='middle' fill='white' font-size='16' font-family='sans-serif'%3EJ%3C/text%3E%3C/svg%3E",
];

const NAV_LINKS = [
  { label: "Início", href: "#" },
  { label: "Empresas", href: "#empresas" },
  { label: "Profissionais", href: "#profissionais" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Benefícios", href: "#beneficios" },
];

function BrandSlider() {
  const marcas = ["Nexo CRM", "Atlas Consultoria", "Kubo Tech", "Orbita Logística", "Zenith Digital"];
  return (
    <div style={st.brandSection}>
      <p style={st.brandLabel}>Empresas que já confiam na RYCS</p>
      <div style={st.brandTrack}>
        <div style={st.brandSlide}>
          {[...marcas, ...marcas].map((m, i) => (
            <span key={i} style={st.brandItem}>{m}</span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes brand-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}

function MobileMenu({ open, onClose, onNav }) {
  if (!open) return null;
  return (
    <div style={st.mobileOverlay} onClick={onClose}>
      <div style={st.mobileSheet} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <span style={st.logo}>RYCS</span>
          <button style={st.mobileClose} onClick={onClose}>✕</button>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_LINKS.map((l) => (
            <button key={l.label} style={st.mobileNavLink} onClick={() => { onClose(); }}>{l.label}</button>
          ))}
        </nav>
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <button style={st.btnPrimary} onClick={() => { onClose(); onNav("/cadastro/empresa"); }}>Criar conta grátis</button>
          <button style={st.btnGhost} onClick={() => { onClose(); onNav("/entrar"); }}>Entrar</button>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [aba, setAba] = useState("empresa");
  const [email, setEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const c = conteudo[aba];

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div style={st.page} data-landing-light="1">
      <style>{`
        [data-landing-light] { color-scheme: light !important; }
        [data-landing-light] * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .lp-nav-links { display: none !important; }
          .lp-hamburger { display: flex !important; }
          .lp-hero-title { font-size: 32px !important; }
          .lp-stats-row { flex-direction: column !important; gap: 16px !important; }
          .lp-footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header style={{ ...st.header, ...(scrolled ? st.headerScrolled : {}) }}>
        <div style={st.headerInner}>
          <span style={st.logo}>RYCS</span>

          <nav className="lp-nav-links" style={st.navCenter}>
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} style={st.navLink}>{l.label}</a>
            ))}
          </nav>

          <div className="lp-nav-links" style={st.navRight}>
            <button style={st.btnGhost} onClick={() => navegar("/entrar")}>Entrar</button>
            <button style={st.btnPrimary} onClick={() => navegar(c.ctaPrimario.rota)}>Criar conta grátis</button>
          </div>

          <button className="lp-hamburger" style={st.hamburger} onClick={() => setMenuOpen(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNav={navegar} />

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={st.hero}>
        {/* Glow decorativo */}
        <div style={st.heroGlow} />

        {/* Abas */}
        <div style={st.tabBar}>
          {ABAS.map((a) => (
            <button
              key={a}
              style={{ ...st.tabBtn, ...(aba === a ? st.tabBtnActive : {}) }}
              onClick={() => setAba(a)}
            >
              {a === "empresa" ? "🏢 Empresas" : "🤝 Profissionais"}
            </button>
          ))}
        </div>

        {/* Badge */}
        <div style={st.heroBadge}>{c.heroBadge}</div>

        {/* Título */}
        <h1 className="lp-hero-title" style={st.heroTitle}>{c.heroTitle}</h1>
        <p style={st.heroSub}>{c.heroSub}</p>

        {/* CTAs */}
        <div style={st.heroCtas}>
          <button style={st.btnHeroPrimary} onClick={() => navegar(c.ctaPrimario.rota)}>
            {c.ctaPrimario.label}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <button style={st.btnHeroSecondary} onClick={() => navegar(c.ctaSecundario.rota)}>
            {c.ctaSecundario.label}
          </button>
        </div>

        {/* Social proof: avatares + texto */}
        <div style={st.socialProof}>
          <div style={st.avatarGroup}>
            {avatars.map((src, i) => (
              <img key={i} src={src} alt="" style={{ ...st.avatar, marginLeft: i > 0 ? -10 : 0, zIndex: avatars.length - i }} />
            ))}
          </div>
          <span style={st.socialText}>
            <b style={{ color: "#0B1220" }}>+2.000</b> profissionais e empresas já usam
          </span>
        </div>

        {/* Stats */}
        <div className="lp-stats-row" style={st.statsRow}>
          {c.stats.map((s) => (
            <div key={s.label} style={st.statItem}>
              <span style={st.statValue}>{s.valor}</span>
              <span style={st.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── BRAND SLIDER ───────────────────────────────────────────────── */}
      <BrandSlider />

      {/* ── BENEFÍCIOS ─────────────────────────────────────────────────── */}
      <section id="beneficios" style={st.section}>
        <h2 style={st.sectionTitle}>Por que usar a RYCS?</h2>
        <div style={st.grid}>
          {c.beneficios.map((b) => (
            <div key={b.t} style={st.card}>
              <span style={st.cardIcon}>{b.icone}</span>
              <h3 style={st.cardTitle}>{b.t}</h3>
              <p style={st.cardDesc}>{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA ──────────────────────────────────────────────── */}
      <section id="como-funciona" style={st.sectionAlt}>
        <h2 style={st.sectionTitle}>Como funciona</h2>
        <div style={st.steps}>
          {c.passos.map((p) => (
            <div key={p.n} style={st.step}>
              <div style={st.stepNum}>{p.n}</div>
              <div>
                <h3 style={st.stepTitle}>{p.t}</h3>
                <p style={st.stepDesc}>{p.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────────────── */}
      <section style={st.ctaFinal}>
        <h2 style={st.ctaTitle}>
          {aba === "empresa" ? "Pronto para montar seu time?" : "Pronto para começar a vender?"}
        </h2>
        <p style={st.ctaSub}>
          {aba === "empresa"
            ? "Crie sua conta grátis e lance sua primeira campanha hoje."
            : "Cadastre-se e candidate-se às melhores campanhas agora."}
        </p>
        <button style={st.ctaBtn} onClick={() => navegar(c.ctaPrimario.rota)}>
          {c.ctaPrimario.label}
        </button>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer style={st.footer}>
        <div style={st.footerInner}>
          <div className="lp-footer-grid" style={st.footerGrid}>
            <div style={st.footerCol}>
              <h2 style={st.footerColTitle}>Fique por dentro</h2>
              <p style={st.footerColText}>Receba novidades sobre campanhas, dicas de vendas e atualizações da plataforma.</p>
              <form style={st.newsletterForm} onSubmit={(e) => { e.preventDefault(); if (email.trim()) setEmail(""); }}>
                <input type="email" placeholder="Seu melhor e-mail" value={email} onChange={(e) => setEmail(e.target.value)} style={st.newsletterInput} />
                <button type="submit" style={st.newsletterBtn} aria-label="Inscrever-se">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </form>
            </div>
            <div style={st.footerCol}>
              <h3 style={st.footerColSubtitle}>Links rápidos</h3>
              <nav style={st.footerNav}>
                <button style={st.footerNavLink} onClick={() => navegar("/")}>Início</button>
                <button style={st.footerNavLink} onClick={() => navegar("/cadastro/empresa")}>Cadastro empresa</button>
                <button style={st.footerNavLink} onClick={() => navegar("/cadastro/profissional")}>Cadastro profissional</button>
                <button style={st.footerNavLink} onClick={() => navegar("/entrar")}>Entrar na plataforma</button>
              </nav>
            </div>
            <div style={st.footerCol}>
              <h3 style={st.footerColSubtitle}>Contato</h3>
              <div style={st.footerAddress}><p>São Paulo, SP — Brasil</p><p>contato@rycs.com.br</p></div>
            </div>
            <div style={st.footerCol}>
              <h3 style={st.footerColSubtitle}>Redes sociais</h3>
              <div style={st.socialRow}>
                {[
                  { label: "Instagram", path: "M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zm1.5-4.87h.01M6.5 2h11A4.5 4.5 0 0122 6.5v11a4.5 4.5 0 01-4.5 4.5h-11A4.5 4.5 0 012 17.5v-11A4.5 4.5 0 016.5 2z" },
                  { label: "LinkedIn", path: "M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 2a2 2 0 110 4 2 2 0 010-4z" },
                  { label: "Facebook", path: "M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3V2z" },
                ].map(({ label, path }) => (
                  <button key={label} style={st.socialBtn} title={label} aria-label={label}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={st.footerBottom}>
            <p style={st.footerCopy}>© {new Date().getFullYear()} RYCS Sales Solutions. Todos os direitos reservados.</p>
            <nav style={st.footerBottomNav}>
              <button style={st.footerBottomLink}>Política de privacidade</button>
              <button style={st.footerBottomLink}>Termos de uso</button>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── TOKENS DE COR ───────────────────────────────────────────────────── */
const BRAND = "#2563EB";
const BRAND_DARK = "#1D4ED8";
const BRAND_LIGHT = "#EFF6FF";
const BRAND_MID = "#BFDBFE";
const INK = "#0B1220";
const MUTED = "#64748B";
const MUTED2 = "#94A3B8";
const BORDER = "#E2E8F0";
const BG = "#FFFFFF";
const BG_PAGE = "#FAFBFE";

const st = {
  /* ── PAGE ─────────────────────────────────────────────────────────── */
  page: {
    minHeight: "100vh",
    background: BG,
    color: INK,
    fontFamily: "'Inter', system-ui, sans-serif",
    WebkitFontSmoothing: "antialiased",
    overflowX: "hidden",
  },

  /* ── HEADER ──────────────────────────────────────────────────────── */
  header: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: "rgba(255,255,255,.85)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid transparent",
    transition: "border-color .2s, box-shadow .2s",
  },
  headerScrolled: {
    borderBottomColor: BORDER,
    boxShadow: "0 1px 8px rgba(0,0,0,.06)",
  },
  headerInner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 24px",
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    fontSize: 22,
    color: BRAND,
    letterSpacing: "0.04em",
  },
  navCenter: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  navLink: {
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    color: MUTED,
    textDecoration: "none",
    transition: "color .15s, background .15s",
  },
  navRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  hamburger: {
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 10,
    border: `1px solid ${BORDER}`,
    background: "none",
    cursor: "pointer",
    color: INK,
  },

  /* ── MOBILE MENU ────────────────────────────────────────────────── */
  mobileOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "rgba(0,0,0,.4)",
    backdropFilter: "blur(4px)",
  },
  mobileSheet: {
    position: "absolute",
    top: 0,
    right: 0,
    width: "min(320px, 85vw)",
    height: "100%",
    background: BG,
    padding: 24,
    boxShadow: "-8px 0 30px rgba(0,0,0,.12)",
    overflowY: "auto",
  },
  mobileClose: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    background: "none",
    fontSize: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: INK,
  },
  mobileNavLink: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
    borderRadius: 10,
    border: "none",
    background: "none",
    fontSize: 15,
    fontWeight: 500,
    color: INK,
    cursor: "pointer",
  },

  /* ── BUTTONS ─────────────────────────────────────────────────────── */
  btnPrimary: {
    background: BRAND,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 20px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    minHeight: 40,
    transition: "background .15s",
  },
  btnGhost: {
    background: "none",
    color: MUTED,
    border: "none",
    padding: "10px 14px",
    fontWeight: 500,
    fontSize: 14,
    cursor: "pointer",
    borderRadius: 10,
  },
  btnHeroPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: BRAND,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "15px 28px",
    fontWeight: 600,
    fontSize: 15.5,
    cursor: "pointer",
    minHeight: 48,
    boxShadow: "0 4px 16px -4px rgba(37,99,235,.45)",
    transition: "transform .15s, box-shadow .15s",
  },
  btnHeroSecondary: {
    background: BG,
    color: INK,
    border: `1.5px solid ${BORDER}`,
    borderRadius: 12,
    padding: "15px 28px",
    fontWeight: 600,
    fontSize: 15.5,
    cursor: "pointer",
    minHeight: 48,
    transition: "border-color .15s",
  },

  /* ── HERO ─────────────────────────────────────────────────────────── */
  hero: {
    position: "relative",
    textAlign: "center",
    padding: "120px 24px 56px",
    maxWidth: 820,
    margin: "0 auto",
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -120,
    left: "50%",
    transform: "translateX(-50%)",
    width: 600,
    height: 400,
    background: `radial-gradient(ellipse at center, rgba(37,99,235,.08) 0%, transparent 70%)`,
    pointerEvents: "none",
    zIndex: 0,
  },
  tabBar: {
    display: "inline-flex",
    gap: 4,
    background: BG_PAGE,
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
    position: "relative",
    zIndex: 1,
    border: `1px solid ${BORDER}`,
  },
  tabBtn: {
    padding: "9px 20px",
    borderRadius: 9,
    border: "none",
    background: "transparent",
    fontSize: 13.5,
    fontWeight: 600,
    color: MUTED,
    cursor: "pointer",
    transition: "all .15s",
  },
  tabBtnActive: {
    background: BG,
    color: BRAND,
    boxShadow: "0 1px 4px rgba(0,0,0,.08)",
  },
  heroBadge: {
    display: "inline-block",
    background: BRAND_LIGHT,
    color: BRAND,
    border: `1px solid ${BRAND_MID}`,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: ".05em",
    padding: "5px 14px",
    marginBottom: 20,
    textTransform: "uppercase",
    position: "relative",
    zIndex: 1,
  },
  heroTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(32px, 5vw, 52px)",
    fontWeight: 700,
    lineHeight: 1.12,
    margin: "0 0 20px",
    color: INK,
    letterSpacing: "-.02em",
    position: "relative",
    zIndex: 1,
  },
  heroSub: {
    fontSize: 17,
    color: MUTED,
    lineHeight: 1.65,
    margin: "0 auto 36px",
    maxWidth: 600,
    position: "relative",
    zIndex: 1,
  },
  heroCtas: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: 40,
    position: "relative",
    zIndex: 1,
  },
  socialProof: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 36,
    position: "relative",
    zIndex: 1,
  },
  avatarGroup: {
    display: "flex",
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "2.5px solid #fff",
    objectFit: "cover",
  },
  socialText: {
    fontSize: 13.5,
    color: MUTED,
  },
  statsRow: {
    display: "flex",
    justifyContent: "center",
    gap: 48,
    position: "relative",
    zIndex: 1,
  },
  statItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 28,
    fontWeight: 700,
    color: BRAND,
    letterSpacing: "-.02em",
  },
  statLabel: {
    fontSize: 12.5,
    color: MUTED2,
    fontWeight: 500,
  },

  /* ── BRAND SLIDER ────────────────────────────────────────────────── */
  brandSection: {
    padding: "40px 0",
    borderTop: `1px solid ${BORDER}`,
    borderBottom: `1px solid ${BORDER}`,
    background: BG_PAGE,
    overflow: "hidden",
  },
  brandLabel: {
    textAlign: "center",
    fontSize: 12.5,
    fontWeight: 500,
    color: MUTED2,
    textTransform: "uppercase",
    letterSpacing: ".06em",
    margin: "0 0 20px",
  },
  brandTrack: {
    overflow: "hidden",
    maskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
    WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
  },
  brandSlide: {
    display: "flex",
    gap: 48,
    animation: "brand-scroll 25s linear infinite",
    width: "max-content",
  },
  brandItem: {
    fontSize: 18,
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600,
    color: MUTED2,
    whiteSpace: "nowrap",
    letterSpacing: "-.01em",
    opacity: 0.7,
  },

  /* ── SECTIONS ────────────────────────────────────────────────────── */
  section: { padding: "80px 24px", maxWidth: 1100, margin: "0 auto" },
  sectionAlt: {
    padding: "80px 24px",
    background: BG_PAGE,
    borderTop: `1px solid ${BORDER}`,
    borderBottom: `1px solid ${BORDER}`,
  },
  sectionTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(22px, 3vw, 32px)",
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 48,
    marginTop: 0,
    color: INK,
    letterSpacing: "-.01em",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 18,
    maxWidth: 1100,
    margin: "0 auto",
  },
  card: {
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    padding: "28px 24px",
    transition: "box-shadow .2s, border-color .2s",
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
    minWidth: 44, height: 44, borderRadius: "50%", background: BRAND,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 17, color: "#fff", flexShrink: 0,
    boxShadow: "0 4px 12px -4px rgba(37,99,235,.5)",
  },
  stepTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600, fontSize: 16, color: INK, margin: "2px 0 6px",
  },
  stepDesc: { color: MUTED, fontSize: 14, lineHeight: 1.6, margin: 0 },

  /* ── CTA FINAL ───────────────────────────────────────────────────── */
  ctaFinal: {
    textAlign: "center",
    padding: "88px 24px",
    background: `linear-gradient(135deg, ${BRAND} 0%, #4338CA 100%)`,
  },
  ctaTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(24px, 3.5vw, 38px)",
    fontWeight: 700, color: "#fff", margin: "0 0 16px",
  },
  ctaSub: { color: "rgba(255,255,255,.8)", fontSize: 16, margin: "0 0 36px" },
  ctaBtn: {
    background: "#fff", color: BRAND, border: "none", borderRadius: 12,
    padding: "15px 32px", fontWeight: 700, fontSize: 15.5, cursor: "pointer", minHeight: 50,
    boxShadow: "0 4px 20px rgba(0,0,0,.15)",
  },

  /* ── FOOTER ──────────────────────────────────────────────────────── */
  footer: { background: BG, borderTop: `1px solid ${BORDER}` },
  footerInner: { maxWidth: 1100, margin: "0 auto", padding: "48px 24px 0" },
  footerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "40px 32px",
  },
  footerCol: {},
  footerColTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 22, fontWeight: 700, margin: "0 0 10px", color: INK, letterSpacing: "-.01em",
  },
  footerColText: { fontSize: 13.5, color: MUTED, lineHeight: 1.6, margin: "0 0 16px" },
  footerColSubtitle: { fontSize: 15, fontWeight: 600, margin: "0 0 14px", color: INK },
  newsletterForm: { position: "relative", display: "flex", alignItems: "center" },
  newsletterInput: {
    width: "100%", padding: "11px 44px 11px 14px", border: `1px solid ${BORDER}`,
    borderRadius: 10, fontSize: 13.5, background: BG_PAGE, color: INK, outline: "none", fontFamily: "inherit",
  },
  newsletterBtn: {
    position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)",
    width: 32, height: 32, borderRadius: "50%", background: BRAND, color: "#fff",
    border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  },
  footerNav: { display: "flex", flexDirection: "column", gap: 8 },
  footerNavLink: {
    background: "none", border: "none", padding: 0, color: MUTED, fontSize: 13.5,
    cursor: "pointer", textAlign: "left", transition: "color .15s",
  },
  footerAddress: { fontSize: 13.5, color: MUTED, lineHeight: 1.8 },
  socialRow: { display: "flex", gap: 10 },
  socialBtn: {
    width: 38, height: 38, borderRadius: "50%", border: `1px solid ${BORDER}`,
    background: "none", display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: MUTED, transition: "color .15s, border-color .15s",
  },
  footerBottom: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", gap: 12, marginTop: 40, paddingTop: 20, paddingBottom: 24,
    borderTop: `1px solid ${BORDER}`,
  },
  footerCopy: { fontSize: 12.5, color: MUTED2, margin: 0 },
  footerBottomNav: { display: "flex", gap: 16 },
  footerBottomLink: {
    background: "none", border: "none", padding: 0, fontSize: 12.5,
    color: MUTED2, cursor: "pointer", transition: "color .15s",
  },
};
