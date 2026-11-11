export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Michroma&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap');
*{box-sizing:border-box}

/* O navegador aplica margin:8px no body por padrão. Sem zerar, sobra uma
   faixa da cor da página em volta do app inteiro — é a "moldura branca" que
   aparece no celular. html e body também precisam da cor de fundo: acima da
   área do app, o que o iOS mostra ao rolar além do limite é o fundo do html. */
html,body{margin:0;padding:0;min-height:100%;background:#CFE1F8;overscroll-behavior-y:none}
html.dark,html.dark body{background:#08090C}
body{-webkit-text-size-adjust:100%}
#root{min-height:100vh}

.vx-app{
  /* ── Paleta Monocromática Premium — Light ── */
  --bg:#F6F7F9;
  --surface:rgba(255,255,255,.88); --surface-1:rgba(255,255,255,.70); --surface-2:#F1F3F6; --surface-3:#E9EDF2;
  --surface-solid:#FFFFFF;
  --border:rgba(17,24,39,.06); --border-strong:rgba(17,24,39,.10);
  --ink:#171B24; --ink-2:#374151; --muted:#667085; --muted-2:#98A2B3;
  /* icon tokens monocromáticos */
  --icon-primary:#303846; --icon-secondary:#667085; --icon-brand:#2563EB;
  /* brand */
  --brand:#2563EB; --brand-600:#1D4ED8; --brand-50:rgba(37,99,235,.07); --brand-100:rgba(37,99,235,.12);
  --brand-200:rgba(37,99,235,.20);
  /* semânticos (preservados para badges/status) */
  --orange:#EA580C; --orange-600:#C2410C; --orange-50:#FFF7ED; --orange-100:#FFEDD5;
  --green:#16A34A; --green-50:#F0FDF4; --green-100:#DCFCE7; --green-700:#15803D;
  --navy:#0F1A31; --navy-600:#0A1120;
  --amber:#B45309; --amber-50:#FFFBEB; --amber-100:#FEF3C7;
  --red:#B42318; --red-50:#FEF2F1; --red-100:#FBDDDA;
  --indigo:#4338CA; --indigo-50:#EEF0FE; --indigo-100:#DEE1FB;
  --sky:#38BDF8; --sky-600:#0EA5E9; --sky-700:#0284C7; --sky-50:#F8FCFF;
  --blue-400:#60A5FA; --blue-500:#3B82F6; --blue-vivo:#005DFF; --blue-800:#1E40AF; --blue-noite:#1A3379;
  /* geometria */
  --radius-lg:18px; --radius-md:14px; --radius-sm:10px; --radius-pill:999px;
  /* escala de espaçamento — ritmo vertical e horizontal consistente */
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px;
  --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px; --space-16:64px;
  /* escala de ícones — tamanhos padronizados por contexto */
  --icon-xs:14px; --icon-sm:16px; --icon-md:18px; --icon-nav:20px; --icon-lg:24px;
  --icon-stroke:1.85;
  /* sombras refinadas */
  --shadow-card:0 2px 12px rgba(20,30,45,.035);
  --shadow-pop:0 8px 32px rgba(20,30,45,.12),0 2px 8px rgba(20,30,45,.05);
  --shadow-brand:0 2px 8px rgba(37,99,235,.16),0 8px 24px -6px rgba(37,99,235,.20);
  --shadow-orange:0 2px 8px rgba(234,88,12,.16),0 8px 24px -6px rgba(234,88,12,.20);
  --ring:0 0 0 3px rgba(37,99,235,.18);
  /* glass */
  --glass:rgba(255,255,255,.66);
  --glass-strong:rgba(255,255,255,.84);
  --glass-blur:blur(24px) saturate(180%);
  --glass-blur-strong:blur(32px) saturate(190%);
  --glass-border:rgba(255,255,255,.78);
  --glass-border-subtle:rgba(17,24,39,.06);
  --glass-shadow:0 8px 32px rgba(20,30,45,.07);
  --glass-radius:22px;
  --topbar-bg:rgba(255,255,255,.84);
  /* gradients */
  --grad-brand:linear-gradient(135deg,#2563EB 0%,#4338CA 100%);
  --grad-orange:linear-gradient(135deg,#EA580C 0%,#F59E0B 100%);
  --grad-ai:linear-gradient(135deg,#4338CA 0%,#2563EB 60%,#0EA5E9 100%);
  /* Fundo azul bem claro: o material de vidro flutua sobre ele. */
  min-height:100vh;
  background:linear-gradient(140deg,#D6E6FA 0%,#E8F1FD 48%,#CFE1F8 100%) fixed;
  color:var(--ink);
  font-family:'Geist','Inter',system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;
  letter-spacing:-.012em;
  font-variant-numeric:tabular-nums;
  -webkit-font-smoothing:antialiased;
  transition:background .3s,color .3s;
}

/* ── Tema escuro — verdadeiro preto sofisticado ───────────────────────── */
html.dark{background:#08090C}
html.dark .vx-app{
  --bg:#08090C;
  --surface:rgba(17,19,24,.86); --surface-1:rgba(25,28,35,.78); --surface-2:#191C23; --surface-3:#232833;
  --surface-solid:#111318;
  --border:rgba(255,255,255,.07); --border-strong:rgba(255,255,255,.12);
  --ink:#F5F6F8; --ink-2:#C8D0DC; --muted:#A0A8B5; --muted-2:#737D8D;
  --icon-primary:#E8EDF5; --icon-secondary:#9AA4B2;
  --brand-50:rgba(37,99,235,.12); --brand-100:rgba(37,99,235,.20); --brand-200:rgba(37,99,235,.30);
  --green-50:rgba(22,163,74,.10); --green-100:rgba(22,163,74,.18);
  --orange-50:rgba(234,88,12,.10); --orange-100:rgba(234,88,12,.18);
  --amber-50:rgba(180,83,9,.10); --amber-100:rgba(180,83,9,.18);
  --red-50:rgba(180,35,24,.10); --red-100:rgba(180,35,24,.18);
  --indigo-50:rgba(67,56,202,.12); --indigo-100:rgba(67,56,202,.20);
  --sky-50:rgba(56,189,248,.06);
  --glass:rgba(20,22,28,.66);
  --glass-strong:rgba(20,22,28,.86);
  --glass-blur:blur(28px) saturate(160%);
  --glass-blur-strong:blur(36px) saturate(170%);
  --glass-border:rgba(255,255,255,.11);
  --glass-border-subtle:rgba(255,255,255,.07);
  --glass-shadow:0 8px 32px rgba(0,0,0,.30);
  --topbar-bg:rgba(14,16,20,.86);
  --shadow-card:0 2px 12px rgba(0,0,0,.20);
  --shadow-pop:0 16px 48px rgba(0,0,0,.40),0 2px 8px rgba(0,0,0,.20);
  background:#08090C;
}
html.dark .vx-logo{mix-blend-mode:normal;filter:brightness(0) invert(1)}
html.dark .vx-sidebar-logo img{filter:brightness(0) invert(1)}

.vx-logo{display:block;object-fit:contain;mix-blend-mode:multiply}

.vx-disp{font-family:'Geist','Inter',system-ui,sans-serif;font-weight:700;letter-spacing:-.025em}
.vx-mono{font-family:'Geist Mono','IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.vx-eyebrow{font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted-2)}

/* topbar */
.vx-topbar{display:none}
.vx-topbar-inner{width:100%;max-width:1240px;margin:0 auto;padding:0 max(18px,env(safe-area-inset-left,0px)) 0 max(18px,env(safe-area-inset-left,0px));display:flex;align-items:center;justify-content:space-between;gap:10px}
.vx-mark{width:28px;height:28px;border-radius:9px;background:var(--navy);display:flex;align-items:center;justify-content:center;flex:none}
.vx-word{font-size:17px;color:var(--ink);display:flex;align-items:center;gap:8px;white-space:nowrap;flex:none}
.vx-seg{display:inline-flex;background:var(--surface-2);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);border:1px solid var(--glass-border);border-radius:var(--radius-pill);padding:3px;gap:2px;overflow-x:auto;scrollbar-width:none}
.vx-seg::-webkit-scrollbar{display:none}
.vx-seg button{border:0;background:transparent;padding:7px 13px;border-radius:var(--radius-pill);font:inherit;font-size:12.5px;font-weight:500;color:var(--muted);cursor:pointer;white-space:nowrap;transition:.15s;letter-spacing:-.01em}
.vx-seg button[data-on="1"]{background:var(--surface);color:var(--ink);box-shadow:0 1px 2px rgba(11,18,32,.06),0 1px 4px -2px rgba(11,18,32,.08)}
.vx-beta-badge{background:var(--amber);color:#17110a;border-radius:999px;padding:5px 9px;font-size:10.5px;font-weight:800;letter-spacing:.08em;white-space:nowrap}
.vx-beta-login-badge{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:60;background:var(--amber);color:#17110a;border-radius:999px;padding:7px 12px;font-size:11px;font-weight:800;letter-spacing:.07em;white-space:nowrap;box-shadow:var(--shadow-pop)}
.vx-beta-login-panel{margin-top:12px;padding:12px;border:1px solid var(--amber);border-radius:var(--radius-sm);background:var(--amber-50)}
.vx-beta-login-panel p{margin:6px 0 10px;color:var(--ink-2);font-size:12.5px}
.vx-beta-ribbon{margin-bottom:16px;border:1px solid var(--amber);background:var(--amber-50);color:var(--ink);border-radius:var(--radius-sm);padding:10px 12px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.vx-beta-ribbon b{font-size:12px;letter-spacing:.06em}
.vx-beta-ribbon span{font-size:12.5px;color:var(--ink-2)}
.vx-beta-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}
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
.vx-mobile-actions{display:flex;justify-content:flex-end;margin-bottom:12px}
.vx-mobile-actions .vx-btn{min-height:44px}
.vx-content-chat>.vx-mobile-actions,.vx-content-settings>.vx-mobile-actions{padding:12px 16px 0;margin-bottom:12px}
.vx-content{padding:24px max(16px,env(safe-area-inset-right,0px)) calc(104px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));max-width:820px;margin:0 auto}
.vx-content-chat{padding:0!important;max-width:none!important;margin:0!important;overflow:hidden;display:flex;flex-direction:column}
.vx-content-settings{padding:0!important;max-width:none!important;margin:0!important;}
/* bottom nav mobile — glass flutuante */
.vx-bottomnav{position:fixed;left:0;right:0;bottom:0;z-index:30;
  background:var(--glass-strong);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);
  border-top:1px solid var(--glass-border);box-shadow:0 -1px 0 rgba(17,24,39,.06),0 -8px 24px rgba(20,30,45,.04);
  display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding-bottom:env(safe-area-inset-bottom,0)}
html.dark .vx-bottomnav{background:var(--glass-strong);border-top-color:var(--glass-border);box-shadow:0 -1px 0 rgba(255,255,255,.07),0 -8px 24px rgba(0,0,0,.18)}
.vx-navbtn{min-width:0;background:none;border:0;font:inherit;padding:10px 1px 11px;cursor:pointer;overflow:hidden;
  display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--icon-secondary);position:relative;transition:color .16s}
.vx-navbtn[data-on="1"]{color:var(--brand)}
.vx-navbtn span{max-width:100%;font-size:clamp(9px,2.6vw,11px);line-height:1.15;font-weight:600;white-space:nowrap}
.vx-subnav{max-width:100%;flex-wrap:wrap;overflow-x:hidden}
.vx-ai-trigger{display:none!important}
.vx-ai-panel{display:none!important}
/* Jarvis / Brain premium */
.vx-jarvis-btn{background:var(--grad-ai);border-color:transparent;color:#fff;border-radius:var(--radius-pill);box-shadow:0 4px 20px -6px rgba(67,56,202,.5)}
.vx-jarvis-btn:hover{filter:brightness(1.12);border-color:transparent;color:#fff}
.vx-jarvis-pulse{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;animation:vxpulse 2s cubic-bezier(.4,0,.6,1) infinite}
@keyframes vxpulse{0%,100%{box-shadow:0 0 0 0 rgba(67,56,202,.4)}50%{box-shadow:0 0 0 10px rgba(67,56,202,0)}}
.vx-brain-card{background:linear-gradient(135deg,var(--brand-50) 0%,var(--indigo-50) 100%);border:1.5px solid var(--brand-200);border-radius:var(--radius-lg);overflow:hidden;position:relative}
.vx-brain-card::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.6),transparent);pointer-events:none;border-radius:inherit}
.vx-chrome-badge{background:linear-gradient(135deg,#e8f0fe,#c7d7fd,#e8f0fe);border:1px solid rgba(37,99,235,.2);color:var(--brand);border-radius:var(--radius-pill)}
.vx-glass-card{background:var(--glass);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);border:1px solid var(--glass-border);box-shadow:var(--glass-shadow);border-radius:var(--glass-radius)}
.vx-navdot{position:absolute;top:5px;right:calc(50% - 16px);min-width:15px;height:15px;padding:0 3px;border-radius:999px;
  background:var(--red);color:#fff;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center}

@media (min-width:900px){
  .vx-mobile-actions{display:none}
  .vx-content{padding:30px 36px 56px;max-width:none;margin:0;width:100%}
  .vx-content-chat{padding:0!important;overflow:hidden}
  .vx-body{display:grid;grid-template-columns:220px 1fr;max-width:none;margin:0}
  /* sidebar glass flutuante — tratamento premium */
  .vx-sidebar{display:flex;flex-direction:column;gap:0;padding:0;
    position:sticky;top:0;height:100vh;align-self:start;
    background:var(--glass-strong);
    backdrop-filter:var(--glass-blur-strong);-webkit-backdrop-filter:var(--glass-blur-strong);
    border-right:1px solid var(--glass-border);
    box-shadow:1px 0 0 var(--border),4px 0 24px rgba(20,30,45,.04)}
  html.dark .vx-sidebar{
    background:var(--glass-strong);
    border-right:1px solid var(--glass-border);
    box-shadow:1px 0 0 var(--border),4px 0 24px rgba(0,0,0,.24)}
  /* reflexo sutil no topo do sidebar */
  .vx-sidebar::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
    background:linear-gradient(160deg,rgba(255,255,255,.18) 0%,transparent 35%);opacity:.5;z-index:0}
  html.dark .vx-sidebar::before{background:linear-gradient(160deg,rgba(255,255,255,.04) 0%,transparent 25%)}
  .vx-sidebar-logo{padding:0 16px;height:60px;margin-top:24px;margin-bottom:24px;flex-shrink:0;overflow:hidden;
    display:flex;align-items:center;position:relative;z-index:1}
  .vx-sidebar-logo img{height:52px;width:auto;object-fit:contain;max-width:100%;display:block;margin:0 auto}
  .vx-sidebar>div:first-of-type{padding:12px 10px 0;gap:1px;position:relative;z-index:1}
  .vx-sidebar::-webkit-scrollbar{display:none}
  .vx-bottomnav{display:none}
  /* Subitens do menu (ex.: Pagamentos → Plano/Campanhas/Movimentações) */
  .vx-subitem{padding-left:40px!important;min-height:38px!important;font-size:14px!important}
  /* Subitem selecionado: só o texto azul, sem fundo nem barra. */
  .vx-subitem[data-on="1"]{background:none!important;color:var(--brand)!important;font-weight:600}
  .vx-subitem[data-on="1"]::before{display:none!important}
  /* O submenu em abas da página só aparece no mobile (onde não há barra lateral) */
  .vx-subnav-mobile{display:none!important}
  .vx-ai-trigger{bottom:22px}
  .vx-ai-panel{bottom:72px}
  .vx-sidebar-section{font-size:9px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:var(--muted-2);
    padding:18px 14px 4px;pointer-events:none;user-select:none;position:relative;z-index:1}
  .vx-sidebtn{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:9px;border:0;
    background:none;font:inherit;font-size:13px;font-weight:450;color:var(--icon-secondary);cursor:pointer;text-align:left;
    position:relative;z-index:1;transition:all .18s;letter-spacing:-.01em}
  .vx-sidebtn>svg{flex-shrink:0}
  .vx-sidebtn:hover{background:rgba(17,24,39,.05);color:var(--ink)}
  html.dark .vx-sidebtn:hover{background:rgba(255,255,255,.06);color:var(--ink)}
  .vx-sidebtn[data-on="1"]{background:var(--brand-50);color:var(--brand);font-weight:600}
  html.dark .vx-sidebtn[data-on="1"]{background:var(--brand-50);color:var(--brand)}
  .vx-sidebtn[data-on="1"]::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);
    width:3px;height:60%;border-radius:0 3px 3px 0;background:var(--brand)}
  .vx-sidedot{margin-left:auto;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:var(--red);
    color:#fff;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center}
}
.vx-navbar-indicator{position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:24px;height:3px;border-radius:0 0 3px 3px;background:var(--brand)}

/* primitives */
.vx-card{background:var(--surface);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);
  border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);
  transition:box-shadow .25s,border-color .25s,transform .25s}
.vx-card:hover{box-shadow:0 4px 20px rgba(20,30,45,.06);border-color:var(--border-strong)}
html.dark .vx-card{border-color:var(--border);box-shadow:var(--shadow-card)}
html.dark .vx-card:hover{border-color:var(--border-strong);box-shadow:0 4px 20px rgba(0,0,0,.24)}
.vx-btn{appearance:none;border:1px solid var(--border-strong);background:var(--surface);color:var(--ink);font:inherit;
  font-weight:500;font-size:13px;padding:9px 15px;border-radius:10px;cursor:pointer;transition:.18s;
  display:inline-flex;align-items:center;gap:6px;justify-content:center;letter-spacing:-.01em}
.vx-btn:hover{background:var(--surface-2);border-color:var(--border-strong);color:var(--ink)}
.vx-btn:disabled{opacity:.4;cursor:not-allowed}
.vx-btn:focus-visible{outline:none;box-shadow:var(--ring)}
.vx-btn-primary{background:var(--brand);border-color:var(--brand);color:#fff;box-shadow:var(--shadow-brand)}
.vx-btn-primary:hover{background:var(--brand-600);border-color:var(--brand-600);box-shadow:0 4px 16px rgba(37,99,235,.30)}
.vx-btn-orange{background:var(--orange);border-color:var(--orange);color:#fff;box-shadow:var(--shadow-orange)}
.vx-btn-orange:hover{background:var(--orange-600);border-color:var(--orange-600);color:#fff}
.vx-btn-danger{border-color:var(--red-100);color:var(--red);background:transparent}
.vx-btn-danger:hover{background:var(--red-50);border-color:var(--red-100)}
.vx-btn-ghost{border-color:transparent;background:transparent;color:var(--icon-secondary)}
.vx-btn-ghost:hover{background:var(--surface-2);color:var(--ink);border-color:transparent}
.vx-btn-sm{padding:6px 12px;font-size:12px;border-radius:8px}
.vx-btn-block{width:100%}
.vx-input{width:100%;background:var(--surface-2);border:1px solid var(--border-strong);color:var(--ink);font:inherit;
  font-size:13.5px;padding:10px 13px;border-radius:10px;transition:.18s}
.vx-input::placeholder{color:var(--muted-2)}
.vx-input:focus{outline:none;border-color:var(--brand);background:var(--surface-solid);box-shadow:var(--ring)}
.vx-label{display:block;font-size:11.5px;font-weight:600;color:var(--muted);margin:0 0 5px;letter-spacing:.01em}
.vx-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:var(--radius-pill)}
.vx-badge-brand{background:var(--brand-100);color:var(--brand)}
.vx-badge-amber{background:var(--amber-100);color:#7C3B0A}
.vx-badge-red{background:var(--red-100);color:var(--red)}
.vx-badge-indigo{background:var(--indigo-100);color:var(--indigo)}
.vx-badge-muted{background:var(--surface-2);color:var(--muted)}
.vx-chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:500;padding:5px 10px;border-radius:var(--radius-pill);
  background:var(--surface-2);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);color:var(--ink-2);border:1px solid var(--glass-border)}
.vx-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.vx-mut{color:var(--muted)}
.vx-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px;flex-wrap:wrap}
.vx-page-head h1{font-size:27px;margin:2px 0 5px;letter-spacing:-.03em;font-weight:600}.vx-page-head p{font-size:13px;color:var(--muted);margin:0;letter-spacing:-.01em}
.vx-filterbar{display:grid;grid-template-columns:repeat(2,minmax(130px,1fr));gap:7px;flex:1;max-width:620px}.vx-filterbar .vx-input{padding:8px 10px;font-size:12px}
.vx-notice{padding:11px 13px;border-radius:var(--radius-sm);font-size:12.5px;border:1px solid var(--glass-border);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur)}
.vx-notice-amber{background:var(--amber-50);border-color:var(--amber-100);color:#7C3B0A}
.vx-btn-ai{border-color:var(--indigo-100);color:var(--indigo);background:linear-gradient(135deg,var(--indigo-50),var(--brand-50))}
.vx-btn-ai:hover{border-color:var(--indigo);background:var(--indigo-50)}
.vx-btn-ai-hero{background:linear-gradient(135deg,var(--indigo),var(--brand));border-color:transparent;color:#fff;font-weight:600}
.vx-btn-ai-hero:hover{background:linear-gradient(135deg,var(--indigo-600,var(--indigo)),var(--brand-600));border-color:transparent;color:#fff}
.vx-sep{height:1px;background:var(--border);border:0;margin:14px 0;opacity:.7}
.vx-fade{animation:vxin .2s cubic-bezier(.22,.9,.32,1)}
/* Só opacidade: um transform aqui vira containing-block e quebra o position:fixed
   dos modais em páginas longas (modal ia parar fora da tela). */
@keyframes vxin{from{opacity:0}to{opacity:1}}
@keyframes vxSearchExpand{from{width:40px;opacity:.5}to{width:280px;opacity:1}}
@media (prefers-reduced-motion:reduce){.vx-fade{animation:none}}
.vx-spinner{width:28px;height:28px;border:3px solid var(--vx-border,#e5e5e5);border-top-color:var(--vx-accent,#2563EB);border-radius:50%;animation:vxspin .7s linear infinite;margin:0 auto}
@keyframes vxspin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.vx-spinner{animation:none}}
.vx-grid{display:grid;gap:13px}
.vx-prof-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;align-items:stretch}
.vx-prof-grid>.vx-prof-card{min-width:0;height:420px;display:flex;flex-direction:column;overflow:hidden;border-radius:16px;background:var(--surface);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);border:1px solid var(--glass-border);box-shadow:var(--glass-shadow);cursor:pointer;transition:box-shadow .25s,border-color .25s,transform .25s}
.vx-prof-grid>.vx-prof-card:hover{box-shadow:0 12px 32px -10px rgba(11,18,32,.1);border-color:var(--border-strong);transform:translateY(-2px)}
.vx-prof-card__img{width:100%;height:220px;min-height:220px;max-height:220px;flex-shrink:0;overflow:hidden;position:relative;background:var(--surface-2)}
.vx-prof-card__img img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
.vx-prof-card__body{display:flex;flex-direction:column;flex:1;padding:14px 16px 16px;min-height:0;overflow:hidden}
.vx-prof-card__info{display:flex;flex-direction:column;gap:4px}
.vx-prof-card__actions{margin-top:auto;padding-top:12px;width:100%}
.vx-prof-card__btn{width:100%;height:48px;min-height:48px;border:none;border-radius:12px;background:var(--brand);color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;letter-spacing:.01em}
.vx-prof-card__btn:hover:not(:disabled){background:#1d4ed8}
.vx-prof-card__btn--success,.vx-prof-card__btn--muted,.vx-prof-card__btn--danger{font-family:inherit}
.vx-prof-card__btn--success{background:#dcfce7;color:#166534;cursor:default}
.vx-prof-card__btn--muted{background:var(--surface-2);color:var(--muted);cursor:default;font-size:12px;font-weight:500}
.vx-prof-card__btn--danger{background:#fee2e2;color:#b91c1c}
.vx-prof-card__btn--danger:hover{background:#fecaca}
@media(max-width:1200px){.vx-prof-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.vx-prof-grid{grid-template-columns:1fr}}
.vx-g2{grid-template-columns:1fr}
.vx-g4{grid-template-columns:repeat(2,1fr)}
.vx-g3{grid-template-columns:1fr}
@media(min-width:620px){.vx-g2{grid-template-columns:1fr 1fr}.vx-g3{grid-template-columns:repeat(3,1fr)}.vx-g4{grid-template-columns:repeat(4,1fr)}}

/* stat cards */
.vx-stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:20px 18px 18px;box-shadow:var(--shadow-card);
  position:relative;transition:box-shadow .2s,border-color .2s}
.vx-stat:hover{box-shadow:0 4px 20px rgba(20,30,45,.06);border-color:var(--border-strong)}
html.dark .vx-stat{border-color:var(--border);box-shadow:var(--shadow-card)}
html.dark .vx-stat:hover{box-shadow:0 4px 20px rgba(0,0,0,.24);border-color:var(--border-strong)}
.vx-stat-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;
  background:var(--surface-2);border:1px solid var(--border);color:var(--icon-secondary)}
.vx-stat-val{font-family:'Geist','Inter',sans-serif;font-weight:600;font-size:26px;letter-spacing:-.04em;color:var(--ink);font-variant-numeric:tabular-nums}

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
.vx-table-wrap{overflow-x:auto;border:1px solid var(--glass-border);border-radius:var(--radius-sm);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur)}.vx-table{border-collapse:collapse;width:100%;min-width:640px;font-size:12px}.vx-table th,.vx-table td{text-align:left;padding:9px 11px;border-bottom:1px solid var(--border);white-space:nowrap}.vx-table th{color:var(--muted);background:var(--surface-2);font-size:10px;text-transform:uppercase;letter-spacing:.05em}
.vx-steps{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.vx-steps span{white-space:nowrap;padding:5px 8px;border-radius:999px;background:var(--surface-2);color:var(--muted);font-size:10.5px}.vx-steps span[data-done="1"]{background:var(--brand-50);color:var(--brand)}

/* Central de operações de Campanhas */
.vx-campaign-head h1{font-size:30px;margin:5px 0 4px}.vx-campaign-head p{line-height:1.55}.vx-campaign-head p b{color:var(--ink);font-size:14px}.vx-campaign-actions{display:flex;gap:8px;flex-wrap:wrap}
.vx-campaign-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.vx-campaign-stat{min-height:132px;display:flex;flex-direction:column;justify-content:space-between}
.vx-campaign-stat-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;color:var(--muted);font-size:11.5px;font-weight:600}.vx-campaign-stat-top svg{color:var(--brand);flex:none}.vx-campaign-stat .vx-stat-val{display:block;margin:7px 0;font-size:21px}
.vx-campaign-stat-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;color:var(--muted-2);font-size:10px}.vx-campaign-trend{font-weight:700}.vx-campaign-trend.is-positive{color:#22A06B}.vx-campaign-trend.is-negative{color:var(--red)}.vx-campaign-stat-period{color:var(--muted-2);font-weight:500}
.vx-budget-card{padding:19px;margin-top:14px}.vx-budget-main{max-width:100%}.vx-budget-value{display:flex;align-items:baseline;gap:5px;margin:5px 0 10px}.vx-budget-value strong{font-size:24px}.vx-budget-value span{color:var(--muted);font-size:13px}.vx-budget-progress{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:7px;color:var(--muted);font-size:11px}
.vx-budget-risk{display:inline-flex;align-items:center;gap:5px;font-weight:700}.vx-budget-risk i{width:7px;height:7px;border-radius:50%;background:currentColor}.vx-budget-risk.is-ok{color:#22A06B}.vx-budget-risk.is-warning{color:var(--amber)}.vx-budget-risk.is-danger{color:var(--red)}.vx-budget-risk.is-muted{color:var(--muted)}
.vx-budget-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:17px}.vx-budget-facts>div{padding:10px;border-radius:10px;background:var(--surface-2);min-width:0}.vx-budget-facts span{display:block;color:var(--muted);font-size:10.5px}.vx-budget-facts b{display:block;margin-top:3px;font-size:12.5px;overflow:hidden;text-overflow:ellipsis}
.vx-campaign-empty{padding:32px 18px;text-align:center;display:flex;align-items:center;flex-direction:column}.vx-campaign-empty-icon{width:50px;height:50px;border-radius:15px;display:grid;place-items:center;background:var(--surface-2);border:1px solid var(--border);color:var(--icon-secondary)}.vx-campaign-empty h2{font-size:20px;margin:13px 0 5px}.vx-campaign-empty p{max-width:470px;color:var(--muted);margin:0 0 17px;font-size:13px}
.vx-campaign-row{appearance:none;width:100%;padding:14px 15px;color:var(--ink);font:inherit;text-align:left;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;cursor:pointer;transition:.16s}.vx-campaign-row:hover{border-color:var(--brand);transform:translateY(-1px)}.vx-campaign-row>div{min-width:0}.vx-campaign-row b,.vx-campaign-row div>span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vx-campaign-row div>span{color:var(--muted);font-size:11.5px;margin-top:2px}.vx-campaign-open{font-size:11.5px;color:var(--brand);font-weight:700;white-space:nowrap}
.vx-campaign-status{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:10.5px;font-weight:700;white-space:nowrap;background:var(--surface-2);color:var(--muted)}.vx-campaign-status::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}.vx-campaign-status.is-ativa{background:rgba(34,160,107,.12);color:#22A06B}.vx-campaign-status.is-em_revisao{background:var(--amber-50);color:var(--amber)}.vx-campaign-status.is-pausada{background:var(--red-50);color:var(--red)}.vx-campaign-status.is-rascunho{background:var(--surface-2);color:var(--muted)}
.vx-campaign-filters{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 1px 8px}.vx-campaign-filters::-webkit-scrollbar{display:none}.vx-campaign-filters button{appearance:none;border:1px solid var(--border);background:var(--surface);color:var(--muted);border-radius:999px;padding:7px 10px;font:600 11.5px Inter;white-space:nowrap;cursor:pointer;display:inline-flex;align-items:center;gap:6px}.vx-campaign-filters button span{display:grid;place-items:center;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:var(--surface-2);font-size:9.5px}.vx-campaign-filters button[data-on="1"]{border-color:var(--brand);background:var(--brand-50);color:var(--brand)}.vx-campaign-filters button[data-on="1"] span{background:var(--brand-100)}
.vx-campaign-card-grid{display:grid;grid-template-columns:1fr;gap:13px}.vx-campaign-card{padding:17px;display:flex;flex-direction:column;min-width:0;backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur)}.vx-campaign-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.vx-campaign-card h3{font-size:17px;margin:0;line-height:1.25}.vx-campaign-card-meta{font-size:11px;color:var(--muted);margin-top:4px}.vx-campaign-people{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11.5px;margin:13px 0}.vx-campaign-people svg{color:var(--brand)}.vx-campaign-people b{color:var(--ink)}
.vx-campaign-today{padding:12px;background:var(--surface-2);border-radius:11px}.vx-campaign-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:8px}.vx-campaign-metrics>div{min-width:0}.vx-campaign-metrics b,.vx-campaign-metrics span{display:block}.vx-campaign-metrics b{font-size:13px;overflow:hidden;text-overflow:ellipsis}.vx-campaign-metrics span{font-size:9.5px;color:var(--muted);margin-top:1px}
.vx-campaign-budget-mini{margin:14px 0}.vx-campaign-budget-mini .vx-row{font-size:10.5px;margin-bottom:7px}.vx-campaign-budget-mini .vx-row span{color:var(--muted)}.vx-campaign-budget-mini>.vx-meter-track{height:5px}.vx-campaign-budget-mini>span{display:block;color:var(--muted);font-size:9.5px;margin-top:5px}.vx-campaign-operation-btn{margin-top:auto;justify-content:space-between;color:var(--brand)}.vx-campaign-filter-empty{padding:26px;text-align:center;color:var(--muted);font-size:13px}
@media(min-width:700px){.vx-campaign-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:720px){.vx-campaign-stats{grid-template-columns:repeat(4,minmax(0,1fr))}.vx-budget-card{display:grid;grid-template-columns:minmax(260px,1.1fr) minmax(320px,1fr);column-gap:22px}.vx-budget-facts{margin-top:0;grid-template-columns:repeat(3,minmax(0,1fr))}.vx-budget-card .vx-chart-source{grid-column:1/-1}}
@media(max-width:560px){.vx-campaign-head .vx-campaign-actions,.vx-campaign-empty .vx-campaign-actions{display:grid;grid-template-columns:1fr 1fr;width:100%}.vx-campaign-head .vx-btn{padding-left:10px;padding-right:10px}.vx-campaign-row{grid-template-columns:minmax(0,1fr) auto}.vx-campaign-row .vx-campaign-open{grid-column:1/-1}.vx-budget-progress{align-items:flex-start;flex-direction:column}.vx-budget-facts{grid-template-columns:1fr 1fr}}

/* Dashboard individual da campanha */
.vx-campaign-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.vx-campaign-detail-head h1{font-size:28px;margin:0}.vx-campaign-detail-head p{margin:5px 0;color:var(--muted);font-size:13px;max-width:680px}.vx-campaign-detail-meta{display:flex;gap:13px;flex-wrap:wrap;margin-top:11px}.vx-campaign-detail-meta span{display:inline-flex;align-items:center;gap:5px;color:var(--muted);font-size:11.5px}.vx-campaign-detail-actions{display:flex;gap:7px;flex-wrap:wrap}.vx-context-wrap{position:relative}.vx-context-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:10;min-width:175px;padding:5px;background:var(--surface);border:1px solid var(--border);border-radius:11px;box-shadow:var(--shadow-pop)}.vx-context-menu button{width:100%;border:0;background:none;color:var(--ink);font:600 12px Inter;text-align:left;padding:9px;border-radius:8px;cursor:pointer}.vx-context-menu button:hover{background:var(--surface-2)}.vx-context-menu button.is-danger{color:var(--red)}
.vx-campaign-inner-tabs{display:flex;gap:3px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--border);margin-bottom:13px}.vx-campaign-inner-tabs::-webkit-scrollbar{display:none}.vx-campaign-inner-tabs button{appearance:none;border:0;border-bottom:2px solid transparent;background:none;color:var(--muted);font:600 12px Inter;padding:10px 11px;white-space:nowrap;cursor:pointer}.vx-campaign-inner-tabs button[data-on="1"]{color:var(--brand);border-bottom-color:var(--brand)}
.vx-campaign-periods{display:flex;gap:5px;margin:0 0 14px;overflow-x:auto}.vx-campaign-periods button{appearance:none;border:1px solid var(--border);background:var(--surface);color:var(--muted);font:600 11px Inter;padding:6px 10px;border-radius:999px;white-space:nowrap;cursor:pointer}.vx-campaign-periods button[data-on="1"]{background:var(--brand-50);border-color:var(--brand);color:var(--brand)}.vx-campaign-periods button:disabled{opacity:.45;cursor:not-allowed}
.vx-custom-dates{display:flex;gap:5px;align-items:center}.vx-custom-dates label{display:flex;align-items:center;gap:4px;color:var(--muted);font-size:9.5px}.vx-custom-dates input{border:1px solid var(--border);background:var(--surface);color:var(--ink);border-radius:999px;padding:5px 7px;font:500 10px Inter;color-scheme:dark}
.vx-campaign-detail-loading{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.vx-campaign-detail-loading>div{min-height:110px}.vx-campaign-overview-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.vx-campaign-overview-stats .vx-stat{min-height:120px;display:flex;flex-direction:column;justify-content:space-between}.vx-campaign-overview-stats .vx-stat-val{font-size:20px}.vx-positive{color:#22A06B;font-size:10.5px;font-weight:700}.vx-negative{color:var(--red);font-size:10.5px;font-weight:700}
.vx-campaign-detail-grid{display:grid;grid-template-columns:1fr;gap:13px;margin-top:13px}.vx-funnel-card,.vx-cost-card{padding:18px}.vx-funnel-card h2,.vx-cost-card h2,.vx-detail-section h2{font-size:18px;margin:3px 0}.vx-funnel{display:grid;grid-template-columns:repeat(5,minmax(70px,1fr));gap:8px;overflow-x:auto;margin-top:16px;padding-bottom:4px}.vx-funnel-step{position:relative;min-width:70px}.vx-funnel-step>div{padding:12px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;text-align:center}.vx-funnel-step b,.vx-funnel-step span{display:block}.vx-funnel-step b{font-size:16px}.vx-funnel-step span{font-size:9.5px;color:var(--muted);margin-top:2px}.vx-funnel-step small{display:block;text-align:center;color:var(--brand);font-size:9.5px;font-weight:700;margin-top:4px}.vx-cost-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);font-size:12.5px}.vx-cost-row span{color:var(--muted)}
.vx-detail-section{padding:19px}.vx-detail-section>p{color:var(--muted);font-size:12.5px;margin:2px 0 14px}.vx-campaign-inline-empty{padding:24px 14px;border:1px dashed var(--border-strong);border-radius:11px;text-align:center;color:var(--muted);font-size:12.5px}.vx-compact-list{display:flex;flex-direction:column}.vx-compact-list>div{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)}.vx-compact-list>div:last-child{border-bottom:0}.vx-compact-list b,.vx-compact-list span{font-size:12px}.vx-compact-list div>div span{display:block;color:var(--muted);font-size:10.5px;margin-top:2px}.vx-performance-list{display:flex;flex-direction:column;gap:8px}.vx-performance-list>div{display:grid;grid-template-columns:40px minmax(5px,1fr) 28px;gap:8px;align-items:center}.vx-performance-list span,.vx-performance-list b{font-size:10px;color:var(--muted)}.vx-performance-list i{height:7px;min-width:3px;border-radius:99px;background:var(--brand)}
@media(min-width:720px){.vx-campaign-overview-stats{grid-template-columns:repeat(5,minmax(0,1fr))}.vx-campaign-detail-grid{grid-template-columns:minmax(0,1.6fr) minmax(230px,.7fr)}}
@media(max-width:620px){.vx-campaign-detail-head{flex-direction:column}.vx-campaign-detail-actions{width:100%}.vx-campaign-detail-actions>.vx-btn{flex:1}.vx-campaign-detail-head h1{font-size:23px}.vx-campaign-overview-stats{grid-template-columns:1fr 1fr}.vx-campaign-overview-stats .vx-stat:first-child{grid-column:1/-1}.vx-campaign-detail-loading{grid-template-columns:1fr 1fr}.vx-funnel-card,.vx-cost-card,.vx-detail-section{padding:15px}}

