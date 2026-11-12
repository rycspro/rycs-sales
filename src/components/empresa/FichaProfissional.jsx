import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";
import { money } from "../../lib/utils.js";

// Perfil completo do profissional — a MESMA ficha usada na lista de Profissionais
// e na visualização do candidato em Aprovações. Presentational: recebe o
// profissional já enriquecido (`p`) e a compatibilidade (`fit`), e aceita blocos
// opcionais `topo` (ex.: mensagem da candidatura) e `acoes` (ações da página).

const PERFIL = { sdr: "SDR", bdr: "BDR", closer: "Closer", pap: "Porta a porta", "sem-exp": "Em formação" };
const arr = (v) => (Array.isArray(v) ? v : []);
const text = (v, empty = "Não informado") => v || empty;

function iniciais(nome = "") {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("") || "PR";
}
function capitalizar(nome = "") {
  return String(nome).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function Metric({ label, value }) {
  return <div className="vx-scenario"><span>{label}</span><strong>{value}</strong></div>;
}

function resumoIA(p) {
  const partes = [];
  if (p.perfilComercial?.estilo) partes.push(`Perfil comportamental: ${p.perfilComercial.estilo}.`);
  if (p.experiencia) partes.push(`Experiência: ${p.experiencia}.`);
  const fortes = [...arr(p.skills), ...arr(p.segmentos)].slice(0, 5);
  if (fortes.length) partes.push(`Pontos fortes: ${fortes.join(", ")}.`);
  if (p.perfil || arr(p.modalidades).length) partes.push(`Operação ideal: ${[PERFIL[p.perfil] || p.perfil, ...arr(p.modalidades).slice(0, 3)].filter(Boolean).join(", ")}.`);
  if (p.perfilComercial?.abordagem) partes.push(`Estilo de abordagem: ${p.perfilComercial.abordagem}.`);
  if (p.tarefasRealizadas || p.resultadosGerados) partes.push(`Resultados históricos: ${p.tarefasAprovadas}/${p.tarefasRealizadas} tarefas aprovadas, ${p.resultadosGerados} resultado(s) gerado(s).`);
  return partes.length ? partes.join(" ") : "Sem dados reais suficientes para gerar resumo confiável.";
}

export default function FichaProfissional({ p, fit = { percentual: 0, pontos: [], atencao: [] }, topo = null, acoes = null, onFechar }) {
  const [bioExpandida, setBioExpandida] = useState(false);
  const nomeCompleto = capitalizar([p.nome, p.sobrenome].filter(Boolean).join(" ") || p.nome);

  useEffect(() => {
    const fechar = (e) => { if (e.key === "Escape") onFechar?.(); };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [onFechar]);

  return (
    <div className="vx-overlay" onClick={onFechar}>
      <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1020 }}>

        {/* ── Cabeçalho: fechar ── */}
        <div className="vx-row" style={{ marginBottom: 16 }}>
          <div className="vx-eyebrow">Perfil completo</div>
          <button className="vx-btn vx-btn-ghost" onClick={onFechar}><X size={16} /></button>
        </div>

        {topo}

        {/* ── HERO: foto (3:4) + coluna direita ── */}
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* Coluna esquerda — somente foto 3:4 */}
          <div style={{ width: 180, minWidth: 180, flexShrink: 0 }}>
            <div style={{ width: 180, height: 240, borderRadius: 16, overflow: "hidden", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {p.foto
                ? <img src={p.foto} alt={nomeCompleto} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
                : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 52, fontWeight: 700, color: "var(--brand)", fontFamily: "var(--font-disp)" }}>{iniciais(p.nome)}</div>
              }
            </div>
          </div>

          {/* Coluna direita — nome, bio, canais */}
          <div style={{ flex: 1, minWidth: 240 }}>
            {/* A. Nome */}
            <h2 className="vx-disp" style={{ margin: "0 0 12px", fontSize: 24 }}>{nomeCompleto}</h2>

            {/* B. Biografia (clamp 6 linhas) */}
            <div style={{ marginBottom: 12 }}>
              {(p.bio || p.experiencia) ? (
                <>
                  <p className="vx-mut" style={{
                    fontSize: 13, lineHeight: 1.65, margin: 0,
                    display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical",
                    overflow: "hidden", textAlign: "justify",
                    maxHeight: "calc(1.65em * 6)",
                  }}>{p.bio || p.experiencia}</p>
                  {(p.bio || p.experiencia).length > 320 && (
                    <button
                      type="button"
                      onClick={() => setBioExpandida(true)}
                      style={{ background: "none", border: "none", padding: 0, marginTop: 4, fontSize: 12.5, color: "var(--brand)", cursor: "pointer", fontWeight: 500 }}
                    >Ler biografia completa →</button>
                  )}
                </>
              ) : (
                <p className="vx-mut" style={{ fontSize: 13, margin: 0, fontStyle: "italic" }}>Apresentação em atualização.</p>
              )}
            </div>

            {/* C. Canais de Atendimento */}
            {(() => {
              const canais = [
                p.whats && { label: "WhatsApp", icon: "📱", href: `https://wa.me/${p.whats.replace(/\D/g, "")}` },
                p.email && { label: "E-mail", icon: "✉️", href: `mailto:${p.email}` },
                arr(p.modalidades).some((m) => /video|confer/i.test(m)) && { label: "Videoconferência", icon: "🎥", href: null },
                p.telefone && { label: "Telefone", icon: "📞", href: `tel:${p.telefone}` },
              ].filter(Boolean);
              return canais.length > 0 ? (
                <div>
                  <div className="vx-eyebrow" style={{ marginBottom: 7 }}>Canais de Atendimento</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {canais.map(({ label, icon, href }) =>
                      href
                        ? <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="vx-chip" style={{ fontSize: 12, textDecoration: "none", color: "var(--ink)" }}>{icon} {label}</a>
                        : <span key={label} className="vx-chip" style={{ fontSize: 12 }}>{icon} {label}</span>
                    )}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Currículo enviado pelo profissional */}
            {p.curriculo && (
              <div>
                <div className="vx-eyebrow" style={{ marginBottom: 7 }}>Currículo</div>
                <a href={p.curriculo} target="_blank" rel="noopener noreferrer" className="vx-btn vx-btn-sm" style={{ textDecoration: "none", gap: 7 }}>
                  📄 Ver currículo{p.curriculoNome ? ` · ${p.curriculoNome}` : ""}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ── Dados do Perfil — card horizontal largura total ── */}
        <div className="vx-card" style={{ padding: "14px 18px", marginTop: 20 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 12 }}>Dados do Perfil</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px 20px", fontSize: 13 }}>
            <div>
              <div className="vx-mut" style={{ fontSize: 11, marginBottom: 2 }}>Função</div>
              <b>{text(PERFIL[p.perfil] || p.perfil)}</b>
            </div>
            <div>
              <div className="vx-mut" style={{ fontSize: 11, marginBottom: 2 }}>Localização</div>
              <b>{text([p.cidade, p.estado].filter(Boolean).join(" / "), "—")}</b>
            </div>
            {p.disponibilidade && (
              <div>
                <div className="vx-mut" style={{ fontSize: 11, marginBottom: 2 }}>Disponibilidade</div>
                <b>{p.disponibilidade}</b>
              </div>
            )}
            {arr(p.segmentos).length > 0 && (
              <div style={{ gridColumn: "span 2" }}>
                <div className="vx-mut" style={{ fontSize: 11, marginBottom: 5 }}>Segmentos</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {arr(p.segmentos).map((s) => <span key={s} className="vx-chip" style={{ fontSize: 11 }}>{s}</span>)}
                </div>
              </div>
            )}
            {arr(p.skills).length > 0 && (
              <div style={{ gridColumn: "span 2" }}>
                <div className="vx-mut" style={{ fontSize: 11, marginBottom: 5 }}>Habilidades</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {arr(p.skills).map((s) => <span key={s} className="vx-chip" style={{ fontSize: 11 }}>{s}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Indicadores de Desempenho — seção independente ── */}
        <div style={{ marginTop: 16 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 12 }}>Indicadores de Desempenho</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              { label: "Score", val: p.scoreTriagem != null ? `${Number(p.scoreTriagem).toFixed(0)}%` : "—" },
              { label: "Tarefas", val: `${p.tarefasAprovadas || 0}/${p.tarefasRealizadas || 0}` },
              { label: "Aprovação", val: `${p.taxaAprovacao || 0}%` },
              { label: "Vendas", val: p.vendas || 0 },
              { label: "Compatibilidade", val: `${fit.percentual}%` },
            ].map(({ label, val }) => (
              <div key={label} className="vx-card" style={{ padding: "12px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Michroma','General Sans',sans-serif", fontSize: 22, fontWeight: 700, color: "var(--brand)", fontVariantNumeric: "lining-nums tabular-nums" }}>{val}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Perfil declarado no cadastro ── */}
        {Array.isArray(p.scoreDetalhe?.componentes) && (
          <div className="vx-card" style={{ padding: 16, marginTop: 16 }}>
            <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Perfil declarado no cadastro</div>
            {p.scoreExplicacao && <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 12px", lineHeight: 1.6 }}>{p.scoreExplicacao}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {p.scoreDetalhe.componentes.filter((c) => c.chave !== "base").map((c) => {
                const pct = c.max ? Math.round((c.pontos / c.max) * 100) : 0;
                return (
                  <div key={c.chave}>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--ink)" }}>{c.label} <span className="vx-mut">· {c.valor}</span></span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: pct >= 70 ? "var(--brand)" : pct >= 40 ? "#F59E0B" : "#EF4444" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Pontos positivos e de atenção (quiz de cadastro) ── */}
        {((p.pontosPositivos?.length || 0) + (p.pontosNegativos?.length || 0)) > 0 && (
          <div className="vx-grid vx-g2" style={{ marginTop: 14 }}>
            <section className="vx-card" style={{ padding: 14 }}>
              <h3 className="vx-disp" style={{ fontSize: 15, marginBottom: 10 }}><CheckCircle2 size={15} color="#16A34A" style={{ verticalAlign: -2, marginRight: 5 }} />Pontos positivos</h3>
              {p.pontosPositivos?.length
                ? <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                    {p.pontosPositivos.map((t) => <li key={t} style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 13, lineHeight: 1.45, color: "var(--ink-2)" }}><CheckCircle2 size={14} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} />{t}</li>)}
                  </ul>
                : <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>Sem destaques registrados no cadastro.</p>}
            </section>
            <section className="vx-card" style={{ padding: 14 }}>
              <h3 className="vx-disp" style={{ fontSize: 15, marginBottom: 10 }}><AlertTriangle size={15} color="#B45309" style={{ verticalAlign: -2, marginRight: 5 }} />Pontos de atenção</h3>
              {p.pontosNegativos?.length
                ? <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                    {p.pontosNegativos.map((t) => <li key={t} style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 13, lineHeight: 1.45, color: "var(--ink-2)" }}><AlertTriangle size={14} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />{t}</li>)}
                  </ul>
                : <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>Nenhum ponto de atenção.</p>}
            </section>
          </div>
        )}

        {/* ── Métricas completas ── */}
        <div className="vx-grid vx-g4" style={{ marginTop: 20 }}>
          <Metric label="Score" value={p.scoreTriagem != null ? `${Number(p.scoreTriagem).toFixed(0)}%` : "—"} />
          <Metric label="Tarefas aprovadas" value={`${p.tarefasAprovadas || 0}/${p.tarefasRealizadas || 0}`} />
          <Metric label="Taxa de aprovação" value={`${p.taxaAprovacao || 0}%`} />
          <Metric label="Ganhos totais" value={money(p.ganhosTotais || 0)} />
          <Metric label="Reuniões" value={p.reunioesGeradas || 0} />
          <Metric label="Visitas" value={p.visitas || 0} />
          <Metric label="Vendas" value={p.vendas || 0} />
          <Metric label="Leads" value={p.leadsGerados || 0} />
        </div>

        <div className="vx-grid vx-g2" style={{ marginTop: 14 }}>
          <section className="vx-card" style={{ padding: 14 }}>
            <h3 className="vx-disp" style={{ fontSize: 15 }}>Resumo com IA</h3>
            <p className="vx-mut" style={{ lineHeight: 1.6 }}>{resumoIA(p)}</p>
            <h3 className="vx-disp" style={{ fontSize: 15 }}>Fit cultural</h3>
            <div className="vx-row"><b className="vx-mono" style={{ fontSize: 24 }}>{fit.percentual}%</b><span className="vx-chip">{fit.campanha?.titulo || "campanha de referência"}</span></div>
            <p className="vx-mut">Compatibilidade: {arr(fit.pontos).join("; ")}.</p>
            <p className="vx-mut">Pontos de atenção: {arr(fit.atencao).join("; ")}.</p>
          </section>

          <section className="vx-card" style={{ padding: 14 }}>
            <h3 className="vx-disp" style={{ fontSize: 15 }}>Certificações</h3>
            {p.certificacoes?.length ? p.certificacoes.map((c) => <span key={`${c.funcao}-${c.percentual}`} className="vx-chip" style={{ marginRight: 6, marginBottom: 6 }}><CheckCircle2 size={12} />{PERFIL[c.funcao] || c.funcao} · {c.percentual}%</span>) : <p className="vx-mut">Nenhuma certificação publicada.</p>}
            <p className="vx-mut" style={{ marginTop: 8 }}>Treinamentos concluídos: {p.certificacoes?.length || 0}</p>
          </section>
        </div>

        <div className="vx-grid vx-g2" style={{ marginTop: 14 }}>
          <section className="vx-card" style={{ padding: 14 }}>
            <h3 className="vx-disp" style={{ fontSize: 15 }}>Histórico e resultados</h3>
            {p.campanhas?.length ? <div className="vx-compact-list">{p.campanhas.slice(0, 8).map((c) => <div key={c.id}><div><b>{c.titulo}</b><span>{PERFIL[c.funcao] || c.funcao || "Função não informada"} · {c.regiao || "sem região"}</span></div><span className="vx-chip">{c.candidaturaStatus || c.status}</span></div>)}</div> : <p className="vx-mut">Sem histórico de campanhas nesta empresa.</p>}
            <p className="vx-mut">Tarefas recusadas: {p.tarefasRecusadas || 0} · Leads: {p.leadsGerados || 0}</p>
          </section>

          <section className="vx-card" style={{ padding: 14 }}>
            <h3 className="vx-disp" style={{ fontSize: 15 }}>Treinamentos, feedbacks e certificações</h3>
            {p.certificacoes?.length ? p.certificacoes.map((c) => <span key={`${c.funcao}-${c.percentual}`} className="vx-chip" style={{ marginRight: 6, marginBottom: 6 }}><CheckCircle2 size={12} />{PERFIL[c.funcao] || c.funcao} · {c.percentual}%</span>) : <p className="vx-mut">Nenhuma certificação publicada.</p>}
            <p className="vx-mut">Treinamentos concluídos: {p.certificacoes?.length || 0}</p>
            <p className="vx-mut">Feedbacks: não há feedbacks publicados para esta empresa.</p>
          </section>
        </div>

        {acoes}

        {/* ── Modal secundário: biografia completa ── */}
        {bioExpandida && (
          <div className="vx-overlay" onClick={() => setBioExpandida(false)} style={{ zIndex: 1100 }}>
            <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
              <div className="vx-row" style={{ marginBottom: 16 }}>
                <h3 className="vx-disp" style={{ margin: 0 }}>Biografia — {nomeCompleto}</h3>
                <button className="vx-btn vx-btn-ghost" onClick={() => setBioExpandida(false)}><X size={16} /></button>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--ink)", margin: 0, whiteSpace: "pre-wrap", textAlign: "justify" }}>{p.bio || p.experiencia}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
