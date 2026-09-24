import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { uid, agora, money } from "../../lib/utils.js";
import { ACOES, CAMPOS, ORDEM_ACOES, TAXA } from "../../lib/constants.js";
import { EVIDENCE_MATRIX, EVIDENCE_SLOTS, validateProva } from "../../../shared/evidenceMatrix.js";
import { Campo, Vazio } from "../ui.jsx";
import UploadEvidencia from "./UploadEvidencia.jsx";

// Seções de campos obrigatórios por tipo de tarefa
const CAMPOS_CONTATO_BASE = ["cliente", "telefone"];

const SECOES_EXTRA = {
  contato:        { campos: ["empresa", "cargo", "canal"], titulo: "Dados do contato" },
  lead_qualificado:{ campos: ["empresa", "cargo", "canal", "interesse", "necessidade", "fit", "objecoes", "proximo_passo"], titulo: "Qualificação do lead" },
  follow:         { campos: ["canal", "resultado", "proximo_follow"], titulo: "Follow-up" },
  agendamento:    { campos: ["empresa", "datahora", "modalidade", "link_reuniao"], titulo: "Dados da reunião" },
  realizada:      { campos: ["empresa", "duracao", "necessidade", "interesse", "objecoes", "resultado", "proximo_passo"], titulo: "Resumo da reunião" },
  ligacao:        { campos: ["duracao", "resultado"], titulo: "Dados da ligação" },
  visita:         { campos: ["empresa", "endereco", "resultado", "proximo_passo"], titulo: "Dados da visita" },
  venda:          { campos: ["empresa", "documento", "valorContrato", "produto"], titulo: "Dados da venda" },
};

function EvidenceItem({ slot, idx, value, onChange, isRequired }) {
  const def = EVIDENCE_SLOTS[slot] || { label: `Evidência ${idx + 1}`, ph: "", isUrl: false };
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ background: isRequired ? "var(--brand)" : "var(--surface-3)", color: isRequired ? "#fff" : "var(--ink-2)", borderRadius: 4, padding: "2px 7px", fontSize: 10.5, fontWeight: 700 }}>
          {isRequired ? `OBRIGATÓRIA ${idx + 1}` : "ADICIONAL"}
        </span>
        {def.label}
      </div>
      <UploadEvidencia slot={slot} value={value || ""} onChange={onChange} placeholder={def.ph} />
    </div>
  );
}

function ValidationErrors({ erros }) {
  if (!erros.length) return null;
  return (
    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, color: "#B91C1C", marginBottom: 6 }}>Faltam informações para enviar:</div>
      {erros.map((e, i) => (
        <div key={i} style={{ fontSize: 12, color: "#DC2626", marginBottom: 2 }}>• {e}</div>
      ))}
    </div>
  );
}

function IntegrityNotice() {
  return (
    <div style={{
      background: "#1e1b4b",
      border: "1.5px solid #4338ca",
      borderRadius: 10,
      padding: "12px 14px",
      marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 15 }}>🛡</span>
        <span style={{ fontWeight: 800, fontSize: 12.5, color: "#e0e7ff", letterSpacing: "0.02em", textTransform: "uppercase" }}>
          Integridade das Informações
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: "#c7d2fe", lineHeight: 1.55 }}>
        As ações e evidências enviadas na RYCS podem passar por verificações automáticas e manuais de consistência, evidências, duplicidade e outros sinais de auditoria.
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#a5b4fc", lineHeight: 1.5 }}>
        Informações comprovadamente falsas, manipuladas ou inconsistentes podem resultar em:
        <span style={{ display: "block", paddingLeft: 10, marginTop: 3 }}>
          · recusa da tarefa · perda da remuneração · suspensão do acesso
        </span>
      </div>
      <div style={{ marginTop: 8, fontWeight: 700, fontSize: 12, color: "#818cf8" }}>
        Envie somente informações e evidências reais.
      </div>
    </div>
  );
}