/* Equipe e atividade da campanha */
.vx-activity-card{padding:18px;margin-top:13px}.vx-activity-card h2{font-size:18px;margin:3px 0}.vx-activity-list{display:flex;flex-direction:column;margin-top:12px}.vx-activity-list>div{display:grid;grid-template-columns:42px 9px minmax(0,1fr);gap:9px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border)}.vx-activity-list>div:last-child{border-bottom:0}.vx-activity-list time{font-size:10px;color:var(--muted)}.vx-activity-list i{width:8px;height:8px;margin-top:4px;border-radius:50%;background:var(--brand);box-shadow:0 0 0 4px var(--brand-50)}.vx-activity-list b{font-size:11.5px}.vx-activity-list span{display:block;color:var(--muted);font-size:9.5px;margin-top:2px}
.vx-professional-filters{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:13px 0}.vx-professional-filters button{appearance:none;border:1px solid var(--border);background:var(--surface-2);color:var(--muted);border-radius:999px;padding:6px 10px;font:600 10.5px Inter;white-space:nowrap;cursor:pointer}.vx-professional-filters button[data-on="1"]{background:var(--brand-50);border-color:var(--brand);color:var(--brand)}
.vx-campaign-team-table{border:1px solid var(--border);border-radius:12px;overflow:hidden}.vx-team-head,.vx-team-row{display:grid;grid-template-columns:minmax(145px,1.4fr) minmax(80px,.8fr) minmax(90px,.8fr) 76px 70px 80px 55px 74px;align-items:center;gap:8px;padding:9px 11px}.vx-team-head{background:var(--surface-2);color:var(--muted);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}.vx-team-row{appearance:none;width:100%;border:0;border-top:1px solid var(--border);background:var(--surface);color:var(--ink);font:500 10.5px Inter;text-align:left;cursor:pointer}.vx-team-row:hover{background:var(--surface-2)}.vx-team-person{display:flex;align-items:center;gap:7px;min-width:0}.vx-team-person i{width:28px;height:28px;border-radius:9px;background:linear-gradient(135deg,var(--brand),var(--indigo));display:grid;place-items:center;color:#fff;font-style:normal;font-size:9px;font-weight:700;flex:none}.vx-team-person b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vx-team-action{color:var(--brand);font-weight:700}.vx-campaign-person-status{display:inline-flex;align-items:center;gap:4px;font-style:normal;font-size:9.5px;font-weight:700;text-transform:capitalize;color:var(--muted)}.vx-campaign-person-status::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}.vx-campaign-person-status.is-online{color:#22A06B}.vx-campaign-person-status.is-ativo{color:var(--brand)}.vx-campaign-person-status.is-pendente{color:var(--amber)}.vx-campaign-person-status.is-sem_atividade{color:var(--muted)}
.vx-professional-sheet{max-width:760px}.vx-professional-sheet h2{font-size:22px;margin:3px 0}.vx-professional-identity{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid var(--border)}.vx-professional-identity b,.vx-professional-identity span{display:block}.vx-professional-identity span{color:var(--muted);font-size:11px;margin-top:2px}.vx-profile-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:13px}.vx-profile-stats>div{padding:10px;background:var(--surface-2);border-radius:9px}.vx-profile-stats span,.vx-profile-stats b{display:block}.vx-profile-stats span{color:var(--muted);font-size:9.5px}.vx-profile-stats b{font-size:13px;margin-top:3px}.vx-profile-chart{margin-top:17px}.vx-profile-chart>div:not(.vx-eyebrow):not(.vx-campaign-inline-empty){display:grid;grid-template-columns:42px 1fr 25px;gap:7px;align-items:center;margin-top:7px}.vx-profile-chart span,.vx-profile-chart strong{font-size:9.5px;color:var(--muted)}.vx-profile-chart i{height:7px;border-radius:99px;background:var(--surface-3);overflow:hidden}.vx-profile-chart i b{display:block;height:100%;border-radius:99px;background:var(--brand)}
@media(max-width:820px){.vx-team-head{display:none}.vx-campaign-team-table{border:0;display:grid;grid-template-columns:1fr 1fr;gap:9px;overflow:visible}.vx-team-row{border:1px solid var(--border);border-radius:11px;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px}.vx-team-row .vx-team-person{grid-column:1/-1;border-bottom:1px solid var(--border);padding-bottom:8px}.vx-team-row>span:not(.vx-team-person):not(.vx-team-action)::before{content:attr(data-label);display:block;color:var(--muted);font-size:8px;text-transform:uppercase;margin-bottom:2px}.vx-team-action{grid-column:1/-1;text-align:right}}
@media(max-width:520px){.vx-campaign-team-table{grid-template-columns:1fr}.vx-profile-stats{grid-template-columns:repeat(2,1fr)}.vx-professional-identity{grid-template-columns:48px minmax(0,1fr)}.vx-professional-identity>.vx-campaign-person-status{grid-column:1/-1}}

