export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
*{box-sizing:border-box}
.vx-app{
  --bg:#F6F7F9; --surface:#FFFFFF; --surface-2:#F1F2F5; --border:#E4E7EC; --border-strong:#D0D5DD;
  --ink:#101828; --ink-2:#344054; --muted:#667085; --muted-2:#98A2B3;
  --brand:#0F766E; --brand-600:#0D9488; --brand-50:#EFFCFA; --brand-100:#CCFBF1;
  --amber:#B45309; --amber-50:#FFFBEB; --amber-100:#FEF3C7;
  --red:#B42318; --red-50:#FEF3F2; --red-100:#FEE4E2;
  --indigo:#3730A1; --indigo-50:#EEF2FF; --indigo-100:#E0E7FF;
  --radius-lg:16px; --radius-md:12px; --radius-sm:9px; --radius-pill:999px;
  --shadow-card:0 1px 2px rgba(16,24,40,.04),0 1px 3px rgba(16,24,40,.06);
  --shadow-pop:0 8px 24px -6px rgba(16,24,40,.18);
  min-height:100vh;background:var(--bg);color:var(--ink);
  font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14.5px;line-height:1.5;
}
.vx-disp{font-family:'Space Grotesk','Inter',sans-serif;font-weight:600;letter-spacing:-.01em}
.vx-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.vx-eyebrow{font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}

/* topbar */
.vx-topbar{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);
  border-bottom:1px solid var(--border);height:58px;display:flex;align-items:center}
.vx-topbar-inner{width:100%;max-width:1180px;margin:0 auto;padding:0 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.vx-mark{width:28px;height:28px;border-radius:8px;background:var(--brand);display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 1px 2px rgba(15,118,110,.35)}
.vx-word{font-size:17px;color:var(--ink);display:flex;align-items:center;gap:8px;white-space:nowrap;flex:none}
.vx-seg{display:inline-flex;background:var(--surface-2);border-radius:var(--radius-pill);padding:3px;gap:2px;overflow-x:auto;scrollbar-width:none}
.vx-seg::-webkit-scrollbar{display:none}
.vx-seg button{border:0;background:transparent;padding:7px 12px;border-radius:var(--radius-pill);font:inherit;font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;white-space:nowrap;transition:.15s}
.vx-seg button[data-on="1"]{background:var(--surface);color:var(--ink);box-shadow:var(--shadow-card)}
@media (max-width:480px){
  .vx-word{font-size:14px;gap:6px}
  .vx-mark{width:23px;height:23px;border-radius:7px}
  .vx-topbar-inner{gap:6px;padding:0 10px}
  .vx-seg button{padding:6px 8px;font-size:10.5px}
}

/* shell: sidebar (desktop) + bottom nav (mobile) */
.vx-body{max-width:1180px;margin:0 auto;display:block}
.vx-sidebar{display:none}
.vx-content{padding:22px 16px 100px;max-width:760px;margin:0 auto}
.vx-bottomnav{position:fixed;left:0;right:0;bottom:0;z-index:30;background:rgba(255,255,255,.97);backdrop-filter:blur(10px);
  border-top:1px solid var(--border);display:flex}
.vx-navbtn{flex:1;background:none;border:0;font:inherit;padding:9px 4px 12px;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--muted-2);position:relative}
.vx-navbtn[data-on="1"]{color:var(--brand)}
.vx-navbtn span{font-size:11px;font-weight:600}
.vx-navdot{position:absolute;top:4px;right:calc(50% - 16px);min-width:15px;height:15px;padding:0 3px;border-radius:999px;
  background:var(--red);color:#fff;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center}

@media (min-width:900px){
  .vx-content{padding:28px 28px 48px;max-width:none}
  .vx-body{display:grid;grid-template-columns:220px 1fr}
  .vx-sidebar{display:flex;flex-direction:column;gap:2px;padding:20px 12px;border-right:1px solid var(--border);
    position:sticky;top:58px;height:calc(100vh - 58px);align-self:start}
  .vx-bottomnav{display:none}
  .vx-sidebtn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--radius-sm);border:0;
    background:none;font:inherit;font-size:13.5px;font-weight:600;color:var(--ink-2);cursor:pointer;text-align:left;position:relative}
  .vx-sidebtn:hover{background:var(--surface-2)}
  .vx-sidebtn[data-on="1"]{background:var(--brand-50);color:var(--brand)}
  .vx-sidedot{margin-left:auto;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:var(--red);
    color:#fff;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center}
}

