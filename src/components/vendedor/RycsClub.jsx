import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trophy, Target, Lock, Check, ChevronRight, Sparkles, Image as ImageIcon,
  GraduationCap, ClipboardList, UserRound, Rocket, Gift, Star, Medal, Clock,
} from "lucide-react";
import { api } from "../../lib/api.js";
import { FAIXAS, CATEGORIAS } from "../../../shared/gamificacao.js";

const AZUL = "#318CE7"; // White Editorial — azul institucional

// Para onde cada missão/categoria leva dentro da plataforma.
const DESTINO = { perfil: "perfil", avaliacoes: "testes", academy: "academy", performance: "oportunidades", ganhos: "oportunidades" };
const ICONE_CAT = { perfil: UserRound, avaliacoes: ClipboardList, academy: GraduationCap, performance: Rocket, ganhos: Trophy };

const nfmt = (n) => new Intl.NumberFormat("pt-BR").format(Math.round(Number(n) || 0));

// ── Átomos ────────────────────────────────────────────────────────────────────
function Eyebrow({ children }) {
  return <div className="vx-eyebrow" style={{ marginBottom: 10 }}>{children}</div>;
}

function Barra({ pct, cor = AZUL, alt = 8 }) {
  return (
    <div style={{ height: alt, borderRadius: 999, background: "#EEF2F7", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: cor, borderRadius: 999, transition: "width .5s cubic-bezier(.22,1,.36,1)" }} />
    </div>
  );
}

function PlaceholderImg({ label, alt = 120, radius = 14 }) {
  return (
    <div style={{
      height: alt, borderRadius: radius, border: "1px dashed #D7DEE8", background: "#F7F9FC",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "#9AA6B4", textAlign: "center", padding: 8,
    }}>
      <ImageIcon size={Math.min(28, alt / 3)} strokeWidth={1.6} />
      {label && <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>}
    </div>
  );
}

// ── Banner ───────────────────────────────────────────────────────────────────
function Banner({ nivel, imagens }) {
  const img = imagens?.banner;
  return (
    <div className="vx-card" style={{ padding: 0, overflow: "hidden", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 0, border: "1px solid var(--border)" }}>
      <div style={{ padding: "26px 26px 24px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999, background: "#EAF4FF", color: AZUL, fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
          <Trophy size={14} /> Jornada
        </div>
        <h1 className="vx-disp" style={{ fontSize: 26, lineHeight: 1.15, margin: "0 0 10px", letterSpacing: -0.5 }}>Sua evolução merece reconhecimento.</h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.5, maxWidth: 460 }}>
          Complete missões, alcance novos níveis e desbloqueie conquistas e recompensas exclusivas na RYCS.
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 9, marginTop: 18, padding: "8px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)" }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: nivel.cor + "1A", color: nivel.cor }}>
            <Medal size={17} />
          </span>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Seu nível</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{nivel.nome} · {nfmt(nivel.xp)} XP</div>
          </div>
        </div>
      </div>
      <div style={{ padding: 16, display: "flex" }}>
        {img
          ? <img src={img} alt="RYCS Club" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, minHeight: 160 }} />
          : <div style={{ width: "100%" }}><PlaceholderImg label="Imagem do RYCS Club" alt={176} /></div>}
      </div>
    </div>
  );
}

// ── Nível + jornada ────────────────────────────────────────────────────────────
function NivelResumo({ nivel }) {
  return (
    <div className="vx-card" style={{ padding: 22 }}>
      <Eyebrow>Seu nível</Eyebrow>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <span style={{ width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center", background: nivel.cor + "1A", color: nivel.cor, flexShrink: 0 }}>
          <Medal size={28} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: -0.4 }}>{nivel.nome}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Nível {nivel.numero} de {FAIXAS.length} · {nfmt(nivel.xp)} XP</div>
        </div>
      </div>
      <Barra pct={nivel.progresso} cor={nivel.cor} alt={9} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 12, color: "var(--muted)" }}>
        <span>{nfmt(nivel.xp)} XP</span>
        {nivel.proximo
          ? <span>Faltam <b style={{ color: "var(--ink)" }}>{nfmt(nivel.faltam)} XP</b> para {nivel.proximo.nome}</span>
          : <span>Nível máximo alcançado 🎉</span>}
      </div>
    </div>
  );
}

