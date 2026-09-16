export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
*{box-sizing:border-box}

/* O navegador aplica margin:8px no body por padrão. Sem zerar, sobra uma
   faixa da cor da página em volta do app inteiro — é a "moldura branca" que
   aparece no celular. html e body também precisam da cor de fundo: acima da
   área do app, o que o iOS mostra ao rolar além do limite é o fundo do html. */
html,body{margin:0;padding:0;min-height:100%;background:#070B14;overscroll-behavior-y:none}
body{-webkit-text-size-adjust:100%}
#root{min-height:100vh}

/* ---------------------------------------------------------------------------
   Identidade RYCS — painel escuro com brilho azul ambiente.
   O tema claro existe como alternativa e recebe o mesmo cuidado, mas o escuro
   é o desenho primário: é onde a marca vive.
--------------------------------------------------------------------------- */

.vx-app{
  --bg:#F4F7FC; --bg-glow:transparent;
  --surface:#FFFFFF; --surface-2:#EEF2F9; --surface-3:#E6ECF6;
  --border:#DCE4F0; --border-strong:#C6D2E6;
  --ink:#0B1220; --ink-2:#33415C; --muted:#64748B; --muted-2:#94A3B8;
  --brand:#2563EB; --brand-600:#1D4ED8; --brand-50:#E8F0FE; --brand-100:#D3E1FD;
  --navy:#0F1A31; --navy-600:#0A1120;
  --amber:#B45309; --amber-50:#FFF7EA; --amber-100:#FCEBD2;
  --red:#B42318; --red-50:#FEF2F1; --red-100:#FBDDDA;
  --indigo:#4338CA; --indigo-50:#EEF0FE; --indigo-100:#DEE1FB;
  --radius-lg:16px; --radius-md:13px; --radius-sm:10px; --radius-pill:999px;
  --shadow-card:0 1px 2px rgba(11,18,32,.04),0 2px 8px -4px rgba(11,18,32,.08);
  --shadow-pop:0 18px 44px -16px rgba(11,18,32,.28);
  --ring:0 0 0 3px var(--brand-100);
  min-height:100vh;background:var(--bg);color:var(--ink);
  font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14.5px;line-height:1.55;
  -webkit-font-smoothing:antialiased;
  transition:background .25s,color .25s;
}

.vx-app.vx-dark{
  --bg:#070B14;
  /* O brilho é o que dá profundidade ao painel — sem ele o escuro fica chapado. */
  --bg-glow:radial-gradient(1100px 620px at 78% -12%, rgba(76,125,255,.20), transparent 62%),
            radial-gradient(820px 520px at 4% 8%, rgba(56,92,196,.13), transparent 60%);
  --surface:#0E1524; --surface-2:#141D30; --surface-3:#1B2740;
  --border:#1E2A44; --border-strong:#2A3958;
  --ink:#EDF2FB; --ink-2:#B7C4DC; --muted:#8496B4; --muted-2:#5D6E8D;
  --brand:#5B8CFF; --brand-600:#7BA4FF; --brand-50:rgba(91,140,255,.13); --brand-100:rgba(91,140,255,.22);
  --navy:#16233C; --navy-600:#0A1120;
  --amber:#F0B45E; --amber-50:rgba(240,180,94,.11); --amber-100:rgba(240,180,94,.18);
  --red:#FF8A7A; --red-50:rgba(255,138,122,.10); --red-100:rgba(255,138,122,.18);
  --indigo:#9AA6FF; --indigo-50:rgba(154,166,255,.11); --indigo-100:rgba(154,166,255,.18);
  --topbar-bg:rgba(9,14,25,.78);
  --shadow-card:0 1px 2px rgba(0,0,0,.34),0 10px 26px -14px rgba(0,0,0,.7);
  --shadow-pop:0 24px 60px -18px rgba(0,0,0,.85);
  --ring:0 0 0 3px rgba(91,140,255,.28);
  background:var(--bg);
  background-image:var(--bg-glow);
  background-attachment:fixed;
}

/* A logo é um PNG de fundo branco. No escuro, inverter a luminosidade e girar
   o matiz de volta apaga o fundo e preserva o azul da marca — evita o
   retângulo branco recortado no topo. */
.vx-logo{display:block;object-fit:contain;mix-blend-mode:multiply}
/* Invertido, o fundo branco vira preto; o blend "lighten" então o descarta
   contra a superfície escura, deixando só a marca. */
.vx-dark .vx-logo{filter:invert(1) hue-rotate(180deg) saturate(1.2) brightness(1.1);mix-blend-mode:lighten}

.vx-disp{font-family:'Space Grotesk','Inter',sans-serif;font-weight:600;letter-spacing:-.015em}
.vx-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.vx-eyebrow{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}

/* topbar */
.vx-topbar{position:sticky;top:0;z-index:30;background:var(--topbar-bg,rgba(255,255,255,.85));backdrop-filter:blur(14px) saturate(1.6);
  border-bottom:1px solid var(--border);height:60px;display:flex;align-items:center}
.vx-topbar-inner{width:100%;max-width:1240px;margin:0 auto;padding:0 max(18px,env(safe-area-inset-left,0px)) 0 max(18px,env(safe-area-inset-left,0px));display:flex;align-items:center;justify-content:space-between;gap:10px}
.vx-mark{width:28px;height:28px;border-radius:9px;background:var(--navy);display:flex;align-items:center;justify-content:center;flex:none}
.vx-word{font-size:17px;color:var(--ink);display:flex;align-items:center;gap:8px;white-space:nowrap;flex:none}
.vx-seg{display:inline-flex;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-pill);padding:3px;gap:2px;overflow-x:auto;scrollbar-width:none}
.vx-seg::-webkit-scrollbar{display:none}
.vx-seg button{border:0;background:transparent;padding:7px 13px;border-radius:var(--radius-pill);font:inherit;font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;white-space:nowrap;transition:.16s}
.vx-seg button[data-on="1"]{background:var(--surface);color:var(--ink);box-shadow:var(--shadow-card)}
@media (max-width:640px){
  .vx-word{font-size:14px;gap:6px}
  .vx-mark{width:23px;height:23px;border-radius:7px}
  .vx-topbar-inner{gap:6px;padding:0 12px}
  .vx-seg button{padding:6px 9px;font-size:10.5px}
  .vx-topbar .vx-chip{display:none}
}

