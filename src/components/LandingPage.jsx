import { useState, useEffect, useRef } from "react";
import { ArrowRight, ChevronDown, MessageCircle, Sparkles } from "lucide-react";
import { navegar } from "../lib/rotas.js";
import { PLANOS, ORDEM_PLANOS } from "../../shared/planos.js";
import { useI18n } from "../lib/i18n.jsx";
import LangSwitcher from "./LangSwitcher.jsx";

const ABAS = ["empresa", "profissional"];

function buildConteudo(t) {
  return {
    empresa: {
      heroBadge: t("landing.company.badge"),
      heroTitle: t("landing.company.title"),
      heroSub: t("landing.company.sub"),
      ctaPrimario: { label: t("landing.company.ctaPrimary"), rota: "/cadastro/empresa" },
      ctaSecundario: { label: t("landing.company.ctaSecondary"), rota: "/entrar" },
      stats: [
        { valor: t("landing.company.stat1.value"), label: t("landing.company.stat1.label") },
        { valor: t("landing.company.stat2.value"), label: t("landing.company.stat2.label") },
        { valor: t("landing.company.stat3.value"), label: t("landing.company.stat3.label") },
      ],
      passos: [
        { n: "1", t: t("landing.company.step1.title"), d: t("landing.company.step1.desc") },
        { n: "2", t: t("landing.company.step2.title"), d: t("landing.company.step2.desc") },
        { n: "3", t: t("landing.company.step3.title"), d: t("landing.company.step3.desc") },
        { n: "4", t: t("landing.company.step4.title"), d: t("landing.company.step4.desc") },
      ],
      beneficios: [
        { icone: "🎯", t: t("landing.company.benefit1.title"), d: t("landing.company.benefit1.desc") },
        { icone: "💰", t: t("landing.company.benefit2.title"), d: t("landing.company.benefit2.desc") },
        { icone: "📊", t: t("landing.company.benefit3.title"), d: t("landing.company.benefit3.desc") },
        { icone: "🏆", t: t("landing.company.benefit4.title"), d: t("landing.company.benefit4.desc") },
        { icone: "⚡", t: t("landing.company.benefit5.title"), d: t("landing.company.benefit5.desc") },
        { icone: "🔒", t: t("landing.company.benefit6.title"), d: t("landing.company.benefit6.desc") },
      ],
    },
    profissional: {
      heroBadge: t("landing.pro.badge"),
      heroTitle: t("landing.pro.title"),
      heroSub: t("landing.pro.sub"),
      ctaPrimario: { label: t("landing.pro.ctaPrimary"), rota: "/cadastro/profissional" },
      ctaSecundario: { label: t("landing.pro.ctaSecondary"), rota: "/entrar" },
      stats: [
        { valor: t("landing.pro.stat1.value"), label: t("landing.pro.stat1.label") },
        { valor: t("landing.pro.stat2.value"), label: t("landing.pro.stat2.label") },
        { valor: t("landing.pro.stat3.value"), label: t("landing.pro.stat3.label") },
      ],
      passos: [
        { n: "1", t: t("landing.pro.step1.title"), d: t("landing.pro.step1.desc") },
        { n: "2", t: t("landing.pro.step2.title"), d: t("landing.pro.step2.desc") },
        { n: "3", t: t("landing.pro.step3.title"), d: t("landing.pro.step3.desc") },
        { n: "4", t: t("landing.pro.step4.title"), d: t("landing.pro.step4.desc") },
      ],
      beneficios: [
        { icone: "🚀", t: t("landing.pro.benefit1.title"), d: t("landing.pro.benefit1.desc") },
        { icone: "💸", t: t("landing.pro.benefit2.title"), d: t("landing.pro.benefit2.desc") },
        { icone: "🏆", t: t("landing.pro.benefit3.title"), d: t("landing.pro.benefit3.desc") },
        { icone: "📍", t: t("landing.pro.benefit4.title"), d: t("landing.pro.benefit4.desc") },
        { icone: "📱", t: t("landing.pro.benefit5.title"), d: t("landing.pro.benefit5.desc") },
        { icone: "🔓", t: t("landing.pro.benefit6.title"), d: t("landing.pro.benefit6.desc") },
      ],
    },
  };
}