/* Performance, alertas e financeiro da campanha */
.vx-alerts-card{padding:18px;margin-top:13px}.vx-alerts-card h2{font-size:18px;margin:3px 0 11px}.vx-alert-row{display:flex;align-items:flex-start;gap:9px;padding:9px 10px;border-radius:9px;background:var(--surface-2);font-size:11.5px;margin-top:6px}.vx-alert-row.is-positive{color:#22A06B;background:rgba(34,160,107,.1)}.vx-alert-row.is-atencao{color:#7C3B0A;background:var(--amber-50)}.vx-alert-row.is-critico{color:var(--red);background:var(--red-50)}.vx-alert-dot{width:7px;height:7px;border-radius:50%;background:currentColor;flex:none;margin-top:5px}
.vx-performance-chart{min-width:0}.vx-chart-toggles{display:flex;gap:5px;flex-wrap:wrap;margin:12px 0}.vx-chart-toggles button{appearance:none;border:1px solid var(--border);background:var(--surface-2);color:var(--muted);border-radius:999px;padding:5px 8px;font:600 9.5px Inter;cursor:pointer;display:inline-flex;align-items:center;gap:5px;opacity:.55}.vx-chart-toggles button[data-on="1"]{opacity:1;border-color:var(--border-strong);color:var(--ink)}.vx-chart-toggles i{width:7px;height:7px;border-radius:50%}.vx-performance-chart svg{display:block;width:100%;height:230px;overflow:visible}.vx-chart-gridline{stroke:var(--border);stroke-width:1;vector-effect:non-scaling-stroke}.vx-chart-axis{display:flex;justify-content:space-between;color:var(--muted);font-size:9px;margin-top:2px}
.vx-finance-stack{display:flex;flex-direction:column;gap:13px}.vx-finance-budget{margin:14px 0}.vx-finance-budget .vx-row{font-size:11px;margin-bottom:7px}.vx-finance-budget .vx-row span{color:var(--muted)}.vx-finance-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.vx-finance-kpis>div{padding:10px;background:var(--surface-2);border-radius:9px}.vx-finance-kpis span,.vx-finance-kpis b{display:block}.vx-finance-kpis span{font-size:9.5px;color:var(--muted)}.vx-finance-kpis b{font-size:12px;margin-top:3px;overflow:hidden;text-overflow:ellipsis}.vx-cost-table{border:1px solid var(--border);border-radius:11px;overflow:hidden}.vx-cost-table>div{display:grid;grid-template-columns:minmax(140px,1fr) repeat(3,minmax(90px,.55fr));gap:8px;padding:9px 11px;border-bottom:1px solid var(--border);font-size:11px}.vx-cost-table>div:first-child{background:var(--surface-2);color:var(--muted);font-size:9px;font-weight:700;text-transform:uppercase}.vx-cost-table>div:last-child{border-bottom:0}
@media(max-width:620px){.vx-campaign-periods{flex-wrap:wrap}.vx-custom-dates{width:100%}.vx-finance-kpis{grid-template-columns:1fr 1fr}.vx-performance-chart svg{height:190px}.vx-cost-table{border:0;display:grid;gap:8px}.vx-cost-table>div:first-child{display:none}.vx-cost-table>div:not(:first-child){border:1px solid var(--border);border-radius:10px;display:grid;grid-template-columns:1fr 1fr;padding:11px}.vx-cost-table>div b{grid-column:1/-1;padding-bottom:6px;border-bottom:1px solid var(--border)}.vx-cost-table>div span::before{content:attr(data-label);display:block;color:var(--muted);font-size:8px;text-transform:uppercase;margin-bottom:2px}}

/* Criação de campanha em três etapas */
.vx-campaign-wizard{max-width:900px;margin:0 auto}.vx-wizard-steps{display:grid;grid-template-columns:repeat(3,1fr);margin-bottom:25px}.vx-wizard-steps>div{display:flex;align-items:center;min-width:0}.vx-wizard-steps>div>div{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:12px;font-weight:600;white-space:nowrap}.vx-wizard-steps>div>div>span{width:25px;height:25px;border:1px solid var(--border);border-radius:50%;display:grid;place-items:center;font-size:10px;flex:none}.vx-wizard-steps>div>i{height:1px;background:var(--border);flex:1;margin:0 10px}.vx-wizard-steps>div[data-active="1"]>div,.vx-wizard-steps>div[data-done="1"]>div{color:var(--brand)}.vx-wizard-steps>div[data-active="1"]>div>span,.vx-wizard-steps>div[data-done="1"]>div>span{background:var(--brand-50);border-color:var(--brand)}
.vx-objective-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.vx-objective-card{appearance:none;padding:17px;text-align:left;cursor:pointer;color:var(--ink);font:inherit;display:grid;grid-template-columns:38px minmax(0,1fr) 16px;align-items:start;gap:11px;transition:.16s}.vx-objective-card:hover{border-color:var(--brand);transform:translateY(-1px)}.vx-objective-card:last-child:nth-child(odd){grid-column:1/-1}.vx-objective-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--brand-50);border:1px solid var(--brand-100);color:var(--brand)}.vx-objective-arrow{color:var(--muted);margin-top:10px}.vx-wizard-checks{display:flex;gap:14px;flex-wrap:wrap;margin-top:13px}.vx-wizard-checks label{display:flex;gap:7px;align-items:center;color:var(--muted);font-size:11.5px}.vx-training-drafts{display:flex;flex-direction:column;gap:8px;margin-top:12px}.vx-training-drafts>div{display:grid;grid-template-columns:minmax(150px,.7fr) minmax(220px,1.3fr) 34px;gap:7px;align-items:start}.vx-training-drafts textarea{min-height:43px;resize:vertical}.vx-evidence-summary{display:flex;flex-direction:column;gap:7px}.vx-evidence-summary>div{padding:9px 10px;border-radius:9px;background:var(--surface-2)}.vx-evidence-summary b,.vx-evidence-summary span{display:block}.vx-evidence-summary b{font-size:11.5px}.vx-evidence-summary span{font-size:10px;color:var(--muted);margin-top:2px}.vx-publish-checklist{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:12px}.vx-publish-checklist>div{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:10.5px}.vx-publish-checklist>div>span{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:var(--red-50);color:var(--red);font-size:10px;font-weight:800}.vx-publish-checklist>div[data-ok="1"]{color:var(--ink-2)}.vx-publish-checklist>div[data-ok="1"]>span{background:rgba(34,160,107,.12);color:#22A06B}
@media(max-width:620px){.vx-objective-grid{grid-template-columns:1fr}.vx-objective-card:last-child:nth-child(odd){grid-column:auto}.vx-wizard-steps>div>div{font-size:10px}.vx-wizard-steps>div>i{margin:0 5px}.vx-training-drafts>div{grid-template-columns:1fr 36px}.vx-training-drafts textarea{grid-column:1/-1;grid-row:2}.vx-publish-checklist{grid-template-columns:1fr}}

/* meter */
.vx-meter-track{height:6px;background:var(--surface-3);border-radius:999px;overflow:hidden}
.vx-meter-fill{height:100%;border-radius:999px;transition:width .6s cubic-bezier(.4,0,.2,1)}

/* tabs */
.vx-tabs{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.vx-tabs::-webkit-scrollbar{display:none}
.vx-tab{white-space:nowrap;padding:7px 14px;border-radius:var(--radius-pill);border:1px solid var(--glass-border);background:transparent;
  color:var(--muted);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;transition:.2s}
.vx-tab:hover{color:var(--ink-2);border-color:var(--border-strong);background:var(--surface-2)}
.vx-tab[data-on="1"]{background:var(--ink);color:#fff;border-color:var(--ink)}

/* modal */
.vx-overlay{position:fixed;inset:0;z-index:40;background:rgba(4,8,16,.45);backdrop-filter:blur(20px) saturate(1.2);-webkit-backdrop-filter:blur(20px) saturate(1.2);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:640px){/* overlay rola e o sheet se centra via margin:auto — garante que o fim do modal
   (ex.: botão Confirmar no checkout) seja sempre alcançável em qualquer tela. */
.vx-overlay{align-items:flex-start;overflow-y:auto;overscroll-behavior:contain;padding:16px}}
.vx-sheet{width:100%;max-width:580px;margin:auto;background:var(--surface);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);border:1px solid var(--glass-border);border-radius:18px;padding:24px;box-shadow:0 -8px 40px -8px rgba(11,18,32,.12),inset 0 .5px 0 rgba(255,255,255,.4)}
@media(min-width:640px){.vx-sheet{border-radius:18px}}
/* --- RYCS Academy: grade de cursos ------------------------------------ */
.vx-course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:16px}
.vx-course-card{padding:0;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:transform .2s,border-color .2s,box-shadow .2s;backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur)}
.vx-course-card:hover{transform:translateY(-2px);border-color:var(--brand);box-shadow:0 10px 28px -8px rgba(11,18,32,.08)}
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
/* --- Card de empresa: vitrine premium -------------------------------- */
.vx-empresa-card{background:var(--surface);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);border:1px solid var(--glass-border);border-radius:var(--radius-lg);
  overflow:hidden;box-shadow:var(--glass-shadow);transition:border-color .25s,transform .25s,box-shadow .25s;display:flex;flex-direction:column}