/* shell */
.vx-body{max-width:1240px;margin:0 auto;display:block}
.vx-sidebar{display:none}
.vx-content{padding:24px max(16px,env(safe-area-inset-right,0px)) calc(104px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));max-width:820px;margin:0 auto}
.vx-bottomnav{position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--topbar-bg,rgba(255,255,255,.96));backdrop-filter:blur(14px);
  border-top:1px solid var(--border);display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding-bottom:env(safe-area-inset-bottom,0)}
.vx-navbtn{min-width:0;background:none;border:0;font:inherit;padding:10px 1px 11px;cursor:pointer;overflow:hidden;
  display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--muted-2);position:relative;transition:color .16s}
.vx-navbtn[data-on="1"]{color:var(--brand)}
.vx-navbtn span{max-width:100%;font-size:clamp(9px,2.6vw,11px);line-height:1.15;font-weight:600;white-space:nowrap}
.vx-subnav{max-width:100%;flex-wrap:wrap;overflow-x:hidden}
.vx-ai-trigger{position:fixed;right:18px;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:28;box-shadow:var(--shadow-pop)}
.vx-ai-panel{position:fixed;right:16px;bottom:calc(126px + env(safe-area-inset-bottom,0px));z-index:29;width:min(390px,calc(100vw - 32px));max-height:70vh;overflow:auto;padding:16px}
.vx-navdot{position:absolute;top:5px;right:calc(50% - 16px);min-width:15px;height:15px;padding:0 3px;border-radius:999px;
  background:var(--red);color:#fff;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center}

@media (min-width:900px){
  .vx-content{padding:30px 30px 56px;max-width:none}
  .vx-body{display:grid;grid-template-columns:236px 1fr}
  .vx-sidebar{display:flex;flex-direction:column;gap:3px;padding:22px 14px;border-right:1px solid var(--border);
    position:sticky;top:60px;height:calc(100vh - 60px);align-self:start}
  .vx-bottomnav{display:none}
  .vx-ai-trigger{bottom:22px}
  .vx-ai-panel{bottom:72px}
  .vx-sidebtn{display:flex;align-items:center;gap:11px;padding:10px 13px;border-radius:var(--radius-sm);border:1px solid transparent;
    background:none;font:inherit;font-size:13.5px;font-weight:600;color:var(--ink-2);cursor:pointer;text-align:left;position:relative;transition:.16s}
  .vx-sidebtn:hover{background:var(--surface-2);color:var(--ink)}
  .vx-sidebtn[data-on="1"]{background:var(--brand-50);color:var(--brand);border-color:var(--brand-100)}
  .vx-sidedot{margin-left:auto;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:var(--red);
    color:#fff;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center}
}

/* primitives */
.vx-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-card)}
.vx-btn{appearance:none;border:1px solid var(--border-strong);background:var(--surface);color:var(--ink);font:inherit;
  font-weight:600;font-size:13.5px;padding:10px 16px;border-radius:var(--radius-sm);cursor:pointer;transition:.16s;
  display:inline-flex;align-items:center;gap:7px;justify-content:center}
