import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { api } from "./lib/api.js";
import { dadosRastreio } from "./lib/rastreio.js";
import { seed } from "./lib/seed.js";
import { NAV } from "./lib/constants.js";
import { CSS } from "./styles.js";
import Shell from "./components/Shell.jsx";
import Login from "./components/Login.jsx";
import LoginPlataforma from "./components/LoginPlataforma.jsx";
const CadastroProfissional = lazy(() => import("./components/auth/CadastroProfissional.jsx"));
import { useRota, guardarConvite, guardarConviteOnboarding, lerConviteOnboarding, limparConviteOnboarding } from "./lib/rotas.js";
import EtapaAcesso from "./components/onboarding/EtapaAcesso.jsx";
import EntradaEmpresa from "./components/auth/EntradaEmpresa.jsx";
import ConfirmarEmail from "./components/auth/ConfirmarEmail.jsx";
const LandingPage = lazy(() => import("./components/LandingPage.jsx"));
const Vendedor = lazy(() => import("./components/vendedor/index.jsx"));
const Empresa = lazy(() => import("./components/empresa/index.jsx"));
const Admin = lazy(() => import("./components/admin/index.jsx"));
import Notificacoes from "./components/Notificacoes.jsx";
import BannerOnboarding from "./components/empresa/BannerOnboarding.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const PREVIA_QUALIFICACAO = {
  id: "preview-empresa",
  nome: "Nexo CRM",
  produto: "CRM comercial para equipes B2B",
  ticket: "R$ 1.490/mês",
  icp: "Empresas B2B em crescimento",
  saldo: 12500,
  saldoReservado: 1450,
  assinatura: "starter",
  statusCadastro: "aprovada",
  razaoSocial: "Nexo Tecnologia Comercial Ltda",
  documento: "12345678000190",
  endereco: "São Paulo, SP",
  representanteLegal: "Marina Alves",
  contatoFinanceiro: "financeiro@nexocrm.com.br",
  contatoComercial: "vendas@nexocrm.com.br",
  segmento: "Tecnologia B2B",
  regiao: "Brasil",
  diferenciais: "Implantação rápida, cadências integradas e visão completa do funil.",
  objecoes: "Migração de dados, adoção do time e integração com ferramentas existentes.",
  materiais: [{ id: "deck", nome: "Apresentação comercial", url: "https://example.com/deck" }],
  vagas: 8,
  cor: "#2563EB",
  curso: [
    { id: "produto", titulo: "O problema que resolvemos", min: 6, conteudo: "O Nexo CRM organiza a operação comercial em um único lugar: leads, cadência, previsões e conversas." },
    { id: "cliente", titulo: "Cliente ideal e mensagem", min: 8, conteudo: "Fale com líderes comerciais de empresas B2B que já têm volume de leads, mas pouca previsibilidade na receita." },
  ],
  qualificacao: {
    criterios: { perfis: ["sdr", "closer"], notaMinima: 70, exigeVideo: true },
    notaMinimaQuiz: 80,
    questoes: [
      { pergunta: "Para quem a solução é indicada?", opcoes: ["Líderes comerciais B2B", "Restaurantes", "Influenciadores"], correta: 0 },
      { pergunta: "Qual é o principal ganho prometido?", opcoes: ["Mais seguidores", "Previsibilidade comercial", "Reduzir estoque"], correta: 1 },
    ],
  },
};

const PREVIA_LEADS = [
  { id: "lead-1", sellerId: "s1", companyId: "preview-empresa", campaignId: "camp-preview", nome: "Carlos Mendes", empresa: "Orbita Logística", cargo: "Diretor comercial", etapa: "reuniao", valorEstimado: 17880, atualizadoEm: Date.now() - 3600000 },
  { id: "lead-2", sellerId: "s1", companyId: "preview-empresa", campaignId: "camp-preview", nome: "Fernanda Lima", empresa: "Atlas Consultoria", cargo: "Head de vendas", etapa: "proposta", valorEstimado: 23840, atualizadoEm: Date.now() - 86400000 },
  { id: "lead-3", sellerId: "s2", companyId: "preview-empresa", campaignId: "camp-preview", nome: "Rafael Souza", empresa: "Kubo Tech", cargo: "CEO", etapa: "ganho", valorEstimado: 14900, atualizadoEm: Date.now() - 172800000 },
];

