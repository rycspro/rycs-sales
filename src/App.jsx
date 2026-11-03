import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { api } from "./lib/api.js";
import { seed } from "./lib/seed.js";
import { CSS } from "./styles.js";
import Shell from "./components/Shell.jsx";
import Login from "./components/Login.jsx";
import LoginPlataforma from "./components/LoginPlataforma.jsx";
import CadastroProfissional from "./components/auth/CadastroProfissional.jsx";
import EscolhaCadastro from "./components/auth/EscolhaCadastro.jsx";
import { useRota, guardarConvite, guardarConviteOnboarding, lerConviteOnboarding, limparConviteOnboarding } from "./lib/rotas.js";
import EtapaAcesso from "./components/onboarding/EtapaAcesso.jsx";
import EntradaEmpresa from "./components/auth/EntradaEmpresa.jsx";
import ConfirmarEmail from "./components/auth/ConfirmarEmail.jsx";
import Onboarding from "./components/onboarding/index.jsx";
import Vendedor from "./components/vendedor/index.jsx";
import Empresa from "./components/empresa/index.jsx";
import Admin from "./components/admin/index.jsx";
import Notificacoes from "./components/Notificacoes.jsx";
import BannerOnboarding from "./components/empresa/BannerOnboarding.jsx";

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
  const [user, setUser] = useState(() => previaQualificacao ? { role: "empresa", email: "preview@local" } : null);
  const [toast, setToast] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [nav, setNav] = useState({ vendedor: "oportunidades", empresa: previaQualificacao ? (previaEmpresa ? "painel" : "academy") : "painel", admin: "dashboard" });
  useEffect(() => {
    document.documentElement.style.background = "#F4F7FC";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#F4F7FC");
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
    setOnb(r && !r.error ? r : { erro: r?.error || "Não foi possível carregar o seu cadastro." });
  }, []);

  // Acesso da empresa: prefetch em paralelo com onboarding, evita cascata.
  const [acesso, setAcesso] = useState(undefined);
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
  // Onboarding fora da frente do painel: o endereço de etapa não tem o que mostrar.
  useEffect(() => {
    if (onb && !onb.erro && !onb.bloqueia && window.location.pathname.startsWith("/onboarding")) window.history.replaceState({}, "", "/");
  }, [onb]);

  const carregarState = useCallback(async (usr) => {
    const u = usr || userRef.current;
    if (!u) return;
    const state = await api("/state");
    if (!state?.sellers) {
      // Sem dados ainda: fixa o papel para a interface conseguir renderizar.
      setDb((d) => ({ ...d, role: u.role }));
      return;
    }
    setDb((d) => ({
      ...d,
      ...state,
      role: u.role,
      sellerId: u.role === "vendedor" ? u.entityId : state.sellers.find((s) => s.status === "aprovado")?.id || null,
      companyId: u.role === "empresa" ? u.entityId : state.companies[0]?.id || null,
    }));
  }, []);

  useEffect(() => { api("/environment").then((r) => { if (r?.environment) setEnvironment(r.environment); }); }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const me = await api("/auth/me");
        if (vivo && me?.id) {
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
    const iv = setInterval(() => carregarState(), 30000);
    return () => clearInterval(iv);
  }, [user, carregarState]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // { silencioso } é para telas que mostram o erro no próprio campo.
  // Usado após confirmação de e-mail: o cookie já foi setado pelo servidor.
  const loginDireto = async (userData) => {
    if (userData?.id) { window.history.replaceState({}, "", "/"); setUser(userData); userRef.current = userData; await carregarState(userData); }
  };

  const login = async (email, senha, { silencioso = false } = {}) => {
    const r = await api("/auth/login", { email, senha });
    if (r?.error) { if (!silencioso) setToast(r.error); return { ok: false, error: r.error }; }
    if (r?.id) { setUser(r); userRef.current = r; await carregarState(r); return { ok: true }; }
    if (!silencioso) setToast("Erro ao fazer login.");
    return { ok: false, error: "Erro ao fazer login." };
  };

  const registrar = async (dados, { silencioso = false } = {}) => {
    const r = await api("/auth/register", dados);
    if (r?.error) { if (!silencioso) setToast(r.error); return { ok: false, error: r.error, campo: r.campo }; }
    if (r?.id) {
      // A conta existe: o endereço de cadastro não deve sobreviver a um F5,
      // senão a pessoa recarrega e volta a ver um formulário já cumprido.
      // Antes de trocar o usuário: o onboarding troca o endereço logo depois.
      window.history.replaceState({}, "", "/");
      setUser(r); userRef.current = r; await carregarState(r);
      return { ok: true };
    }
    if (!silencioso) setToast("Erro ao registrar.");
    return { ok: false, error: "Erro ao registrar." };
  };

  const logout = async () => {
    await api("/auth/logout", {});
    setUser(null);
    setOnb(null);
    setDb(seed());
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

  if (!loaded) return <div className="vx-app" style={{ background: "#F4F7FC", minHeight: "100dvh" }}><style>{CSS}</style></div>;

  const entrarComoAdmin = async (u) => { setUser(u); userRef.current = u; await carregarState(u); };

  if (!user) return (
    <div className="vx-app">
      <style>{CSS}</style>
      {environment === "beta" && <div className="vx-beta-login-badge">AMBIENTE BETA — DADOS FICTÍCIOS</div>}
      {rota.tipo === "trial" ? <Login onLogin={login} conviteTrial beta={environment === "beta"} />
        : rota.tipo === "plataforma" ? <LoginPlataforma onEntrar={entrarComoAdmin} />
        : rota.tipo === "escolha" ? <EscolhaCadastro />
        : rota.tipo === "cadastro" && rota.role === "vendedor" ? <CadastroProfissional onRegister={registrar} />
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

  const roleLabel = { vendedor: "Vendedor", empresa: "Empresa", admin: "Plataforma" }[role] || "";

  const toastEl = toast && (
    <div className="vx-fade" role="status" style={{
      position: "fixed", bottom: 30, left: 16, right: 16, zIndex: 50, maxWidth: 480, margin: "0 auto",
      background: "var(--surface-3)", color: "var(--ink)", border: "1px solid var(--border)", padding: "12px 15px", borderRadius: 12, fontWeight: 500, fontSize: 13.5,
      boxShadow: "var(--shadow-pop)",
    }}>{toast}</div>
  );

  // Empresa com onboarding em aberto não entra na plataforma: vê as etapas.
  if (role === "empresa" && !previaQualificacao) {
    if (!onb) return <div className="vx-app"><style>{CSS}</style><div className="vx-onb-estado" role="status">Carregando seu cadastro…</div></div>;
    if (onb.erro) return (
      <div className="vx-app"><style>{CSS}</style>
        <div className="vx-onb-estado" role="alert">
          <p>{onb.erro}</p>
          <button className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} onClick={carregarOnboarding}>Tentar novamente</button>
        </div>
      </div>
    );
    if (onb.bloqueia) return (
      <div className="vx-app">
        <style>{CSS}</style>
        <Onboarding estado={onb} email={user.email}
          // Saindo do onboarding, o painel precisa dos dados que acabaram de ser preenchidos.
          setEstado={(novo) => {
            setOnb(novo);
            if (novo.bloqueia) return;
            carregarState();
            // Concluído: a empresa vai para a listagem de campanhas.
            if (novo.concluido) setNav((n) => ({ ...n, empresa: "campanhas" }));
          }}
          emp={db.companies.find((c) => c.id === db.companyId)} aviso={aviso}
          etapaPedida={rota.tipo === "onboarding" ? rota.etapa : null} aoSair={logout} />
        {toastEl}
      </div>
    );
    // caminho=livre: onboarding incompleto mas a plataforma não bloqueia.
    // Deixa cair no return principal com o banner.
  }

  const bannerOnb = role === "empresa" && onb && !onb.concluido && !onb.bloqueia && !previaQualificacao;

  return (
    <div className="vx-app">
      <style>{CSS}</style>

      {bannerOnb && <BannerOnboarding onb={onb} />}

      <header className="vx-topbar" style={bannerOnb ? { marginTop: 48 } : undefined}>
        <div className="vx-topbar-inner">
          <div className="vx-word vx-disp" style={{ display: "flex", alignItems: "center" }}>
            <img className="vx-logo" src="/logo-rycs.png" alt="RYCS" style={{ height: 26 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {environment === "beta" && <span className="vx-beta-badge">AMBIENTE BETA — DADOS FICTÍCIOS</span>}
            <span className="vx-chip">{roleLabel} · {user.email}</span>
            <Notificacoes items={db.notifications || []} onUpdate={recarregar} />
            <button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={logout}>Sair</button>
          </div>
        </div>
      </header>

      <Shell role={role} active={aba} onSelect={setAba} counts={counts} beta={environment === "beta"}>
        {role === "vendedor" && <Vendedor {...ctx} aba={aba} setAba={setAba} />}
        {role === "empresa" && <Empresa {...ctx} aba={aba} setAba={setAba} acesso={acesso} consultarAcesso={consultarAcesso} />}
        {role === "admin" && <Admin {...ctx} aba={aba} />}
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