.vx-btn:hover{background:var(--surface-2);border-color:var(--brand-100)}
.vx-btn:disabled{opacity:.42;cursor:not-allowed}
.vx-btn:focus-visible{outline:none;box-shadow:var(--ring)}
.vx-btn-primary{background:var(--brand);border-color:var(--brand);color:#fff}
.vx-btn-primary:hover{background:var(--brand-600);border-color:var(--brand-600)}
.vx-btn-danger{border-color:var(--red-100);color:var(--red);background:transparent}
.vx-btn-danger:hover{background:var(--red-50);border-color:var(--red-100)}
.vx-btn-ghost{border-color:transparent;background:transparent;color:var(--muted)}
.vx-btn-ghost:hover{background:var(--surface-2);color:var(--ink);border-color:transparent}
.vx-btn-sm{padding:7px 12px;font-size:12.5px;border-radius:9px}
.vx-btn-block{width:100%}
.vx-input{width:100%;background:var(--surface-2);border:1px solid var(--border);color:var(--ink);font:inherit;
  font-size:14px;padding:11px 13px;border-radius:var(--radius-sm);transition:.16s}
.vx-input::placeholder{color:var(--muted-2)}
.vx-input:focus{outline:none;border-color:var(--brand);background:var(--surface);box-shadow:var(--ring)}
.vx-label{display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin:0 0 6px}
.vx-badge{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:var(--radius-pill)}
.vx-badge-brand{background:var(--brand-100);color:var(--brand)}
.vx-badge-amber{background:var(--amber-100);color:var(--amber)}
.vx-badge-red{background:var(--red-100);color:var(--red)}
.vx-badge-indigo{background:var(--indigo-100);color:var(--indigo)}
.vx-badge-muted{background:var(--surface-2);color:var(--muted)}
.vx-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:6px 11px;border-radius:var(--radius-pill);
  background:var(--surface-2);color:var(--ink-2);border:1px solid var(--border)}
.vx-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.vx-mut{color:var(--muted)}
.vx-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px;flex-wrap:wrap}
.vx-page-head h1{font-size:26px;margin:4px 0 3px}.vx-page-head p{font-size:13px;color:var(--muted);margin:0}
.vx-filterbar{display:grid;grid-template-columns:repeat(2,minmax(130px,1fr));gap:7px;flex:1;max-width:620px}.vx-filterbar .vx-input{padding:8px 10px;font-size:12px}
.vx-notice{padding:11px 13px;border-radius:var(--radius-sm);font-size:12.5px;border:1px solid var(--border)}
.vx-notice-amber{background:var(--amber-50);border-color:var(--amber-100);color:var(--amber)}
.vx-btn-ai{border-color:var(--indigo-100);color:var(--indigo);background:linear-gradient(135deg,var(--indigo-50),var(--brand-50))}
.vx-btn-ai:hover{border-color:var(--indigo);background:var(--indigo-50)}
.vx-sep{height:1px;background:var(--border);border:0;margin:15px 0}
.vx-fade{animation:vxin .26s cubic-bezier(.22,.9,.32,1)}
@keyframes vxin{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.vx-fade{animation:none}}
.vx-grid{display:grid;gap:13px}
.vx-g2{grid-template-columns:1fr}
.vx-g4{grid-template-columns:repeat(2,1fr)}
.vx-g3{grid-template-columns:1fr}
@media(min-width:620px){.vx-g2{grid-template-columns:1fr 1fr}.vx-g3{grid-template-columns:repeat(3,1fr)}.vx-g4{grid-template-columns:repeat(4,1fr)}}

