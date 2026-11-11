import { useState } from "react";
import { CheckCircle2, Plus, Trash2, BookOpen, ShieldCheck, Sparkles, CircleAlert } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { useI18n } from "../../lib/i18n.jsx";

const padrao = {
  criterios: { perfis: ["sdr", "closer"], notaMinima: 60, exigeVideo: false, tipoOperacao: "remota" },
  notaMinimaQuiz: 70,
  questoes: [],
};

export default function QualificacaoEmpresa({ emp, up, aviso, completarInformacoes }) {
  const { t } = useI18n();
  const [qualificacao, setQualificacao] = useState({ ...padrao, ...(emp.qualificacao || {}), criterios: { ...padrao.criterios, ...(emp.qualificacao?.criterios || {}) } });
  const [curso, setCurso] = useState(emp.curso || []);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [pendencias, setPendencias] = useState([]);
  const [perfilRascunho, setPerfilRascunho] = useState(() => (emp.qualificacao?.criterios?.perfis || padrao.criterios.perfis)[0]);
  const gerarRascunho = async () => {
    setGerando(true);
    const r = await api("/assistant/training-draft", { perfil: perfilRascunho || (qualificacao.criterios.perfis || [])[0] || "sdr", tipoOperacao: qualificacao.criterios.tipoOperacao || "remota" });
    setGerando(false);
    if (r?.pendencias?.length) { setPendencias(r.pendencias); return; }
    if (r?.error) return aviso(r.error);
    setCurso(r.modulos); setQualificacao((q) => ({ ...q, questoes: r.questoes }));
    aviso(t("qual.draftCreated"));
  };
  const alterarCriterio = (chave, valor) => setQualificacao((q) => ({ ...q, criterios: { ...q.criterios, [chave]: valor } }));
  const alternarPerfil = (perfil) => {
    const atuais = qualificacao.criterios.perfis || [];
    alterarCriterio("perfis", atuais.includes(perfil) ? atuais.filter((p) => p !== perfil) : [...atuais, perfil]);
  };
  const atualizarModulo = (i, campo, valor) => setCurso((lista) => lista.map((m, n) => n === i ? { ...m, [campo]: valor } : m));
  const atualizarQuestao = (i, campo, valor) => setQualificacao((q) => ({ ...q, questoes: q.questoes.map((x, n) => n === i ? { ...x, [campo]: valor } : x) }));
  const salvar = async () => {
    if (qualificacao.questoes.some((q) => !q.pergunta.trim() || q.opcoes.some((o) => !o.trim()))) return aviso(t("qual.fillAllFields"));
    setSalvando(true);
    const r = await apiPatch(`/companies/${emp.id}`, { qualificacao, curso });
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, qualificacao, curso } : c) }));
    aviso(t("qual.published"));
  };
  return <div className="vx-fade" style={{ maxWidth: 860 }}>
    <div className="vx-eyebrow" style={{ marginBottom: 7 }}>{t("qual.eyebrow")}</div>
    <div className="vx-row" style={{alignItems:"flex-start",flexWrap:"wrap"}}><div><h2 className="vx-disp" style={{ fontSize: 24, margin: "0 0 8px" }}>{t("qual.academy", { name: emp.nome })}</h2><div className="vx-mut" style={{fontSize:12}}>{t("qual.draftNote")}</div></div><div style={{display:"flex",gap:7,alignItems:"center"}}><select className="vx-input" aria-label="Perfil do rascunho" style={{width:150}} value={perfilRascunho} onChange={(e) => setPerfilRascunho(e.target.value)}>{[["sdr", "SDR"], ["bdr", "BDR"], ["closer", "Closer"], ["pap", "PAP"], ["sem-exp", "Iniciante"]].map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select><button className="vx-btn vx-btn-primary vx-btn-sm" disabled={gerando} onClick={gerarRascunho}><Sparkles size={14}/>{gerando ? t("qual.generating") : t("qual.generateDraft")}</button></div></div>
    <p className="vx-mut" style={{ fontSize: 13.5, marginTop: 0 }}>{t("qual.description")}</p>

    <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-row" style={{ marginBottom: 12 }}><b><ShieldCheck size={16} style={{ verticalAlign: -3, marginRight: 6 }} />{t("qual.mandatoryCriteria")}</b><span className="vx-chip">{t("qual.autoBlock")}</span></div>
      <div className="vx-label">{t("qual.eligibleProfiles")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>{[["sdr", "SDR"], ["bdr", "BDR"], ["closer", "Closer"], ["pap", "PAP / Porta a Porta"], ["sem-exp", "Iniciante"]].map(([k, label]) => <button key={k} className="vx-btn vx-btn-sm" onClick={() => alternarPerfil(k)} style={{ borderColor: qualificacao.criterios.perfis?.includes(k) ? "var(--brand)" : undefined, background: qualificacao.criterios.perfis?.includes(k) ? "var(--brand-50)" : undefined }}>{qualificacao.criterios.perfis?.includes(k) && <CheckCircle2 size={14} />}{label}</button>)}</div>
      <label style={{display:"block",marginBottom:16}}><div className="vx-label">{t("qual.operationType")}</div><select className="vx-input" value={qualificacao.criterios.tipoOperacao || "remota"} onChange={(e) => alterarCriterio("tipoOperacao", e.target.value)}><option value="remota">{t("qual.opRemote")}</option><option value="hibrida">{t("qual.opHybrid")}</option><option value="pap">{t("qual.opPAP")}</option><option value="campo">{t("qual.opField")}</option></select></label>
      <div className="vx-grid vx-g2"><label><div className="vx-label">{t("qual.minTriageScore")}</div><input className="vx-input vx-mono" type="number" min="0" max="100" value={qualificacao.criterios.notaMinima} onChange={(e) => alterarCriterio("notaMinima", Number(e.target.value))} /></label><label><div className="vx-label">{t("qual.minQuizScore")}</div><input className="vx-input vx-mono" type="number" min="0" max="100" value={qualificacao.notaMinimaQuiz} onChange={(e) => setQualificacao((q) => ({ ...q, notaMinimaQuiz: Number(e.target.value) }))} /></label></div>
      <label style={{ display: "flex", gap: 9, alignItems: "center", marginTop: 16, fontSize: 13.5 }}><input type="checkbox" checked={!!qualificacao.criterios.exigeVideo} onChange={(e) => alterarCriterio("exigeVideo", e.target.checked)} /> {t("qual.requireVideo")}</label>
    </section>

    <section className="vx-card" style={{ padding: 18, marginTop: 16, borderColor: "var(--brand-100)" }}>
      <div className="vx-row" style={{ marginBottom: 4 }}><div><b><BookOpen size={16} style={{ verticalAlign: -3, marginRight: 6 }} />{t("qual.trainingContent")}</b><div className="vx-mut" style={{fontSize:11.5,marginTop:4}}>{t("qual.trainingNote")}</div></div><button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => setCurso((c) => [...c, { id: `mod-${Date.now()}`, titulo: "", conteudo: "", min: 5 }])}><Plus size={14} />{t("qual.addModule")}</button></div>
      {!curso.length && <div className="vx-notice vx-notice-amber" style={{marginTop:14}}>{t("qual.noContent")}</div>}
      {curso.map((m, i) => <div key={m.id} className="vx-card" style={{ padding: 14, marginTop: 12, background: "var(--surface-2)" }}><div className="vx-row" style={{ gap: 8, alignItems:"flex-start" }}><span className="vx-chip vx-mono">{t("qual.module", { n: i + 1 })}</span><input className="vx-input" value={m.titulo} onChange={(e) => atualizarModulo(i, "titulo", e.target.value)} placeholder={t("qual.moduleTitle")} /><button className="vx-btn vx-btn-danger vx-btn-sm" aria-label="Remover módulo" onClick={() => setCurso((c) => c.filter((_, n) => n !== i))}><Trash2 size={14} /></button></div><div className="vx-grid vx-g2" style={{marginTop:8}}><textarea className="vx-input" style={{ minHeight: 92 }} value={m.conteudo} onChange={(e) => atualizarModulo(i, "conteudo", e.target.value)} placeholder={t("qual.moduleContent")} /><label><div className="vx-label">{t("qual.duration")}</div><input className="vx-input vx-mono" type="number" min="1" value={m.min || 5} onChange={(e) => atualizarModulo(i, "min", Math.max(1, Number(e.target.value) || 1))} /></label></div></div>)}
    </section>

    <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-row"><b>{t("qual.quiz")}</b><button className="vx-btn vx-btn-sm" onClick={() => setQualificacao((q) => ({ ...q, questoes: [...q.questoes, { pergunta: "", opcoes: ["", "", ""], correta: 0 }] }))}><Plus size={14} />{t("qual.question")}</button></div>
      <p className="vx-mut" style={{ fontSize: 12.5 }}>{t("qual.quizNote")}</p>
      {qualificacao.questoes.map((q, i) => <div key={i} style={{ paddingTop: 14, marginTop: 14, borderTop: "1px solid var(--border)" }}><div className="vx-row"><span className="vx-chip vx-mono">{i + 1}</span><input className="vx-input" value={q.pergunta} onChange={(e) => atualizarQuestao(i, "pergunta", e.target.value)} placeholder={t("qual.questionPlaceholder")} /><button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => setQualificacao((x) => ({ ...x, questoes: x.questoes.filter((_, n) => n !== i) }))}><Trash2 size={14} /></button></div>{q.opcoes.map((op, n) => <label key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13 }}><input type="radio" name={`correta-${i}`} checked={Number(q.correta) === n} onChange={() => atualizarQuestao(i, "correta", n)} /><input className="vx-input" value={op} onChange={(e) => atualizarQuestao(i, "opcoes", q.opcoes.map((x, p) => p === n ? e.target.value : x))} placeholder={t("qual.alternative", { n: n + 1 })} /></label>)}{q.justificativa&&<div className="vx-chart-source">{q.justificativa}</div>}</div>)}
      {!qualificacao.questoes.length && <div className="vx-mut" style={{ fontSize: 13 }}>{t("qual.noQuestions")}</div>}
    </section>
    <button className="vx-btn vx-btn-primary" style={{ marginTop: 16 }} disabled={salvando} onClick={salvar}>{salvando ? t("qual.publishing") : t("qual.publish")}</button>
    {!!pendencias.length && <div className="vx-overlay" onClick={() => setPendencias([])}><div className="vx-sheet" style={{maxWidth:520}} onClick={(e) => e.stopPropagation()}><div className="vx-row"><div><div className="vx-eyebrow">{t("qual.infoNeeded")}</div><h3 className="vx-disp" style={{fontSize:19,margin:"4px 0"}}>{t("qual.completeBeforeGen")}</h3></div><CircleAlert size={22} color="var(--amber)"/></div><p className="vx-mut" style={{fontSize:13}}>{t("qual.aiReuseNote")}</p><ul style={{paddingLeft:20,margin:"10px 0 16px"}}>{pendencias.map((p) => <li key={p.campo} style={{fontSize:13.5,marginBottom:5}}>{p.label}</li>)}</ul><div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button className="vx-btn" onClick={() => setPendencias([])}>{t("qual.notNow")}</button><button className="vx-btn vx-btn-primary" onClick={() => { completarInformacoes?.(pendencias); setPendencias([]); }}>{t("qual.completeInfo")}</button></div></div></div>}
  </div>;
}
