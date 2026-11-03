import { NAV } from "../lib/constants.js";
export default function Shell({ role, active, onSelect, counts, beta, children }) {
  const allItems = (NAV[role] || []).filter((item) => !item.key || item.key !== "beta" || beta);
  const navItems = allItems.filter((item) => item.key);
  const bottomItems = navItems.slice(0, 5);

  return (
    <div className="vx-body">
      <aside className="vx-sidebar">
        <div className="vx-sidebar-logo">
          <img src="/logo-rycs.png" alt="RYCS" style={{ width: "100%", display: "block" }} />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", scrollbarWidth: "none" }}>
          {allItems.map((item, i) => {
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

      </aside>

      <div className="vx-content">
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
            <Icon size={19} strokeWidth={2.3} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