/* stat cards */
.vx-stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;box-shadow:var(--shadow-card);
  position:relative;overflow:hidden}
.vx-stat::after{content:"";position:absolute;inset:0 0 auto 0;height:1px;
  background:linear-gradient(90deg,transparent,var(--brand-100),transparent);opacity:.8}
.vx-stat-icon{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
.vx-stat-val{font-family:'Space Grotesk';font-weight:700;font-size:23px;letter-spacing:-.02em}

/* gráficos e cenários compartilhados */
.vx-chart-card{padding:17px;min-height:230px}.vx-donut-layout{display:grid;grid-template-columns:118px 1fr;align-items:center;gap:18px;margin-top:15px}
.vx-donut{width:118px;height:118px;border-radius:50%;display:grid;place-items:center;position:relative;box-shadow:inset 0 0 0 1px var(--border)}
.vx-donut::after{content:"";position:absolute;width:70px;height:70px;border-radius:50%;background:var(--surface);box-shadow:0 0 0 1px var(--border)}
.vx-donut>div{z-index:1;display:flex;flex-direction:column;text-align:center;line-height:1.1}.vx-donut strong{font-size:15px}.vx-donut span{font-size:9px;color:var(--muted);text-transform:uppercase;margin-top:3px}
.vx-chart-legend{display:flex;flex-direction:column;gap:8px;min-width:0}.vx-chart-legend>div{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:7px;font-size:11.5px}
.vx-chart-legend i{width:8px;height:8px;border-radius:50%}.vx-chart-legend span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted)}.vx-chart-legend b{font-size:10.5px}
.vx-chart-source{font-size:11px;color:var(--muted);margin-top:11px}.vx-scenario{border:1px solid var(--border);background:var(--surface-2);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:3px}
.vx-scenario>span{text-transform:capitalize;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.06em}.vx-scenario>strong{font-size:17px}.vx-scenario small{font-size:10.5px;color:var(--muted)}
.vx-talent-grid{display:grid;grid-template-columns:1fr;gap:13px}.vx-talent-card{padding:17px;display:grid;grid-template-columns:48px 1fr;gap:13px}.vx-talent-card h3{font-family:'Space Grotesk';font-size:16px;margin:0}.vx-talent-card p{color:var(--muted);font-size:12px;margin:2px 0}.vx-avatar{width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,var(--brand),var(--indigo));color:#fff;display:grid;place-items:center;font-family:'Space Grotesk';font-weight:700}.vx-talent-meta{display:flex;flex-direction:column;gap:5px;margin-top:9px}.vx-talent-meta span{display:flex;gap:6px;align-items:flex-start;color:var(--muted);font-size:11.5px}.vx-skeleton{background:linear-gradient(100deg,var(--surface) 20%,var(--surface-2) 45%,var(--surface) 70%);background-size:200% 100%;animation:vxsh 1.4s infinite}@keyframes vxsh{to{background-position:-200% 0}}
@media(min-width:720px){.vx-talent-grid{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.vx-filterbar{grid-template-columns:1fr 1fr;width:100%}.vx-donut-layout{grid-template-columns:96px 1fr;gap:12px}.vx-donut{width:96px;height:96px}.vx-donut::after{width:58px;height:58px}.vx-chart-card{min-height:200px}.vx-page-head h1{font-size:23px}}
.vx-plan-card{padding:20px;position:relative;overflow:hidden}.vx-plan-card h2{font-size:18px;margin:0 0 5px}.vx-plan-recommended{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand),var(--shadow-pop)}.vx-plan-ribbon{display:inline-flex;align-items:center;gap:5px;background:var(--brand);color:#fff;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:800;margin-bottom:12px}.vx-plan-price{font:700 25px 'Space Grotesk';margin:5px 0 10px}.vx-plan-price small{font:500 11px Inter;color:var(--muted);margin-left:4px}.vx-plan-benefits{display:flex;flex-direction:column;gap:8px;margin:16px 0}.vx-plan-benefits>div{display:flex;gap:7px;color:var(--muted);font-size:12px}.vx-plan-benefits svg{color:var(--brand);flex:none;margin-top:2px}.vx-checkout-total{display:grid;grid-template-columns:1fr auto;gap:8px;padding:14px;background:var(--surface-2);border-radius:12px;margin:14px 0}.vx-checkout-total span{color:var(--muted)}.vx-checkout-total strong{font:700 20px 'Space Grotesk';color:var(--brand)}
.vx-table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-sm)}.vx-table{border-collapse:collapse;width:100%;min-width:640px;font-size:12px}.vx-table th,.vx-table td{text-align:left;padding:9px 11px;border-bottom:1px solid var(--border);white-space:nowrap}.vx-table th{color:var(--muted);background:var(--surface-2);font-size:10px;text-transform:uppercase;letter-spacing:.05em}
.vx-steps{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.vx-steps span{white-space:nowrap;padding:5px 8px;border-radius:999px;background:var(--surface-2);color:var(--muted);font-size:10.5px}.vx-steps span[data-done="1"]{background:var(--brand-50);color:var(--brand)}

/* Central de operações de Campanhas */
.vx-campaign-head h1{font-size:30px;margin:5px 0 4px}.vx-campaign-head p{line-height:1.55}.vx-campaign-head p b{color:var(--ink);font-size:14px}.vx-campaign-actions{display:flex;gap:8px;flex-wrap:wrap}
.vx-campaign-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.vx-campaign-stat{min-height:132px;display:flex;flex-direction:column;justify-content:space-between}
.vx-campaign-stat-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;color:var(--muted);font-size:11.5px;font-weight:600}.vx-campaign-stat-top svg{color:var(--brand);flex:none}.vx-campaign-stat .vx-stat-val{display:block;margin:7px 0;font-size:21px}
.vx-campaign-stat-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;color:var(--muted-2);font-size:10px}.vx-campaign-trend{font-weight:700}.vx-campaign-trend.is-positive{color:#22A06B}.vx-campaign-trend.is-negative{color:var(--red)}.vx-campaign-stat-period{color:var(--muted-2);font-weight:500}
.vx-budget-card{padding:19px;margin-top:14px}.vx-budget-main{max-width:100%}.vx-budget-value{display:flex;align-items:baseline;gap:5px;margin:5px 0 10px}.vx-budget-value strong{font-size:24px}.vx-budget-value span{color:var(--muted);font-size:13px}.vx-budget-progress{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:7px;color:var(--muted);font-size:11px}
.vx-budget-risk{display:inline-flex;align-items:center;gap:5px;font-weight:700}.vx-budget-risk i{width:7px;height:7px;border-radius:50%;background:currentColor}.vx-budget-risk.is-ok{color:#22A06B}.vx-budget-risk.is-warning{color:var(--amber)}.vx-budget-risk.is-danger{color:var(--red)}.vx-budget-risk.is-muted{color:var(--muted)}
.vx-budget-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:17px}.vx-budget-facts>div{padding:10px;border-radius:10px;background:var(--surface-2);min-width:0}.vx-budget-facts span{display:block;color:var(--muted);font-size:10.5px}.vx-budget-facts b{display:block;margin-top:3px;font-size:12.5px;overflow:hidden;text-overflow:ellipsis}
.vx-campaign-empty{padding:32px 18px;text-align:center;display:flex;align-items:center;flex-direction:column}.vx-campaign-empty-icon{width:50px;height:50px;border-radius:15px;display:grid;place-items:center;background:var(--brand-50);color:var(--brand)}.vx-campaign-empty h2{font-size:20px;margin:13px 0 5px}.vx-campaign-empty p{max-width:470px;color:var(--muted);margin:0 0 17px;font-size:13px}
.vx-campaign-row{appearance:none;width:100%;padding:14px 15px;color:var(--ink);font:inherit;text-align:left;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;cursor:pointer;transition:.16s}.vx-campaign-row:hover{border-color:var(--brand);transform:translateY(-1px)}.vx-campaign-row>div{min-width:0}.vx-campaign-row b,.vx-campaign-row div>span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vx-campaign-row div>span{color:var(--muted);font-size:11.5px;margin-top:2px}.vx-campaign-open{font-size:11.5px;color:var(--brand);font-weight:700;white-space:nowrap}
.vx-campaign-status{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:10.5px;font-weight:700;white-space:nowrap;background:var(--surface-2);color:var(--muted)}.vx-campaign-status::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}.vx-campaign-status.is-ativa{background:rgba(34,160,107,.12);color:#22A06B}.vx-campaign-status.is-em_revisao{background:var(--amber-50);color:var(--amber)}.vx-campaign-status.is-pausada{background:var(--red-50);color:var(--red)}.vx-campaign-status.is-rascunho{background:var(--surface-2);color:var(--muted)}
.vx-campaign-filters{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 1px 8px}.vx-campaign-filters::-webkit-scrollbar{display:none}.vx-campaign-filters button{appearance:none;border:1px solid var(--border);background:var(--surface);color:var(--muted);border-radius:999px;padding:7px 10px;font:600 11.5px Inter;white-space:nowrap;cursor:pointer;display:inline-flex;align-items:center;gap:6px}.vx-campaign-filters button span{display:grid;place-items:center;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:var(--surface-2);font-size:9.5px}.vx-campaign-filters button[data-on="1"]{border-color:var(--brand);background:var(--brand-50);color:var(--brand)}.vx-campaign-filters button[data-on="1"] span{background:var(--brand-100)}
.vx-campaign-card-grid{display:grid;grid-template-columns:1fr;gap:13px}.vx-campaign-card{padding:17px;display:flex;flex-direction:column;min-width:0}.vx-campaign-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.vx-campaign-card h3{font-size:17px;margin:0;line-height:1.25}.vx-campaign-card-meta{font-size:11px;color:var(--muted);margin-top:4px}.vx-campaign-people{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11.5px;margin:13px 0}.vx-campaign-people svg{color:var(--brand)}.vx-campaign-people b{color:var(--ink)}
.vx-campaign-today{padding:12px;background:var(--surface-2);border-radius:11px}.vx-campaign-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:8px}.vx-campaign-metrics>div{min-width:0}.vx-campaign-metrics b,.vx-campaign-metrics span{display:block}.vx-campaign-metrics b{font-size:13px;overflow:hidden;text-overflow:ellipsis}.vx-campaign-metrics span{font-size:9.5px;color:var(--muted);margin-top:1px}
.vx-campaign-budget-mini{margin:14px 0}.vx-campaign-budget-mini .vx-row{font-size:10.5px;margin-bottom:7px}.vx-campaign-budget-mini .vx-row span{color:var(--muted)}.vx-campaign-budget-mini>.vx-meter-track{height:5px}.vx-campaign-budget-mini>span{display:block;color:var(--muted);font-size:9.5px;margin-top:5px}.vx-campaign-operation-btn{margin-top:auto;justify-content:space-between;color:var(--brand)}.vx-campaign-filter-empty{padding:26px;text-align:center;color:var(--muted);font-size:13px}
@media(min-width:700px){.vx-campaign-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:720px){.vx-campaign-stats{grid-template-columns:repeat(4,minmax(0,1fr))}.vx-budget-card{display:grid;grid-template-columns:minmax(260px,1.1fr) minmax(320px,1fr);column-gap:22px}.vx-budget-facts{margin-top:0;grid-template-columns:repeat(3,minmax(0,1fr))}.vx-budget-card .vx-chart-source{grid-column:1/-1}}
@media(max-width:560px){.vx-campaign-head .vx-campaign-actions,.vx-campaign-empty .vx-campaign-actions{display:grid;grid-template-columns:1fr 1fr;width:100%}.vx-campaign-head .vx-btn{padding-left:10px;padding-right:10px}.vx-campaign-row{grid-template-columns:minmax(0,1fr) auto}.vx-campaign-row .vx-campaign-open{grid-column:1/-1}.vx-budget-progress{align-items:flex-start;flex-direction:column}.vx-budget-facts{grid-template-columns:1fr 1fr}}

