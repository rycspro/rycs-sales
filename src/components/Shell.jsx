import { useEffect, useRef, useState, useCallback } from "react";
import { LogOut, ChevronDown, ChevronUp, ChevronRight, Building2, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV, MOBILE_NAV } from "../lib/constants.js";
import { api } from "../lib/api.js";
import { lerJson, gravarJson } from "../lib/armazenamento.js";
import ThemeSwitcher from "./ThemeSwitcher.jsx";

const SIDEBAR_STORAGE_KEY = "rycs-sidebar-state";
const COLLAPSED_STORAGE_KEY = "rycs-sidebar-collapsed";

function allChildKeys(item) {
  const keys = [];
  if (!item.children) return keys;
  for (const c of item.children) {
    if (c.key) keys.push(c.key);
    if (c.children) for (const sc of c.children) if (sc.key) keys.push(sc.key);
  }
  return keys;
}

function findGroupForKey(items, key) {
  for (const item of items) {
    if (!item.children) continue;
    if (allChildKeys(item).includes(key)) return item.key;
  }
  return null;
}

export default function Shell({ user, entity, role, active, onSelect, counts, beta, colaborador, onLogout, children, fullBleed, settingsLayout }) {
  const [acessoAgenda, setAcessoAgenda] = useState(false);
  useEffect(() => {
    let ativo = true;
    setAcessoAgenda(false);
    if (role === "vendedor") api("/agenda-comercial/acesso").then(r => { if (ativo) setAcessoAgenda(!!r?.permitido); });
    return () => { ativo = false; };
  }, [role, user?.id]);

  const isVendedor = role === "vendedor";

  const [gruposAbertos, setGruposAbertos] = useState(() => {
    if (!isVendedor) return {};
    const saved = lerJson(SIDEBAR_STORAGE_KEY, {});
    return typeof saved === "object" && saved !== null ? saved : {};
  });

  const [collapsed, setCollapsed] = useState(() => {
    if (!isVendedor) return false;
    return lerJson(COLLAPSED_STORAGE_KEY, false) === true;
  });

  const [menuMobile, setMenuMobile] = useState(false);

  useEffect(() => {
    if (!isVendedor) return;
    gravarJson(SIDEBAR_STORAGE_KEY, gruposAbertos);
  }, [gruposAbertos, isVendedor]);

  useEffect(() => {
    if (!isVendedor) return;
    gravarJson(COLLAPSED_STORAGE_KEY, collapsed);
  }, [collapsed, isVendedor]);

  useEffect(() => {
    if (!isVendedor) {
      setGruposAbertos({});
      return;
    }
    const navItems = NAV[role] || [];
    const parentKey = findGroupForKey(navItems, active);
    if (parentKey && !gruposAbertos[parentKey]) {
      setGruposAbertos(prev => ({ ...prev, [parentKey]: true }));
    }
  }, [active, role, isVendedor]);

  useEffect(() => { setMenuMobile(false); }, [active]);

  const drawerRef = useRef(null);
  useEffect(() => {
    if (!menuMobile) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector(".vx-mobilemenu-x")?.focus();
    const onKey = (e) => { if (e.key === "Escape") setMenuMobile(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = anterior; document.removeEventListener("keydown", onKey); };
  }, [menuMobile]);

  const rawItems = (NAV[role] || []).filter((item) => {
    if (!item.key) return true;
    if (item.key === "beta" && !beta) return false;
    if (item.key === "colaborador" && !colaborador) return false;
    if (item.key === "agenda-comercial" && role !== "admin" && !acessoAgenda) return false;
    if (item.hidden) return false;
    return true;
  });

  const fimKeys = new Set(["outros"]);
  const fimItems = rawItems.filter((item) => fimKeys.has(item.key));
  const allItems = fimItems.length
    ? [...rawItems.filter((item) => !fimKeys.has(item.key)), ...fimItems]
    : rawItems;
  const navItems = allItems.filter((item) => item.key);
  const bottomItems = MOBILE_NAV[role] || navItems.slice(0, 5);
  const accountRole = role === "empresa" || role === "vendedor";

  const mobileActive = (() => {
    if (role === "vendedor" && ["conta", "configuracoes", "perfil", "testes", "indicar", "suporte-conta"].includes(active)) return "conta";
    if (role === "vendedor" && ["planos", "loja-leads"].includes(active)) return "compras";
    if (role === "empresa") {
      if (["conta", "configuracoes", "outros", "perfil", "carteira", "academy", "indicar", "suporte-conta", "pagamentos", "pagamentos-visibilidade"].includes(active)) return "outros";
      if (["leads-whatsapp", "leads-instagram"].includes(active)) return "conversas";
      if (["leads", "pedidos", "loja-leads", "integracoes", "materiais", "academy-empresa", "profissionais", "conferir-fila", "conferir-time"].includes(active)) return "campanhas";
      if (["campanhas-comissoes", "campanhas-tarefas", "pagamentos-campanhas"].includes(active)) return "campanhas";
    }
    return active;
  })();

  const mobileItems = (() => {
    const base = allItems.filter((item) => !item.divider);
    const out = [{ section: "Início" }];
    for (const item of base) {
      if (item.key === "suporte") out.push({ section: "Configurações" });
      out.push(item);
    }
    return out;
  })();

  const toggleGrupo = useCallback((key) => {
    setGruposAbertos(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const renderVendedorNav = (items) => items
    .filter(item => !item.hidden)
    .map((item, i) => {
      if (item.divider) return <div key={`div-${i}`} style={{ margin: "2px 14px", borderTop: "1px solid var(--border)", opacity: 0.4 }} />;
      if (item.section) return <div key={`sec-${i}`} className="vx-sidebar-section">{item.section}</div>;
      const { key, label, Icon, children: kids } = item;

      if (!kids) {
        if (collapsed) {
          return (
            <button key={key} className="vx-sidebtn vx-sidebtn-collapsed" data-on={active === key ? "1" : "0"} onClick={() => onSelect(key)} title={label}>
              <Icon size={20} strokeWidth={1.85} />
            </button>
          );
        }
        return (
          <button key={key} className="vx-sidebtn" data-on={active === key ? "1" : "0"} onClick={() => onSelect(key)}>
            <Icon size={18} strokeWidth={1.85} />
            {label}
            {counts?.[key] > 0 && <span className="vx-sidedot">{counts[key]}</span>}
          </button>
        );
      }

      const childKeys = allChildKeys(item);
      const grupoAtivo = childKeys.includes(active);
      const aberto = gruposAbertos[key] ?? grupoAtivo;

      if (collapsed) {
        return (
          <div key={key} className="vx-collapsed-group">
            <button
              className="vx-sidebtn vx-sidebtn-collapsed"
              data-on={grupoAtivo ? "1" : "0"}
              title={label}
              onClick={() => onSelect(kids[0]?.key ?? key)}
            >
              <Icon size={20} strokeWidth={1.85} />
            </button>
          </div>
        );
      }

      return (
        <div key={key} className="vx-accordion" data-open={aberto ? "1" : "0"}>
          <button
            className="vx-accordion-header"
            data-on={grupoAtivo ? "1" : "0"}
            aria-expanded={aberto}
            onClick={() => toggleGrupo(key)}
          >
            <Icon size={18} strokeWidth={1.85} className="vx-accordion-icon" />
            <span className="vx-accordion-label">{label}</span>
            <ChevronRight size={14} className="vx-accordion-chevron" style={{ transform: aberto ? "rotate(90deg)" : "none" }} />
          </button>
          <div className="vx-accordion-body" style={{ display: aberto ? "flex" : "none" }}>
            {kids.map((sub) => {
              if (sub.children) {
                const subActive = sub.children.some(sc => sc.key === active);
                return (
                  <div key={sub.key} className="vx-accordion-sub">
                    <button
                      className="vx-sidebtn vx-subitem"
                      data-on={subActive ? "1" : "0"}
                      onClick={() => onSelect(sub.children[0]?.key ?? sub.key)}
                    >
                      {sub.Icon && <sub.Icon size={16} strokeWidth={1.85} />}
                      {sub.label}
                    </button>
                    {subActive && sub.children.map(sc => (
                      <button key={sc.key} className="vx-sidebtn vx-subsubitem" data-on={active === sc.key ? "1" : "0"} onClick={() => onSelect(sc.key)}>
                        {sc.label}
                      </button>
                    ))}
                  </div>
                );
              }
              return (
                <button key={sub.key} className="vx-sidebtn vx-subitem" data-on={active === sub.key ? "1" : "0"} onClick={() => onSelect(sub.key)}>
                  {sub.Icon && <sub.Icon size={16} strokeWidth={1.85} />}
                  {sub.label}
                  {counts?.[sub.key] > 0 && <span className="vx-sidedot">{counts[sub.key]}</span>}
                </button>
              );
            })}
          </div>
        </div>
      );
    });

  const renderNav = (items, { mobile = false } = {}) => items
    .filter((item) => item.key !== "perfil" || role === "vendedor")
    .map((item, i) => {
      if (item.divider) return <div key={`div-${i}`} style={{ margin: "2px 14px", borderTop: "1px solid var(--border)", opacity: 0.4 }} />;
      if (item.section) return <div key={`sec-${i}`} className="vx-sidebar-section">{item.section}</div>;
      const { key, label, Icon, children: kids } = item;
      if (kids) {
        const grupoAtivo = active === key || kids.some((c) => c.key === active);
        const aberto = gruposAbertos[key] !== undefined ? gruposAbertos[key] : grupoAtivo;
        return (
          <div key={key} style={{ display: "flex", flexDirection: "column" }}>
            <button
              className="vx-sidebtn"
              data-on={grupoAtivo ? "1" : "0"}
              aria-expanded={aberto}
              onClick={() => {
                const novo = !aberto;
                setGruposAbertos((a) => ({ ...a, [key]: novo }));
                if (!mobile && novo && !grupoAtivo) onSelect(kids[0]?.key ?? key);
              }}
            >
              <Icon size={18} strokeWidth={1.85} />
              {label}
              <ChevronDown size={16} style={{ marginLeft: "auto", flexShrink: 0, color: "var(--muted)", transition: "transform .2s", transform: aberto ? "rotate(180deg)" : "none" }} />
            </button>
            {aberto && kids.map((sub) => (
              <button key={sub.key} className="vx-sidebtn vx-subitem" data-on={active === sub.key ? "1" : "0"} onClick={() => onSelect(sub.key)}>
                {sub.label}
              </button>
            ))}
          </div>
        );
      }
      return (
        <button key={key} className="vx-sidebtn" data-on={active === key ? "1" : "0"} onClick={() => onSelect(key)}>
          <Icon size={18} strokeWidth={1.85} />
          {label}
          {counts?.[key] > 0 && <span className="vx-sidedot">{counts[key]}</span>}
        </button>
      );
    });

  const sidebarWidth = isVendedor && collapsed ? 68 : undefined;

  return (
    <div className={`vx-body${isVendedor && collapsed ? " vx-sidebar-collapsed" : ""}`}>
      <aside className="vx-sidebar" style={sidebarWidth ? { width: sidebarWidth, minWidth: sidebarWidth } : undefined}>
        <div className="vx-sidebar-logo">
          {isVendedor && collapsed
            ? <img src="/logo-rycs-icon.png" alt="RYCS" style={{ height: 28, width: "auto", display: "block", margin: "0 auto" }} onError={(e) => { e.target.src = "/logo-rycs-sm.png"; e.target.style.height = "22px"; }} />
            : <img src="/logo-rycs-sm.png" alt="RYCS Sales Machine" style={{ height: 30, width: "auto", maxWidth: "100%", display: "block", margin: "0 auto" }} />
          }
        </div>

        <div className="vx-sidebar-nav" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", scrollbarWidth: "none", padding: collapsed ? "8px 6px 0" : "8px 10px 0" }}>
          {isVendedor ? renderVendedorNav(allItems) : renderNav(allItems)}
        </div>

        {!accountRole && onLogout && (
          <button type="button" className="vx-sidebtn" onClick={onLogout} style={{ margin: "0 8px 4px", color: "var(--muted)" }}>
            <LogOut size={18} strokeWidth={1.85} />
            {!collapsed && "Sair"}
          </button>
        )}
        <div className="vx-sidebar-footer">
          {isVendedor ? (
            <>
              <ThemeSwitcher />
              <button
                type="button"
                className="vx-sidebar-collapse-btn"
                onClick={() => setCollapsed(c => !c)}
                title={collapsed ? "Expandir menu" : "Recolher menu"}
                aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              >
                {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.85} /> : <PanelLeftClose size={16} strokeWidth={1.85} />}
              </button>
              {accountRole && !collapsed && <AccountMenu user={user} entity={entity} onSelect={onSelect} onLogout={onLogout} />}
              {accountRole && collapsed && (
                <button
                  type="button"
                  className="vx-account-logo-mini"
                  title={entity?.nome || user?.email || "Minha conta"}
                  onClick={() => onSelect("perfil")}
                >
                  {(role === "vendedor" && entity?.foto)
                    ? <img src={entity.foto} alt="" style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover" }} />
                    : <span className="vx-account-initial" style={{ width: 28, height: 28, fontSize: 12, borderRadius: 7 }}>{(entity?.nome || user?.email || "?").slice(0, 1).toUpperCase()}</span>}
                </button>
              )}
            </>
          ) : (
            <>
              <ThemeSwitcher />
              {accountRole && <AccountMenu user={user} entity={entity} onSelect={onSelect} onLogout={onLogout} />}
            </>
          )}
        </div>
      </aside>

      <div className={fullBleed ? "vx-content vx-content-chat" : settingsLayout ? "vx-content vx-content-settings" : "vx-content"}>
        {beta && (
          <div className="vx-beta-ribbon">
            <b>AMBIENTE BETA — DADOS FICTÍCIOS</b>
            <span>Nenhuma movimentação financeira possui valor real. Dados podem ser resetados. Use somente para testes.</span>
          </div>
        )}
        <div className="vx-mobile-topbar">
          {active === bottomItems[0]?.key && (
            <img src="/logo-rycs-sm.png" alt="RYCS Sales Machine" className="vx-mobile-logo" />
          )}
          <div id="vx-mobile-actions" className="vx-mobile-actions-slot">
            {!accountRole && onLogout && (
              <button type="button" className="vx-btn vx-btn-sm" onClick={onLogout}>
                <LogOut size={16} aria-hidden="true" /> Sair
              </button>
            )}
          </div>
        </div>
        {children}
      </div>

      <nav className="vx-bottomnav">
        {bottomItems.map(({ key, label, Icon }) => {
          const ehMenu = key === "outros";
          const aceso = ehMenu ? menuMobile || mobileActive === key : mobileActive === key;
          return (
            <button
              key={key}
              className="vx-navbtn"
              aria-current={aceso ? "page" : undefined}
              data-on={aceso ? "1" : "0"}
              onClick={() => ehMenu ? setMenuMobile(true) : onSelect(key)}
            >
              {aceso && <span className="vx-navbar-indicator" />}
              {counts?.[key] > 0 && <span className="vx-navdot">{counts[key]}</span>}
              <Icon size={22} strokeWidth={1.95} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {menuMobile && (
        <div className="vx-mobilemenu-overlay" onClick={() => setMenuMobile(false)}>
          <div className="vx-mobilemenu" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Menu de navegação" onClick={(e) => e.stopPropagation()}>
            <div className="vx-mobilemenu-head">
              <img src="/logo-rycs-sm.png" alt="RYCS Sales Machine" className="vx-mobilemenu-logo" />
              <button type="button" className="vx-mobilemenu-x" aria-label="Fechar menu" onClick={() => setMenuMobile(false)}><X size={18} strokeWidth={2} /></button>
            </div>
            <div className="vx-mobilemenu-list">
              {renderNav(mobileItems, { mobile: true })}
            </div>
            {accountRole && (
              <div className="vx-mobilemenu-footer">
                <button type="button" className="vx-mobilemenu-conta" onClick={() => onSelect(role === "empresa" ? "configuracoes" : "conta")}>
                  <span className="vx-mobilemenu-avatar">
                    {role === "vendedor" && entity?.foto
                      ? <img src={entity.foto} alt="" />
                      : <span>{(entity?.nome || user?.email || "?").slice(0, 1).toUpperCase()}</span>}
                  </span>
                  <span className="vx-mobilemenu-conta-nome">{entity?.nome || user?.email || "Minha conta"}</span>
                </button>
                {onLogout && (
                  <button type="button" className="vx-mobilemenu-sair" onClick={onLogout}>
                    <LogOut size={17} strokeWidth={1.9} /> Sair da conta
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountMenu({ user, entity, onSelect, onLogout, dropDown = false }) {
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
    {open && <div className={`vx-account-menu${dropDown ? " vx-account-menu--down" : ""}`} ref={menu} role="menu" aria-label="Menu da conta" onKeyDown={e => {
      if (!['ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
      e.preventDefault(); const buttons = [...menu.current.querySelectorAll('button')], i = buttons.indexOf(document.activeElement);
      buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length-1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }}>
      {company && <button type="button" role="menuitem" onClick={() => choose(() => onSelect('configuracoes'))}><Building2 size={18} />Dados da empresa</button>}
      <button type="button" role="menuitem" className="vx-account-sair" onClick={() => choose(onLogout)}><LogOut size={18} />Sair da conta</button>
    </div>}
    <button type="button" className="vx-account-logo" ref={trigger} aria-haspopup="menu" aria-expanded={open} aria-label={nome} title={nome} onClick={() => setOpen(!open)}>
      {avatar ? <img src={avatar} alt="" /> : <span className="vx-account-initial">{nome.slice(0,1).toUpperCase()}</span>}
      <ChevronUp size={15} className="vx-account-chevron" style={{ transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
    </button>
  </div>;
}
