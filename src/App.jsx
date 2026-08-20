import { useState, useEffect, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { api } from "./lib/api.js";
import { seed } from "./lib/seed.js";
import { CSS } from "./styles.js";
import Shell from "./components/Shell.jsx";
import Login from "./components/Login.jsx";
import Vendedor from "./components/vendedor/index.jsx";
import Empresa from "./components/empresa/index.jsx";
import Admin from "./components/admin/index.jsx";

export default function App() {
  const [db, setDb] = useState(seed);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState("");
  const [nav, setNav] = useState({ vendedor: "empresas", empresa: "painel", admin: "triagem" });

  const carregarState = async (usr) => {
    const state = await api("/state");
    if (!state?.sellers) return;
    setDb((d) => ({
      ...d,
      ...state,
      role: usr.role,
      sellerId: usr.role === "vendedor" ? usr.entityId : state.sellers.find((s) => s.status === "aprovado")?.id || null,
      companyId: usr.role === "empresa" ? usr.entityId : state.companies[0]?.id || null,
    }));
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const me = await api("/auth/me");
        if (vivo && me?.id) {
          setUser(me);
          await carregarState(me);
        }
      } catch (e) {}
      if (vivo) setLoaded(true);
    })();
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const login = async (email, senha) => {
    const r = await api("/auth/login", { email, senha });
    if (r?.error) { setToast(r.error); return false; }
    if (r?.id) { setUser(r); await carregarState(r); return true; }
    setToast("Erro ao fazer login."); return false;
  };

  const registrar = async (dados) => {
    const r = await api("/auth/register", dados);
    if (r?.error) { setToast(r.error); return false; }
    if (r?.id) { setUser(r); await carregarState(r); return true; }
    setToast("Erro ao registrar."); return false;
  };

  const logout = async () => {
    await api("/auth/logout", {});
    setUser(null);
    setDb(seed());
  };

  const up = (fn) => setDb((d) => ({ ...d, ...fn(d) }));
  const aviso = (t) => setToast(t);
  const ctx = { db, setDb, up, aviso };

  const counts = useMemo(() => {
    if (db.role === "empresa") {
      return {
        conferir: db.submissions.filter((s) => s.companyId === db.companyId && s.status === "revisao").length,
        time: db.sellers.filter((s) => s.aplicacoes?.[db.companyId] === "pendente").length,
      };
    }
    if (db.role === "admin") {
      return {
        triagem: db.sellers.filter((s) => s.status === "triagem").length,
        liberar: db.submissions.filter((s) => s.status === "ia_aprovado" || s.status === "conferido").length,
        saques: db.withdrawals.filter((w) => w.status === "solicitado").length,
      };
    }
    return {};
  }, [db]);

  const aba = nav[db.role];
  const setAba = (k) => setNav((n) => ({ ...n, [db.role]: k }));

  if (!loaded) return <div className="vx-app"><style>{CSS}</style></div>;

  if (!user) return (
    <div className="vx-app">
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

  const roleLabel = { vendedor: "Vendedor", empresa: "Empresa", admin: "Plataforma" }[db.role] || "";

  return (
    <div className="vx-app">
      <style>{CSS}</style>

      <header className="vx-topbar">
        <div className="vx-topbar-inner">
          <div className="vx-word vx-disp">
            <span className="vx-mark"><Sparkles size={15} color="#fff" strokeWidth={2.5} /></span>
            Sales Machine
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="vx-chip">{roleLabel} · {user.email}</span>
            <button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={logout}>Sair</button>
          </div>
        </div>
      </header>

      <Shell role={db.role} active={aba} onSelect={setAba} counts={counts}>
        {db.role === "vendedor" && <Vendedor {...ctx} aba={aba} />}
        {db.role === "empresa" && <Empresa {...ctx} aba={aba} />}
        {db.role === "admin" && <Admin {...ctx} aba={aba} />}
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