.vx-empresa-card:hover{border-color:var(--brand-200);transform:translateY(-3px);box-shadow:0 12px 36px -10px rgba(37,99,235,.16)}
.vx-empresa-topo{height:5px;flex:none}
.vx-empresa-corpo{padding:18px 18px 20px;display:flex;flex-direction:column;flex:1}
.vx-empresa-cabeca{display:flex;gap:14px;align-items:center;margin-bottom:14px}
.vx-empresa-logo{width:56px;height:56px;border-radius:14px;
  display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none;
  font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:20px;
  box-shadow:0 2px 8px -2px rgba(11,18,32,.14);
  background:linear-gradient(135deg,var(--brand-50),var(--indigo-50));color:var(--brand)}
.vx-empresa-logo img{width:100%;height:100%;object-fit:cover;border-radius:12px}
.vx-empresa-ficha{display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:12px;
  padding:13px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.vx-empresa-ficha b{display:block;font-size:13.5px;margin-top:2px}
.vx-empresa-icp{margin-top:12px}
.vx-empresa-icp p{margin:3px 0 0;font-size:12.5px;color:var(--muted);line-height:1.5}

/* ── Jarvis / Modo de Gravação premium ─────────────────────────────────── */
.vx-jarvis-ring{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;position:relative;cursor:pointer;transition:.2s}
.vx-jarvis-ring::before{content:"";position:absolute;inset:-4px;border-radius:50%;background:var(--grad-ai);opacity:.18;transition:opacity .3s}
.vx-jarvis-ring:hover::before{opacity:.32}
.vx-jarvis-ring[data-active="1"]::before{opacity:.4;animation:vxpulse 1.4s ease-in-out infinite}
.vx-jarvis-wave{display:flex;align-items:center;gap:3px;height:28px}
.vx-jarvis-wave span{width:4px;border-radius:2px;background:var(--brand);transform-origin:bottom;animation:vxwave 1.2s ease-in-out infinite}
.vx-jarvis-wave span:nth-child(2){animation-delay:.15s;height:18px}
.vx-jarvis-wave span:nth-child(3){animation-delay:.3s;height:24px}
.vx-jarvis-wave span:nth-child(4){animation-delay:.15s;height:18px}
.vx-jarvis-wave span:nth-child(5){animation-delay:0s;height:10px}
@keyframes vxwave{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1.1)}}

