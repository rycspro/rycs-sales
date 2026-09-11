import { useEffect, useMemo, useState } from "react";
import { BookOpen, Bot, FileText, Mic, RotateCcw, Send, Trash2, X } from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";

export function BaseConhecimento({ emp, db, aviso }) {
  const [docs, setDocs] = useState([]), [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState({ titulo: "", categoria: "geral", departamento: "comercial", origem: "texto", conteudo: "", responsavel: "" });
  const carregar = async () => { setCarregando(true); const r = await api("/knowledge"); setDocs(Array.isArray(r) ? r : []); setCarregando(false); };
  useEffect(() => { carregar(); }, []);
  const salvar = async () => {
    const r = await api("/knowledge", form); if (!r || r.error) return aviso(r?.error || "Não foi possível adicionar o material.");
    setForm({ ...form, titulo: "", conteudo: "" }); await carregar(); aviso("Material adicionado à base autorizada.");
  };
  const remover = async (doc) => {
    if (!window.confirm(`Excluir “${doc.titulo}” e seu índice?`)) return;
    const r = await apiDelete(`/knowledge/${doc.id}`); if (r?.error) return aviso(r.error); await carregar(); aviso("Material e índice removidos.");
  };
  const reprocessar = async (doc) => { const r = await api(`/knowledge/${doc.id}/reprocess`, {}); if (r?.error) return aviso(r.error); await carregar(); aviso(`Processamento: ${r.status}.`); };
  return <div className="vx-fade">
    <div className="vx-row" style={{ marginBottom: 14 }}><div><div className="vx-eyebrow">Fontes autorizadas</div><h2 className="vx-disp" style={{ margin: "4px 0" }}>Base de conhecimento</h2></div><span className="vx-chip">{docs.length} materiais</span></div>
    <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
      <div className="vx-grid vx-g2"><label><div className="vx-label">Título</div><input className="vx-input" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></label><label><div className="vx-label">Responsável</div><input className="vx-input" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></label></div>
      <div className="vx-grid vx-g2" style={{ marginTop: 9 }}><label><div className="vx-label">Categoria</div><input className="vx-input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></label><label><div className="vx-label">Campanha</div><select className="vx-input" value={form.campaignId || ""} onChange={(e) => setForm({ ...form, campaignId: e.target.value || null })}><option value="">Toda a empresa</option>{(db.campaigns || []).map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select></label></div>
      <label style={{ display: "block", marginTop: 9 }}><div className="vx-label">Texto autorizado</div><textarea className="vx-input" rows={7} value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} placeholder="Cole políticas, manuais, FAQs ou transcrições. PDF, DOCX e áudio podem ser cadastrados como aguardando processamento." /></label>
      <button className="vx-btn vx-btn-primary" style={{ marginTop: 10 }} onClick={salvar}>Adicionar material</button>
    </div>
    {carregando ? <div className="vx-mut">Carregando materiais…</div> : !docs.length ? <div className="vx-card" style={{ padding: 24, textAlign: "center" }}><BookOpen size={24} color="var(--muted)" /><p className="vx-mut">Adicione a primeira fonte para habilitar respostas fundamentadas.</p></div> : <div className="vx-grid">{docs.map((d) => <div key={d.id} className="vx-card vx-row" style={{ padding: 14 }}><div><b>{d.titulo}</b><div className="vx-mut" style={{ fontSize: 12 }}>{d.categoria} · v{d.versao} · {d.status} · {dataCurta(d.atualizadoEm)}</div></div><div style={{ display: "flex", gap: 6 }}><button className="vx-btn vx-btn-sm" onClick={() => reprocessar(d)}><RotateCcw size={13} /> Reprocessar</button><button className="vx-btn vx-btn-sm vx-btn-danger" onClick={() => remover(d)}><Trash2 size={13} /></button></div></div>)}</div>}
  </div>;
}

