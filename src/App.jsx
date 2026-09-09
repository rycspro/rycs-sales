import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { api } from "./lib/api.js";
import { seed } from "./lib/seed.js";
import { CSS } from "./styles.js";
import Shell from "./components/Shell.jsx";
import Login from "./components/Login.jsx";
import LoginPlataforma from "./components/LoginPlataforma.jsx";
import Vendedor from "./components/vendedor/index.jsx";
import Empresa from "./components/empresa/index.jsx";
import Admin from "./components/admin/index.jsx";
import Notificacoes from "./components/Notificacoes.jsx";

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
  const [nav, setNav] = useState({ vendedor: "empresas", empresa: previaQualificacao ? (previaEmpresa ? "cadastro" : "qualificacao") : "painel", admin: "dashboard" });
  // O escuro é a identidade primária da RYCS; o claro fica como preferência.
  const [dark, setDark] = useState(() => localStorage.getItem("rycs-theme") !== "light");

  const userRef = useRef(null);

  // A plataforma vive num endereço próprio. Sem router no projeto, o caminho
  // da URL decide qual porta de entrada aparece.
  const entradaPlataforma = typeof window !== "undefined" && window.location.pathname.startsWith("/plataforma");

  const toggleDark = () => {
    setDark((d) => { localStorage.setItem("rycs-theme", d ? "light" : "dark"); return !d; });
  };

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

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const me = await api("/auth/me");
        if (vivo && me?.id) {
          setUser(me);
          userRef.current = me;
          await carregarState(me);
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

  const login = async (email, senha) => {
    const r = await api("/auth/login", { email, senha });
    if (r?.error) { setToast(r.error); return false; }
    if (r?.id) { setUser(r); userRef.current = r; await carregarState(r); return true; }
    setToast("Erro ao fazer login."); return false;
  };

  const registrar = async (dados) => {
    const r = await api("/auth/register", dados);
    if (r?.error) { setToast(r.error); return false; }
    if (r?.id) { setUser(r); userRef.current = r; await carregarState(r); return true; }
    setToast("Erro ao registrar."); return false;
  };

  const logout = async () => {
    await api("/auth/logout", {});
    setUser(null);
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

  if (!loaded) return <div className={`vx-app${dark ? " vx-dark" : ""}`}><style>{CSS}</style></div>;

  const entrarComoAdmin = async (u) => { setUser(u); userRef.current = u; await carregarState(u); };

  if (!user) return (
    <div className={`vx-app${dark ? " vx-dark" : ""}`}>
      <style>{CSS}</style>
      {entradaPlataforma
        ? <LoginPlataforma onEntrar={entrarComoAdmin} />
        : <Login onLogin={login} onRegister={registrar} />}
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

  return (
    <div className={`vx-app${dark ? " vx-dark" : ""}`}>
      <style>{CSS}</style>

      <header className="vx-topbar">
        <div className="vx-topbar-inner">
          <div className="vx-word vx-disp" style={{ display: "flex", alignItems: "center" }}>
            <img className="vx-logo" src="/logo-rycs.png" alt="RYCS" style={{ height: 26 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="vx-chip">{roleLabel} · {user.email}</span>
            <Notificacoes items={db.notifications || []} onUpdate={recarregar} />
            <button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={toggleDark} style={{ padding: "7px 8px" }}>
              {dark ? <Sun size={17} strokeWidth={2.2} /> : <Moon size={17} strokeWidth={2.2} />}
            </button>
            <button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={logout}>Sair</button>
          </div>
        </div>
      </header>

      <Shell role={role} active={aba} onSelect={setAba} counts={counts}>
        {role === "vendedor" && <Vendedor {...ctx} aba={aba} setAba={setAba} />}
        {role === "empresa" && <Empresa {...ctx} aba={aba} />}
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