/* ── Scores & progress premium ─────────────────────────────────────────── */
.vx-score-ring{--size:96px;width:var(--size);height:var(--size);border-radius:50%;position:relative;display:grid;place-items:center}
.vx-score-ring svg{position:absolute;inset:0;transform:rotate(-90deg)}

/* ── Empty states ───────────────────────────────────────────────────────── */
.vx-empty{padding:40px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.vx-empty-icon{width:56px;height:56px;border-radius:18px;background:var(--surface-2);border:1px solid var(--border);display:grid;place-items:center;color:var(--icon-secondary)}
.vx-empty h2{font-size:20px;margin:0}
.vx-empty p{font-size:13.5px;color:var(--muted);max-width:420px;margin:0;line-height:1.65}

/* ── Microinterações ────────────────────────────────────────────────────── */
.vx-card:hover{border-color:var(--border-strong);box-shadow:0 8px 28px -8px rgba(11,18,32,.08)}
.vx-campaign-card:hover{border-color:var(--border-strong);box-shadow:0 10px 28px -8px rgba(11,18,32,.08)}
button.vx-btn:active:not(:disabled){transform:scale(.97)}

/* ── Topbar premium ─────────────────────────────────────────────────────── */
.vx-topbar{background:var(--topbar-bg);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur)}

