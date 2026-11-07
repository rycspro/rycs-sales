import { useEffect, useRef, useState } from "react";
import { LogOut, ChevronUp, CircleUserRound, Settings, Headphones } from "lucide-react";
import { NAV, MOBILE_NAV } from "../lib/constants.js";
import ThemeSwitcher from "./ThemeSwitcher.jsx";
export default function Shell({ user, entity, role, active, onSelect, counts, beta, onLogout, children, fullBleed, settingsLayout }) {
  const rawItems = (NAV[role] || []).filter((item) => !item.key || item.key !== "beta" || beta);
  const configIdx = rawItems.findIndex((item) => item.key === "configuracoes");
  const allItems = configIdx > -1
    ? [...rawItems.filter((_, i) => i !== configIdx), rawItems[configIdx]]
    : rawItems;
  const navItems = allItems.filter((item) => item.key);
  const bottomItems = MOBILE_NAV[role] || navItems.slice(0, 5);
  const accountRole = role === "empresa" || role === "vendedor";
  // Destaque da barra inferior: telas sem aba própria no celular acendem a aba
  // que as contém. Perfil, Indicar e Configurações do profissional vivem em
  // "Conta"; no lado empresa, a conta inteira acende "Conta" (configuracoes), e
  // Leads/Aprovações/Profissionais acendem "Campanhas".
  const mobileActive = (() => {
    if (role === "vendedor" && ["conta", "configuracoes", "perfil", "indicar", "suporte-conta"].includes(active)) return "conta";
    if (role === "empresa") {
      if (["conta", "configuracoes", "perfil", "carteira", "academy", "indicar", "suporte-conta"].includes(active)) return "configuracoes";
      if (["leads", "conferir", "profissionais"].includes(active)) return "campanhas";
    }
    return active;
  })();

  return (
    <div className="vx-body">
      <aside className="vx-sidebar">
        <div className="vx-sidebar-logo">
          <img src="/logo-rycs.png" alt="RYCS" style={{ width: "100%", display: "block" }} />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, overflowY: "auto", scrollbarWidth: "none" }}>
          {allItems.filter(item => !accountRole || !["configuracoes", "perfil"].includes(item.key)).map((item, i) => {
            if (item.divider) {
              return <div key={`div-${i}`} style={{ margin: "2px 14px", borderTop: "1px solid var(--border)", opacity: 0.4 }} />;
            }
            if (item.section) {
              return <div key={`sec-${i}`} className="vx-sidebar-section">{item.section}</div>;
            }
            const { key, label, Icon } = item;
            return (
              <button key={key} className="vx-sidebtn" data-on={active === key ? "1" : "0"} onClick={() => onSelect(key)}>
                <Icon size={18} strokeWidth={1.85} />
                {label}
                {counts?.[key] > 0 && <span className="vx-sidedot">{counts[key]}</span>}
              </button>
            );
          })}
        </div>

        {accountRole && <AccountMenu user={user} entity={entity} onSelect={onSelect} onLogout={onLogout} />}
        {!accountRole && onLogout && (
          <button
            type="button"
            className="vx-sidebtn"
            onClick={onLogout}
            style={{ margin: "0 8px 4px", color: "var(--muted)" }}
          >
            <LogOut size={18} strokeWidth={1.85} />
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
        {onLogout && (
          <div className="vx-mobile-actions">
            <button type="button" className="vx-btn vx-btn-sm" onClick={onLogout}>
              <LogOut size={16} aria-hidden="true" /> Sair
            </button>
          </div>
        )}
        {children}
      </div>

      <nav className="vx-bottomnav">
        {bottomItems.map(({ key, label, Icon }) => (
          <button key={key} className="vx-navbtn" aria-current={mobileActive === key ? "page" : undefined} data-on={mobileActive === key ? "1" : "0"} onClick={() => onSelect(key)}>
            {mobileActive === key && <span className="vx-navbar-indicator" />}
            {counts?.[key] > 0 && <span className="vx-navdot">{counts[key]}</span>}
            <Icon size={22} strokeWidth={1.95} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function AccountMenu({ user, entity, onSelect, onLogout }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null), trigger = useRef(null), menu = useRef(null);
  const company = user?.role === 'empresa';
  const nome = entity?.nome || user?.email || 'Minha Conta';
  const avatar = company ? entity?.logo : entity?.foto;
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector('button')?.focus();
    const outside = e => { if (!root.current?.contains(e.target)) setOpen(false); };
    const escape = e => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const choose = action => { setOpen(false); trigger.current?.focus(); action(); };
  return <div className="vx-sidebar-account" ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    {open && <div className="vx-account-menu" ref={menu} role="menu" aria-label="Menu da conta" onKeyDown={e => {
      if (!['ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
      e.preventDefault(); const buttons = [...menu.current.querySelectorAll('button')], i = buttons.indexOf(document.activeElement);
      buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length-1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }}>
      {[[CircleUserRound, 'Minha Conta', 'conta'], [Settings, 'Configurações', 'configuracoes']].map(([Icon,label,key]) => <button type="button" role="menuitem" key={key} onClick={() => choose(() => onSelect(key))}><Icon size={18} />{label}</button>)}
      <button type="button" role="menuitem" onClick={() => choose(() => onSelect('suporte-conta'))}><Headphones size={18} />Ajuda e suporte</button>
      <button type="button" role="menuitem" onClick={() => choose(onLogout)}><LogOut size={18} />Sair da conta</button>
    </div>}
    <button type="button" className="vx-account-trigger" ref={trigger} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
      {avatar ? <img src={avatar} alt="" /> : <span className="vx-account-initial">{nome.slice(0,1).toUpperCase()}</span>}
      <span><strong>{nome}</strong><small>{company ? 'Empresa' : 'Profissional'}</small></span><ChevronUp size={17} />
    </button>
  </div>;
}
