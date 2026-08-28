export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
*{box-sizing:border-box}

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
.vx-topbar-inner{width:100%;max-width:1240px;margin:0 auto;padding:0 18px;display:flex;align-items:center;justify-content:space-between;gap:10px}
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
.vx-content{padding:24px 16px 104px;max-width:820px;margin:0 auto}
.vx-bottomnav{position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--topbar-bg,rgba(255,255,255,.96));backdrop-filter:blur(14px);
  border-top:1px solid var(--border);display:flex}
.vx-navbtn{flex:1;background:none;border:0;font:inherit;padding:10px 4px 13px;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--muted-2);position:relative;transition:color .16s}
.vx-navbtn[data-on="1"]{color:var(--brand)}
.vx-navbtn span{font-size:11px;font-weight:600}
.vx-navdot{position:absolute;top:5px;right:calc(50% - 16px);min-width:15px;height:15px;padding:0 3px;border-radius:999px;
  background:var(--red);color:#fff;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center}

@media (min-width:900px){
  .vx-content{padding:30px 30px 56px;max-width:none}
  .vx-body{display:grid;grid-template-columns:236px 1fr}
  .vx-sidebar{display:flex;flex-direction:column;gap:3px;padding:22px 14px;border-right:1px solid var(--border);
    position:sticky;top:60px;height:calc(100vh - 60px);align-self:start}
  .vx-bottomnav{display:none}
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
.vx-sep{height:1px;background:var(--border);border:0;margin:15px 0}
.vx-fade{animation:vxin .26s cubic-bezier(.22,.9,.32,1)}
@keyframes vxin{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.vx-fade{animation:none}}
.vx-grid{display:grid;gap:13px}
.vx-g2{grid-template-columns:1fr}
.vx-g4{grid-template-columns:repeat(2,1fr)}
@media(min-width:620px){.vx-g2{grid-template-columns:1fr 1fr}.vx-g4{grid-template-columns:repeat(4,1fr)}}

/* stat cards */
.vx-stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;box-shadow:var(--shadow-card);
  position:relative;overflow:hidden}
.vx-stat::after{content:"";position:absolute;inset:0 0 auto 0;height:1px;
  background:linear-gradient(90deg,transparent,var(--brand-100),transparent);opacity:.8}
.vx-stat-icon{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
.vx-stat-val{font-family:'Space Grotesk';font-weight:700;font-size:23px;letter-spacing:-.02em}

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
`;
