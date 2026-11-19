import { useState, useEffect, useMemo } from "react";
import {
  Copy, Share2, CheckCircle2, Clock, Building2, Users, ArrowRight, ChevronRight,
  Sparkles, TrendingUp, Trophy, Wallet, Filter,
} from "lucide-react";
import { api } from "../lib/api.js";
import { money, dataCurta } from "../lib/utils.js";
import { ROTAS } from "../lib/rotas.js";
import ParceriaCanal from "./ParceriaCanal.jsx";

const AZUL = "#318CE7";
const PAPEL = { empresa: "Empresa", vendedor: "Profissional" };
// Paleta das medalhas por posição na trilha (do iniciante ao topo).
const CORES_NIVEL = ["#8C97A3", "#B06E3B", "#C79A2B", "#318CE7", "#7C3AED"];

const prefersReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Animações suaves, respeitando movimento reduzido.
const estilos = `
.ind-wrap{max-width:900px}
.ind-hero{position:relative;overflow:hidden;border-radius:20px;border:1px solid ${AZUL}33;
  background:linear-gradient(135deg,#0F4C8A 0%,#2563EB 48%,#318CE7 100%);color:#fff}
.ind-hero-grid{display:grid;grid-template-columns:1.35fr .9fr;gap:8px}
@media(max-width:720px){.ind-hero-grid{grid-template-columns:1fr}}
.ind-slot{position:relative;border-radius:16px;overflow:hidden;background:
  radial-gradient(120% 120% at 70% 20%, rgba(255,255,255,.22), rgba(255,255,255,0) 60%),
  linear-gradient(160deg, rgba(255,255,255,.14), rgba(255,255,255,.04));
  border:1px solid rgba(255,255,255,.22);display:grid;place-items:center}
.ind-slot--claro{background:
  radial-gradient(120% 120% at 70% 20%, rgba(49,140,231,.14), rgba(49,140,231,0) 60%),
  linear-gradient(160deg, var(--surface-2), var(--surface));border:1px solid var(--border)}
.ind-slot img{width:100%;height:100%;object-fit:contain}
.ind-medal{transition:${prefersReduced ? "none" : "transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s"}}
.ind-medal:hover{transform:${prefersReduced ? "none" : "translateY(-3px)"}}
.ind-trilha{display:flex;gap:0;overflow-x:auto;padding:6px 2px 10px;scrollbar-width:thin}
.ind-bar{height:8px;border-radius:999px;background:rgba(255,255,255,.25);overflow:hidden}
.ind-bar>i{display:block;height:100%;border-radius:999px;background:#fff;transition:${prefersReduced ? "none" : "width .6s cubic-bezier(.22,1,.36,1)"}}
`;

// Placeholder de ilustração/medalha premium (gradiente + motivo discreto),
// pronto para receber a arte final via `src`. Nunca usa ícone Lucide ampliado
// como arte principal — o glifo é só uma marca d'água sutil.
function SlotArte({ src, alt = "", cor = AZUL, claro = false, children, style }) {
  return (
    <div className={"ind-slot" + (claro ? " ind-slot--claro" : "")} style={style}>
      {src ? <img src={src} alt={alt} /> : children}
    </div>
  );
}

// Medalhão de nível: anel colorido com brilho conforme o estado.
function Medalhao({ cor, estado, numero, src, nome }) {
  const conquistado = estado === "conquistado" || estado === "atual";
  const fundo = conquistado
    ? `radial-gradient(120% 120% at 30% 20%, #fff6, transparent 55%), conic-gradient(from 210deg, ${cor}, #ffffff55, ${cor})`
    : "linear-gradient(160deg, var(--surface-2), var(--surface))";
  return (
    <div className="ind-medal" style={{
      width: 62, height: 62, borderRadius: "50%", margin: "0 auto", display: "grid", placeItems: "center",
      background: fundo, border: `2px solid ${conquistado ? cor : "var(--border)"}`,
      boxShadow: estado === "atual" ? `0 0 0 4px ${cor}22, 0 6px 18px ${cor}44` : conquistado ? `0 4px 12px ${cor}33` : "none",
      filter: estado === "bloqueado" ? "grayscale(1) opacity(.55)" : "none", overflow: "hidden", position: "relative",
    }}>
      {src ? <img src={src} alt={nome} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
        : <span style={{ fontSize: 20, fontWeight: 800, color: conquistado ? "#fff" : "var(--muted-2)", textShadow: conquistado ? "0 1px 2px rgba(0,0,0,.25)" : "none" }}>{numero}</span>}
      {estado === "atual" && !prefersReduced && (
        <span style={{ position: "absolute", inset: -2, borderRadius: "50%", boxShadow: `0 0 14px ${cor}`, opacity: .5, pointerEvents: "none" }} />
      )}
    </div>
  );
}