function Jornada({ nivel, imagens }) {
  return (
    <div className="vx-card" style={{ padding: 22 }}>
      <Eyebrow>Jornada de níveis</Eyebrow>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "thin" }}>
        {FAIXAS.map((f, i) => {
          const atingido = nivel.numero >= i + 1;
          const atual = nivel.numero === i + 1;
          const img = imagens?.[`nivel:${f.chave}`];
          return (
            <div key={f.chave} style={{
              flex: "0 0 112px", textAlign: "center", padding: "14px 10px", borderRadius: 14,
              border: `1.5px solid ${atual ? f.cor : "var(--border)"}`, background: atual ? f.cor + "0F" : "var(--surface)",
              opacity: atingido ? 1 : 0.65,
            }}>
              <div style={{ width: 56, height: 56, margin: "0 auto 8px", borderRadius: 12, display: "grid", placeItems: "center", background: f.cor + "1A", color: f.cor, position: "relative", overflow: "hidden" }}>
                {img ? <img src={img} alt={f.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : atingido ? <Medal size={28} /> : <Lock size={22} />}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: atingido ? "var(--ink)" : "var(--muted)" }}>{f.nome}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{nfmt(f.min)} XP</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Missões ────────────────────────────────────────────────────────────────────
function MissaoCard({ m, onIr }) {
  const Ic = ICONE_CAT[m.categoria] || Target;
  const pct = m.progresso?.pct || 0;
  const comecou = pct > 0;
  return (
    <div className="vx-card" style={{ padding: 16, display: "flex", gap: 13, alignItems: "flex-start" }}>
      <span style={{ width: 40, height: 40, borderRadius: 11, display: "grid", placeItems: "center", background: "#EAF4FF", color: AZUL, flexShrink: 0 }}><Ic size={20} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>{m.nome}</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: AZUL, whiteSpace: "nowrap" }}>+{m.xp} XP</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 10px", lineHeight: 1.45 }}>{m.descricao}</div>
        {m.progresso?.alvo > 1 && (
          <div style={{ marginBottom: 10 }}>
            <Barra pct={pct} alt={6} />
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{nfmt(m.progresso.atual)} / {nfmt(m.progresso.alvo)}</div>
          </div>
        )}
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => onIr(m.destino || DESTINO[m.categoria])} style={{ gap: 6 }}>
          {comecou ? "Continuar" : "Começar"} <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Conquistas ─────────────────────────────────────────────────────────────────
function ConquistaCard({ c, imagens }) {
  const img = imagens?.[`medalha:${c.id}`];
  const pct = c.progresso?.pct || 0;
  return (
    <div className="vx-card" style={{ padding: 16, textAlign: "center", position: "relative", opacity: c.desbloqueada ? 1 : 0.92 }}>
      {c.desbloqueada && (
        <span style={{ position: "absolute", top: 10, right: 10, color: "#16A34A" }}><Check size={16} strokeWidth={3} /></span>
      )}
      <div style={{
        width: 72, height: 72, margin: "2px auto 12px", borderRadius: 16, display: "grid", placeItems: "center", overflow: "hidden",
        background: c.desbloqueada ? "#EAF4FF" : "#F1F4F8", color: c.desbloqueada ? AZUL : "#AAB4C0",
        filter: c.desbloqueada ? "none" : "grayscale(1)",
      }}>
        {img ? <img src={img} alt={c.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : c.desbloqueada ? <Medal size={34} /> : <Lock size={26} />}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{c.nome}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 10px", lineHeight: 1.4, minHeight: 32 }}>{c.descricao}</div>
      {c.desbloqueada
        ? <div style={{ fontSize: 11.5, fontWeight: 600, color: "#16A34A" }}>Conquistada{c.conquistadoEm ? ` · ${new Date(c.conquistadoEm).toLocaleDateString("pt-BR")}` : ""}</div>
        : c.progresso?.alvo > 1
          ? <div><Barra pct={pct} alt={6} /><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{nfmt(c.progresso.atual)} / {nfmt(c.progresso.alvo)}</div></div>
          : <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{c.xp > 0 ? `Recompensa: +${c.xp} XP` : "Bloqueada"}</div>}
    </div>
  );
}

// ── Prêmios ────────────────────────────────────────────────────────────────────
function PremioCard({ p, onResgatar }) {
  const { requisito, elegivel, resgate } = p;
  return (
    <div className="vx-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ aspectRatio: "16 / 10", background: "#F7F9FC" }}>
        {p.imagem ? <img src={p.imagem} alt={p.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <PlaceholderImg label="Imagem do prêmio" alt={180} radius={0} />}
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: p.tipo === "digital" ? "#7C3AED" : "#B06E3B", background: (p.tipo === "digital" ? "#7C3AED" : "#B06E3B") + "14", padding: "3px 8px", borderRadius: 999 }}>
            {p.tipo === "digital" ? "Digital" : "Físico"}
          </span>
          {elegivel && !resgate && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#16A34A", background: "#16A34A14", padding: "3px 8px", borderRadius: 999 }}>Desbloqueado</span>}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", letterSpacing: -0.3 }}>{p.nome}</div>
        <div style={{ fontSize: 13, color: "var(--muted)", margin: "5px 0 14px", lineHeight: 1.5, flex: 1 }}>{p.descricao}</div>
        {requisito?.alvo > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)", marginBottom: 5 }}>
              <span>{requisito.label}</span><span>{nfmt(requisito.atual)} / {nfmt(requisito.alvo)}</span>
            </div>
            <Barra pct={requisito.pct} cor={elegivel ? "#16A34A" : AZUL} alt={7} />
          </div>
        )}
        {resgate
          ? <div className="vx-btn vx-btn-block" style={{ cursor: "default", gap: 7, color: "var(--muted)" }}><Clock size={15} /> Resgate {resgate.estado}</div>
          : <button className="vx-btn vx-btn-block" disabled={!elegivel} onClick={() => onResgatar(p)}
              style={elegivel ? { background: AZUL, color: "#fff", borderColor: AZUL } : {}}>
              {elegivel ? <><Gift size={15} /> Resgatar prêmio</> : <><Lock size={14} /> Bloqueado</>}
            </button>}
      </div>
    </div>
  );
}

// ── Modal de nova conquista ─────────────────────────────────────────────────────
function ModalConquista({ c, imagens, onFechar }) {
  const img = imagens?.[`medalha:${c.id}`];
  return (
    <div className="vx-overlay" onClick={onFechar} style={{ zIndex: 1200 }}>
      <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380, textAlign: "center", padding: "34px 28px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: AZUL, marginBottom: 14 }}>Nova conquista desbloqueada!</div>
        <div style={{ width: 96, height: 96, margin: "0 auto 16px", borderRadius: 22, display: "grid", placeItems: "center", background: "#EAF4FF", color: AZUL, overflow: "hidden" }}>
          {img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Medal size={48} />}
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: "var(--ink)" }}>{c.nome}</div>
        <div style={{ fontSize: 13.5, color: "var(--muted)", margin: "6px 0 8px", lineHeight: 1.5 }}>{c.descricao}</div>
        {c.xp > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: AZUL, marginBottom: 18 }}>+{c.xp} XP</div>}
        <button className="vx-btn vx-btn-primary vx-btn-block" onClick={onFechar}>Continuar</button>
      </div>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────────
