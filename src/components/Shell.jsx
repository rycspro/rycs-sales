import { LogOut } from "lucide-react";
import { NAV } from "../lib/constants.js";
import ThemeSwitcher from "./ThemeSwitcher.jsx";
export default function Shell({ role, active, onSelect, counts, beta, onLogout, children, fullBleed, settingsLayout }) {
  const rawItems = (NAV[role] || []).filter((item) => !item.key || item.key !== "beta" || beta);
  const configIdx = rawItems.findIndex((item) => item.key === "configuracoes");
  const allItems = configIdx > -1
    ? [...rawItems.filter((_, i) => i !== configIdx), rawItems[configIdx]]
    : rawItems;
  const navItems = allItems.filter((item) => item.key);
  const bottomItems = navItems.slice(0, 5);

  return (
    <div className="vx-body">
      <aside className="vx-sidebar">
        <div className="vx-sidebar-logo">
          <img src="/logo-rycs.png" alt="RYCS" style={{ width: "100%", display: "block" }} />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, overflowY: "auto", scrollbarWidth: "none" }}>
          {allItems.map((item, i) => {
            if (item.divider) {
              return <div key={`div-${i}`} style={{ margin: "2px 14px", borderTop: "1px solid var(--border)", opacity: 0.4 }} />;
            }
            if (item.section) {
              return <div key={`sec-${i}`} className="vx-sidebar-section">{item.section}</div>;
            }
            const { key, label, Icon } = item;
            return (
              <button key={key} className="vx-sidebtn" data-on={active === key ? "1" : "0"} onClick={() => onSelect(key)}>
                <Icon size={16} strokeWidth={2.3} />
                {label}
                {counts?.[key] > 0 && <span className="vx-sidedot">{counts[key]}</span>}
              </button>
            );
          })}
        </div>

        {onLogout && (
          <button
            type="button"
            className="vx-sidebtn"
            onClick={onLogout}
            style={{ margin: "0 8px 4px", color: "var(--muted)" }}
          >
            <LogOut size={16} strokeWidth={2.3} />
            Sair
          </button>
        )}
        <div style={{ padding: "10px 0", display: "flex", justifyContent: "center", borderTop: "1px solid var(--border)" }}>
          <ThemeSwitcher />
        </div>
      </aside>

      <div className={fullBleed ? "vx-content vx-content-chat" : settingsLayout ? "vx-content vx-content-settings" : "vx-content"}>
        {beta && (
          <div className="vx-beta-ribbon">
            <b>AMBIENTE BETA — DADOS FICTÍCIOS</b>
            <span>Nenhuma movimentação financeira possui valor real. Dados podem ser resetados. Use somente para testes.</span>
          </div>
        )}
        {children}
      </div>

      <nav className="vx-bottomnav">
        {bottomItems.map(({ key, label, Icon }) => (
          <button key={key} className="vx-navbtn" data-on={active === key ? "1" : "0"} onClick={() => onSelect(key)}>
            {active === key && <span className="vx-navbar-indicator" />}
            {counts?.[key] > 0 && <span className="vx-navdot">{counts[key]}</span>}
            <Icon size={20} strokeWidth={2.2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