export default function App() {
  const previaQualificacao = import.meta.env.DEV && typeof window !== "undefined" && window.location.pathname.startsWith("/preview/");
  const previaEmpresa = previaQualificacao && window.location.pathname === "/preview/empresa";
  const [db, setDb] = useState(() => previaQualificacao
    ? { ...seed(), role: "empresa", companyId: PREVIA_QUALIFICACAO.id, companies: [PREVIA_QUALIFICACAO], leads: PREVIA_LEADS, campaigns: [{ id: "camp-preview", companyId: PREVIA_QUALIFICACAO.id, titulo: "Piloto Nexo CRM", descricao: "Campanha de validação", produto: PREVIA_QUALIFICACAO.produto, publico: PREVIA_QUALIFICACAO.icp, objetivo: "Gerar reuniões qualificadas", regiao: "Brasil", funcao: "sdr", vagas: 3, orcamento: 5000, reservado: 1450, status: "rascunho", prazoHoras: 48, limitePorProfissional: 10, aceitaLeadProprio: true, exigeCertificacao: true, tarefas: { agendamento: 80, realizada: 140 }, evidencias: {}, criteriosAprovacao: {}, treinamento: PREVIA_QUALIFICACAO.curso }] }
    : seed());
  const [loaded, setLoaded] = useState(false);
  // Os painéis só aparecem depois da primeira resposta do /state. Antes disso
  // eles desenhavam o banco vazio do seed, e o admin abria com tudo zerado
  // até os dados chegarem. "erro" só vale para a primeira carga: se uma
  // atualização periódica falhar, os dados que já estão na tela ficam.
  const [carga, setCarga] = useState(previaQualificacao ? "ok" : "carregando");
  const cargaRef = useRef(previaQualificacao ? "ok" : "carregando");
  const marcarCarga = useCallback((v) => { cargaRef.current = v; setCarga(v); }, []);
  const [user, setUser] = useState(() => previaQualificacao ? { role: "empresa", email: "preview@local" } : null);
  const [toast, setToast] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [nav, setNav] = useState({ vendedor: "oportunidades", empresa: previaQualificacao ? (previaEmpresa ? "inicio" : "academy") : "inicio", admin: "dashboard" });
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    const bg = isDark ? "#0B1121" : "#F2F4F8";
    document.documentElement.style.background = bg;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }, []);

  const userRef = useRef(null);

  // Cada porta de entrada vive num endereço próprio: login, cadastro de
  // profissional, cadastro de empresa e plataforma. A tabela de endereços fica
  // em lib/rotas.js — aqui só se escolhe o que renderizar.
  const rota = useRota();
  // O convite é guardado no instante em que o link abre. Quem chega sem conta
  // passa por cadastro e login antes de conseguir resgatar, e a URL se perde
  // no caminho.
  useEffect(() => { if (rota.tipo === "trial" && rota.token) guardarConvite(rota.token); }, [rota]);
  useEffect(() => { if (rota.tipo === "convite-onboarding" && rota.token) guardarConviteOnboarding(rota.token); }, [rota]);

  // Onboarding da empresa: o servidor diz se está concluído e em qual etapa.
  // null = ainda consultando; { erro } = falhou e a tela oferece tentar de novo.
  const [onb, setOnb] = useState(null);
  const carregarOnboarding = useCallback(async () => {
    setOnb(null);
    // Convite aberto por quem já tem conta: aplica antes de ler o progresso.
    const convite = lerConviteOnboarding();
    if (convite) {
      const r = await api(`/onboarding/convites/${encodeURIComponent(convite)}/aplicar`, {});
      limparConviteOnboarding();
      if (r?.error) setToast(r.error);
    }
    const r = await api("/onboarding");
    if (r?.error === "Não autenticado" || r?.error === "Sessão expirada" || r?.error === "Usuário não encontrado") {
      await api("/auth/logout", {});
      setUser(null);
      setOnb(null);
      setDb(seed());
      marcarCarga("carregando");
      return;
    }
    setOnb(r && !r.error ? r : { erro: r?.error || "Não foi possível carregar o seu cadastro." });
  }, []);

  // Acesso da empresa: prefetch em paralelo com onboarding, evita cascata.
  // No modo de pré-visualização (DEV, /preview/*) não há API: libera por padrão
  // para a tela montar com os dados demo.
  const [acesso, setAcesso] = useState(() => previaQualificacao ? { liberado: true, plano: "premium", motivo: "preview" } : undefined);
  const consultarAcesso = useCallback(() =>
    api("/subscription/access").then((r) => {
      if (r) { setAcesso(r); return r; }
      setAcesso({ liberado: true, plano: "livre", motivo: "fallback" });
      return null;
    }), []);

  useEffect(() => {
    if (!user || previaQualificacao) return;
    if (user.role === "empresa") {
      carregarOnboarding();
      consultarAcesso();
    }
  }, [user, carregarOnboarding, consultarAcesso]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sem onboarding guiado: quem está logado nunca fica numa URL /onboarding.
  useEffect(() => {
    if (!user || !window.location.pathname.startsWith("/onboarding")) return;
    window.history.replaceState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [user]);

  const carregarState = useCallback(async (usr) => {
    const u = usr || userRef.current;
    if (!u) return;
    const state = await api("/state");
    if (!state?.sellers) {
      // Sem dados ainda: fixa o papel para a interface conseguir renderizar.
      setDb((d) => ({ ...d, role: u.role }));
      if (cargaRef.current !== "ok")
        marcarCarga(state?.error === "ONBOARDING_PENDENTE" ? "ok" : "erro");
      return;
    }
    // Define a moeda da UI a partir da empresa — faz toda chamada money()
    // formatar na moeda certa (planos, campanhas, pagamentos).
    const companyId = u.role === "empresa" ? u.entityId : state.companies[0]?.id || null;
    const empresa = companyId ? state.companies.find((c) => c.id === companyId) : null;
    if (empresa?.moeda) {
      try {
        const { setMoedaUi } = await import("./lib/utils.js");
        setMoedaUi(empresa.moeda);
      } catch { /* ignore */ }
    }
    setDb((d) => ({
      ...d,
      ...state,
      role: u.role,
      sellerId: u.role === "vendedor" ? u.entityId : state.sellers.find((s) => s.status === "aprovado")?.id || null,
      companyId,
    }));
    marcarCarga("ok");
  }, [marcarCarga]);

  useEffect(() => { api("/environment").then((r) => { if (r?.environment) setEnvironment(r.environment); }); }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const me = await api("/auth/me");
        if (vivo && me?.id) {
          // Sessão válida em URL de login: redireciona para o dashboard.
          const p = window.location.pathname.replace(/\/+$/, "").toLowerCase();
          if (p === "/entrar" || p === "/login") {
            window.history.replaceState({}, "", "/");
          }
          setUser(me);
          userRef.current = me;
          if (vivo) setLoaded(true);
          await carregarState(me);
          return;
        }
      } catch (e) {}
      if (vivo) setLoaded(true);
    })();
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    const iv = setInterval(() => carregarState(), 60000);
    return () => clearInterval(iv);
  }, [user, carregarState]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  // { silencioso } é para telas que mostram o erro no próprio campo.
  // Usado após confirmação de e-mail: o cookie já foi setado pelo servidor.
  const loginDireto = async (userData) => {
    if (userData?.id) { window.history.replaceState({}, "", "/"); setUser(userData); userRef.current = userData; await carregarState(userData); }
  };

  const login = async (email, senha, { silencioso = false, tipoConta } = {}) => {
    const r = await api("/auth/login", { email, senha });
    if (r?.error) { if (!silencioso) setToast(r.error); return { ok: false, error: r.error }; }
    if (r?.id) {
      const roleEsperado = tipoConta === "profissional" ? "vendedor" : tipoConta === "empresa" ? "empresa" : null;
      if (roleEsperado && r.role !== roleEsperado) {
        await api("/auth/logout", {});
        return { ok: false, roleErrado: r.role };
      }
      const pNow = window.location.pathname.replace(/\/+$/, "").toLowerCase();
      if ((r.role !== "empresa" && window.location.pathname.startsWith("/onboarding")) || pNow === "/entrar" || pNow === "/login") {
        window.history.replaceState({}, "", "/");
      }
      setUser(r); userRef.current = r; await carregarState(r); return { ok: true, role: r.role };
    }
    if (!silencioso) setToast("Erro ao fazer login.");
    return { ok: false, error: "Erro ao fazer login." };
  };

  const registrar = async (dados, { silencioso = false, autoEntrar = true } = {}) => {
    const r = await api("/auth/register", { ...dados, ...dadosRastreio() });
    if (r?.error) { if (!silencioso) setToast(r.error); return { ok: false, error: r.error, campo: r.campo }; }
    if (r?.id) {
      const entrar = async () => {
        // Limpa a URL de cadastro/onboarding para não sobreviver a um F5.
        window.history.replaceState({}, "", "/");
        setUser(r); userRef.current = r; await carregarState(r);
      };
      // autoEntrar=false deixa a tela mostrar a confirmação antes de entrar.
      if (autoEntrar) { await entrar(); return { ok: true }; }
      return { ok: true, entrar };
    }
    if (!silencioso) setToast("Erro ao registrar.");
    return { ok: false, error: "Erro ao registrar." };
  };

  const logout = async () => {
    await api("/auth/logout", {});
    setUser(null);
    setOnb(null);
    setDb(seed());
    marcarCarga("carregando");
    // Sai para a tela de login limpa (idioma → tipo → credenciais), em vez de
    // ficar preso na URL de onboarding da empresa.
    if (!window.location.pathname.replace(/\/+$/, "").match(/^\/?(entrar|login)?$/i)) {
      window.history.replaceState({}, "", "/entrar");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const up = (fn) => setDb((d) => ({ ...d, ...fn(d) }));
  const aviso = (t) => setToast(t);
  const recarregar = () => carregarState();
  const ctx = { db, setDb, up, aviso, recarregar };

  // O papel vem do usuário autenticado, disponível assim que o login responde.
  // db.role só é preenchido depois do /state e chegaria vazio no primeiro render.
  const role = user?.role ?? db.role;

  const counts = useMemo(() => {
    if (role === "empresa") {
      return {
        conferir: db.submissions.filter((s) => s.companyId === db.companyId && s.status === "revisao").length,
        time: db.sellers.filter((s) => s.aplicacoes?.[db.companyId] === "pendente").length,
      };
    }
    if (role === "admin") {
      return {
        triagem: db.sellers.filter((s) => s.status === "triagem").length,
        liberar: db.submissions.filter((s) => s.status === "ia_aprovado" || s.status === "conferido").length,
        saques: db.withdrawals.filter((w) => w.status === "solicitado").length,
      };
    }
    return {};
  }, [db, role]);

  const aba = nav[role];
  const setAba = (k) => setNav((n) => ({ ...n, [role]: k }));

  // Link direto para uma aba (?aba=perfil), usado pelos botões dos e-mails.
  useEffect(() => {
    if (!role) return;
    const p = new URLSearchParams(window.location.search);
    const k = p.get("aba");
    if (!k) return;
    const existe = (NAV[role] || []).some((i) => i.key === k || i.children?.some((c) => c.key === k));
    if (existe) setNav((n) => ({ ...n, [role]: k }));
    p.delete("aba");
    const q = p.toString();
    window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
  }, [role]);

  if (!loaded) return <div className="vx-app" style={{ minHeight: "100dvh" }}><style>{CSS}</style></div>;

  const entrarComoAdmin = async (u) => { setUser(u); userRef.current = u; await carregarState(u); };

  // As telas públicas de cadastro (profissional/empresa e a escolha) devem
  // respeitar a URL mesmo com uma sessão ativa: abrir /cadastro/profissional
  // logado deixava de mostrar a página e jogava direto no dashboard.
  const rotaLoginExplicita = /^\/(entrar|login)\/?$/i.test(window.location.pathname);
  const rotaCadastro = rota.tipo === "cadastro" || rota.tipo === "escolha" || rotaLoginExplicita;
  if (!user || rotaCadastro) {
    if (rota.tipo === "landing") return <div className="vx-app"><style>{CSS}</style><Suspense fallback={<div className="vx-onb-estado" role="status">Carregando…</div>}><LandingPage /></Suspense></div>;
    return (
      <div className="vx-app">
        <style>{CSS}</style>
        {environment === "beta" && <div className="vx-beta-login-badge">AMBIENTE BETA — DADOS FICTÍCIOS</div>}
        {rota.tipo === "trial" ? <Login onLogin={login} conviteTrial beta={environment === "beta"} />
          : rota.tipo === "plataforma" ? <LoginPlataforma onEntrar={entrarComoAdmin} />
          : rota.tipo === "escolha" ? <Login onLogin={login} beta={environment === "beta"} />
          : rota.tipo === "cadastro" && rota.role === "vendedor" ? <Suspense fallback={<div className="vx-onb-estado" role="status">Carregando…</div>}><CadastroProfissional onRegister={(d) => registrar(d, { autoEntrar: false })} /></Suspense>
          : rota.tipo === "cadastro" && rota.role === "empresa" ? <EntradaEmpresa />
          : rota.tipo === "onboarding" || rota.tipo === "convite-onboarding"
            ? <EtapaAcesso conviteToken={rota.tipo === "convite-onboarding" ? rota.token : null}
                onRegister={(d) => registrar(d, { silencioso: true })} onLogin={(e, s) => login(e, s, { silencioso: true })} />
          : rota.tipo === "confirmar-email" ? <ConfirmarEmail token={rota.token} onLogin={loginDireto} />
          : <Login onLogin={login} beta={environment === "beta"} />}
        {toast && (
          <div className="vx-fade" style={{
            position: "fixed", bottom: 30, left: 16, right: 16, zIndex: 50, maxWidth: 480, margin: "0 auto",
            background: "var(--surface-3)", color: "var(--ink)", border: "1px solid var(--border)", padding: "12px 15px", borderRadius: 12, fontWeight: 500, fontSize: 13.5,
            boxShadow: "var(--shadow-pop)",
          }}>{toast}</div>
        )}
      </div>
    );
  }

  const roleLabel = { vendedor: "Vendedor", empresa: "Empresa", admin: "Plataforma" }[role] || "";

  const toastEl = toast && (
    <div className="vx-fade" role="status" style={{
      position: "fixed", bottom: 30, left: 16, right: 16, zIndex: 50, maxWidth: 480, margin: "0 auto",
      background: "var(--surface-3)", color: "var(--ink)", border: "1px solid var(--border)", padding: "12px 15px 12px 15px", borderRadius: 12, fontWeight: 500, fontSize: 13.5,
      boxShadow: "var(--shadow-pop)", display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ flex: 1 }}>{toast}</span>
      <button onClick={() => setToast("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--muted)", flexShrink: 0 }} aria-label="Fechar">✕</button>
    </div>
  );

  // A empresa entra direto na plataforma — sem onboarding guiado bloqueando.
  // O plano e os dados da empresa são preenchidos dentro do sistema quando quiser.
  const bannerOnb = role === "empresa" && onb && !onb.concluido && !onb.bloqueia && !previaQualificacao;

  // Entidade do usuário logado — alimenta o cartão de conta na barra lateral
  // (nome + logo da empresa ou foto do profissional).
  const entidadeConta = role === "empresa"
    ? db.companies.find((c) => c.id === db.companyId)
    : role === "vendedor"
      ? db.sellers.find((s) => s.id === db.sellerId)
      : null;

  return (
    <div className="vx-app">
      <style>{CSS}</style>

      <Shell role={role} user={user} entity={entidadeConta} active={aba} onSelect={setAba} counts={counts} beta={environment === "beta"} onLogout={logout} fullBleed={role === "empresa" && aba === "conversas"} settingsLayout={role === "empresa" && aba === "outros"}>
        <ErrorBoundary>
          <Suspense fallback={<div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>}>
            {carga === "carregando" && (
              <div className="vx-onb-estado vx-fade" role="status" aria-live="polite">
                <div className="vx-spinner" style={{ marginBottom: 12 }} />
                Carregando seus dados…
              </div>
            )}
            {carga === "erro" && (
              <div className="vx-onb-estado vx-fade" role="alert">
                <p style={{ margin: "0 0 14px", color: "var(--ink)" }}>Não foi possível carregar os dados agora.</p>
                <button className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={() => { marcarCarga("carregando"); carregarState(); }}>Tentar de novo</button>
              </div>
            )}
            {carga === "ok" && <>
            {role === "vendedor" && <Vendedor {...ctx} aba={aba} setAba={setAba} />}
            {role === "empresa" && <>
              {bannerOnb && aba === "inicio" && <BannerOnboarding onb={onb} />}
              <Empresa {...ctx} aba={aba} setAba={setAba} acesso={acesso} consultarAcesso={consultarAcesso} />
            </>}
            {role === "admin" && <Admin {...ctx} aba={aba} />}
            </>}
          </Suspense>
        </ErrorBoundary>
      </Shell>

      {toast && (
        <div className="vx-fade" style={{
          position: "fixed", bottom: 84, left: 16, right: 16, zIndex: 50, maxWidth: 480, margin: "0 auto",
          background: "var(--surface-3)", color: "var(--ink)", border: "1px solid var(--border)", padding: "12px 15px", borderRadius: 12, fontWeight: 500, fontSize: 13.5,
          boxShadow: "var(--shadow-pop)",
        }}>{toast}</div>
      )}
    </div>
  );
}