/* ── Corrigir badge amber (texto branco em fundo amarelo) ───────────────── */
.vx-beta-badge{background:#F59E0B;color:#1c1200}
.vx-beta-login-badge{background:#F59E0B;color:#1c1200}

/* ── Sidebar desktop premium ────────────────────────────────────────────── */
@media(min-width:900px){
  .vx-sidebtn[data-on="1"]{background:var(--brand-50);color:var(--brand);font-weight:600}
}

/* ── Responsividade mobile ──────────────────────────────────────────────── */
@media(max-width:640px){
  .vx-page-head h1{font-size:22px}
  .vx-campaign-head h1{font-size:24px}
  .vx-btn{font-size:13px;padding:9px 14px}
}


/* ── Onboarding da empresa (docs/onboarding/SPEC.md) ─────────────────────
   Usa os tokens da plataforma. Campos de 48px, botões de 52px e alvos de
   toque de 44px, como pede a especificação. */
.vx-onb{min-height:100vh;background:var(--bg);display:flex;flex-direction:column}
.vx-onb-topo{background:var(--bg);border-bottom:1px solid var(--border)}
.vx-onb-topo-inner{max-width:1200px;margin:0 auto;padding:6px 20px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px}
.vx-onb-passos{display:flex;align-items:center;gap:6px;list-style:none;margin:0;padding:0;flex-wrap:wrap}
.vx-onb-passos li{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--muted)}
.vx-onb-passos li+li::before{content:"";width:18px;height:1px;background:var(--border-strong);margin-right:2px}
.vx-onb-passo-n{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;border:1.5px solid var(--border-strong);background:var(--surface);color:var(--muted);flex:none}
.vx-onb-passos li[data-estado="concluida"]{color:var(--green-700)}
.vx-onb-passos li[data-estado="concluida"] .vx-onb-passo-n{background:var(--green);border-color:var(--green);color:#fff}
.vx-onb-passos li[data-estado="atual"]{color:var(--ink)}
.vx-onb-passos li[data-estado="atual"] .vx-onb-passo-n{background:var(--brand);border-color:var(--brand);color:#fff;box-shadow:var(--ring)}
.vx-onb-passos button{appearance:none;background:none;border:0;padding:0;font:inherit;color:inherit;display:flex;align-items:center;gap:7px;cursor:pointer;min-height:44px}
.vx-onb-passos button:focus-visible{outline:none;box-shadow:var(--ring);border-radius:8px}
.vx-onb-corpo{width:100%;max-width:1200px;margin:0 auto;padding:36px 20px 56px;flex:1}
.vx-onb-duas{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:48px;align-items:start}
.vx-onb-eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--brand)}
.vx-onb-hero h1{font-size:34px;line-height:1.15;margin:10px 0 14px}
.vx-onb-hero>p{font-size:16px;line-height:1.6;color:var(--muted);margin:0;max-width:480px}
.vx-onb-proximos{list-style:none;margin:26px 0 0;padding:0;display:grid;gap:10px}
.vx-onb-proximos li{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:600;color:var(--ink-2)}
.vx-onb-proximos li span{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--brand-50);color:var(--brand);font-size:12.5px;font-weight:700;flex:none}
.vx-onb-card{background:var(--surface);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);border:1px solid var(--glass-border);border-radius:var(--radius-lg);box-shadow:var(--glass-shadow);padding:28px}
.vx-onb-card-titulo{font-size:22px;margin:0 0 6px}
.vx-onb-card-apoio{font-size:14px;line-height:1.6;margin:0 0 20px}
.vx-onb-campo{margin-bottom:16px}
.vx-onb .vx-input,.vx-onb-campo .vx-input,.vx-senha .vx-input{min-height:48px}
.vx-onb-btn{min-height:48px;margin-top:10px}
.vx-btn-primary.vx-onb-btn{min-height:52px;font-size:15px}
.vx-onb-dica{font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.5}
.vx-onb-erro{font-size:13px;color:var(--red);background:var(--red-50);border:1px solid var(--red-100);border-radius:var(--radius-sm);padding:9px 12px;margin:4px 0 8px;line-height:1.5}
.vx-onb-campo .vx-onb-erro{background:none;border:0;padding:0;margin:6px 0 0}
.vx-onb-ok{font-size:13px;color:var(--green-700);background:var(--green-50);border:1px solid var(--green-100);border-radius:var(--radius-sm);padding:9px 12px;margin:4px 0 8px}
.vx-onb-aviso{font-size:13px;color:var(--ink-2);background:var(--brand-50);border:1px solid var(--brand-100);border-radius:var(--radius-sm);padding:10px 12px;margin:0 0 16px;line-height:1.5}
.vx-input[aria-invalid="true"]{border-color:var(--red)}
.vx-onb-termos{font-size:12.5px;color:var(--muted);text-align:center;margin:14px 0 0;line-height:1.5}
.vx-onb-link{appearance:none;background:none;border:0;padding:0;font:inherit;color:var(--brand-600);text-decoration:underline;cursor:pointer}
.vx-onb-link:focus-visible{outline:none;box-shadow:var(--ring);border-radius:4px}
.vx-onb-icone{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--brand-50);color:var(--brand);margin-bottom:14px}
.vx-onb-acoes{display:flex;gap:10px;justify-content:space-between;margin-top:22px;flex-wrap:wrap}
.vx-onb-acoes .vx-btn{min-height:48px;min-width:140px}
.vx-onb-acoes .vx-btn-primary{min-height:52px}
.vx-onb-estado{padding:40px 20px;text-align:center;color:var(--muted)}
.vx-onb-titulo{font-size:30px;line-height:1.2;margin:8px 0 8px}
.vx-onb-opcional{font-weight:500;color:var(--muted)}
.vx-onb-perfil{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:32px;align-items:start}
.vx-onb-secao{margin-bottom:16px}
.vx-onb-secao h2,.vx-onb-lateral h2{font-size:18px;margin:0 0 16px}
.vx-onb-secao textarea.vx-input{min-height:104px;resize:vertical;line-height:1.5}
.vx-onb-lateral{position:sticky;top:20px}
.vx-onb-lateral p{font-size:14px;line-height:1.6;margin:0}
.vx-onb-lateral ul{margin:8px 0 0;padding-left:18px;font-size:14px;color:var(--ink-2);line-height:1.9}
.vx-onb-logo{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.vx-onb-logo-previa{width:72px;height:72px;border-radius:var(--radius-md);border:1px dashed var(--border-strong);background:var(--surface-1);display:grid;place-items:center;color:var(--muted);overflow:hidden;flex:none}
.vx-onb-logo-previa img{max-width:100%;max-height:100%;object-fit:contain}
.vx-onb-moeda{position:relative}
.vx-onb-moeda>span{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--muted);font-weight:600;pointer-events:none}
.vx-onb-moeda .vx-input{padding-left:42px}
.vx-onb-permissoes{border:0;padding:0;margin:0}
.vx-onb-permissoes label{display:flex;align-items:center;gap:10px;min-height:44px;font-size:14px;cursor:pointer}
.vx-onb-permissoes input{width:18px;height:18px;accent-color:var(--brand);flex:none}
.vx-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.vx-onb-grade-envio{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.vx-onb-envio{display:flex;flex-direction:column;gap:12px}
.vx-onb-envio-topo{display:flex;gap:12px;align-items:center}
.vx-onb-envio-topo .vx-onb-icone{margin:0;flex:none}
.vx-onb-envio h2{font-size:17px;margin:0}
.vx-onb-envio-topo .vx-onb-dica{margin-top:2px}
.vx-onb-soltar{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:18px;border:1.5px dashed var(--border-strong);border-radius:var(--radius-md);background:var(--surface-1);color:var(--muted);font-size:14px}
.vx-onb-soltar[data-ativo="1"]{border-color:var(--brand);background:var(--brand-50);color:var(--brand-600)}
.vx-onb-arquivos{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.vx-onb-arquivos li{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13.5px;min-height:44px}
.vx-onb-arquivos li[data-erro="1"]{border-color:var(--red-100);background:var(--red-50)}
.vx-onb-arquivo-nome{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)}
.vx-onb-arquivos progress{flex:0 0 120px;height:8px;accent-color:var(--brand)}
.vx-onb-erro-inline{font-size:12.5px;color:var(--red);flex-basis:100%}
.vx-onb-linha{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;position:relative}
.vx-onb-linha>.vx-input{flex:1;min-width:180px}
.vx-onb-tres{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.vx-onb-dois{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.vx-onb-ia{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:20px;align-items:start}
.vx-onb-palco{text-align:center;padding:36px 28px;min-height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.vx-onb-palco .vx-onb-card-apoio{max-width:440px}
.vx-onb-anim{position:relative;width:96px;height:96px;margin-bottom:22px}
.vx-onb-anim span{position:absolute;inset:0;border-radius:50%;border:3px solid var(--brand-100)}
.vx-onb-anim span:nth-child(1){border-top-color:var(--brand);animation:vxgira 1.1s linear infinite}
.vx-onb-anim span:nth-child(2){inset:16px;border-right-color:var(--indigo);animation:vxgira 1.6s linear infinite reverse}
.vx-onb-anim span:nth-child(3){inset:34px;background:var(--brand-50);border-color:transparent;animation:vxpulsa 1.4s ease-in-out infinite}
.vx-onb-anim-script span:nth-child(3){background:var(--indigo-50)}
.vx-onb-anim-funil span:nth-child(1){border-radius:30%}
.vx-onb-anim-followups span:nth-child(2){border-radius:30%}
.vx-onb-anim-pronta span,.vx-onb-anim-falhou span{animation:none}
.vx-onb-anim-pronta span:nth-child(1){border-color:var(--green)}
.vx-onb-anim-pronta span:nth-child(3){background:var(--green-50)}
.vx-onb-anim-falhou span:nth-child(1){border-color:var(--red)}
.vx-onb-anim-falhou span:nth-child(3){background:var(--red-50)}
@keyframes vxgira{to{transform:rotate(360deg)}}
@keyframes vxpulsa{50%{transform:scale(.8);opacity:.6}}
.vx-onb-fases{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.vx-onb-fases li{display:flex;gap:10px;align-items:flex-start;color:var(--muted)}
.vx-onb-fases li b{display:block;font-size:14px;color:inherit}
.vx-onb-fases li small{display:block;font-size:12.5px;line-height:1.5;margin-top:2px}
.vx-onb-fase-marca{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--border-strong);display:grid;place-items:center;flex:none;margin-top:1px}
.vx-onb-fases li[data-estado="concluida"]{color:var(--green-700)}
.vx-onb-fases li[data-estado="concluida"] .vx-onb-fase-marca{background:var(--green);border-color:var(--green);color:#fff}
.vx-onb-fases li[data-estado="atual"]{color:var(--ink)}
.vx-onb-fases li[data-estado="atual"] .vx-onb-fase-marca{border-color:var(--brand);box-shadow:var(--ring);background:var(--brand-50)}
.vx-onb-fases li[data-estado="falhou"]{color:var(--red)}
.vx-onb-fases li[data-estado="falhou"] .vx-onb-fase-marca{border-color:var(--red);background:var(--red-50)}
.vx-onb-badge-ok{background:var(--green-50);color:var(--green-700)}
.vx-onb-secao[data-aprovado="1"]{border-color:var(--green-100)}
.vx-onb-partes{margin:0;display:grid;gap:12px}
.vx-onb-partes dt{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.vx-onb-partes dd{margin:4px 0 0;font-size:14.5px;line-height:1.6;white-space:pre-wrap}
.vx-onb-followups{margin:0;padding-left:20px;display:grid;gap:12px}
.vx-onb-followups b{font-size:13px;color:var(--brand-600)}
.vx-onb-followups p{margin:4px 0 0;font-size:14.5px;line-height:1.6;white-space:pre-wrap}
.vx-onb-aviso code,.vx-onb-partes code{font-family:'IBM Plex Mono',monospace;font-size:12.5px}
.vx-onb-barra{position:sticky;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 16px;margin-top:16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-pop)}
.vx-onb-barra .vx-btn{min-height:48px}
.vx-onb-plano{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,420px);gap:24px;align-items:start}
.vx-onb-planos{border:0;padding:0;margin:0;display:grid;gap:12px}
.vx-onb-opcao{display:flex;gap:12px;align-items:flex-start;cursor:pointer;padding:18px}
.vx-onb-opcao[data-on="1"]{border-color:var(--brand);box-shadow:var(--ring)}
.vx-onb-opcao input{width:20px;height:20px;margin-top:3px;accent-color:var(--brand);flex:none}
.vx-onb-opcao b{font-size:17px;display:block}
.vx-onb-opcao ul{margin:8px 0 0;padding-left:18px;font-size:13.5px;color:var(--ink-2);line-height:1.7}
.vx-onb-preco{display:block;font-size:20px;font-weight:700;margin-top:2px}
.vx-onb-preco small{font-size:13px;font-weight:500;color:var(--muted)}
.vx-onb-resumo{margin:16px 0 4px;padding:12px 14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--radius-sm);display:grid;gap:8px;font-size:14px}
.vx-onb-resumo div{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.vx-onb-resumo dt{color:var(--muted)}
.vx-onb-resumo dd{margin:0;font-weight:600;text-align:right}
.vx-onb-pix{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:16px;border:1px solid var(--brand-100);background:var(--brand-50);border-radius:var(--radius-md)}
.vx-onb-pix p{margin:0;font-size:14px}
.vx-onb-selos{list-style:none;margin:0 0 18px;padding:0;display:flex;gap:8px;flex-wrap:wrap}
.vx-onb-selos li{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:600;padding:5px 10px;border-radius:var(--radius-pill);background:var(--green-50);color:var(--green-700)}
.vx-onb-estrategias,.vx-onb-requisitos{list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:14px}
.vx-onb-estrategias li{display:flex;flex-direction:column}
.vx-onb-requisitos li{display:flex;gap:8px;align-items:center;color:var(--red)}
.vx-onb-requisitos li[data-ok="1"]{color:var(--green-700)}
.vx-onb-requisitos li span{color:var(--ink)}
.vx-senha{position:relative}
.vx-senha .vx-input{padding-right:52px}
.vx-senha-olho{position:absolute;right:2px;top:50%;transform:translateY(-50%);width:44px;height:44px;display:grid;place-items:center;background:none;border:0;border-radius:var(--radius-sm);color:var(--muted);cursor:pointer}
.vx-senha-olho:hover{color:var(--ink)}
.vx-senha-olho:focus-visible{outline:none;box-shadow:var(--ring)}
@media(max-width:900px){
  .vx-onb-duas{grid-template-columns:1fr;gap:26px}
  .vx-onb-hero h1{font-size:27px}
  .vx-onb-proximos{display:none}
  .vx-onb-perfil{grid-template-columns:1fr}
  .vx-onb-lateral{position:static}
  .vx-onb-ia,.vx-onb-plano{grid-template-columns:1fr}
  .vx-onb-tres{grid-template-columns:1fr}
}
@media(max-width:640px){
  .vx-onb-topo-inner{display:grid;grid-template-columns:1fr auto;align-items:center;gap:0 10px;padding:4px 16px 8px}
  .vx-onb-topo-inner>nav{grid-column:1/-1;order:3}
  .vx-onb-corpo{padding:22px 16px 40px}
  .vx-onb-card{padding:20px}
  .vx-onb-passos li[data-estado="pendente"] .vx-onb-passo-txt,.vx-onb-passos li[data-estado="concluida"] .vx-onb-passo-txt{display:none}
  .vx-onb-passos li+li::before{width:8px}
  .vx-onb-grade-envio{grid-template-columns:1fr}
  .vx-onb-dois{grid-template-columns:1fr}
  .vx-onb-barra{position:static}
}
@media (prefers-reduced-motion:reduce){.vx-onb *{transition:none!important;animation:none!important}}

/* ── BarraProgresso animada — Trilha Neon (Atualização 1) ────────────────
   Fundo navy, linha gradiente ciano, anel pulsante no nó atual.
   Variáveis usadas: --navy, --sky, --sky-600, --sky-700.
   Topo do onboarding vira duas linhas: logo/sair + barra de progresso. */
@keyframes vx-prog-pulse{0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,.6),0 0 14px 2px rgba(56,189,248,.2)}50%{box-shadow:0 0 0 6px rgba(56,189,248,0),0 0 22px 6px rgba(56,189,248,.15)}}
@keyframes vx-prog-sfin{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}

.vx-prog{background:var(--navy);width:100%}
.vx-prog-inner{max-width:1200px;margin:0 auto;padding:14px 20px 12px}

/* desktop (padrão) */
.vx-prog-mob{display:none}
.vx-prog-desktop{display:block}

/* trilha dos nós */
.vx-prog-track{display:flex;justify-content:space-between;align-items:flex-start;position:relative;padding:0 17px}
.vx-prog-linha-bg{position:absolute;left:17px;right:17px;top:17px;height:2px;background:rgba(255,255,255,.1);border-radius:2px}
.vx-prog-linha-fill{position:absolute;left:17px;top:17px;height:2px;background:linear-gradient(90deg,var(--sky-700) 0%,var(--sky) 100%);border-radius:2px;transition:width .55s cubic-bezier(.4,0,.2,1);box-shadow:0 0 8px rgba(56,189,248,.45)}

/* nó */
.vx-prog-no{display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;z-index:2}
.vx-prog-circulo{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1.5px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);font-size:12.5px;font-weight:700;color:rgba(255,255,255,.35);flex:none;transition:border-color .3s,background .3s,color .3s,box-shadow .3s;font-family:'Space Grotesk',sans-serif}
.vx-prog-no[data-estado="concluida"] .vx-prog-circulo{background:var(--sky-600);border-color:var(--sky-600);color:#fff;box-shadow:0 0 10px rgba(14,165,233,.4)}
.vx-prog-no[data-estado="atual"] .vx-prog-circulo{background:var(--sky);border-color:var(--sky);color:var(--navy);animation:vx-prog-pulse 2s ease-in-out infinite;box-shadow:0 0 0 4px rgba(56,189,248,.15),0 0 18px rgba(56,189,248,.35)}
.vx-prog-circulo button{appearance:none;border:0;padding:0;margin:0;background:transparent;font:inherit;color:inherit;cursor:pointer;width:34px;height:34px;border-radius:50%;display:grid;place-items:center}
.vx-prog-circulo button:focus-visible{outline:2px solid var(--sky);outline-offset:3px;border-radius:50%}
.vx-prog-circulo span{display:grid;place-items:center;width:34px;height:34px}
.vx-prog-rotulo{font-size:10px;font-weight:600;color:rgba(255,255,255,.35);white-space:nowrap;letter-spacing:.03em;text-align:center;transition:color .3s;max-width:80px;overflow:hidden;text-overflow:ellipsis}
.vx-prog-no[data-estado="concluida"] .vx-prog-rotulo{color:rgba(255,255,255,.55)}
.vx-prog-no[data-estado="atual"] .vx-prog-rotulo{color:#fff;font-weight:700}

/* subfases IA */
.vx-prog-subfases{display:flex;gap:8px;margin-top:10px;padding:0 17px;flex-wrap:wrap}
.vx-prog-subfase{font-size:9.5px;font-weight:600;letter-spacing:.04em;padding:3px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.3);background:rgba(255,255,255,.03);animation:vx-prog-sfin .3s ease both;transition:border-color .25s,color .25s,background .25s}
.vx-prog-subfase[data-estado="atual"]{border-color:var(--sky);color:var(--sky);background:rgba(56,189,248,.1)}
.vx-prog-subfase[data-estado="concluida"]{border-color:rgba(14,165,233,.5);color:rgba(255,255,255,.65);background:rgba(14,165,233,.12)}

/* mobile */
@media(max-width:680px){
  .vx-prog-desktop{display:none}
  .vx-prog-mob{display:flex;align-items:center;gap:12px}
}
.vx-prog-mob-circulo{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--sky);color:var(--navy);font-weight:700;font-size:15px;font-family:'Space Grotesk',sans-serif;flex:none;box-shadow:0 0 14px rgba(56,189,248,.5);animation:vx-prog-pulse 2s ease-in-out infinite}
.vx-prog-mob-info{flex:1;min-width:0}
.vx-prog-mob-rotulo{font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vx-prog-mob-sub{font-size:11px;color:rgba(255,255,255,.45);margin-top:2px}
.vx-prog-mob-pct{height:3px;background:rgba(255,255,255,.1);border-radius:99px;margin-top:7px;overflow:hidden}
.vx-prog-mob-fill{height:100%;background:linear-gradient(90deg,var(--sky-700),var(--sky));border-radius:99px;transition:width .55s cubic-bezier(.4,0,.2,1)}

@media(max-width:640px){.vx-onb-topo-inner{grid-template-columns:auto 1fr auto;padding:6px 14px}}

@media(prefers-reduced-motion:reduce){.vx-prog *{transition:none!important;animation:none!important}}

@keyframes spin{to{transform:rotate(360deg)}}

/* ── Icon container monocromático (substitui fundos coloridos) ──────── */
.vx-icon-box{display:flex;align-items:center;justify-content:center;
  width:36px;height:36px;border-radius:10px;
  background:var(--surface-2);border:1px solid var(--border);
  color:var(--icon-primary);flex-shrink:0}
.vx-icon-box-sm{width:28px;height:28px;border-radius:8px;font-size:12px}
.vx-icon-box-brand{background:var(--brand-50);border-color:var(--brand-100);color:var(--brand)}

/* ── Fallback: reduced transparency ────────────────────────────────────── */
@media(prefers-reduced-transparency:reduce){
  .vx-app{--surface:var(--surface-solid);--surface-1:var(--surface-solid);--glass-border:var(--border)}
  .vx-card,.vx-stat,.vx-btn,.vx-input,.vx-chip,.vx-seg,.vx-sheet,.vx-bottomnav,.vx-sidebar,.vx-empresa-card,.vx-prof-grid>.vx-prof-card,.vx-notice,.vx-onb-card,.vx-glass-card{backdrop-filter:none;-webkit-backdrop-filter:none}
  .vx-sidebar{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--surface-solid)}
}


/* Minha Conta: componentes compartilhados entre Empresa e Profissional. */
.vx-account{max-width:1120px;margin:0 auto;min-width:0;color:var(--ink)}
.vx-account-heading h1{font-size:30px;letter-spacing:-.6px;margin:0 0 6px}
.vx-account-heading p{font-size:14px;color:var(--muted);margin:0 0 24px}
.vx-account-identity{display:flex;align-items:center;gap:16px;padding:20px 0 24px;border-bottom:1px solid var(--border);margin-bottom:24px;min-width:0}
.vx-account-avatar{width:60px;height:60px;object-fit:cover;border-radius:50%;flex-shrink:0;background:var(--surface-2);display:grid;place-items:center;font-size:24px;color:var(--brand)}
.vx-account-identity>div{flex:1;min-width:0}.vx-account-identity strong,.vx-account-identity span:not(.vx-account-avatar){display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vx-account-identity strong{font-size:18px}.vx-account-identity span,.vx-account-identity small{color:var(--muted);font-size:13px}.vx-account-identity small{display:block;margin-top:4px}
.vx-account-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;align-items:start}
.vx-account-group{min-width:0;border:1px solid var(--border);border-radius:14px;background:var(--surface);overflow:hidden}
.vx-account-group h2{font-size:16px;margin:0;padding:18px 16px 10px}
.vx-account-item{display:flex;align-items:center;gap:12px;width:100%;padding:16px;text-align:left;background:transparent;border:0;border-bottom:1px solid var(--border);color:var(--ink);cursor:pointer;font:inherit;min-height:58px;min-width:0}
.vx-account-item:last-child{border-bottom:0}.vx-account-item>svg{flex-shrink:0;color:var(--muted)}.vx-account-item>span{flex:1;min-width:0}.vx-account-item strong{display:block;font-size:14px;font-weight:600}.vx-account-item small{display:block;font-size:12px;line-height:1.5;color:var(--muted);margin-top:3px;overflow-wrap:anywhere}
.vx-account-item:hover,.vx-account-menu button:hover{background:var(--surface-2)}
.vx-account :is(button,input,select,textarea,a):focus-visible,.vx-sidebar-account button:focus-visible{outline:2px solid var(--brand);outline-offset:3px}
.vx-account-logout{color:var(--red);border:1px solid var(--border);border-radius:14px;background:var(--surface)}
.vx-account-plan{padding:0 16px 18px}.vx-account-plan h2{padding-left:0}.vx-account-plan>.vx-chip{margin-left:8px}.vx-account-plan p{font-size:13px;color:var(--muted)}
.vx-account-section{min-width:0}.vx-account-section>h2{font-size:22px;margin:20px 0}.vx-account-form{display:grid;gap:18px;max-width:560px}.vx-account-form label,.vx-account-email{display:grid;gap:8px;font-size:14px}.vx-account-form .vx-btn{justify-self:start;min-height:44px}.vx-account-email{max-width:560px;margin-bottom:20px}.vx-account :is(input,textarea,select){max-width:100%;min-width:0}.vx-account .vx-grid{min-width:0}.vx-account-notification{border-bottom:1px solid var(--border);padding:16px 0;overflow-wrap:anywhere}.vx-account-notification p{font-size:14px}.vx-account-notification .vx-chip{margin-left:8px}
.vx-sidebar-account{position:relative;margin:8px 10px}.vx-account-trigger{display:flex;align-items:center;gap:10px;width:100%;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink);padding:10px;cursor:pointer;text-align:left;min-height:60px}.vx-account-trigger>img,.vx-account-initial{width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0}.vx-account-initial{display:grid;place-items:center;background:var(--surface-2);color:var(--brand)}.vx-account-trigger>span:not(.vx-account-initial){flex:1;min-width:0}.vx-account-trigger strong{display:block;font-size:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.vx-account-trigger small{display:block;font-size:12px;color:var(--muted);margin-top:4px}
.vx-account-menu{position:absolute;bottom:calc(100% + 8px);left:0;right:0;z-index:60;padding:6px;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-pop);max-height:calc(100dvh - 120px);overflow-y:auto}.vx-account-menu button{display:flex;gap:10px;align-items:center;width:100%;min-height:44px;background:none;border:0;padding:10px;color:var(--ink);text-align:left;font-size:13px;cursor:pointer;border-radius:8px}
/* ── Glass workspace ──────────────────────────────────────────────────────
   Material de vidro em toda a plataforma: fundo ambiente com luz difusa,
   painéis translúcidos com reflexo na borda superior, trilho lateral e
   conteúdo flutuando como cartões arredondados, dock flutuante no celular. */