export default function Indicacoes({ aviso }) {
  const [dados, setDados] = useState(null);
  const [afil, setAfil] = useState(null);
  const [canal, setCanal] = useState(null);
  const [fHist, setFHist] = useState("todas"); // todas | pagas | pendentes

  useEffect(() => {
    api("/referrals").then((r) => { if (r && !r.error) setDados(r); });
    api("/afiliados/resumo").then((r) => { if (r && !r.error) setAfil(r); });
    api("/parceiro-canal/resumo").then((r) => { if (r && !r.error) setCanal(r); });
  }, []);

  const copiar = async (texto, oque) => {
    try { await navigator.clipboard.writeText(texto); aviso(`${oque} copiado.`); }
    catch { aviso("Não foi possível copiar. Selecione e copie manualmente."); }
  };
  const compartilhar = async (titulo, texto, url, rotulo) => {
    if (navigator.share) { try { await navigator.share({ title: titulo, text: texto, url }); return; } catch { /* cancelado */ } }
    copiar(url, rotulo);
  };

  const irParaCompartilhar = () => document.getElementById("ind-compartilhar")?.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });

  const trilha = afil?.trilha || [];
  const atualIdx = trilha.findIndex((n) => n.atual);
  const nivelAtual = trilha[atualIdx] || trilha[0] || null;
  const proxNode = atualIdx >= 0 ? trilha[atualIdx + 1] : null;
  const pagantes = afil?.indicadores?.clientesPagantes ?? 0;
  const progresso = useMemo(() => {
    if (!nivelAtual || !proxNode) return 100;
    const faixa = proxNode.min - nivelAtual.min;
    return faixa > 0 ? Math.max(0, Math.min(100, Math.round(((pagantes - nivelAtual.min) / faixa) * 100))) : 100;
  }, [nivelAtual, proxNode, pagantes]);

  if (!dados) return <div className="vx-fade ind-wrap"><div className="vx-card vx-skeleton" style={{ height: 180 }} /></div>;

  const ind = afil?.indicadores;
  const link = `${window.location.origin}${ROTAS.cadastroVendedor}?ref=${dados.codigo}`;
  const linkEmpresa = `${window.location.origin}${ROTAS.onboarding}?ref=${dados.codigo}`;
  const indicaEmpresa = !!dados.recompensas?.empresa;
  const indicaProf = !!dados.recompensas?.vendedor;
  const pctAplicavel = ind?.percentualAtual ?? afil?.politicaVigente?.percentual;

  const indicacoesFiltradas = (dados.indicacoes || []).filter((i) => {
    const pago = i.status === "pago" || i.status === "qualificada";
    if (fHist === "pagas") return pago;
    if (fHist === "pendentes") return !pago;
    return true;
  });

  return (
    <div className="vx-fade ind-wrap">
      <style>{estilos}</style>

      {/* 1. Banner principal — Hero */}
      <div className="ind-hero" style={{ marginBottom: 18 }}>
        <div className="ind-hero-grid">
          <div style={{ padding: "26px 28px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,.16)", fontSize: 11.5, fontWeight: 600, letterSpacing: ".04em", marginBottom: 14 }}>
              <Trophy size={13} /> Programa de recompensas
            </div>
            <h1 className="vx-disp" style={{ fontSize: 30, lineHeight: 1.08, margin: "0 0 10px", letterSpacing: -0.8, color: "#fff" }}>Indique. Evolua. Ganhe.</h1>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "rgba(255,255,255,.9)", maxWidth: 440 }}>
              Compartilhe a RYCS, conquiste clientes e desbloqueie novas recompensas.
            </p>

            {afil && !canal?.ativo && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10.5, opacity: .8, textTransform: "uppercase", letterSpacing: ".06em" }}>Nível atual</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{nivelAtual?.nome || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, opacity: .8, textTransform: "uppercase", letterSpacing: ".06em" }}>Comissão aplicável</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{pctAplicavel}%</div>
                  </div>
                  {proxNode && (
                    <div>
                      <div style={{ fontSize: 10.5, opacity: .8, textTransform: "uppercase", letterSpacing: ".06em" }}>Próximo nível</div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{proxNode.nome}</div>
                    </div>
                  )}
                </div>
                {proxNode ? (
                  <>
                    <div className="ind-bar"><i style={{ width: `${progresso}%` }} /></div>
                    <div style={{ fontSize: 12, opacity: .9, marginTop: 6 }}>
                      Faltam <b>{afil.proximoNivel?.faltam ?? Math.max(0, proxNode.min - pagantes)}</b> cliente{(afil.proximoNivel?.faltam ?? 1) === 1 ? "" : "s"} pagante{(afil.proximoNivel?.faltam ?? 1) === 1 ? "" : "s"} para {proxNode.nome}.
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, opacity: .9 }}>Você alcançou o topo da jornada. Parabéns! 🏆</div>
                )}
              </div>
            )}

            <button className="vx-btn" style={{ marginTop: 20, background: "#fff", color: AZUL, border: "none", fontWeight: 700, gap: 7 }} onClick={irParaCompartilhar}>
              Começar a indicar <ArrowRight size={16} />
            </button>
          </div>

          {/* Direita — ilustração 3D (slot configurável) */}
          <div style={{ padding: 16, display: "flex" }}>
            <SlotArte alt="Troféu de recompensas" style={{ flex: 1, minHeight: 190 }}>
              <div style={{ textAlign: "center", color: "rgba(255,255,255,.85)" }}>
                <div style={{ width: 92, height: 92, margin: "0 auto 10px", borderRadius: "50%", background: "conic-gradient(from 210deg,#FFD66B,#fff6,#F2A93B,#FFD66B)", display: "grid", placeItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
                  <Trophy size={44} color="#7a4b00" />
                </div>
                <div style={{ fontSize: 11, opacity: .75 }}>Ilustração do troféu · em breve</div>
              </div>
            </SlotArte>
          </div>
        </div>
      </div>

      {canal?.ativo && <ParceriaCanal p={canal} aviso={aviso} />}

      {/* 2. Jornada visual de níveis */}
      {trilha.length > 0 && !canal?.ativo && (
        <div className="vx-card" style={{ padding: 20, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div className="vx-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><TrendingUp size={14} /> Jornada de níveis</div>
            {!afil?.ativo && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "var(--surface-2)", color: "var(--muted)" }}>Prévia · níveis em preparação</span>}
          </div>
          <div className="ind-trilha">
            {trilha.map((n, i) => {
              const cor = CORES_NIVEL[Math.min(i, CORES_NIVEL.length - 1)];
              const estado = n.atual ? "atual" : n.desbloqueado ? "conquistado" : (i === atualIdx + 1 ? "proximo" : "bloqueado");
              return (
                <div key={n.chave} style={{ flex: "0 0 128px", textAlign: "center", position: "relative" }}>
                  {i < trilha.length - 1 && <div style={{ position: "absolute", top: 31, left: "50%", width: "100%", height: 3, background: n.desbloqueado ? cor : "var(--border)", zIndex: 0 }} />}
                  <div style={{ position: "relative", zIndex: 1, padding: "0 6px" }}>
                    <Medalhao cor={cor} estado={estado} numero={i + 1} src={n.emblema} nome={n.nome} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 8 }}>{n.nome}</div>
                    <div className="vx-mono" style={{ fontSize: 14, fontWeight: 800, color: n.desbloqueado || n.atual ? cor : "var(--muted)" }}>{n.pct}%</div>
                    <div className="vx-mut" style={{ fontSize: 11 }}>{n.min === 0 ? "início" : `${n.min}+ clientes`}</div>
                    {estado === "atual" && <div style={{ fontSize: 10, fontWeight: 700, color: cor, marginTop: 3, textTransform: "uppercase", letterSpacing: ".04em" }}>Nível atual</div>}
                    {estado === "proximo" && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", marginTop: 3, textTransform: "uppercase", letterSpacing: ".04em" }}>A desbloquear</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="vx-mut" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 10 }}>
            <b style={{ color: "var(--ink)" }}>Comissão vigente: {afil?.politicaVigente?.percentual}% da primeira mensalidade.</b> Os percentuais por nível acima são uma <b>prévia</b> configurável e dependem de aprovação — não são benefícios já disponíveis. A comissão sempre considera o valor efetivamente pago do plano.
          </p>
        </div>
      )}

      {/* 3. Cards ilustrados para indicar */}
      <div id="ind-compartilhar" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 14, marginBottom: 18 }}>
        {indicaEmpresa && (
          <CardCompartilhar
            titulo="Indique empresas" cor="#2563EB" Icon={Building2}
            descricao={`Ganhe ${afil?.politicaVigente?.percentual ?? ""}% da primeira mensalidade quando a empresa que você indicar contratar um plano.`}
            link={linkEmpresa} codigo={dados.codigo}
            onCopiar={() => copiar(linkEmpresa, "Link para empresas")}
            onCompartilhar={() => compartilhar("Conheça a RYCS", "Cadastre sua empresa na RYCS pelo meu convite:", linkEmpresa, "Link para empresas")}
            ilustra={<SlotArte claro alt="Empresas" style={{ height: 120 }}><PanelMotivo Icon={Building2} cor="#2563EB" rotulo="Ilustração de empresas · em breve" /></SlotArte>}
          />
        )}
        {indicaProf && (
          <CardCompartilhar
            titulo="Indique profissionais" cor="#7C3AED" Icon={Users}
            descricao={dados.recompensas?.vendedor ? (dados.recompensas.vendedor.descricao || `Recompensa de ${money(dados.recompensas.vendedor.valor)} quando o profissional indicado completa o perfil.`) : "Convide profissionais para a RYCS."}
            link={link} codigo={dados.codigo}
            onCopiar={() => copiar(link, "Link para profissionais")}
            onCompartilhar={() => compartilhar("Venha para a RYCS", "Crie seu perfil de profissional na RYCS pelo meu convite:", link, "Link para profissionais")}
            ilustra={<SlotArte claro alt="Profissionais" style={{ height: 120 }}><PanelMotivo Icon={Users} cor="#7C3AED" rotulo="Ilustração de profissionais · em breve" /></SlotArte>}
          />
        )}
      </div>

      {/* 4. Resumo financeiro compacto */}
      {ind && (
        <div className="vx-card" style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(50%, 150px), 1fr))" }}>
            {[
              ["Total recebido", money(ind.comissoesRecebidas), AZUL],
              ["Disponível", money(ind.comissoesDisponiveis), "#16A34A"],
              ["Pendente", money(ind.comissoesPendentes), "#B45309"],
              ["Clientes pagantes", String(ind.clientesPagantes), "var(--ink)"],
            ].map(([rot, val, cor], i) => (
              <div key={rot} style={{ padding: "16px 18px", borderLeft: i % 4 === 0 ? "none" : "1px solid var(--border)", borderTop: "none" }}>
                <div className="vx-mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{rot}</div>
                <div className="vx-mono" style={{ fontSize: 20, fontWeight: 800, color: cor, marginTop: 4 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Minhas indicações e histórico */}
      {afil?.empresas?.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <h3 className="vx-disp" style={{ fontSize: 16, margin: "0 0 10px" }}>Empresas indicadas ({afil.empresas.length})</h3>
          <div className="vx-grid" style={{ gap: 10 }}>
            {afil.empresas.map((e, i) => <CartaoEmpresa key={e.companyId || i} e={e} />)}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <h3 className="vx-disp" style={{ fontSize: 16, margin: 0 }}>Histórico de indicações {dados.indicacoes.length > 0 && `(${dados.indicacoes.length})`}</h3>
        {dados.indicacoes.length > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Filter size={13} color="var(--muted)" />
            {[["todas", "Todas"], ["pagas", "Pagas"], ["pendentes", "Pendentes"]].map(([k, l]) => (
              <button key={k} onClick={() => setFHist(k)} style={{
                fontSize: 12, padding: "5px 11px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${fHist === k ? AZUL : "var(--border)"}`, background: fHist === k ? "#EAF4FF" : "#fff", color: fHist === k ? AZUL : "var(--ink)", fontWeight: fHist === k ? 600 : 500,
              }}>{l}</button>
            ))}
          </div>
        )}
      </div>
      {dados.indicacoes.length === 0 ? (
        <div className="vx-card" style={{ padding: 36, textAlign: "center" }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center", background: "#EAF4FF", color: AZUL, margin: "0 auto 14px" }}><Sparkles size={26} /></span>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Sua jornada de indicações começa aqui.</div>
          <p className="vx-mut" style={{ fontSize: 13, maxWidth: 420, margin: "0 auto 16px", lineHeight: 1.55 }}>
            Compartilhe seu convite com empresas e profissionais. Assim que alguém se cadastrar pelo seu link, aparece aqui — e a comissão entra quando o pagamento é confirmado.
          </p>
          <button className="vx-btn vx-btn-primary" style={{ background: AZUL, borderColor: AZUL, gap: 7 }} onClick={irParaCompartilhar}>Compartilhar convite <ChevronRight size={15} /></button>
        </div>
      ) : indicacoesFiltradas.length === 0 ? (
        <div className="vx-card vx-mut" style={{ padding: 22, textAlign: "center", fontSize: 13.5 }}>Nenhuma indicação para este filtro.</div>
      ) : (
        <div className="vx-grid">
          {indicacoesFiltradas.map((i, idx) => {
            const pago = i.status === "pago" || i.status === "qualificada";
            return (
              <div key={idx} className="vx-card vx-row" style={{ padding: 14 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  {pago ? <CheckCircle2 size={17} color={AZUL} style={{ flex: "none" }} /> : <Clock size={17} color="var(--amber)" style={{ flex: "none" }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{i.contato}</div>
                    <div className="vx-mut" style={{ fontSize: 11.5 }}>{PAPEL[i.papel] || i.papel} · {dataCurta(i.criadoEm)}</div>
                  </div>
                </div>
                <span className={"vx-badge " + (pago ? "vx-badge-brand" : "vx-badge-amber")}>
                  {i.status === "qualificada" ? "Perfil completo" : pago ? money(i.valor) : "Pendente"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PanelMotivo({ Icon, cor, rotulo }) {
  return (
    <div style={{ textAlign: "center", color: "var(--muted)" }}>
      <div style={{ width: 54, height: 54, margin: "0 auto 8px", borderRadius: 14, background: cor + "18", display: "grid", placeItems: "center", color: cor }}><Icon size={26} /></div>
      <div style={{ fontSize: 10.5 }}>{rotulo}</div>
    </div>
  );
}

function CardCompartilhar({ titulo, descricao, cor, Icon, link, codigo, onCopiar, onCompartilhar, ilustra }) {
  return (
    <div className="vx-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", borderTop: `3px solid ${cor}` }}>
      {ilustra}
      <div style={{ padding: 18, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: cor + "18", color: cor }}><Icon size={17} /></span>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{titulo}</div>
        </div>
        <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 14px", lineHeight: 1.5, flex: 1 }}>{descricao}</p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)", marginBottom: 10 }}>
          <span className="vx-mono" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)" }}>{link.replace(/^https?:\/\//, "")}</span>
          <span className="vx-mono" style={{ fontSize: 12, fontWeight: 700, color: cor, flexShrink: 0, letterSpacing: ".06em" }}>{codigo}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="vx-btn" style={{ flex: 1, justifyContent: "center", gap: 6 }} onClick={onCopiar}><Copy size={14} /> Copiar link</button>
          <button className="vx-btn vx-btn-primary" style={{ flex: 1, justifyContent: "center", gap: 6, background: cor, borderColor: cor }} onClick={onCompartilhar}><Share2 size={14} /> Compartilhar</button>
        </div>
      </div>
    </div>
  );
}

// Linha do tempo de uma empresa indicada — estados correspondem a eventos reais.
function CartaoEmpresa({ e }) {
  const etapas = [
    { chave: "cadastro", rotulo: "Cadastro", ok: e.linhaDoTempo?.cadastro },
    { chave: "aprovado", rotulo: "Aprovado", ok: e.linhaDoTempo?.aprovado },
    { chave: "pagamento", rotulo: "Pagamento", ok: e.linhaDoTempo?.pagamentoConfirmado },
    { chave: "comissao", rotulo: "Comissão", ok: e.linhaDoTempo?.comissaoConstituida },
  ];
  return (
    <div className="vx-card" style={{ padding: 14 }}>
      <div className="vx-row" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <Building2 size={17} color={e.pagante ? AZUL : "var(--muted-2)"} style={{ flex: "none" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nome}</div>
            <div className="vx-mut" style={{ fontSize: 11.5 }}>{dataCurta(e.criadoEm)}{e.assinatura ? ` · ${e.assinatura}` : ""}</div>
          </div>
        </div>
        <span className={"vx-badge " + (e.comissaoRecebida > 0 || e.pagante ? "vx-badge-brand" : "")}>
          {e.comissaoRecebida > 0 ? money(e.comissaoRecebida) : e.pagante ? "Pagante" : "Sem pagamento"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {etapas.map((et, i) => (
          <div key={et.chave} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: "none" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", flex: "none", background: et.ok ? AZUL : "var(--surface-2)", border: `1.5px solid ${et.ok ? AZUL : "var(--border)"}`, display: "grid", placeItems: "center" }}>
                {et.ok && <CheckCircle2 size={11} color="#fff" />}
              </div>
              <span style={{ fontSize: 9.5, color: et.ok ? "var(--ink-2)" : "var(--muted-2)" }}>{et.rotulo}</span>
            </div>
            {i < etapas.length - 1 && <div style={{ height: 2, flex: 1, borderRadius: 2, background: et.ok ? AZUL : "var(--surface-2)", marginBottom: 14 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