const avatars = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%232563EB'/%3E%3Ctext x='20' y='25' text-anchor='middle' fill='white' font-size='16' font-family='sans-serif'%3EM%3C/text%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%234338CA'/%3E%3Ctext x='20' y='25' text-anchor='middle' fill='white' font-size='16' font-family='sans-serif'%3ER%3C/text%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%230EA5E9'/%3E%3Ctext x='20' y='25' text-anchor='middle' fill='white' font-size='16' font-family='sans-serif'%3EA%3C/text%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%2316A34A'/%3E%3Ctext x='20' y='25' text-anchor='middle' fill='white' font-size='16' font-family='sans-serif'%3EJ%3C/text%3E%3C/svg%3E",
];

function buildNavLinks(t) {
  return [
    { label: t("landing.nav.home"), href: "#" },
    { label: t("landing.nav.companies"), href: "#empresas" },
    { label: t("landing.nav.professionals"), href: "#profissionais" },
    { label: t("landing.nav.howItWorks"), href: "#como-funciona" },
    { label: t("landing.nav.benefits"), href: "#beneficios" },
  ];
}

function BrandSlider() {
  const { t } = useI18n();
  const marcas = ["Nexo CRM", "Atlas Consultoria", "Kubo Tech", "Orbita Logística", "Zenith Digital"];
  return (
    <div style={st.brandSection}>
      <p style={st.brandLabel}>{t("landing.brandSlider")}</p>
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

function MobileMenu({ open, onClose, onNav, navLinks }) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div style={st.mobileOverlay} onClick={onClose}>
      <div style={st.mobileSheet} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <span style={st.logo}>RYCS</span>
          <button style={st.mobileClose} onClick={onClose}>✕</button>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {navLinks.map((l) => (
            <button key={l.label} style={st.mobileNavLink} onClick={() => { onClose(); }}>{l.label}</button>
          ))}
        </nav>
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <button style={st.btnPrimary} onClick={() => { onClose(); onNav("/cadastro/empresa"); }}>{t("landing.nav.mobileSignup")}</button>
          <button style={st.btnGhost} onClick={() => { onClose(); onNav("/entrar"); }}>{t("landing.nav.mobileLogin")}</button>
        </div>
      </div>
    </div>
  );
}

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v % 1 ? 2 : 0 });
const planosPagos = ORDEM_PLANOS.filter((k) => PLANOS[k].preco > 0)
  .map((k) => `${PLANOS[k].nome} (${brl(PLANOS[k].preco)}/mês, taxa de ${Math.round(PLANOS[k].takeRate * 100)}%)`)
  .join(", ");

function buildFaqs(t) {
  return {
    empresa: [
      { q: t("landing.faq.company.q1"), a: t("landing.faq.company.a1") },
      { q: t("landing.faq.company.q2"), a: t("landing.faq.company.a2") },
      { q: t("landing.faq.company.q3"), a: t("landing.faq.company.a3") },
      { q: t("landing.faq.company.q4"), a: t("landing.faq.company.a4") },
      { q: t("landing.faq.company.q5"), a: t("landing.faq.company.a5") },
      { q: t("landing.faq.company.q6"), a: t("landing.faq.company.a6") },
    ],
    profissional: [
      { q: t("landing.faq.pro.q1"), a: t("landing.faq.pro.a1") },
      { q: t("landing.faq.pro.q2"), a: t("landing.faq.pro.a2") },
      { q: t("landing.faq.pro.q3"), a: t("landing.faq.pro.a3") },
      { q: t("landing.faq.pro.q4"), a: t("landing.faq.pro.a4") },
      { q: t("landing.faq.pro.q5"), a: t("landing.faq.pro.a5") },
      { q: t("landing.faq.pro.q6"), a: t("landing.faq.pro.a6") },
    ],
  };
}

