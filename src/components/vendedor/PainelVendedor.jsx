import { useEffect, useMemo, useState } from "react";
import {
  Award, CheckCircle2, Clock3, ShieldCheck, Target, TrendingUp, Wallet,
  Presentation, XCircle, Zap, Lock, ChevronRight, GraduationCap, Brain,
  UserRound, Trophy, Sparkles, X, Medal, ArrowRight,
} from "lucide-react";
import { money } from "../../lib/utils.js";
import { api } from "../../lib/api.js";
import { Stat, Medidor, Donut } from "../ui.jsx";
import AchievementBadge from "./AchievementBadge.jsx";
import { desempenhoVendedor, potencialDeGanhos } from "../../../shared/desempenhoVendedor.js";
import { CATEGORIAS } from "../../../shared/gamificacao.js";
import { ler as lerArmazenamento, gravar as gravarArmazenamento } from "../../lib/armazenamento.js";

// Ícone + cor pontual por categoria de conquista (diferenciação discreta).
const CAT = {
  perfil: { Icon: UserRound, cor: "#318CE7" },
  avaliacoes: { Icon: Brain, cor: "#7C3AED" },
  academy: { Icon: GraduationCap, cor: "#0E9F9A" },
  performance: { Icon: TrendingUp, cor: "#318CE7" },
  ganhos: { Icon: Wallet, cor: "#16A34A" },
};
const VERDE = "#16A34A";

