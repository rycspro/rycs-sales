import { useEffect, useRef, useState } from "react";
import { LogOut, ChevronDown, ChevronUp, Building2, X } from "lucide-react";
import { NAV, MOBILE_NAV } from "../lib/constants.js";
import { api } from "../lib/api.js";
import ThemeSwitcher from "./ThemeSwitcher.jsx";
export default function Shell({ user, entity, role, active, onSelect, counts, beta, colaborador, onLogout, children, fullBleed, settingsLayout }) {
  const [acessoAgenda, setAcessoAgenda] = useState(false);
  useEffect(() => {
    let ativo = true;
    setAcessoAgenda(false);
    if (role === "vendedor") api("/agenda-comercial/acesso").then(r => { if (ativo) setAcessoAgenda(!!r?.permitido); });
    return () => { ativo = false; };
  }, [role, user?.id]);
  const [gruposAbertos, setGruposAbertos] = useState({});
  const [menuMobile, setMenuMobile] = useState(false);
  // Ao navegar para outra página, fecha os submenus abertos manualmente — só o
  // grupo que contém a página ativa permanece aberto (comportamento sanfona).
  useEffect(() => { setGruposAbertos({}); }, [active]);
  // Navegou: fecha o menu completo do celular.
  useEffect(() => { setMenuMobile(false); }, [active]);
  const drawerRef = useRef(null);
  // Enquanto o drawer está aberto: trava o scroll de fundo, leva o foco para o
  // menu (leitor de tela / teclado) e permite fechar com Esc.
  useEffect(() => {
    if (!menuMobile) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector(".vx-mobilemenu-x")?.focus();
    const onKey = (e) => { if (e.key === "Escape") setMenuMobile(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = anterior; document.removeEventListener("keydown", onKey); };
  }, [menuMobile]);
  const rawItems = (NAV[role] || []).filter((item) => !item.key || (item.key !== "beta" || beta) && (item.key !== "colaborador" || colaborador) && (item.key !== "agenda-comercial" || role === "admin" || acessoAgenda));
  const fimKeys = new Set(["outros"]);
  const fimItems = rawItems.filter((item) => fimKeys.has(item.key));
  const allItems = fimItems.length
    ? [...rawItems.filter((item) => !fimKeys.has(item.key)), ...fimItems]
    : rawItems;
  const navItems = allItems.filter((item) => item.key);
  const bottomItems = MOBILE_NAV[role] || navItems.slice(0, 5);
  const accountRole = role === "empresa" || role === "vendedor";
  // Destaque da barra inferior: telas sem aba própria no celular acendem a aba
  // que as contém. Perfil, Indicar e Configurações do profissional vivem em
  // "Conta"; no lado empresa, a conta inteira acende "Conta" (configuracoes), e
  // Leads/Aprovações/Profissionais acendem "Campanhas".
  const mobileActive = (() => {
    if (role === "vendedor" && ["conta", "configuracoes", "perfil", "testes", "indicar", "planos", "suporte-conta"].includes(active)) return "conta";
    if (role === "empresa") {
      if (["conta", "configuracoes", "outros", "perfil", "carteira", "academy", "indicar", "suporte-conta", "pagamentos", "pagamentos-visibilidade"].includes(active)) return "outros";
      if (active === "loja-leads") return "loja-leads";
      if (["leads-whatsapp", "leads-instagram"].includes(active)) return "conversas";
      if (["leads", "pedidos", "integracoes", "materiais", "academy-empresa", "profissionais", "conferir-fila", "conferir-time"].includes(active)) return "campanhas";
      if (["campanhas-comissoes", "campanhas-tarefas", "pagamentos-campanhas"].includes(active)) return "campanhas";
    }
    return active;
  })();

  // Itens do menu completo do celular: mesma navegação, com rótulos de seção
  // "Início" e "Configurações" injetados só aqui (não mexe na sidebar desktop).
  // Dividers viram seções; a ordem e as permissões vêm de allItems.
  const mobileItems = (() => {
    const base = allItems.filter((item) => !item.divider);
    const out = [{ section: "Início" }];
    for (const item of base) {
      if (item.key === "suporte") out.push({ section: "Configurações" });
      out.push(item);
    }
    return out;
  })();

  // Renderiza a lista de navegação (usada na sidebar web e no menu completo do
  // celular). A sidebar esconde "perfil" para a empresa; o menu mobile mostra tudo.
  const renderNav = (items, { mobile = false } = {}) => items
    .filter((item) => item.key !== "perfil" || role === "vendedor")
    .map((item, i) => {
      if (item.divider) return <div key={`div-${i}`} style={{ margin: "2px 14px", borderTop: "1px solid var(--border)", opacity: 0.4 }} />;
      if (item.section) return <div key={`sec-${i}`} className="vx-sidebar-section">{item.section}</div>;
      const { key, label, Icon, children } = item;
      if (children) {
        const grupoAtivo = active === key || children.some((c) => c.key === active);
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
                // No menu completo do celular o grupo só expande — navegar fecharia
                // o menu antes de a pessoa escolher a subpágina. Na sidebar web,
                // abrir um grupo já leva à primeira página dele.
                if (!mobile && novo && !grupoAtivo) onSelect(children[0]?.key ?? key);
              }}
            >
              <Icon size={18} strokeWidth={1.85} />
              {label}
              <ChevronDown size={16} style={{ marginLeft: "auto", flexShrink: 0, color: "var(--muted)", transition: "transform .2s", transform: aberto ? "rotate(180deg)" : "none" }} />
            </button>
            {aberto && children.map((sub) => (
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

  return (
    <div className="vx-body">
      <aside className="vx-sidebar">
        <div className="vx-sidebar-logo">
          <img src="/logo-rycs-sm.png" alt="RYCS Sales Machine" style={{ height: 30, width: "auto", maxWidth: "100%", display: "block", margin: "0 auto" }} />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, overflowY: "auto", scrollbarWidth: "none" }}>
          {renderNav(allItems)}
        </div>

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
        <div className="vx-sidebar-footer">
          <ThemeSwitcher />
          {accountRole && <AccountMenu user={user} entity={entity} onSelect={onSelect} onLogout={onLogout} />}
        </div>
      </aside>

      <div className={fullBleed ? "vx-content vx-content-chat" : settingsLayout ? "vx-content vx-content-settings" : "vx-content"}>
        {beta && (
          <div className="vx-beta-ribbon">
            <b>AMBIENTE BETA — DADOS FICTÍCIOS</b>
            <span>Nenhuma movimentação financeira possui valor real. Dados podem ser resetados. Use somente para testes.</span>
          </div>
        )}
        {/* Barra de topo do celular: o logo RYCS aparece só na home (primeira aba);
            nas demais telas, este espaço serve só para a página injetar o filtro de
            período via portal. Quando não há logo nem filtro, a barra colapsa (CSS
            :has). A conta e o "Sair" ficam no menu lateral (drawer). */}
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

      {/* Menu completo do celular (equivalente à sidebar web). */}
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
                    {/* Vendedor: foto real preenche o círculo. Empresa: inicial num
                        chip limpo — o logo enviado costuma ter fundo (quadrado cinza),
                        que não dá para remover por CSS. */}
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
