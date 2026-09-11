import { useState } from "react";
import { CheckCircle2, Plus, Trash2, BookOpen, ShieldCheck } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";

const padrao = {
  criterios: { perfis: ["sdr", "closer"], notaMinima: 60, exigeVideo: false },
  notaMinimaQuiz: 70,
  questoes: [],
};

export default function QualificacaoEmpresa({ emp, up, aviso }) {
  const [qualificacao, setQualificacao] = useState({ ...padrao, ...(emp.qualificacao || {}), criterios: { ...padrao.criterios, ...(emp.qualificacao?.criterios || {}) } });
  const [curso, setCurso] = useState(emp.curso || []);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const gerarRascunho = async () => { setGerando(true); const r=await api("/assistant/training-draft",{}); setGerando(false); if(r?.error)return aviso(r.error); setCurso(r.modulos); setQualificacao((q)=>({...q,questoes:r.questoes})); aviso("Rascunho criado com fontes autorizadas. Revise antes de publicar."); };
  const alterarCriterio = (chave, valor) => setQualificacao((q) => ({ ...q, criterios: { ...q.criterios, [chave]: valor } }));
  const alternarPerfil = (perfil) => {
    const atuais = qualificacao.criterios.perfis || [];
    alterarCriterio("perfis", atuais.includes(perfil) ? atuais.filter((p) => p !== perfil) : [...atuais, perfil]);
  };
  const atualizarModulo = (i, campo, valor) => setCurso((lista) => lista.map((m, n) => n === i ? { ...m, [campo]: valor } : m));
  const atualizarQuestao = (i, campo, valor) => setQualificacao((q) => ({ ...q, questoes: q.questoes.map((x, n) => n === i ? { ...x, [campo]: valor } : x) }));
  const salvar = async () => {
    if (qualificacao.questoes.some((q) => !q.pergunta.trim() || q.opcoes.some((o) => !o.trim()))) return aviso("Preencha a pergunta e todas as alternativas.");
    setSalvando(true);
    const r = await apiPatch(`/companies/${emp.id}`, { qualificacao, curso });
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, qualificacao, curso } : c) }));
    aviso("Qualificação publicada. Só candidatos elegíveis poderão se cadastrar.");
  };
  return <div className="vx-fade" style={{ maxWidth: 860 }}>
    <div className="vx-eyebrow" style={{ marginBottom: 7 }}>Entrada de vendedores</div>
    <div className="vx-row" style={{alignItems:"flex-start",flexWrap:"wrap"}}><h2 className="vx-disp" style={{ fontSize: 24, margin: "0 0 8px" }}>Academy {emp.nome}</h2><button className="vx-btn vx-btn-primary vx-btn-sm" disabled={gerando} onClick={gerarRascunho}>{gerando?"Consultando fontes…":"Gerar rascunho com IA"}</button></div>
    <p className="vx-mut" style={{ fontSize: 13.5, marginTop: 0 }}>Defina quem pode se candidatar e prepare o vendedor antes da primeira oportunidade. Os critérios são verificados pelo servidor no envio da candidatura.</p>

    <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-row" style={{ marginBottom: 12 }}><b><ShieldCheck size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Critérios obrigatórios</b><span className="vx-chip">bloqueio automático</span></div>
      <div className="vx-label">Perfis que podem entrar</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>{[["sdr", "SDR"], ["closer", "Closer"], ["sem-exp", "Iniciante"]].map(([k, label]) => <button key={k} className="vx-btn vx-btn-sm" onClick={() => alternarPerfil(k)} style={{ borderColor: qualificacao.criterios.perfis?.includes(k) ? "var(--brand)" : undefined, background: qualificacao.criterios.perfis?.includes(k) ? "var(--brand-50)" : undefined }}>{qualificacao.criterios.perfis?.includes(k) && <CheckCircle2 size={14} />}{label}</button>)}</div>
      <div className="vx-grid vx-g2"><label><div className="vx-label">Nota mínima na triagem</div><input className="vx-input vx-mono" type="number" min="0" max="100" value={qualificacao.criterios.notaMinima} onChange={(e) => alterarCriterio("notaMinima", Number(e.target.value))} /></label><label><div className="vx-label">Nota mínima no questionário</div><input className="vx-input vx-mono" type="number" min="0" max="100" value={qualificacao.notaMinimaQuiz} onChange={(e) => setQualificacao((q) => ({ ...q, notaMinimaQuiz: Number(e.target.value) }))} /></label></div>
      <label style={{ display: "flex", gap: 9, alignItems: "center", marginTop: 16, fontSize: 13.5 }}><input type="checkbox" checked={!!qualificacao.criterios.exigeVideo} onChange={(e) => alterarCriterio("exigeVideo", e.target.checked)} /> Exigir vídeo de apresentação no perfil</label>
    </section>

    <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-row" style={{ marginBottom: 4 }}><b><BookOpen size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Conteúdo para o vendedor</b><button className="vx-btn vx-btn-sm" onClick={() => setCurso((c) => [...c, { id: `mod-${Date.now()}`, titulo: "Novo módulo", conteudo: "", min: 5 }])}><Plus size={14} />Módulo</button></div>
      <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 0 }}>Este material fica disponível antes da candidatura, para que a avaliação seja justa.</p>
      {!curso.length && <div className="vx-mut" style={{ fontSize: 13 }}>Adicione ao menos um módulo explicando seu produto, público e abordagem comercial.</div>}
      {curso.map((m, i) => <div key={m.id} style={{ paddingTop: 12, marginTop: 12, borderTop: "1px solid var(--border)" }}><div className="vx-row" style={{ gap: 8 }}><input className="vx-input" value={m.titulo} onChange={(e) => atualizarModulo(i, "titulo", e.target.value)} placeholder="Título do módulo" /><button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => setCurso((c) => c.filter((_, n) => n !== i))}><Trash2 size={14} /></button></div><textarea className="vx-input" style={{ marginTop: 8, minHeight: 72 }} value={m.conteudo} onChange={(e) => atualizarModulo(i, "conteudo", e.target.value)} placeholder="Explique o que o vendedor precisa saber" /></div>)}
    </section>

    <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-row"><b>Questionário de aprendizado</b><button className="vx-btn vx-btn-sm" onClick={() => setQualificacao((q) => ({ ...q, questoes: [...q.questoes, { pergunta: "", opcoes: ["", "", ""], correta: 0 }] }))}><Plus size={14} />Questão</button></div>
      <p className="vx-mut" style={{ fontSize: 12.5 }}>Escolha a resposta correta; ela não é enviada ao vendedor.</p>
      {qualificacao.questoes.map((q, i) => <div key={i} style={{ paddingTop: 14, marginTop: 14, borderTop: "1px solid var(--border)" }}><div className="vx-row"><span className="vx-chip vx-mono">{i + 1}</span><input className="vx-input" value={q.pergunta} onChange={(e) => atualizarQuestao(i, "pergunta", e.target.value)} placeholder="O que o vendedor deve saber?" /><button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => setQualificacao((x) => ({ ...x, questoes: x.questoes.filter((_, n) => n !== i) }))}><Trash2 size={14} /></button></div>{q.opcoes.map((op, n) => <label key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13 }}><input type="radio" name={`correta-${i}`} checked={Number(q.correta) === n} onChange={() => atualizarQuestao(i, "correta", n)} /><input className="vx-input" value={op} onChange={(e) => atualizarQuestao(i, "opcoes", q.opcoes.map((x, p) => p === n ? e.target.value : x))} placeholder={`Alternativa ${n + 1}`} /></label>)}{q.justificativa&&<div className="vx-chart-source">{q.justificativa}</div>}</div>)}
      {!qualificacao.questoes.length && <div className="vx-mut" style={{ fontSize: 13 }}>Sem perguntas, somente os critérios de perfil serão usados.</div>}
    </section>
    <button className="vx-btn vx-btn-primary" style={{ marginTop: 16 }} disabled={salvando} onClick={salvar}>{salvando ? "Publicando…" : "Publicar qualificação"}</button>
  </div>;
}