.vx-app{position:relative;isolation:isolate;
  --glass-edge:inset 0 1px 0 rgba(255,255,255,.90),inset 0 0 0 1px rgba(255,255,255,.45);
  --glass-lift:0 12px 30px -16px rgba(23,37,84,.28),0 2px 8px -4px rgba(23,37,84,.10);
  --glass-lift-hover:0 18px 44px -18px rgba(23,37,84,.34),0 3px 10px -4px rgba(23,37,84,.12);
  --glass-panel:rgba(255,255,255,.86)}
html.dark .vx-app{--glass-edge:inset 0 1px 0 rgba(255,255,255,.12),inset 0 0 0 1px rgba(255,255,255,.06);
  --glass-lift:0 14px 34px -16px rgba(0,0,0,.55),0 2px 8px -4px rgba(0,0,0,.4);
  --glass-lift-hover:0 20px 48px -18px rgba(0,0,0,.6),0 3px 10px -4px rgba(0,0,0,.45);
  --glass-panel:rgba(20,22,28,.52)}
/* Painel de vidro reutilizável — aplique em qualquer card inline para trazê-lo
   ao mesmo material dos primitivos (translúcido, luz na borda, sombra suave). */
.vx-glass-panel{background:var(--glass);backdrop-filter:var(--glass-blur-strong);-webkit-backdrop-filter:var(--glass-blur-strong);
  border:0;border-radius:18px;box-shadow:var(--glass-edge),var(--glass-lift)}
/* Fundo ambiente com cor de verdade: é o que faz o vidro translúcido "aparecer"
   em tema claro — sem isso, painel branco sobre fundo branco fica invisível. */
.vx-app::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(1000px 620px at 6% -10%,rgba(59,130,246,.18),transparent 60%),
    radial-gradient(880px 560px at 102% 10%,rgba(37,99,235,.15),transparent 60%),
    radial-gradient(820px 560px at 50% 120%,rgba(14,165,233,.14),transparent 62%)}
html.dark .vx-app::before{background:
    radial-gradient(1000px 620px at 6% -10%,rgba(37,99,235,.24),transparent 60%),
    radial-gradient(860px 560px at 102% 12%,rgba(99,102,241,.20),transparent 60%),
    radial-gradient(820px 560px at 50% 116%,rgba(14,165,233,.12),transparent 60%)}
/* Cards como tiles de vidro elevados: sem borda dura, luz no topo, sombra que
   levanta do fundo, cantos arredondados. */
.vx-card,.vx-stat,.vx-account-group,.vx-onb-card,.vx-empresa-card,.vx-glass-card,.vx-prof-grid>.vx-prof-card,.vx-sheet,.vx-context-menu,.vx-account-menu,.vx-account-trigger,.vx-account-logout{
  border:0!important;box-shadow:var(--glass-edge),var(--glass-lift)!important}
.vx-card,.vx-stat,.vx-account-group,.vx-onb-card,.vx-empresa-card,.vx-account-trigger,.vx-account-logout,.vx-context-menu,.vx-account-menu{
  background:var(--glass)!important;backdrop-filter:var(--glass-blur-strong);-webkit-backdrop-filter:var(--glass-blur-strong)}
.vx-stat{border-radius:18px}
.vx-card:hover,.vx-stat:hover{box-shadow:var(--glass-edge),var(--glass-lift-hover)!important;transform:translateY(-2px)}
.vx-content>*{animation:vxin .32s cubic-bezier(.22,.9,.32,1) both}

/* ── Linguagem interna da referência (glass dashboard) ───────────────────
   Padrões reutilizáveis para o CONTEÚDO dos blocos, iguais aos .gw-* da
   referência: cabeçalho de painel discreto, tiles de métrica com número leve,
   e linhas de lista com ícone em tile. Use em qualquer página. */