/* meter */
.vx-meter-track{height:6px;background:var(--surface-3);border-radius:999px;overflow:hidden}
.vx-meter-fill{height:100%;border-radius:999px;transition:width .6s cubic-bezier(.4,0,.2,1)}

/* tabs */
.vx-tabs{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.vx-tabs::-webkit-scrollbar{display:none}
.vx-tab{white-space:nowrap;padding:8px 14px;border-radius:var(--radius-pill);border:1px solid var(--border);background:var(--surface);
  color:var(--muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:.16s}
.vx-tab:hover{color:var(--ink);border-color:var(--border-strong)}
.vx-tab[data-on="1"]{background:var(--brand);color:#fff;border-color:var(--brand)}

/* modal */
.vx-overlay{position:fixed;inset:0;z-index:40;background:rgba(4,8,16,.62);backdrop-filter:blur(3px);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:640px){.vx-overlay{align-items:center}}
.vx-sheet{width:100%;max-width:580px;background:var(--surface);border:1px solid var(--border);border-radius:20px 20px 0 0;padding:22px;max-height:88vh;overflow-y:auto;box-shadow:var(--shadow-pop)}
@media(min-width:640px){.vx-sheet{border-radius:20px}}
/* --- RYCS Academy: grade de cursos ------------------------------------ */
.vx-course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:16px}
.vx-course-card{padding:0;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:transform .16s,border-color .16s}
.vx-course-card:hover{transform:translateY(-2px);border-color:var(--brand)}
.vx-course-capa{position:relative;aspect-ratio:16/9;background:var(--surface-2)}
.vx-course-capa img{width:100%;height:100%;object-fit:cover;display:block}
.vx-course-capa .vx-badge{position:absolute;top:10px;left:10px;background:rgba(7,11,20,.82);backdrop-filter:blur(6px);border-color:rgba(255,255,255,.2);color:#fff}
.vx-course-capa .vx-course-cert{left:auto;right:10px}
.vx-course-corpo{padding:15px;display:flex;flex-direction:column;flex:1}
.vx-course-corpo h3{font-family:'Space Grotesk',system-ui,sans-serif;font-size:15.5px;line-height:1.28;margin:5px 0 4px}
.vx-course-corpo p{color:var(--muted);font-size:12.5px;line-height:1.45;margin:0;flex:1}
.vx-course-meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:11px;color:var(--muted);font-size:11.5px}
.vx-course-meta span{display:inline-flex;align-items:center;gap:4px}
.vx-course-layout{display:grid;grid-template-columns:290px 1fr;gap:16px;margin-top:16px;align-items:start}
@media(max-width:860px){.vx-course-layout{grid-template-columns:1fr}}
/* --- Card de empresa: vitrine, não linha de lista --------------------- */
.vx-empresa-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);
  overflow:hidden;box-shadow:var(--shadow-card);transition:border-color .16s,transform .16s}
.vx-empresa-card:hover{border-color:var(--border-strong);transform:translateY(-1px)}
.vx-empresa-topo{height:64px}
.vx-empresa-corpo{padding:0 18px 18px}
.vx-empresa-cabeca{display:flex;gap:13px;align-items:flex-end;margin-top:-30px;margin-bottom:14px}
.vx-empresa-logo{width:62px;height:62px;border-radius:16px;background:var(--surface);border:2px solid;
  display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none;
  font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:20px;box-shadow:var(--shadow-card)}
.vx-empresa-logo img{width:100%;height:100%;object-fit:cover}
.vx-empresa-ficha{display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:12px;
  padding:13px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.vx-empresa-ficha b{display:block;font-size:13.5px;margin-top:2px}
.vx-empresa-icp{margin-top:12px}
.vx-empresa-icp p{margin:3px 0 0;font-size:12.5px;color:var(--muted);line-height:1.5}

`;