/* primitives */
.vx-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-card)}
.vx-btn{appearance:none;border:1px solid var(--border-strong);background:var(--surface);color:var(--ink);font:inherit;
  font-weight:600;font-size:13.5px;padding:10px 15px;border-radius:var(--radius-sm);cursor:pointer;transition:.15s;
  display:inline-flex;align-items:center;gap:7px;justify-content:center}
.vx-btn:hover{background:var(--surface-2)}
.vx-btn:disabled{opacity:.45;cursor:not-allowed}
.vx-btn-primary{background:var(--brand);border-color:var(--brand);color:#fff}
.vx-btn-primary:hover{background:var(--brand-600);border-color:var(--brand-600)}
.vx-btn-danger{border-color:var(--red-100);color:var(--red);background:var(--surface)}
.vx-btn-danger:hover{background:var(--red-50)}
.vx-btn-ghost{border-color:transparent;background:transparent;color:var(--muted)}
.vx-btn-ghost:hover{background:var(--surface-2)}
.vx-btn-sm{padding:7px 11px;font-size:12.5px;border-radius:8px}
.vx-btn-block{width:100%}
.vx-input{width:100%;background:var(--surface);border:1px solid var(--border-strong);color:var(--ink);font:inherit;
  font-size:14px;padding:10px 12px;border-radius:var(--radius-sm)}
.vx-input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-100)}
.vx-label{display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin:0 0 6px}
.vx-badge{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:4px 9px;border-radius:var(--radius-pill)}
.vx-badge-brand{background:var(--brand-100);color:var(--brand)}
.vx-badge-amber{background:var(--amber-100);color:var(--amber)}
.vx-badge-red{background:var(--red-100);color:var(--red)}
.vx-badge-indigo{background:var(--indigo-100);color:var(--indigo)}
.vx-badge-muted{background:var(--surface-2);color:var(--muted)}
.vx-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:5px 10px;border-radius:var(--radius-pill);
  background:var(--surface-2);color:var(--ink-2);border:1px solid var(--border)}
.vx-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.vx-mut{color:var(--muted)}
.vx-sep{height:1px;background:var(--border);border:0;margin:14px 0}
.vx-fade{animation:vxin .22s ease}
@keyframes vxin{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.vx-fade{animation:none}}
.vx-grid{display:grid;gap:12px}
.vx-g2{grid-template-columns:1fr}
.vx-g4{grid-template-columns:repeat(2,1fr)}
@media(min-width:620px){.vx-g2{grid-template-columns:1fr 1fr}.vx-g4{grid-template-columns:repeat(4,1fr)}}

/* stat cards */
.vx-stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;box-shadow:var(--shadow-card)}
.vx-stat-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:9px}
.vx-stat-val{font-family:'Space Grotesk';font-weight:700;font-size:22px;letter-spacing:-.01em}

/* meter */
.vx-meter-track{height:6px;background:var(--border);border-radius:999px;overflow:hidden}
.vx-meter-fill{height:100%;border-radius:999px;transition:width .5s cubic-bezier(.4,0,.2,1)}

/* segmented pill tabs */
.vx-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.vx-tabs::-webkit-scrollbar{display:none}
.vx-tab{white-space:nowrap;padding:8px 13px;border-radius:var(--radius-pill);border:1px solid var(--border);background:var(--surface);
  color:var(--muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.vx-tab[data-on="1"]{background:var(--ink);color:#fff;border-color:var(--ink)}

/* modal sheet */
.vx-overlay{position:fixed;inset:0;z-index:40;background:rgba(16,24,40,.45);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:640px){.vx-overlay{align-items:center}}
.vx-sheet{width:100%;max-width:560px;background:var(--surface);border-radius:18px 18px 0 0;padding:20px;max-height:88vh;overflow-y:auto;box-shadow:var(--shadow-pop)}
@media(min-width:640px){.vx-sheet{border-radius:18px}}
`;