.vx-ph{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px;color:var(--muted);font-size:12px}
.vx-ph-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;letter-spacing:-.02em;color:var(--ink)}
.vx-ph-title>svg{color:var(--icon-secondary);opacity:.7;flex:none}
.vx-ph-link{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--brand);background:none;border:0;cursor:pointer;padding:0;white-space:nowrap}
.vx-ph-link:hover{color:var(--brand-600)}
.vx-tile{display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:16px;min-width:0}
.vx-tile-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;color:var(--muted);font-size:12px;font-weight:500}
.vx-tile-top>svg{opacity:.6;flex:none;color:var(--icon-secondary)}
.vx-tile-val{font-size:27px;font-weight:500;letter-spacing:-.04em;color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
.vx-tile-sub{font-size:11.5px;color:var(--muted)}
.vx-lrow{display:flex;align-items:center;gap:11px;padding:11px 0;border-top:1px solid var(--border);min-width:0}
.vx-lrow:first-child{border-top:0;padding-top:0}
.vx-lrow:last-child{padding-bottom:0}
.vx-lrow-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--surface-2);color:var(--icon-secondary);flex:none}
.vx-lrow-main{flex:1;min-width:0;display:flex;flex-direction:column}
.vx-lrow-main b{font-size:12.5px;font-weight:500;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vx-lrow-main span{font-size:10.5px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vx-lrow-val{font-size:12.5px;font-weight:500;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap;flex:none}
.vx-lrow-sub{font-size:10.5px;color:var(--muted);flex:none;white-space:nowrap}

/* ═══ Versão SOL — White Editorial Blue ════════════════════════════════════
   Redesign premium SaaS: fundo branco, azul #318CE7 estratégico, tipografia
   editorial (títulos General Sans, números em serifa Bodoni Moda), sidebar
   compacta #FAFAFA integrada, bordas finas 1px, cantos 8–12px, sem sombras
   pesadas nem gradientes de fundo. Tudo escopado em [data-versao="sol"]. */
html[data-versao="sol"] .vx-app{
  --brand:#318CE7;--brand-600:#2676CC;--brand-50:#EAF4FF;--brand-100:#EAF4FF;--brand-200:#D4E8FB;
  --bg:#FFFFFF;--surface:#FFFFFF;--surface-solid:#FFFFFF;--surface-1:#FFFFFF;--surface-2:#FAFAFA;--surface-3:#F3F4F6;
  --ink:#171717;--ink-2:#333333;--muted:#666666;--muted-2:#888888;
  --border:#EAEAEA;--border-strong:#E0E0E0;--glass-border:#EAEAEA;
  --glass:#FFFFFF;--glass-strong:#FFFFFF;--glass-panel:#FFFFFF;
  --icon-primary:#333333;--icon-secondary:#666666;--icon-brand:#318CE7;
  --radius-lg:12px;--radius-md:10px;--radius-sm:8px;
  background:#FAFAFA;
  font-family:'General Sans','Inter',system-ui,-apple-system,sans-serif;
  letter-spacing:normal;font-variant-numeric:normal;}
html[data-versao="sol"] .vx-app::before{display:none}

/* Layout integrado: sidebar branca colada, conteúdo sobre fundo cinza claro */
html[data-versao="sol"] .vx-body{padding:0!important;gap:0!important}
@media(min-width:900px){html[data-versao="sol"] .vx-body{grid-template-columns:240px minmax(0,1fr)!important}}
html[data-versao="sol"] .vx-sidebar{background:#FFFFFF!important;border:0!important;border-right:1px solid #EAEAEA!important;
  border-radius:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
  top:0!important;height:100vh!important}
html[data-versao="sol"] .vx-sidebar::before{display:none}
html[data-versao="sol"] .vx-content{background:#FAFAFA!important;border:0!important;border-radius:0!important;
  box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;min-height:100vh}

/* Itens da sidebar */
html[data-versao="sol"] .vx-sidebtn{min-height:44px;font-size:15px;font-weight:500;border-radius:8px;gap:11px;color:#444}
html[data-versao="sol"] .vx-sidebtn:hover{background:#F2F8FF;color:#171717}
html[data-versao="sol"] .vx-sidebtn[data-on="1"]{background:#EAF4FF;color:#318CE7;font-weight:500}
html[data-versao="sol"] .vx-sidebtn[data-on="1"]::before{display:none}
html[data-versao="sol"] .vx-sidebtn[data-on="1"]>svg{color:#318CE7}
html[data-versao="sol"] .vx-sidebar-logo{border-bottom:none}

/* Cards: branco, borda fina 1px, cantos 10px, sem sombra, sem lift */
html[data-versao="sol"] .vx-card,
html[data-versao="sol"] .vx-stat,
html[data-versao="sol"] .vx-glass-panel,
html[data-versao="sol"] .vx-account-group,
html[data-versao="sol"] .vx-account-trigger{
  background:#FFFFFF!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
  border:1px solid #EAEAEA!important;border-radius:10px!important;box-shadow:none!important}
html[data-versao="sol"] .vx-card:hover,
html[data-versao="sol"] .vx-stat:hover{transform:none!important;border-color:#318CE7!important;box-shadow:none!important}
html[data-versao="sol"] .vx-tile{padding:18px 20px}

/* Tipografia: títulos editoriais General Sans */
html[data-versao="sol"] .vx-disp,
html[data-versao="sol"] .vx-page-head h1{font-family:'General Sans',sans-serif;font-weight:600;letter-spacing:-.02em;color:#171717}
html[data-versao="sol"] .vx-page-head h1{font-size:24px;line-height:1.2}
html[data-versao="sol"] .vx-ph-title{font-family:'General Sans',sans-serif;font-weight:600;font-size:18px;letter-spacing:-.01em;color:#171717}
html[data-versao="sol"] .vx-ph-title>svg{color:#888;opacity:1}

/* Rótulos de indicador: General Sans, caixa alta, discreto */
html[data-versao="sol"] .vx-tile-top{text-transform:uppercase;letter-spacing:.04em;font-size:12px;font-weight:500;color:#666}
html[data-versao="sol"] .vx-tile-top>svg{opacity:1;color:#888}

/* Números dos indicadores (em TODAS as páginas da Sol): sans geométrica
   tecnológica larga (Michroma), encorpada e um pouco menor. Cobre os tiles da
   Visão Geral (.vx-tile-val) e o componente de stat compartilhado (.vx-stat-val)
   usado nas demais telas. */
html[data-versao="sol"] .vx-tile-val,
html[data-versao="sol"] .vx-stat-val,
html[data-versao="sol"] .vx-num,
html[data-versao="sol"] .vx-balance-value{font-family:'Michroma','General Sans',sans-serif!important;font-weight:700!important;font-size:26px!important;
  letter-spacing:-.01em!important;color:#171717;line-height:1.1;font-variant-numeric:lining-nums tabular-nums;
  -webkit-text-stroke:.35px #171717}
@media(max-width:1024px){html[data-versao="sol"] .vx-tile-val,html[data-versao="sol"] .vx-stat-val,html[data-versao="sol"] .vx-num,html[data-versao="sol"] .vx-balance-value{font-size:24px!important}}
@media(max-width:640px){html[data-versao="sol"] .vx-tile-val,html[data-versao="sol"] .vx-stat-val,html[data-versao="sol"] .vx-num,html[data-versao="sol"] .vx-balance-value{font-size:22px!important}}
/* Números do card de orçamento (Insights): mesma fonte dos indicadores do sistema, não monoespaçada */
html[data-versao="sol"] .vx-budget-value strong,
html[data-versao="sol"] .vx-budget-facts b{font-family:'Michroma','General Sans',sans-serif!important}
/* Valores de moeda (preços de plano): Michroma é larga; tamanho menor p/ caber */
html[data-versao="sol"] .vx-plan-price{font-family:'Michroma','General Sans',sans-serif!important;font-weight:700;font-size:19px;letter-spacing:-.03em;color:#171717}
html[data-versao="sol"] .vx-plan-price small{font-family:'General Sans',sans-serif;font-size:11px}
/* Números dos mini-cards de métricas (ex.: perfil do profissional): fonte do sistema */
html[data-versao="sol"] .vx-scenario>strong{font-family:'Michroma','General Sans',sans-serif;font-variant-numeric:lining-nums tabular-nums}

/* Azul estratégico: botões, links, ativos */
html[data-versao="sol"] .vx-btn-primary{background:#318CE7!important;border:1px solid #318CE7!important;border-radius:8px!important;
  box-shadow:none!important;color:#fff!important}
html[data-versao="sol"] .vx-btn-primary:hover{background:#2676CC!important;border-color:#2676CC!important;filter:none}
html[data-versao="sol"] .vx-btn{border-radius:8px}
html[data-versao="sol"] .vx-input{border-radius:8px;background:#fff}
html[data-versao="sol"] .vx-ph-link,html[data-versao="sol"] .vx-positive{color:#318CE7}
html[data-versao="sol"] .vx-navbtn[data-on="1"]{color:#318CE7}
html[data-versao="sol"] .vx-badge-brand{background:#EAF4FF;color:#318CE7}
html[data-versao="sol"] .vx-meter-fill{background:#318CE7}
html[data-versao="sol"] .vx-lrow-icon,html[data-versao="sol"] .vx-stat-icon{border-radius:8px}

/* Sol: sem círculos — pills, badges, tabs, segmentos e avatares viram
   retangulares (cantos 8px), padrão em todas as páginas. O spinner continua
   redondo por ser funcional. */
html[data-versao="sol"] .vx-chip,
html[data-versao="sol"] .vx-badge,
html[data-versao="sol"] .vx-beta-badge,
html[data-versao="sol"] .vx-beta-login-badge,
html[data-versao="sol"] .vx-chrome-badge,
html[data-versao="sol"] .vx-campaign-status,
html[data-versao="sol"] .vx-plan-ribbon,
html[data-versao="sol"] .vx-tab,
html[data-versao="sol"] .vx-seg,
html[data-versao="sol"] .vx-seg button,
html[data-versao="sol"] .vx-campaign-filters button,
html[data-versao="sol"] .vx-campaign-filters button span,
html[data-versao="sol"] .vx-professional-filters button,
html[data-versao="sol"] .vx-steps span,
html[data-versao="sol"] .vx-prog-subfase,
html[data-versao="sol"] .vx-navdot,
html[data-versao="sol"] .vx-sidedot,
html[data-versao="sol"] .vx-dock,
html[data-versao="sol"] .vx-navbtn{border-radius:8px!important}
/* Avatares e círculos de ícone → quadrado arredondado */
html[data-versao="sol"] .vx-account-avatar,
html[data-versao="sol"] .vx-account-initial,
html[data-versao="sol"] .vx-account-trigger>img,
html[data-versao="sol"] .vx-avatar,
html[data-versao="sol"] .vx-team-person i,
html[data-versao="sol"] .vx-onb-icone,
html[data-versao="sol"] .vx-onb-passo-n,
html[data-versao="sol"] .vx-prof-card__img,
html[data-versao="sol"] .vx-conv-avatar{border-radius:8px!important}
@media(min-width:900px){
  .vx-body{grid-template-columns:228px minmax(0,1fr);gap:16px;padding:16px}
  .vx-sidebar{top:16px;height:calc(100vh - 32px);border-radius:23px;border:1px solid var(--glass-border);border-right:1px solid var(--glass-border);
    overflow:hidden;box-shadow:var(--glass-edge),var(--glass-shadow)}
  html.dark .vx-sidebar{border-right:1px solid var(--glass-border);box-shadow:var(--glass-edge),var(--glass-shadow)}
  .vx-sidebar-logo{border-bottom-color:var(--glass-border-subtle)}
  .vx-content{min-height:calc(100vh - 32px);background:var(--glass-panel);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);
    border:1px solid var(--glass-border);border-radius:27px;box-shadow:var(--glass-edge),var(--glass-shadow);padding:30px 32px 48px}
  .vx-content-chat,.vx-content-settings{border-radius:27px;overflow:hidden}
}
@media(max-width:899px){
  .vx-bottomnav{left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom,0px));padding:6px;gap:2px;border-radius:30px;
    border:1px solid var(--glass-border);background:var(--glass-strong);box-shadow:var(--glass-edge),var(--shadow-pop);min-height:0}
  .vx-navbtn{min-height:54px;border-radius:24px;padding:8px 2px 7px;transition:background .2s,color .2s}
  .vx-navbtn[data-on="1"]{background:var(--brand-50)}
  .vx-navbar-indicator{display:none}
}
@supports not (backdrop-filter:blur(1px)){.vx-content,.vx-stat,.vx-account-group{background:var(--surface-solid)}}
@media(prefers-reduced-transparency:reduce){.vx-content,.vx-stat,.vx-account-group,.vx-context-menu,.vx-account-menu{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--surface-solid)}}
@media(prefers-reduced-motion:reduce){.vx-content>*{animation:none}}

@media(max-width:899px){.vx-bottomnav{background:var(--surface);min-height:calc(64px + env(safe-area-inset-bottom,0px))}.vx-navbtn{min-height:64px}.vx-navbtn span{font-size:10px}.vx-account-grid{grid-template-columns:1fr;gap:20px}.vx-account-heading h1{font-size:24px}.vx-account-avatar{width:52px;height:52px}.vx-account-identity{gap:12px;flex-wrap:wrap}.vx-account-identity>div{flex-basis:calc(100% - 64px)}.vx-account-identity>.vx-btn{margin-left:64px;min-height:44px}.vx-content-settings .vx-account{padding:20px 16px calc(100px + env(safe-area-inset-bottom,0px))}.vx-account-section .vx-card{max-width:100%}.vx-account-form{width:100%}.vx-account-section>div>nav{max-width:100%}}

/* ───────────────────────── LUA: a versão do Sol, porém escura (black) ─────────────────────────
   Acende com data-dark="1" por cima do data-versao="sol". Redefine a paleta
   (variáveis) e sobrescreve as poucas cores fixas que o Sol trava com !important. */
html[data-dark="1"][data-versao="sol"] .vx-app{
  --brand:#4D9FFF;--brand-600:#2E86E0;--brand-50:#16263C;--brand-100:#16263C;--brand-200:#22395A;
  --bg:#0E1014;--surface:#171A21;--surface-solid:#171A21;--surface-1:#171A21;--surface-2:#1B1F27;--surface-3:#232833;
  --ink:#ECEEF2;--ink-2:#C6CBD3;--muted:#969CA6;--muted-2:#6E747E;--text-2:#C6CBD3;
  --border:#272B34;--border-strong:#343A45;--glass-border:#272B34;
  --glass:#171A21;--glass-strong:#171A21;--glass-panel:#171A21;
  --icon-primary:#C6CBD3;--icon-secondary:#969CA6;--icon-brand:#4D9FFF;
  --red:#F87171;--red-50:#3A1E1E;--amber:#FBBF24;--indigo:#9AA6FF;
  --surface-solid:#171A21;
  background:#0E1014!important;color:#ECEEF2}
html[data-dark="1"][data-versao="sol"] body{color:#ECEEF2}
html[data-dark="1"][data-versao="sol"] .vx-sidebar{background:#15181E!important;border-right:1px solid #262A33!important}
html[data-dark="1"][data-versao="sol"] .vx-content{background:#0E1014!important}
html[data-dark="1"][data-versao="sol"] .vx-sidebar-logo img{filter:brightness(0) invert(1)}
html[data-dark="1"][data-versao="sol"] .vx-sidebtn{color:#B8BDC6}
html[data-dark="1"][data-versao="sol"] .vx-sidebtn:hover{background:#1C2430;color:#ECEEF2}
html[data-dark="1"][data-versao="sol"] .vx-sidebtn[data-on="1"]{background:#16263C;color:#4D9FFF}
html[data-dark="1"][data-versao="sol"] .vx-sidebtn[data-on="1"]>svg{color:#4D9FFF}
html[data-dark="1"][data-versao="sol"] .vx-card,
html[data-dark="1"][data-versao="sol"] .vx-stat,
html[data-dark="1"][data-versao="sol"] .vx-glass-panel,
html[data-dark="1"][data-versao="sol"] .vx-account-group,
html[data-dark="1"][data-versao="sol"] .vx-account-trigger{background:#171A21!important;border:1px solid #272B34!important}
html[data-dark="1"][data-versao="sol"] .vx-card:hover,
html[data-dark="1"][data-versao="sol"] .vx-stat:hover{border-color:#4D9FFF!important}
html[data-dark="1"][data-versao="sol"] .vx-disp,
html[data-dark="1"][data-versao="sol"] .vx-page-head h1,
html[data-dark="1"][data-versao="sol"] .vx-ph-title{color:#ECEEF2!important}
html[data-dark="1"][data-versao="sol"] .vx-tile-val,
html[data-dark="1"][data-versao="sol"] .vx-stat-val,
html[data-dark="1"][data-versao="sol"] .vx-num,
html[data-dark="1"][data-versao="sol"] .vx-balance-value{color:#ECEEF2!important;-webkit-text-stroke:.35px #ECEEF2}
html[data-dark="1"][data-versao="sol"] .vx-plan-price{color:#ECEEF2}
html[data-dark="1"][data-versao="sol"] .vx-input{background:#1B1F27;color:#ECEEF2;border-color:#2B303A}
html[data-dark="1"][data-versao="sol"] .vx-input::placeholder{color:#6E747E}
html[data-dark="1"][data-versao="sol"] select.vx-input option{background:#171A21;color:#ECEEF2}
html[data-dark="1"][data-versao="sol"] .vx-badge-brand{background:#16263C;color:#4D9FFF}
html[data-dark="1"][data-versao="sol"] .vx-btn-primary{background:#4D9FFF!important;border-color:#4D9FFF!important;color:#0A0C10!important}
html[data-dark="1"][data-versao="sol"] .vx-btn-primary:hover{background:#2E86E0!important;border-color:#2E86E0!important}
html[data-dark="1"][data-versao="sol"] .vx-ph-link,
html[data-dark="1"][data-versao="sol"] .vx-positive,
html[data-dark="1"][data-versao="sol"] .vx-navbtn[data-on="1"]{color:#4D9FFF}
html[data-dark="1"][data-versao="sol"] .vx-meter-fill{background:#4D9FFF}
/* Cards de profissional (e outros "glass"): o box-shadow tinha realces brancos
   internos que, no escuro, pareciam bordas brancas. Troca por borda escura limpa. */
html[data-dark="1"][data-versao="sol"] .vx-prof-card,
html[data-dark="1"][data-versao="sol"] .vx-empresa-card,
html[data-dark="1"][data-versao="sol"] .vx-onb-card,
html[data-dark="1"][data-versao="sol"] .vx-glass-card{background:#171A21!important;border:1px solid #272B34!important;box-shadow:none!important}
html[data-dark="1"][data-versao="sol"] .vx-prof-card:hover{border-color:#4D9FFF!important;box-shadow:0 8px 24px -12px rgba(0,0,0,.55)!important}
`;

