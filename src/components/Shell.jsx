import { NAV } from "../lib/constants.js";

export default function Shell({ role, active, onSelect, counts, children }) {
  // role pode chegar vazio na janela entre o login e o carregamento do state.
  const items = NAV[role] || [];
  return (
    <div className="vx-body">
      <aside className="vx-sidebar">
        {items.map(({ key, label, Icon }) => (
          <button key={key} className="vx-sidebtn" data-on={active === key ? "1" : "0"} onClick={() => onSelect(key)}>
            <Icon size={16} strokeWidth={2.3} />
            {label}
            {counts?.[key] > 0 && <span className="vx-sidedot">{counts[key]}</span>}
          </button>
        ))}
      </aside>

      <div className="vx-content">{children}</div>

      <nav className="vx-bottomnav">
        {items.map(({ key, label, Icon }) => (
          <button key={key} className="vx-navbtn" data-on={active === key ? "1" : "0"} onClick={() => onSelect(key)}>
            {counts?.[key] > 0 && <span className="vx-navdot">{counts[key]}</span>}
            <Icon size={19} strokeWidth={2.3} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
