import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Plus, Send, AlertTriangle, RefreshCw } from "lucide-react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import ModeloCodigoWhatsapp from "./ModeloCodigoWhatsapp.jsx";
import MetricasWhatsapp from "./MetricasWhatsapp.jsx";
import MensagensWhatsapp from "./MensagensWhatsapp.jsx";
import CustosWhatsapp from "./CustosWhatsapp.jsx";
import ContaWhatsapp from "./ContaWhatsapp.jsx";

const ABAS = [["disparos", "Disparos e desempenho"], ["mensagens", "Mensagens enviadas"], ["custos", "Custos e cliques"], ["conta", "Conta e configurações"]];

const STATUS = {
  enviando: { txt: "Enviando", color: "var(--brand)" },
  concluido: { txt: "Concluído", color: "var(--green)" },
  parcial: { txt: "Parcial", color: "var(--amber)" },
  falhou: { txt: "Falhou", color: "var(--red)" },
};

export default function DisparoWhatsapp({ aviso }) {
  const [tela, setTela] = useState("lista");
  const [aba, setAba] = useState("disparos");
  const [info, setInfo] = useState(null);

  const carregar = useCallback(() => api("/admin/whatsapp").then((r) => { if (r && !r.error) setInfo(r); }), []);
  useEffect(() => { carregar(); }, [carregar]);

  // Enquanto houver disparo em andamento, atualiza os números sozinho.
  const andamento = info?.disparos?.some((d) => d.status === "enviando");
  useEffect(() => {
    if (!andamento || tela !== "lista" || aba !== "disparos") return;
    const t = setInterval(carregar, 5000);
    return () => clearInterval(t);
  }, [andamento, tela, aba, carregar]);

  if (tela === "novo") {
    return <NovoDisparo aviso={aviso} publicos={info?.publicos || []} onVoltar={() => setTela("lista")} onConcluir={() => { setTela("lista"); carregar(); }} />;
  }

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Admin</div>
          <h1 className="vx-disp">Disparo de WhatsApp</h1>
          <p>Envie um template aprovado pela Meta para os vendedores, pelo WhatsApp oficial da RYCS.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="vx-btn vx-btn-sm" onClick={carregar} style={{ minHeight: 44 }}><RefreshCw size={14} /> Atualizar</button>
          <button className="vx-btn vx-btn-primary" disabled={!info?.configurado || andamento || info?.freios?.bloqueioRecente} onClick={() => setTela("novo")} style={{ minHeight: 44 }}>
            <Plus size={15} /> Novo disparo
          </button>
        </div>
      </div>

      {info && !info.configurado && (
        <div className="vx-card" style={{ padding: 16, marginBottom: 16, borderColor: "var(--amber)", background: "var(--amber-50)", display: "flex", gap: 10 }}>
          <AlertTriangle size={18} style={{ color: "var(--amber)", flexShrink: 0 }} />
          <div style={{ fontSize: 13 }}>
            <b>Envio ainda não configurado.</b> Falta no servidor: <span className="vx-mono">{info.faltando.join(", ")}</span>.
          </div>
        </div>
      )}

      {info?.freios?.bloqueioRecente && (
        <div role="alert" className="vx-card" style={{ padding: 16, marginBottom: 16, borderColor: "var(--red)", display: "flex", gap: 10 }}>
          <AlertTriangle size={18} style={{ color: "var(--red)", flexShrink: 0 }} />
          <div style={{ fontSize: 13 }}>
            <b>Disparos pausados por 24h.</b> A Meta avisou que está limitando o número porque muitas mensagens foram bloqueadas ou denunciadas. Novos disparos voltam a ser liberados 24h depois do aviso.
          </div>
        </div>
      )}

      <div className="vx-seg vx-subnav" style={{ marginBottom: 16 }}>
        {ABAS.map(([k, l]) => <button key={k} type="button" data-on={aba === k ? "1" : "0"} onClick={() => setAba(k)}>{l}</button>)}
      </div>

      {aba === "mensagens" && <MensagensWhatsapp aviso={aviso} disparos={info?.disparos || []} />}
      {aba === "custos" && <CustosWhatsapp aviso={aviso} />}
      {aba === "conta" && <ContaWhatsapp aviso={aviso} />}

      {aba === "disparos" && <>
      <ModeloCodigoWhatsapp aviso={aviso} />

      <MetricasWhatsapp m={info?.metricas} />

      {!info ? (
        <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Carregando...</div>
      ) : info.disparos.length === 0 ? (
        <div className="vx-card" style={{ padding: 40, textAlign: "center" }}>
          <MessageSquare size={40} style={{ color: "var(--muted-2)", marginBottom: 12 }} />
          <div className="vx-disp" style={{ fontSize: 17, marginBottom: 6 }}>Nenhum disparo ainda</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Use "Novo disparo" para enviar um template aos vendedores.</div>
        </div>
      ) : (
        <Historico disparos={info.disparos} aviso={aviso} />
      )}
      </>}
    </div>
  );
}