export default function RycsClub({ db, aviso, recarregar, setAba }) {
  const [tab, setTab] = useState("visao");
  const [dados, setDados] = useState({ imagens: {}, premios: [] });
  const [carregando, setCarregando] = useState(true);
  const [novaConquista, setNovaConquista] = useState(null);

  const g = db.gamificacao || { xp: 0, nivel: { nome: "Starter", numero: 1, cor: "#5B6B7F", progresso: 0, proximo: null, faltam: 0, xp: 0 }, conquistas: [], resumo: { conquistadas: 0, total: 0 }, missoes: [], metricas: {} };

  const carregar = () => api("/club").then((r) => { if (r && !r.error) setDados(r); }).finally(() => setCarregando(false));
  useEffect(() => { carregar(); }, []);

  // Missões = conquistas ainda não desbloqueadas (com recompensa), ordenadas por
  // progresso. O servidor já valida tudo; aqui é só apresentação.
  const missoes = useMemo(() => (g.conquistas || [])
    .filter((c) => !c.desbloqueada && c.xp > 0)
    .sort((a, b) => (b.progresso?.pct || 0) - (a.progresso?.pct || 0))
    .map((c) => ({ ...c, destino: DESTINO[c.categoria] })), [g.conquistas]);

  // Modal "nova conquista": mostra uma vez por conquista (guardado no navegador),
  // respeitando preferências de movimento reduzido via CSS do modal.
  useEffect(() => {
    try {
      const vistos = JSON.parse(localStorage.getItem("rycs-club-vistos") || "[]");
      const novas = (g.conquistas || []).filter((c) => c.desbloqueada && !vistos.includes(c.id));
      if (novas.length && vistos.length) setNovaConquista(novas[0]); // não dispara no primeiro carregamento histórico
      if (novas.length) localStorage.setItem("rycs-club-vistos", JSON.stringify([...new Set([...vistos, ...(g.conquistas || []).filter((c) => c.desbloqueada).map((c) => c.id)])]));
    } catch { /* localStorage indisponível */ }
  }, [g.conquistas]);

  const irPara = (destino) => setAba?.(destino || "painel");

  const resgatar = async (p) => {
    let endereco;
    if (p.tipo === "fisico") {
      endereco = window.prompt("Endereço de entrega (rua, número, cidade, estado, CEP):");
      if (endereco === null) return;
    }
    const r = await api(`/club/premios/${p.id}/resgatar`, { endereco });
    if (r?.error) return aviso(r.error);
    aviso("Resgate solicitado! Acompanhe o andamento aqui.");
    carregar();
    recarregar?.();
  };

  const conquistasPorCat = useMemo(() => {
    const out = {};
    for (const c of g.conquistas || []) (out[c.categoria] = out[c.categoria] || []).push(c);
    return out;
  }, [g.conquistas]);

  const jornadaEventos = useMemo(() => (g.conquistas || [])
    .filter((c) => c.desbloqueada && c.conquistadoEm)
    .sort((a, b) => b.conquistadoEm - a.conquistadoEm)
    .slice(0, 8), [g.conquistas]);

  const TABS = [["visao", "Visão geral"], ["missoes", "Missões"], ["conquistas", "Conquistas"], ["premios", "Prêmios"]];

  return (
    <div className="vx-fade" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Banner nivel={g.nivel} imagens={dados.imagens} />

      <div className="vx-seg vx-subnav" style={{ margin: 0 }}>
        {TABS.map(([k, label]) => (
          <button key={k} data-on={tab === k ? "1" : undefined} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "visao" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14 }}>
            <NivelResumo nivel={g.nivel} />
            <div className="vx-card" style={{ padding: 22 }}>
              <Eyebrow>Resumo</Eyebrow>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[["Conquistas", `${g.resumo?.conquistadas || 0}/${g.resumo?.total || 0}`, Trophy], ["XP total", nfmt(g.xp), Sparkles], ["Nível", g.nivel.nome, Medal], ["Missões ativas", nfmt(missoes.length), Target]].map(([t, v, Ic]) => (
                  <div key={t} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "14px 14px" }}>
                    <Ic size={16} color={AZUL} />
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", letterSpacing: -0.5, marginTop: 6 }}>{v}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{t}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Jornada nivel={g.nivel} imagens={dados.imagens} />

          {missoes.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Eyebrow>Missões em destaque</Eyebrow>
                <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setTab("missoes")}>Ver todas <ChevronRight size={14} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 14 }}>
                {missoes.slice(0, 4).map((m) => <MissaoCard key={m.id} m={m} onIr={irPara} />)}
              </div>
            </div>
          )}

          {jornadaEventos.length > 0 && (
            <div className="vx-card" style={{ padding: 22 }}>
              <Eyebrow>Minha jornada</Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {jornadaEventos.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: "#EAF4FF", color: AZUL, flexShrink: 0 }}><Medal size={16} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{c.nome}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Conquista desbloqueada</div>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(c.conquistadoEm).toLocaleDateString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "missoes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: "0 0 2px", color: "var(--muted)", fontSize: 13.5 }}>Complete desafios e avance na sua jornada profissional.</p>
          {missoes.length === 0
            ? <div className="vx-card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}><Trophy size={26} color={AZUL} /><div style={{ marginTop: 10, fontWeight: 600, color: "var(--ink)" }}>Você concluiu todas as missões disponíveis!</div><div style={{ fontSize: 13, marginTop: 4 }}>Novas missões aparecem conforme a plataforma evolui.</div></div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 14 }}>
                {missoes.map((m) => <MissaoCard key={m.id} m={m} onIr={irPara} />)}
              </div>}
        </div>
      )}

      {tab === "conquistas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13.5 }}>{g.resumo?.conquistadas || 0} de {g.resumo?.total || 0} conquistas desbloqueadas.</p>
          {Object.entries(CATEGORIAS).filter(([cat]) => conquistasPorCat[cat]?.length).map(([cat, label]) => (
            <div key={cat}>
              <Eyebrow>{label}</Eyebrow>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 190px), 1fr))", gap: 14 }}>
                {conquistasPorCat[cat].map((c) => <ConquistaCard key={c.id} c={c} imagens={dados.imagens} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "premios" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: "0 0 2px", color: "var(--muted)", fontSize: 13.5 }}>Suas conquistas podem levar você ainda mais longe.</p>
          {carregando
            ? <div className="vx-card vx-skeleton" style={{ height: 240 }} />
            : dados.premios.length === 0
              ? <div className="vx-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  <Gift size={30} color={AZUL} />
                  <div style={{ marginTop: 12, fontWeight: 700, color: "var(--ink)", fontSize: 15 }}>Prêmios em breve</div>
                  <div style={{ fontSize: 13, marginTop: 6, maxWidth: 420, marginInline: "auto", lineHeight: 1.5 }}>As recompensas do RYCS Club estão sendo preparadas. Continue completando missões — os prêmios aparecem aqui assim que forem publicados.</div>
                </div>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
                  {dados.premios.map((p) => <PremioCard key={p.id} p={p} onResgatar={resgatar} />)}
                </div>}
        </div>
      )}

      {novaConquista && <ModalConquista c={novaConquista} imagens={dados.imagens} onFechar={() => setNovaConquista(null)} />}
    </div>
  );
}