export default function Tarefas({ campanha, empresa, eu, db, setDb, aviso, liberado, irCurso, recarregar, tipoInicial }) {
  const [tipo, setTipo] = useState(tipoInicial || null);
  const [prova, setProva] = useState({});
  const [evidencias, setEvidencias] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [novoLead, setNovoLead] = useState({ nome: "", empresa: "", telefone: "" });

  useEffect(() => {
    if (tipoInicial) {
      const m = EVIDENCE_MATRIX[tipoInicial];
      setEvidencias(m ? m.required.map((slot) => ({ slot, valor: "" })) : []);
    }
  }, [tipoInicial]);

  const valores = campanha?.tarefas || {};
  const tiposDisponiveis = ORDEM_ACOES.filter((k) => valores[k] > 0 && ACOES[k]);
  const leads = (db.leads || []).filter(
    (l) => l.companyId === empresa.id && (!campanha || l.campaignId === campanha.id)
  );

  const matrix = tipo ? EVIDENCE_MATRIX[tipo] : null;
  const secao = tipo ? SECOES_EXTRA[tipo] : null;
  const erros = tipo ? validateProva(tipo, prova, evidencias, null) : [];

  const abrirTipo = (k) => {
    setTipo(k);
    setProva({});
    setLeadId("");
    setTentouEnviar(false);
    const m = EVIDENCE_MATRIX[k];
    if (!m) { setEvidencias([]); return; }
    setEvidencias(m.required.map((slot) => ({ slot, valor: "" })));
  };

  const setEvidenciaValor = (idx, valor) => {
    setEvidencias((prev) => prev.map((e, i) => (i === idx ? { ...e, valor } : e)));
  };

  const addEvidencia = () => {
    const opcional = matrix?.optional?.[0] || "contact_proof";
    setEvidencias((prev) => [...prev, { slot: opcional, valor: "", adicional: true }]);
  };

  const removeEvidencia = (idx) => {
    setEvidencias((prev) => prev.filter((_, i) => i !== idx));
  };

  const cadastrarLead = async () => {
    if (!novoLead.nome.trim() || !novoLead.telefone.trim()) return aviso("Informe nome e telefone do lead.");
    const r = await api("/leads", { ...novoLead, companyId: empresa.id, campaignId: campanha?.id });
    if (!r || r.error) return aviso(r?.error || "Não foi possível cadastrar o lead.");
    setLeadId(r.id);
    setProva((p) => ({ ...p, cliente: novoLead.nome.trim(), telefone: novoLead.telefone }));
    setNovoLead({ nome: "", empresa: "", telefone: "" });
    await recarregar();
    aviso("Lead cadastrado e selecionado.");
  };

  const enviar = async () => {
    setTentouEnviar(true);
    const errosAtuais = validateProva(tipo, prova, evidencias, null);
    if (errosAtuais.length) return;

    if (campanha && tipo === "agendamento" && !leadId) return aviso("Selecione o lead da reunião.");

    setEnviando(true);
    const provaFinal = {
      ...prova,
      evidencias: evidencias.map((e) => ({ slot: e.slot, valor: e.valor })),
    };
    const r = await api("/submissions", {
      sellerId: eu.id,
      companyId: empresa.id,
      campaignId: campanha?.id,
      leadId: leadId || undefined,
      tipo,
      prova: provaFinal,
    });
    setEnviando(false);

    if (!r || r.error) return aviso(r?.error || "Não foi possível enviar a comprovação.");
    setTipo(null); setProva({}); setEvidencias([]); setTentouEnviar(false);
    await recarregar();
    aviso({
      ia_aprovado: "Comprovação aprovada pela análise automática.",
      revisao: "Enviada para conferência da empresa.",
      ia_recusado: `Recusada: ${r.motivo}`,
    }[r.status] || "Comprovação enviada.");
  };

  if (!liberado)
    return (
      <Vazio
        titulo="Tarefas bloqueadas"
        texto="Conclua o curso preparatório desta empresa para registrar ações. São poucos minutos e evita comprovação recusada."
        acao={<button className="vx-btn vx-btn-primary" onClick={irCurso}>Ir para o curso</button>}
      />
    );

  if (!tiposDisponiveis.length)
    return (
      <Vazio
        titulo="Nenhuma tarefa configurada"
        texto="A campanha ainda não tem tipos de tarefa com valor definido. Entre em contato com a empresa."
      />
    );

  return (
    <>
      <div className="vx-grid vx-g2">
        {tiposDisponiveis.filter((k) => valores[k]).map((k) => {
          const Icon = ACOES[k].Icon;
          const m = EVIDENCE_MATRIX[k];
          return (
            <div key={k} className="vx-card" style={{ padding: 16 }}>
              <div className="vx-row" style={{ alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <Icon size={14} color="var(--brand)" strokeWidth={2.3} />
                  </span>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{ACOES[k].nome}</div>
                </div>
                <div className="vx-disp vx-mono" style={{ fontSize: 18, color: "var(--brand)" }}>{money(valores[k])}</div>
              </div>
              <p className="vx-mut" style={{ fontSize: 12.5, margin: "10px 0 4px" }}>{ACOES[k].regra}</p>
              {m && (
                <p className="vx-mut" style={{ fontSize: 11, margin: "0 0 10px", fontWeight: 600 }}>
                  {m.minEvidence} evidência{m.minEvidence > 1 ? "s" : ""} obrigatória{m.minEvidence > 1 ? "s" : ""}
                </p>
              )}
              <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => abrirTipo(k)}>Registrar ação</button>
            </div>
          );
        })}
      </div>

      <p className="vx-mut" style={{ fontSize: 12, marginTop: 18 }}>
        Toda ação é analisada automaticamente por IA assim que enviada. Aprovada, segue direto para a liberação
        da plataforma; em caso de dúvida, vai para conferência humana da empresa. Descontamos {Math.round(TAXA * 100)}%
        de taxa de serviço no repasse.
      </p>

      {tipo && (
        <div className="vx-overlay" onClick={() => setTipo(null)}>
          <div className="vx-sheet vx-fade" style={{ maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            {/* Cabeçalho */}
            <div className="vx-row" style={{ marginBottom: 4 }}>
              <div className="vx-disp" style={{ fontSize: 19 }}>{ACOES[tipo].nome}</div>
              <div className="vx-disp vx-mono" style={{ fontSize: 19, color: "var(--brand)" }}>{money(valores[tipo])}</div>
            </div>
            <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>{ACOES[tipo].regra}</p>

            {matrix && (
              <div style={{ background: "var(--brand-50)", borderRadius: 8, padding: "6px 10px", marginBottom: 12, fontSize: 12, fontWeight: 700, color: "var(--brand)" }}>
                {matrix.minEvidence} evidência{matrix.minEvidence > 1 ? "s" : ""} obrigatória{matrix.minEvidence > 1 ? "s" : ""}
                {tipo === "realizada" && " — gravação + resumo estruturado"}
              </div>
            )}

            <hr className="vx-sep" />

            {/* Lead (agendamento) */}
            {campanha && tipo === "agendamento" && (
              <Campo label="Lead da reunião">
                <select className="vx-input" value={leadId} onChange={(e) => {
                  const id = e.target.value;
                  const lead = leads.find((l) => l.id === id);
                  setLeadId(id);
                  if (lead) setProva((p) => ({ ...p, cliente: lead.nome || "", telefone: lead.telefone || "", empresa: lead.empresa || "" }));
                }}>
                  <option value="">Selecione o lead</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.nome}{l.empresa ? ` · ${l.empresa}` : ""}</option>)}
                </select>
              </Campo>
            )}
            {campanha && tipo === "agendamento" && campanha.aceitaLeadProprio && (
              <div className="vx-card" style={{ padding: 12, marginBottom: 10 }}>
                <div className="vx-label">Cadastrar novo lead</div>
                <input className="vx-input" placeholder="Nome do contato" value={novoLead.nome} onChange={(e) => setNovoLead({ ...novoLead, nome: e.target.value })} />
                <input className="vx-input" style={{ marginTop: 7 }} placeholder="Empresa" value={novoLead.empresa} onChange={(e) => setNovoLead({ ...novoLead, empresa: e.target.value })} />
                <input className="vx-input" style={{ marginTop: 7 }} placeholder="WhatsApp" value={novoLead.telefone} onChange={(e) => setNovoLead({ ...novoLead, telefone: e.target.value })} />
                <button type="button" className="vx-btn vx-btn-sm" style={{ marginTop: 8 }} onClick={cadastrarLead}>Cadastrar e selecionar</button>
              </div>
            )}

            {/* Campos do contato */}
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-2)" }}>Contato</div>
            {CAMPOS_CONTATO_BASE.map((c) => (
              <Campo key={c} label={CAMPOS[c].label}>
                <input className="vx-input" placeholder={CAMPOS[c].ph} value={prova[c] || ""} onChange={(e) => setProva({ ...prova, [c]: e.target.value })} />
              </Campo>
            ))}

            {/* Campos da seção extra */}
            {secao && secao.campos.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: 12, margin: "12px 0 6px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-2)" }}>{secao.titulo}</div>
                {secao.campos.map((c) => {
                  const campo = CAMPOS[c];
                  if (!campo) return null;
                  const isLong = ["resultado", "observacoes", "interesse", "necessidade", "fit", "objecoes", "proximo_passo", "meeting_data"].includes(c);
                  return (
                    <Campo key={c} label={campo.label}>
                      {isLong ? (
                        <textarea className="vx-input" style={{ minHeight: 56, resize: "vertical" }} placeholder={campo.ph} value={prova[c] || ""} onChange={(e) => setProva({ ...prova, [c]: e.target.value })} />
                      ) : (
                        <input className="vx-input" placeholder={campo.ph} value={prova[c] || ""} onChange={(e) => setProva({ ...prova, [c]: e.target.value })} />
                      )}
                    </Campo>
                  );
                })}
              </>
            )}

            {/* Evidências */}
            {matrix && (
              <>
                <hr className="vx-sep" />
                <div style={{ fontWeight: 700, fontSize: 12, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-2)" }}>
                  Evidências ({matrix.minEvidence} obrigatória{matrix.minEvidence > 1 ? "s" : ""})
                </div>

                {tipo === "realizada" && (
                  <div style={{ background: "var(--amber-50)", border: "1px solid var(--amber-100)", color: "var(--ink)", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 12 }}>
                    <b>Atenção:</b> Reunião agendada ≠ Reunião realizada. Para marcar como realizada é obrigatório: gravação/vídeo <b>e</b> resumo estruturado.
                  </div>
                )}

                {evidencias.map((ev, idx) => {
                  const isRequired = idx < matrix.required.length;
                  return (
                    <div key={idx} style={{ position: "relative" }}>
                      <EvidenceItem
                        slot={ev.slot}
                        idx={idx}
                        value={ev.valor}
                        onChange={(v) => setEvidenciaValor(idx, v)}
                        isRequired={isRequired}
                      />
                      {!isRequired && (
                        <button
                          type="button"
                          onClick={() => removeEvidencia(idx)}
                          style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: "var(--red)", padding: 2 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {matrix.optional && matrix.optional.length > 0 && (
                  <button type="button" className="vx-btn vx-btn-sm" style={{ marginBottom: 8 }} onClick={addEvidencia}>
                    <Plus size={13} style={{ marginRight: 4 }} />
                    Adicionar evidência
                  </button>
                )}
              </>
            )}

            <hr className="vx-sep" />
            <IntegrityNotice />

            {tentouEnviar && <ValidationErrors erros={erros} />}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="vx-btn" onClick={() => setTipo(null)}>Cancelar</button>
              <button className="vx-btn vx-btn-primary" style={{ flex: 1 }} disabled={enviando} onClick={enviar}>
                {enviando ? "Enviando…" : "Enviar comprovação"}
              </button>
            </div>
            <p className="vx-mut" style={{ fontSize: 11.5, marginBottom: 0, marginTop: 10, textAlign: "center" }}>
              Envie somente informações reais e evidências legítimas.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