export default function PainelVendedor({ eu, db, abrirEmpresas, setAba }) {
  const [meta, setMeta] = useState(() => Number(lerArmazenamento("rycs:meta", 0)) || 0);
  const [certificados, setCertificados] = useState([]);
  const [conquistaAberta, setConquistaAberta] = useState(null);
  const [novas, setNovas] = useState([]);

  useEffect(() => { api("/courses/me/certificates").then((r) => setCertificados(r?.certificados || [])); }, []);

  const d = useMemo(() => desempenhoVendedor({
    submissions: db.submissions || [], leads: db.leads || [],
    sellerId: eu.id, seller: eu, metaMensal: meta,
  }), [db, eu, meta]);

  const potencial = useMemo(() => potencialDeGanhos({
    companies: db.companies || [], campaigns: db.campaigns || [],
    seller: eu, aplicacoes: eu.aplicacoes || {},
  }), [db, eu]);

  const g = db.gamificacao || { xp: 0, nivel: { nome: "Starter", numero: 1, cor: "#5B6B7F", progresso: 0, proximo: null, faltam: 0 }, conquistas: [], resumo: { conquistadas: 0, total: 0 }, missoes: [], metricas: {} };

  // Reconhecimento de novas conquistas desde a última visita (discreto, sem
  // animação pesada): compara o que está desbloqueado com o que já foi visto.
  useEffect(() => {
    const desbloqueadas = g.conquistas.filter((c) => c.desbloqueada).map((c) => c.id);
    if (!desbloqueadas.length) return;
    const vistas = lerArmazenamento("rycs:badges-vistos", []);
    const vistasArr = Array.isArray(vistas) ? vistas : [];
    const novasIds = desbloqueadas.filter((id) => !vistasArr.includes(id));
    // Na primeira vez (nenhuma vista registrada) não comemora o histórico todo.
    if (vistasArr.length && novasIds.length) {
      setNovas(g.conquistas.filter((c) => novasIds.includes(c.id)));
    }
    gravarArmazenamento("rycs:badges-vistos", desbloqueadas);
  }, [db.gamificacao]); // eslint-disable-line

  const salvarMeta = (v) => {
    const valor = Math.max(0, Number(String(v).replace(",", ".")) || 0);
    setMeta(valor);
    gravarArmazenamento("rycs:meta", valor);
  };
  const ir = (destino) => { if (destino === "oportunidades" && abrirEmpresas) abrirEmpresas(); else setAba?.(destino); };

  const { financeiro: f, performance: p, comercial: c } = d;
  const primeiroNome = String(eu.nome || "").split(" ")[0] || "profissional";
  const m = g.metricas || {};
  const ativo = (m.tarefasAprovadas || 0) > 0 || g.resumo.conquistadas > 1;
  const mensagem = ativo
    ? "Continue evoluindo e acompanhe suas conquistas."
    : "Seu próximo resultado começa com o primeiro passo.";

  const corNivel = g.nivel.cor;

  return (
    <div className="vx-fade">
      {/* ══════════ 1. BOAS-VINDAS + IDENTIDADE ══════════ */}
      <div className="vx-card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Emblema cor={corNivel} numero={g.nivel.numero} foto={eu.foto} nome={eu.nome} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="vx-disp" style={{ fontSize: 22 }}>Olá, {primeiroNome}! <span aria-hidden="true">👋</span></div>
          <p className="vx-mut" style={{ fontSize: 13.5, margin: "4px 0 8px", lineHeight: 1.5 }}>{mensagem}</p>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700,
            letterSpacing: ".08em", textTransform: "uppercase", color: corNivel,
            background: `${corNivel}14`, borderRadius: 999, padding: "5px 12px",
          }}>
            <Medal size={13} /> {g.nivel.nome} — Nível {g.nivel.numero}
          </span>
        </div>
        <div style={{ textAlign: "right", minWidth: 90 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 2 }}>XP total</div>
          <div className="vx-disp vx-mono" style={{ fontSize: 26, color: corNivel }}>{g.xp}</div>
        </div>
      </div>

      {/* ══════════ 2. NÍVEL E EVOLUÇÃO ══════════ */}
      <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
        <div className="vx-row" style={{ marginBottom: 8 }}>
          <div className="vx-eyebrow"><Trophy size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Sua evolução</div>
          <span className="vx-mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {g.nivel.proximo ? `${g.nivel.faltam} XP para ${g.nivel.proximo.nome}` : "Nível máximo alcançado"}
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${g.nivel.progresso}%`, background: corNivel, borderRadius: 999, transition: "width .5s ease" }} />
        </div>
        <div className="vx-row" style={{ marginTop: 6, fontSize: 11.5, color: "var(--muted-2)" }}>
          <span>{g.nivel.nome}</span>
          <span>{g.nivel.proximo ? g.nivel.proximo.nome : "Elite"}</span>
        </div>
      </div>

      {/* ══════════ 3. RESUMO DE GANHOS (enxuto) ══════════ */}
      <h2 className="vx-disp" style={{ fontSize: 17, margin: "22px 0 10px" }}>Seus ganhos</h2>
      <div className="vx-grid vx-g4">
        <Stat label="Ganhos acumulados" value={money(f.historico)} Icon={Award} tone="brand" />
        <Stat label="Disponível para saque" value={money(f.disponivel)} Icon={Wallet} tone="brand" />
        <Stat label="Em análise" value={money(f.emAuditoria)} Icon={ShieldCheck} tone="amber" />
        <Stat label="Total recebido" value={money(f.sacado)} Icon={CheckCircle2} tone="muted" />
      </div>
      <div className="vx-chart-source">
        Ganhos acumulados somam suas ações aprovadas. Saldo, análise e saques vêm do motor financeiro —
        o extrato completo fica na <button type="button" onClick={() => ir("carteira")}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--brand)", font: "inherit", textDecoration: "underline" }}>Carteira</button>.
      </div>

      {/* ══════════ 4. MISSÕES / PRÓXIMOS PASSOS ══════════ */}
      {g.missoes.length > 0 && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 17, margin: "22px 0 4px" }}>Suas próximas conquistas</h2>
          <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 10px" }}>O que fazer para continuar evoluindo — no seu ritmo.</p>
          <div className="vx-grid vx-g2">
            {g.missoes.map((ms) => {
              const info = CAT[ms.categoria] || CAT.perfil;
              const Ico = info.Icon;
              return (
                <div key={ms.id} className="vx-card" style={{ padding: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `${info.cor}14`, color: info.cor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Ico size={19} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{ms.nome}</div>
                    <p className="vx-mut" style={{ fontSize: 12.5, margin: "2px 0 8px", lineHeight: 1.45 }}>{ms.descricao}</p>
                    {ms.progresso.alvo > 1 && (
                      <div style={{ marginBottom: 8 }}>
                        <Medidor value={ms.progresso.pct} tone="brand" />
                        <div className="vx-mut" style={{ fontSize: 11, marginTop: 3 }}>{ms.progresso.atual} de {ms.progresso.alvo}</div>
                      </div>
                    )}
                    <div className="vx-row">
                      <button type="button" className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => ir(ms.destino)}>
                        Avançar <ArrowRight size={13} />
                      </button>
                      {ms.xp > 0 && <span className="vx-chip vx-mono" style={{ fontSize: 11 }}>+{ms.xp} XP</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ══════════ 5. CONQUISTAS E MEDALHAS ══════════ */}
      <div className="vx-row" style={{ margin: "24px 0 4px" }}>
        <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Suas conquistas</h2>
        <span className="vx-chip vx-mono">{g.resumo.conquistadas} / {g.resumo.total}</span>
      </div>
      <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 12px" }}>Cada passo da sua trajetória merece reconhecimento.</p>
      {/* Coleção de medalhas 3D colecionáveis (estilo Premium 3D Collectible).
          Cada conquista é uma AchievementBadge com seu asset, estado e animação. */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))" }}>
        {g.conquistas.map((cq) => (
          <AchievementBadge
            key={cq.id}
            conquista={cq}
            novo={novas.some((n) => n.id === cq.id)}
            onClick={() => setConquistaAberta(cq)}
          />
        ))}
      </div>

      {/* ══════════ 6. CERTIFICADOS ══════════ */}
      <div className="vx-row" style={{ margin: "24px 0 10px" }}>
        <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>
          <GraduationCap size={16} style={{ verticalAlign: -2, marginRight: 6, color: "var(--brand)" }} /> Minhas certificações
        </h2>
        <span className="vx-chip vx-mono">{certificados.length}</span>
      </div>
      {certificados.length === 0 ? (
        <div className="vx-card" style={{ padding: 18, textAlign: "center" }}>
          <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 10px" }}>
            Seu primeiro certificado pode estar mais perto do que você imagina.
          </p>
          <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => ir("academy")}>Ir para a Academy <ChevronRight size={14} /></button>
        </div>
      ) : (
        <div className="vx-grid vx-g2">
          {certificados.map((cert) => (
            <div key={cert.codigo} style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 12, borderLeft: "3px solid var(--brand)" }}>
              <div className="vx-row" style={{ gap: 8 }}>
                <b style={{ fontSize: 13.5 }}>{cert.titulo}</b>
                <span className="vx-badge vx-badge-brand vx-mono" style={{ flexShrink: 0 }}>{cert.percentual}%</span>
              </div>
              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2 }}>{cert.categoria}</div>
              <div className="vx-mono" style={{ fontSize: 11.5, marginTop: 5, color: "var(--brand)" }}>{cert.codigo}</div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════ 7. PERFORMANCE (secundária) ══════════ */}
      <h2 className="vx-disp" style={{ fontSize: 17, margin: "24px 0 10px" }}>Performance</h2>
      <div className="vx-grid vx-g4">
        <Stat label="Tarefas enviadas" value={p.executadas} Icon={Presentation} tone="muted" mono />
        <Stat label="Aprovadas" value={p.aprovadas} Icon={CheckCircle2} tone="brand" mono />
        <Stat label="Em auditoria" value={p.emAuditoria} Icon={ShieldCheck} tone="amber" mono />
        <Stat label="Não aprovadas" value={p.recusadas} Icon={XCircle} tone="red" mono />
      </div>
      <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
        <Stat label="RYCS Score" value={d.rycs.score} Icon={Award} tone={d.rycs.score >= 70 ? "brand" : d.rycs.score >= 50 ? "amber" : "red"} mono />
        <Stat label="Score da triagem" value={d.rycs.scoreTriagem ? `${d.rycs.scoreTriagem}%` : "—"} Icon={ShieldCheck} tone="muted" />
      </div>
      <div className="vx-chart-source">O RYCS Score e a triagem seguem o cálculo oficial da plataforma — a gamificação (XP) é independente deles.</div>

      <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
        <div className="vx-row" style={{ flexWrap: "wrap", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div className="vx-eyebrow"><Target size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Meta do mês</div>
            <div className="vx-disp vx-mono" style={{ fontSize: 20, marginTop: 3 }}>
              {money(f.mes)}{p.metaMensal > 0 && <span className="vx-mut" style={{ fontSize: 13 }}> / {money(p.metaMensal)}</span>}
            </div>
          </div>
          <label style={{ width: 150 }}>
            <div className="vx-label">Definir meta (R$)</div>
            <input className="vx-input vx-mono" inputMode="decimal" value={p.metaMensal || ""} placeholder="0" onChange={(e) => salvarMeta(e.target.value)} />
          </label>
        </div>
        {p.progressoMeta !== null ? (
          <div style={{ marginTop: 12 }}>
            <Medidor value={p.progressoMeta} tone={p.progressoMeta >= 80 ? "brand" : p.progressoMeta >= 40 ? "amber" : "red"} />
            <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4 }}>{p.progressoMeta}% da meta — só no seu aparelho.</div>
          </div>
        ) : (
          <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>Defina uma meta para acompanhar o progresso.</p>
        )}
        {p.taxaAprovacao !== null && (
          <div style={{ marginTop: 14 }}>
            <div className="vx-row" style={{ fontSize: 13, marginBottom: 5 }}>
              <span className="vx-mut">Taxa de aprovação</span><b className="vx-mono">{p.taxaAprovacao}%</b>
            </div>
            <Medidor value={p.taxaAprovacao} tone={p.taxaAprovacao >= 70 ? "brand" : p.taxaAprovacao >= 50 ? "amber" : "red"} />
          </div>
        )}
      </div>

      {/* ══════════ 8. HISTÓRICO / FUNIL COMERCIAL ══════════ */}
      {(c.agendadas + c.realizadas + c.vendas + c.leadsTotais) > 0 && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 17, margin: "24px 0 10px" }}>Sua evolução comercial</h2>
          <div className="vx-grid vx-g2">
            <Donut titulo="Funil das suas ações aprovadas" itens={[
              { nome: "Reuniões agendadas", valor: c.agendadas },
              { nome: "Reuniões realizadas", valor: c.realizadas },
              { nome: "Vendas", valor: c.vendas },
            ]} />
            <div className="vx-card" style={{ padding: 18 }}>
              <div className="vx-grid vx-g2" style={{ fontSize: 12.5 }}>
                <div><span className="vx-mut">Leads na carteira</span><div className="vx-disp vx-mono" style={{ fontSize: 20 }}>{c.leadsTotais}</div></div>
                <div><span className="vx-mut">Leads trabalhados</span><div className="vx-disp vx-mono" style={{ fontSize: 20 }}>{c.leadsTrabalhados}</div></div>
              </div>
              <hr className="vx-sep" />
              <div className="vx-grid vx-g2" style={{ fontSize: 12.5 }}>
                <div><span className="vx-mut">Comparecimento</span><div className="vx-disp vx-mono" style={{ fontSize: 20 }}>{c.comparecimento === null ? "—" : `${c.comparecimento}%`}</div></div>
                <div><span className="vx-mut">Conversão até a venda</span><div className="vx-disp vx-mono" style={{ fontSize: 20, color: "var(--brand)" }}>{c.conversao === null ? "—" : `${c.conversao}%`}</div></div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Potencial de ganhos — incentivo a explorar oportunidades */}
      {potencial.total > 0 && (
        <div className="vx-card" style={{ padding: 18, marginTop: 20, borderLeft: "3px solid var(--brand)" }}>
          <div className="vx-eyebrow"><Zap size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Oportunidades para você</div>
          <div className="vx-disp vx-mono" style={{ fontSize: 26, color: "var(--brand)", margin: "6px 0 2px" }}>{money(potencial.total)}</div>
          <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 10px" }}>em caixa nas empresas onde você está aprovado, prontos para virar tarefa sua.</p>
          {abrirEmpresas && <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={abrirEmpresas}>Ver oportunidades <ChevronRight size={14} /></button>}
        </div>
      )}

      {/* ── Modal de detalhe da conquista ── */}
      {conquistaAberta && (
        <ModalConquista cq={conquistaAberta} onFechar={() => setConquistaAberta(null)} />
      )}

      {/* ── Reconhecimento discreto de novas conquistas ── */}
      {novas.length > 0 && (
        <BannerDesbloqueio conquistas={novas} onFechar={() => setNovas([])} />
      )}
    </div>
  );
}

// Emblema de nível: medalha circular com a cor da faixa e a foto por dentro.
function Emblema({ cor, numero, foto, nome }) {
  return (
    <div style={{ position: "relative", flexShrink: 0, width: 76, height: 76 }}>
      <div style={{
        width: 76, height: 76, borderRadius: "50%", padding: 3,
        background: `conic-gradient(${cor}, ${cor}66, ${cor})`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "var(--surface-solid)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {foto
            ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span className="vx-disp" style={{ fontSize: 26, color: cor }}>{String(nome || "?").slice(0, 1).toUpperCase()}</span>}
        </div>
      </div>
      <span style={{
        position: "absolute", right: -2, bottom: -2, minWidth: 22, height: 22, padding: "0 5px",
        borderRadius: 999, background: cor, color: "#fff", fontSize: 11.5, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--surface-solid)",
      }}>{numero}</span>
    </div>
  );
}

function ModalConquista({ cq, onFechar }) {
  const info = CAT[cq.categoria] || CAT.perfil;
  const Ico = cq.desbloqueada ? info.Icon : Lock;
  const data = cq.conquistadoEm ? new Date(cq.conquistadoEm).toLocaleDateString("pt-BR") : null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 920, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="vx-fade" style={{ background: "var(--surface-solid)", borderRadius: 16, padding: 26, maxWidth: 380, width: "100%", textAlign: "center", border: "1px solid var(--border-strong)", position: "relative" }}>
        <button type="button" onClick={onFechar} aria-label="Fechar" style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}><X size={20} /></button>
        <div style={{ width: 68, height: 68, borderRadius: "50%", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", background: cq.desbloqueada ? `${info.cor}18` : "var(--surface-2)", border: `2px solid ${cq.desbloqueada ? info.cor : "var(--border-strong)"}`, color: cq.desbloqueada ? info.cor : "var(--muted-2)" }}>
          <Ico size={30} />
        </div>
        <div className="vx-eyebrow" style={{ color: info.cor }}>{CATEGORIAS[cq.categoria]}</div>
        <h3 className="vx-disp" style={{ fontSize: 19, margin: "4px 0 8px" }}>{cq.nome}</h3>
        <p className="vx-mut" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 14px" }}>{cq.descricao}</p>
        {!cq.desbloqueada && cq.progresso.alvo > 1 && (
          <div style={{ marginBottom: 14 }}>
            <Medidor value={cq.progresso.pct} tone="brand" />
            <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>{cq.progresso.atual} de {cq.progresso.alvo}</div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, fontSize: 12.5 }}>
          {cq.xp > 0 && <span className="vx-chip vx-mono">+{cq.xp} XP</span>}
          {cq.desbloqueada
            ? <span className="vx-chip" style={{ color: VERDE }}><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> {data ? `Conquistada em ${data}` : "Conquistada"}</span>
            : <span className="vx-chip" style={{ color: "var(--muted)" }}><Lock size={12} style={{ verticalAlign: -2 }} /> Bloqueada</span>}
        </div>
      </div>
    </div>
  );
}

function BannerDesbloqueio({ conquistas, onFechar }) {
  useEffect(() => { const t = setTimeout(onFechar, 6000); return () => clearTimeout(t); }, [onFechar]);
  const varias = conquistas.length > 1;
  return (
    <div className="vx-fade" style={{ position: "fixed", left: "50%", bottom: 90, transform: "translateX(-50%)", zIndex: 930, width: "min(92vw, 380px)" }}>
      <div style={{ background: "var(--surface-solid)", border: "1px solid var(--brand)", borderRadius: 14, padding: 14, boxShadow: "0 10px 30px rgba(0,0,0,.2)", display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: "rgba(49,140,231,.12)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand)" }}>Conquista desbloqueada!</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
            {varias ? `${conquistas.length} novas conquistas` : conquistas[0].nome}
          </div>
          {!varias && conquistas[0].xp > 0 && <div className="vx-mut" style={{ fontSize: 11.5 }}>+{conquistas[0].xp} XP</div>}
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}><X size={16} /></button>
      </div>
    </div>
  );
}
