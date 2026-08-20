import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { api } from "./lib/api.js";
import { seed } from "./lib/seed.js";
import { CSS } from "./styles.js";
import Shell from "./components/Shell.jsx";
import Login from "./components/Login.jsx";
import Vendedor from "./components/vendedor/index.jsx";
import Empresa from "./components/empresa/index.jsx";
import Admin from "./components/admin/index.jsx";
import Notificacoes from "./components/Notificacoes.jsx";

export default function App() {
  const [db, setDb] = useState(seed);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState("");
  const [nav, setNav] = useState({ vendedor: "empresas", empresa: "painel", admin: "dashboard" });
  const [dark, setDark] = useState(() => localStorage.getItem("rycs-theme") === "dark");

  const userRef = useRef(null);

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

  if (!user) return (
    <div className={`vx-app${dark ? " vx-dark" : ""}`}>
      <style>{CSS}</style>
      <Login onLogin={login} onRegister={registrar} />
      {toast && (
        <div className="vx-fade" style={{
          position: "fixed", bottom: 30, left: 16, right: 16, zIndex: 50, maxWidth: 480, margin: "0 auto",
          background: "var(--ink)", color: "#fff", padding: "12px 15px", borderRadius: 12, fontWeight: 500, fontSize: 13.5,
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
            <img src="/logo-rycs.png" alt="RYCS" style={{ height: 28, objectFit: "contain" }} />
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
        {role === "vendedor" && <Vendedor {...ctx} aba={aba} />}
        {role === "empresa" && <Empresa {...ctx} aba={aba} />}
        {role === "admin" && <Admin {...ctx} aba={aba} />}
      </Shell>

      {toast && (
        <div className="vx-fade" style={{
          position: "fixed", bottom: 84, left: 16, right: 16, zIndex: 50, maxWidth: 480, margin: "0 auto",
          background: "var(--ink)", color: "#fff", padding: "12px 15px", borderRadius: 12, fontWeight: 500, fontSize: 13.5,
          boxShadow: "var(--shadow-pop)",
        }}>{toast}</div>
      )}
    </div>
  );
}