function FaqSection({ aba }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(0);
  const faqs = buildFaqs(t);
  const itens = faqs[aba];
  useEffect(() => setOpen(0), [aba]);
  return (
    <section id="faq" style={st.faqSection}>
      <div style={st.faqInner}>
        <div style={st.faqHead}>
          <span style={st.faqPill}><Sparkles size={12} color="#F59E0B" aria-hidden="true" /> FAQ</span>
          <h2 style={st.faqTitle}>{t("landing.faq.title")}</h2>
          <p style={st.faqSub}>
            {t("landing.faq.sub")}{" "}
            <a href="mailto:contato@rycs.com.br" style={st.faqLink}>contato@rycs.com.br</a>.
          </p>
        </div>

        <div style={st.faqList}>
          {itens.map((f, i) => {
            const ativo = open === i;
            return (
              <div key={f.q} style={st.faqItem}>
                <button
                  type="button"
                  className="lp-faq-trigger"
                  style={st.faqTrigger}
                  aria-expanded={ativo}
                  aria-controls={`faq-${aba}-${i}`}
                  onClick={() => setOpen(ativo ? -1 : i)}
                >
                  {f.q}
                  <ChevronDown size={18} aria-hidden="true" style={{ ...st.faqChevron, transform: ativo ? "rotate(180deg)" : "none" }} />
                </button>
                <div id={`faq-${aba}-${i}`} role="region" style={{ ...st.faqPanel, gridTemplateRows: ativo ? "1fr" : "0fr" }}>
                  <div style={st.faqPanelInner}><p style={st.faqAnswer}>{f.a}</p></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lp-faq-box" style={st.faqBox}>
          <div style={st.faqBoxLeft}>
            <span style={st.faqBoxIcon}><MessageCircle size={16} aria-hidden="true" /></span>
            <div>
              <p style={st.faqBoxTitle}>{t("landing.faq.stillQuestion")}</p>
              <p style={st.faqBoxText}>{t("landing.faq.response")}</p>
            </div>
          </div>
          <a href="mailto:contato@rycs.com.br" className="lp-faq-box-btn" style={st.faqBoxBtn}>
            {t("landing.faq.contact")} <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { t } = useI18n();
  const [aba, setAba] = useState("empresa");
  const [email, setEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const conteudo = buildConteudo(t);
  const NAV_LINKS = buildNavLinks(t);
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
          .lp-faq-box { flex-direction: column !important; align-items: flex-start !important; }
        }
        .lp-faq-trigger:hover { color: ${BRAND} !important; }
        .lp-faq-box-btn:hover { background: ${BRAND} !important; }
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
            <LangSwitcher />
            <button style={st.btnGhost} onClick={() => navegar("/entrar")}>{t("landing.nav.login")}</button>
            <button style={st.btnPrimary} onClick={() => navegar(c.ctaPrimario.rota)}>{t("landing.nav.signup")}</button>
          </div>

          <button className="lp-hamburger" style={st.hamburger} onClick={() => setMenuOpen(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNav={navegar} navLinks={NAV_LINKS} />

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={st.hero}>
        <div style={st.heroGrid} aria-hidden="true"><div style={st.heroGridGlow} /></div>
        <div style={st.heroInner}>

        {/* Abas */}
        <div style={st.tabBar}>
          {ABAS.map((a) => (
            <button
              key={a}
              style={{ ...st.tabBtn, ...(aba === a ? st.tabBtnActive : {}) }}
              onClick={() => setAba(a)}
            >
              {a === "empresa" ? `🏢 ${t("landing.tab.company")}` : `🤝 ${t("landing.tab.professional")}`}
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
          <span style={st.socialText}>{t("landing.socialProof")}</span>
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
        </div>
      </section>

      {/* ── BRAND SLIDER ───────────────────────────────────────────────── */}
      <BrandSlider />

      {/* ── BENEFÍCIOS ─────────────────────────────────────────────────── */}
      <section id="beneficios" style={st.section}>
        <h2 style={st.sectionTitle}>{t("landing.whyUse")}</h2>
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
        <h2 style={st.sectionTitle}>{t("landing.howItWorks")}</h2>
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
          {aba === "empresa" ? t("landing.company.ctaFinal.title") : t("landing.pro.ctaFinal.title")}
        </h2>
        <p style={st.ctaSub}>
          {aba === "empresa" ? t("landing.company.ctaFinal.sub") : t("landing.pro.ctaFinal.sub")}
        </p>
        <button style={st.ctaBtn} onClick={() => navegar(c.ctaPrimario.rota)}>
          {c.ctaPrimario.label}
        </button>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <FaqSection aba={aba} />

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer style={st.footer}>
        <div style={st.footerInner}>
          <div className="lp-footer-grid" style={st.footerGrid}>
            <div style={st.footerCol}>
              <h2 style={st.footerColTitle}>{t("landing.footer.stayUpdated")}</h2>
              <p style={st.footerColText}>{t("landing.footer.stayUpdatedSub")}</p>
              <form style={st.newsletterForm} onSubmit={(e) => { e.preventDefault(); if (email.trim()) setEmail(""); }}>
                <input type="email" placeholder={t("landing.footer.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} style={st.newsletterInput} />
                <button type="submit" style={st.newsletterBtn} aria-label="Inscrever-se">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </form>
            </div>
            <div style={st.footerCol}>
              <h3 style={st.footerColSubtitle}>{t("landing.footer.quickLinks")}</h3>
              <nav style={st.footerNav}>
                <button style={st.footerNavLink} onClick={() => navegar("/")}>{t("landing.footer.home")}</button>
                <button style={st.footerNavLink} onClick={() => navegar("/cadastro/empresa")}>{t("landing.footer.companySignup")}</button>
                <button style={st.footerNavLink} onClick={() => navegar("/cadastro/profissional")}>{t("landing.footer.proSignup")}</button>
                <button style={st.footerNavLink} onClick={() => navegar("/entrar")}>{t("landing.footer.enterPlatform")}</button>
              </nav>
            </div>
            <div style={st.footerCol}>
              <h3 style={st.footerColSubtitle}>{t("landing.footer.contact")}</h3>
              <div style={st.footerAddress}><p>{t("landing.footer.location")}</p><p>contato@rycs.com.br</p></div>
            </div>
            <div style={st.footerCol}>
              <h3 style={st.footerColSubtitle}>{t("landing.footer.social")}</h3>
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
            <p style={st.footerCopy}>{t("landing.footer.copyright", { year: new Date().getFullYear() })}</p>
            <nav style={st.footerBottomNav}>
              <button style={st.footerBottomLink}>{t("landing.footer.privacy")}</button>
              <button style={st.footerBottomLink}>{t("landing.footer.terms")}</button>
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
    overflow: "hidden",
  },
  heroInner: {
    maxWidth: 820,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  heroGrid: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    backgroundImage: "linear-gradient(to right, #f0f0f0 1px, transparent 1px), linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)",
    backgroundColor: BG,
    backgroundSize: "6rem 4rem",
    maskImage: "linear-gradient(to bottom, black 70%, transparent 100%)",
    WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent 100%)",
  },
  heroGridGlow: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(circle 500px at 50% 200px, #C9EBFF, transparent)",
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

  /* ── FAQ ─────────────────────────────────────────────────────────── */
  faqSection: { padding: "88px 24px", background: BG },
  faqInner: { maxWidth: 760, margin: "0 auto" },
  faqHead: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" },
  faqPill: {
    display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999,
    border: `1px solid ${BORDER}`, background: BG, padding: "4px 12px",
    fontSize: 12, fontWeight: 600, color: MUTED, boxShadow: "0 1px 2px rgba(0,0,0,.05)",
  },
  faqTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(29px, 4vw, 44px)", fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.08,
    margin: 0, color: INK, textWrap: "balance",
  },
  faqSub: { maxWidth: 560, margin: 0, color: MUTED, fontSize: 15.5, lineHeight: 1.6, textWrap: "balance" },
  faqLink: { color: INK, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 4 },
  faqList: { marginTop: 48, borderTop: `1px solid ${BORDER}` },
  faqItem: { borderBottom: `1px solid ${BORDER}` },
  faqTrigger: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
    width: "100%", padding: "18px 0", background: "none", border: 0, cursor: "pointer",
    fontFamily: "inherit", fontSize: 15.5, fontWeight: 600, color: INK, textAlign: "left",
    transition: "color .15s",
  },
  faqChevron: { flexShrink: 0, color: MUTED, transition: "transform .2s" },
  faqPanel: { display: "grid", transition: "grid-template-rows .25s ease" },
  faqPanelInner: { overflow: "hidden" },
  faqAnswer: { margin: 0, padding: "0 32px 18px 0", color: MUTED, fontSize: 14.5, lineHeight: 1.65 },
  faqBox: {
    marginTop: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
    borderRadius: 18, border: `1px dashed ${BORDER}`, background: BG_PAGE, padding: 20,
  },
  faqBoxLeft: { display: "flex", alignItems: "center", gap: 12 },
  faqBoxIcon: {
    display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: "50%",
    background: INK, color: "#fff", flexShrink: 0,
  },
  faqBoxTitle: { margin: 0, fontSize: 14, fontWeight: 600, color: INK },
  faqBoxText: { margin: "2px 0 0", fontSize: 12.5, color: MUTED },
  faqBoxBtn: {
    display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999,
    background: INK, color: "#fff", padding: "10px 16px", fontSize: 13.5, fontWeight: 600,
    textDecoration: "none", whiteSpace: "nowrap", transition: "background .15s",
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