const COLUNAS = "minmax(160px,1fr) 130px 64px 70px 74px 56px 60px 90px 90px";

function Historico({ disparos, aviso }) {
  const [aberto, setAberto] = useState(null);
  const [falhas, setFalhas] = useState([]);

  const abrir = async (d) => {
    if (aberto === d.id) return setAberto(null);
    const r = await api(`/admin/whatsapp/disparos/${d.id}/falhas`);
    if (r?.error) return aviso(r.error);
    setFalhas(Array.isArray(r) ? r : []);
    setAberto(d.id);
  };

  return (
    <div className="vx-card" style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 820 }}>
        <div style={{ display: "grid", gridTemplateColumns: COLUNAS, gap: 10, padding: "10px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>
          <span>Template</span><span>Público</span><span>Total</span><span>Enviados</span><span>Entregues</span><span>Lidos</span><span>Falhas</span><span>Data</span><span>Status</span>
        </div>
        {disparos.map((d) => {
          const st = d.status === "enviando" && d.aguardandoHorario
            ? { txt: "Aguardando horário", color: "var(--amber)" }
            : STATUS[d.status] || STATUS.concluido;
          const nFalhas = (d.falhasEnvio || 0) + (d.falhasEntrega || 0);
          return (
            <div key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "grid", gridTemplateColumns: COLUNAS, gap: 10, padding: "13px 16px", alignItems: "center", fontSize: 13 }}>
                <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${d.template} (${d.idioma})`}>{d.template}</b>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{d.publico}</span>
                <span className="vx-mono">{d.total}</span>
                <span className="vx-mono">{d.enviados}</span>
                <span className="vx-mono">{d.entregues}</span>
                <span className="vx-mono">{d.lidos}</span>
                {nFalhas ? (
                  <button className="vx-btn vx-btn-sm" onClick={() => abrir(d)} aria-expanded={aberto === d.id} style={{ color: "var(--red)", minHeight: 32, padding: "2px 8px" }}>{nFalhas}</button>
                ) : <span className="vx-mono">0</span>}
                <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{dataCurta(d.criadoEm)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: st.color }}>{st.txt}</span>
              </div>
              {d.erro && <div style={{ padding: "0 16px 12px", fontSize: 12, color: "var(--red)" }}>Interrompido: {d.erro}</div>}
              {aberto === d.id && (
                <div style={{ padding: "0 16px 14px" }}>
                  {falhas.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, padding: "4px 0", borderTop: "1px dashed var(--border)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <b>{f.nome || "—"}</b><span className="vx-mono vx-mut">+{f.numero}</span><span style={{ color: "var(--red)" }}>{f.erro || "Falha na entrega"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Texto do template com as escolhas do admin no lugar das variáveis.
function preencher(texto, tpl, variaveis) {
  return String(texto || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, ph) => {
    const v = variaveis[tpl.variaveis.indexOf(ph)];
    if (!v) return m;
    if (v.origem === "nome") return "‹primeiro nome›";
    if (v.origem === "pendencias") return "‹o que falta no perfil›";
    return v.texto || m;
  });
}

function NovoDisparo({ aviso, publicos, onVoltar, onConcluir }) {
  const [passo, setPasso] = useState(1);
  const [templates, setTemplates] = useState(null);
  const [tpl, setTpl] = useState(null);
  const [variaveis, setVariaveis] = useState([]);
  const [publico, setPublico] = useState(publicos[0]?.key || "ativos");
  const [preview, setPreview] = useState(null);
  const [lote, setLote] = useState("");
  const [para, setPara] = useState("");
  const [nomeTeste, setNomeTeste] = useState("");
  const [testando, setTestando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api("/admin/whatsapp/templates").then((r) => {
      if (r?.error) { aviso(r.error); setTemplates([]); return; }
      setTemplates(Array.isArray(r) ? r : []);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- carrega uma vez ao abrir

  const escolher = (t) => {
    setTpl(t);
    setVariaveis(t.variaveis.map(() => ({ origem: "nome", texto: "" })));
  };

  const mudarVar = (i, campo, valor) => setVariaveis((vs) => vs.map((v, j) => (j === i ? { ...v, [campo]: valor } : v)));

  const revisar = async () => {
    if (variaveis.some((v) => v.origem === "fixo" && !v.texto.trim())) return aviso("Preencha o texto das variáveis fixas.");
    if (variaveis.some((v) => v.origem === "pendencias") && !publicos.find((p) => p.key === publico)?.pendencias) {
      const nomes = publicos.filter((p) => p.pendencias).map((p) => p.label).join(", ");
      return aviso(`A variável de pendências só funciona com o público ${nomes}.`);
    }
    const r = await api("/admin/whatsapp/preview", { publico, template: tpl.nome });
    if (r?.error) return aviso(r.error);
    setPreview(r);
    setLote(String(Math.min(r.freios.lotePadrao, r.quantidade, r.freios.vagas24h)));
    setConfirmado(false);
    setPasso(3);
  };

  // Tamanho da rodada: nunca acima do que o público, o lote máximo e as vagas de 24h permitem.
  const maxLote = preview ? Math.min(preview.quantidade, preview.freios.loteMaximo, preview.freios.vagas24h) : 0;
  const nLote = Math.trunc(Number(lote));
  const loteOk = nLote >= 1 && nLote <= maxLote;

  const enviarTeste = async () => {
    if (!para.trim()) return aviso("Informe o número para o teste.");
    setTestando(true);
    const r = await api("/admin/whatsapp/teste", { para, nomeTeste, template: tpl.nome, idioma: tpl.idioma, variaveis });
    setTestando(false);
    aviso(r?.error || "Mensagem de teste enviada.");
  };

  const disparar = async () => {
    if (!confirmado) return aviso("Confirme o envio.");
    if (!loteOk) return aviso(`Escolha de 1 a ${maxLote} pessoas nesta rodada.`);
    setEnviando(true);
    const r = await api("/admin/whatsapp/disparar", { publico, template: tpl.nome, idioma: tpl.idioma, variaveis, limite: nLote });
    setEnviando(false);
    if (r?.error) return aviso(r.error);
    aviso(`Disparo iniciado para ${r.quantidade} vendedor(es).`);
    onConcluir();
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ minHeight: 44 }}>← Voltar</button>
        <h2 style={{ margin: 0, fontSize: 19 }}>Novo disparo de WhatsApp</h2>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 24, overflow: "auto" }}>
        {["Template", "Variáveis e público", "Revisar e enviar"].map((s, i) => (
          <span key={s} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", background: passo === i + 1 ? "var(--brand)" : passo > i + 1 ? "var(--brand-50)" : "var(--surface-2)", color: passo === i + 1 ? "#fff" : passo > i + 1 ? "var(--brand)" : "var(--muted)", border: "1px solid", borderColor: passo >= i + 1 ? "var(--brand)" : "var(--border)" }}>{i + 1}. {s}</span>
        ))}
      </div>

      {passo === 1 && (
        <div className="vx-card" style={{ padding: 22 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Escolha o template</h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>Só aparecem templates aprovados pela Meta. Para criar um novo, use o WhatsApp Manager.</p>
          {!templates ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Carregando templates...</div>
          ) : templates.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Nenhum template aprovado ainda.</div>
          ) : (
            <div role="radiogroup" aria-label="Templates aprovados" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {templates.map((t) => {
                const sel = tpl?.nome === t.nome && tpl?.idioma === t.idioma;
                return (
                  <button key={`${t.nome}-${t.idioma}`} role="radio" aria-checked={sel} disabled={!t.suportado} onClick={() => escolher(t)}
                    style={{ minHeight: 44, textAlign: "left", padding: 12, border: "1.5px solid", borderColor: sel ? "var(--brand)" : "var(--border)", borderRadius: 12, background: sel ? "var(--brand-50)" : "var(--surface)", cursor: t.suportado ? "pointer" : "not-allowed", opacity: t.suportado ? 1 : 0.6, color: "var(--ink)" }}>
                    <b style={{ fontSize: 13 }}>{t.nome}</b>
                    <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{t.idioma} · {t.categoria}</span>
                    {!t.suportado && <div style={{ fontSize: 12, color: "var(--amber)", marginTop: 4 }}>{t.motivo}</div>}
                  </button>
                );
              })}
            </div>
          )}
          {tpl && <Bolha tpl={tpl} variaveis={variaveis} />}
          <button className="vx-btn vx-btn-primary" disabled={!tpl} onClick={() => setPasso(2)} style={{ minHeight: 44, marginTop: 16 }}>Próximo →</button>
        </div>
      )}

      {passo === 2 && tpl && (
        <div className="vx-card" style={{ padding: 22 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Variáveis e público</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {tpl.variaveis.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>Este template não tem variáveis.</div>}
            {tpl.variaveis.map((ph, i) => (
              <div key={ph} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 8, alignItems: "end" }}>
                <div>
                  <label className="vx-label" htmlFor={`wa-var-${i}`}>Variável {`{{${ph}}}`}</label>
                  <select id={`wa-var-${i}`} className="vx-input" value={variaveis[i].origem} onChange={(e) => mudarVar(i, "origem", e.target.value)} style={{ minHeight: 44 }}>
                    <option value="nome">Primeiro nome do vendedor</option>
                    <option value="pendencias">O que falta no perfil de cada um</option>
                    <option value="fixo">Texto fixo</option>
                  </select>
                </div>
                {variaveis[i].origem === "fixo" && (
                  <div>
                    <label className="vx-label" htmlFor={`wa-txt-${i}`}>Texto para {`{{${ph}}}`}</label>
                    <input id={`wa-txt-${i}`} className="vx-input" maxLength={300} value={variaveis[i].texto} onChange={(e) => mudarVar(i, "texto", e.target.value)} style={{ minHeight: 44 }} />
                  </div>
                )}
              </div>
            ))}
            <div>
              <label className="vx-label" htmlFor="wa-publico">Público</label>
              <select id="wa-publico" className="vx-input" value={publico} onChange={(e) => setPublico(e.target.value)} style={{ minHeight: 44 }}>
                {publicos.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <Bolha tpl={tpl} variaveis={variaveis} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button className="vx-btn vx-btn-sm" onClick={() => setPasso(1)} style={{ minHeight: 44 }}>← Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={revisar} style={{ minHeight: 44 }}>Revisar →</button>
          </div>
        </div>
      )}

      {passo === 3 && tpl && preview && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="vx-card" style={{ padding: 22 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Resumo</h3>
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              <b className="vx-mono">{preview.quantidade}</b> de {preview.total} {preview.publicoLabel.toLowerCase()} podem receber <b>{tpl.nome}</b> ({tpl.idioma}).
            </div>
            <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 12.5, color: "var(--muted)" }}>
              <li>{preview.jaReceberam} já receberam este template</li>
              <li>{preview.semNumero} sem WhatsApp válido</li>
              <li>{preview.descadastrados} pediram para não receber mais</li>
              <li>{preview.duplicados} com número repetido</li>
            </ul>
            <Bolha tpl={tpl} variaveis={variaveis} />
          </div>

          <div className="vx-card" style={{ padding: 22 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Tamanho desta rodada</h3>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
              Comece pequeno e confira entregas, bloqueios e pedidos para sair antes da próxima rodada. Quem já recebeu não entra de novo.
            </p>
            <div style={{ maxWidth: 220 }}>
              <label className="vx-label" htmlFor="wa-lote">Pessoas nesta rodada (máx. {maxLote})</label>
              <input id="wa-lote" className="vx-input" type="number" inputMode="numeric" min={1} max={maxLote} value={lote}
                onChange={(e) => { setLote(e.target.value); setConfirmado(false); }} aria-invalid={!loteOk} style={{ minHeight: 44 }} />
            </div>
            <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
              <li>Limite de segurança: {preview.freios.limite24h} pessoas a cada 24h, somando todos os disparos. Restam {preview.freios.vagas24h}.</li>
              <li>Envio só das {preview.freios.horario.inicio}h às {preview.freios.horario.fim}h no horário de cada vendedor. Fora disso, a fila espera.</li>
              <li>O disparo para sozinho se a Meta avisar sobre bloqueios ou se 30% ou mais das mensagens falharem.</li>
            </ul>
          </div>

          <div className="vx-card" style={{ padding: 22 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Enviar um teste</h3>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto", gap: 8, alignItems: "end" }}>
              <div>
                <label className="vx-label" htmlFor="wa-teste-num">WhatsApp para o teste</label>
                <input id="wa-teste-num" className="vx-input" inputMode="tel" value={para} onChange={(e) => setPara(e.target.value)} placeholder="(15) 99999-9999 ou +91…" style={{ minHeight: 44 }} />
              </div>
              <div>
                <label className="vx-label" htmlFor="wa-teste-nome">Nome no teste</label>
                <input id="wa-teste-nome" className="vx-input" value={nomeTeste} onChange={(e) => setNomeTeste(e.target.value)} style={{ minHeight: 44 }} />
              </div>
              <button className="vx-btn" onClick={enviarTeste} disabled={testando} style={{ minHeight: 44 }}><Send size={14} /> {testando ? "Enviando..." : "Enviar teste"}</button>
            </div>
          </div>

          <div className="vx-card" style={{ padding: 22 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, minHeight: 44, cursor: "pointer" }}>
              <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} style={{ width: 20, height: 20 }} />
              Confirmo o envio para {loteOk ? nLote : "—"} vendedor(es). Não dá para desfazer.
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="vx-btn vx-btn-sm" onClick={() => setPasso(2)} style={{ minHeight: 44 }}>← Voltar</button>
              <button className="vx-btn vx-btn-primary" onClick={disparar} disabled={!confirmado || enviando || !loteOk} style={{ minHeight: 44 }}>
                <Send size={15} /> {enviando ? "Iniciando..." : "Disparar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Prévia no formato de mensagem do WhatsApp.
function Bolha({ tpl, variaveis }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>Prévia</div>
      <div style={{ background: "var(--surface)", borderRadius: 10, padding: 12, maxWidth: 380, boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
        {tpl.cabecalho && <b style={{ display: "block", fontSize: 13.5, marginBottom: 6 }}>{tpl.cabecalho}</b>}
        <div style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{preencher(tpl.corpo, tpl, variaveis)}</div>
        {tpl.rodape && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>{tpl.rodape}</div>}
        {tpl.botoes.length > 0 && (
          <div style={{ marginTop: 10, borderTop: "1px solid var(--border)" }}>
            {tpl.botoes.map((b, i) => (
              <div key={i} style={{ textAlign: "center", padding: "8px 0", fontSize: 13, color: "var(--brand)", borderBottom: i < tpl.botoes.length - 1 ? "1px solid var(--border)" : "none" }}>{b.texto}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