export function RelatoriosEmpresa({ emp, db }) {
  const [periodo, setPeriodo] = useState("30");
  const desde = Date.now() - Number(periodo) * 86400000;
  const subs = db.submissions.filter((s) => s.companyId === emp.id && s.criadoEm >= desde);
  const leads = (db.leads || []).filter((l) => l.companyId === emp.id && l.criadoEm >= desde);
  const resumo = useMemo(() => ({ enviados: subs.length, aprovados: subs.filter((s) => s.status === "liberado").length, recusados: subs.filter((s) => ["recusado","ia_recusado"].includes(s.status)).length, total: subs.filter((s) => s.status === "liberado").reduce((n,s) => n + Number(s.valor || 0), 0) }), [subs]);
  return <div className="vx-fade"><div className="vx-row" style={{ marginBottom: 16 }}><div><div className="vx-eyebrow">Dados operacionais</div><h2 className="vx-disp" style={{ margin: "4px 0" }}>Relatório</h2></div><select className="vx-input" style={{ width: 150 }} value={periodo} onChange={(e) => setPeriodo(e.target.value)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></div><div className="vx-grid vx-g4"><div className="vx-card" style={{padding:14}}>Tarefas<br/><b>{resumo.enviados}</b></div><div className="vx-card" style={{padding:14}}>Aprovadas<br/><b>{resumo.aprovados}</b></div><div className="vx-card" style={{padding:14}}>Recusadas<br/><b>{resumo.recusados}</b></div><div className="vx-card" style={{padding:14}}>Liberado<br/><b>{money(resumo.total)}</b></div></div><div className="vx-card" style={{padding:16,marginTop:14}}><b>Leads no período: {leads.length}</b><p className="vx-mut" style={{fontSize:12}}>Período: {periodo} dias · Fonte: registros operacionais da empresa · Dados ausentes não são estimados.</p></div></div>;
}

export function AssistenteEmpresa({ emp, contexto, aviso }) {
  const [aberto, setAberto] = useState(false), [pergunta, setPergunta] = useState(""), [resposta, setResposta] = useState(null), [enviando, setEnviando] = useState(false), [ouvindo, setOuvindo] = useState(false);
  const consultar = async () => { if (!pergunta.trim()) return; setEnviando(true); const r = await api("/assistant/query", { pergunta, contexto }); setEnviando(false); if (r?.error) return aviso(r.error); setResposta(r); };
  const ditar = () => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return aviso("Ditado não disponível neste navegador. Digite o comando ou envie uma transcrição à base.");
    const rec = new Speech(); rec.lang = "pt-BR"; rec.interimResults = false; setOuvindo(true);
    rec.onresult = (e) => setPergunta(e.results[0][0].transcript); rec.onerror = () => aviso("Não foi possível transcrever o áudio."); rec.onend = () => setOuvindo(false); rec.start();
  };
  return <><button className="vx-btn vx-btn-primary vx-ai-trigger" onClick={() => setAberto(!aberto)}><Bot size={17} /> Assistente</button>{aberto && <div className="vx-card vx-ai-panel"><div className="vx-row"><div><b>Assistente {emp.nome}</b><div className="vx-mut" style={{fontSize:11}}>Consulta fontes autorizadas · não executa ações</div></div><button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={() => setAberto(false)}><X size={15}/></button></div><textarea className="vx-input" rows={3} style={{marginTop:10}} value={pergunta} onChange={(e)=>setPergunta(e.target.value)} placeholder="O que precisa da minha atenção hoje?"/><div style={{display:"flex",gap:7,marginTop:8}}><button className="vx-btn" onClick={ditar}><Mic size={14}/>{ouvindo?"Ouvindo…":"Criar por áudio"}</button><button className="vx-btn vx-btn-primary" disabled={enviando} onClick={consultar}><Send size={14}/>{enviando?"Consultando…":"Consultar"}</button></div>{resposta && <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--border)"}}><div style={{fontSize:13.5,whiteSpace:"pre-wrap"}}>{resposta.resposta}</div><div className="vx-mut" style={{fontSize:11.5,marginTop:8}}>Confiança: {resposta.confianca}% · {resposta.acaoRecomendada}</div>{resposta.fontes?.map((f)=><div key={`${f.documentId}-${f.secao}`} className="vx-chip" style={{margin:"6px 5px 0 0"}}><FileText size={11}/>{f.documento} · seção {f.secao} · v{f.versao}</div>)}</div>}</div>}</>;
}
