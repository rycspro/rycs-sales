import { useEffect, useMemo, useState } from "react";
import { BookOpen, Bot, CheckCircle2, Download, FileText, FileUp, History, Mic, RotateCcw, Send, Trash2, Upload, X } from "lucide-react";
import { api, apiDelete, API_URL } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { TIPOS_RELATORIO } from "../../../shared/reporting.js";
import { useI18n } from "../../lib/i18n.jsx";

const TIPOS_MATERIAL = [
  { value: "texto", label: "Texto / FAQ" },
  { value: "script", label: "Script comercial" },
  { value: "objecao", label: "Objecoes e respostas" },
  { value: "link", label: "Link com contexto" },
  { value: "transcricao", label: "Transcricao de audio/video" },
  { value: "video", label: "Video (titulo + URL + resumo)" },
  { value: "material", label: "Material comercial" },
];

export function BaseConhecimento({ emp, db, aviso }) {
  const [docs, setDocs] = useState([]), [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState({ titulo: "", categoria: "geral", departamento: "comercial", origem: "texto", conteudo: "", responsavel: "" });
  const carregar = async () => { setCarregando(true); const r = await api("/knowledge"); setDocs(Array.isArray(r) ? r : []); setCarregando(false); };
  useEffect(() => { carregar(); }, []);
  const salvar = async () => {
    const r = await api("/knowledge", form);
    if (!r || r.error) return aviso(r?.error || "Nao foi possivel adicionar o material.");
    setForm({ ...form, titulo: "", conteudo: "" }); await carregar(); aviso("Material adicionado ao Cerebro da Operacao.");
  };
  const importar = async (file) => {
    if (!file) return;
    const titulo = form.titulo.trim() || file.name;
    const base64 = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.readAsDataURL(file); });
    const out = await api("/knowledge/import", { titulo, mimetype: file.type, base64, categoria: form.categoria, departamento: form.departamento, responsavel: form.responsavel });
    if (out?.error) return aviso(out.error);
    await carregar(); aviso("Arquivo extraido, indexado e disponivel para a IA.");
  };
  const remover = async (doc) => {
    if (!window.confirm(`Excluir "${doc.titulo}" e seu indice?`)) return;
    const r = await apiDelete(`/knowledge/${doc.id}`); if (r?.error) return aviso(r.error); await carregar(); aviso("Material e indice removidos.");
  };
  const reprocessar = async (doc) => { const r = await api(`/knowledge/${doc.id}/reprocess`, {}); if (r?.error) return aviso(r.error); await carregar(); aviso(`Processamento: ${r.status}.`); };

  const PLACEHOLDER = {
    texto: "Cole politicas, manuais, FAQs, processos ou qualquer conteudo que a IA deve usar como referencia.",
    script: "Cole o script de abordagem, de ligacao ou de apresentacao.",
    objecao: "Cadastre objecoes e as respostas recomendadas — a IA usara isso nos treinamentos e scripts.",
    link: "Cole o link e adicione um contexto explicando do que se trata.",
    transcricao: "Cole a transcricao de audio ou video.",
    video: "Informe o titulo, URL e um resumo do conteudo do video.",
    material: "Cole ou descreva o material comercial (apresentacao, proposta, catalogo).",
  };

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 14 }}>
        <div>
          <div className="vx-eyebrow">Fontes autorizadas para a IA</div>
          <h2 className="vx-disp" style={{ margin: "4px 0" }}>Cerebro da Operacao</h2>
          <p className="vx-mut" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Tudo aqui e usado pela IA para criar campanhas, treinamentos, scripts e sugestoes comerciais.
          </p>
        </div>
        <span className="vx-chip">{docs.length} materiais</span>
      </div>
      <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="vx-grid vx-g2">
          <label><div className="vx-label">Titulo</div><input className="vx-input" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></label>
          <label><div className="vx-label">Tipo de material</div>
            <select className="vx-input" value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })}>
              {TIPOS_MATERIAL.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
        </div>
        <div className="vx-grid vx-g2" style={{ marginTop: 9 }}>
          <label><div className="vx-label">Campanha</div>
            <select className="vx-input" value={form.campaignId || ""} onChange={(e) => setForm({ ...form, campaignId: e.target.value || null })}>
              <option value="">Toda a empresa</option>
              {(db.campaigns || []).map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </label>
          <label><div className="vx-label">Importar arquivo</div>
            <span className="vx-btn vx-btn-block"><FileUp size={14} /> TXT, MD ou PDF
              <input hidden type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" onChange={(e) => importar(e.target.files?.[0])} />
            </span>
          </label>
        </div>
        <label style={{ display: "block", marginTop: 9 }}>
          <div className="vx-label">Conteudo</div>
          <textarea className="vx-input" rows={6} value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
            placeholder={PLACEHOLDER[form.origem] || PLACEHOLDER.texto} />
        </label>
        <button className="vx-btn vx-btn-primary" style={{ marginTop: 10 }} onClick={salvar}>Adicionar ao Cerebro</button>
      </div>
      {carregando
        ? <div className="vx-mut">Carregando materiais...</div>
        : !docs.length
          ? <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
              <BookOpen size={24} color="var(--muted)" />
              <p className="vx-mut">Nenhum material ainda. Adicione scripts, FAQs, objecoes e materiais para a IA usar como contexto.</p>
            </div>
          : <div className="vx-grid">
              {docs.map((d) => (
                <div key={d.id} className="vx-card vx-row" style={{ padding: 14 }}>
                  <div>
                    <b>{d.titulo}</b>
                    <div className="vx-mut" style={{ fontSize: 12 }}>{d.categoria} · {d.origem || "texto"} · v{d.versao} · {d.status} · {dataCurta(d.atualizadoEm)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="vx-btn vx-btn-sm" onClick={() => reprocessar(d)}><RotateCcw size={13} /> Reprocessar</button>
                    <button className="vx-btn vx-btn-sm vx-btn-danger" onClick={() => remover(d)}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>}
    </div>
  );
}

export function RelatoriosEmpresa({ emp, db }) {
  const [periodo, setPeriodo] = useState("30");
  const [tipo, setTipo] = useState("financeiro");
  const [lista,setLista]=useState([]),[gerando,setGerando]=useState(false),[erro,setErro]=useState(""),[visualizacao,setVisualizacao]=useState(null);
  const carregar=()=>api("/reports").then((r)=>{if(Array.isArray(r))setLista(r)}); useEffect(()=>{carregar()},[]);
  const gerar=async()=>{setGerando(true);setErro("");const r=await api("/reports/generate",{dias:Number(periodo),tipo,titulo:TIPOS_RELATORIO[tipo]});setGerando(false);if(r?.error)return setErro(r.error);setVisualizacao(r.dados);await carregar();};
  const importar=async(file)=>{if(!file)return;setGerando(true);setErro("");const base64=await new Promise((ok,fail)=>{const fr=new FileReader();fr.onload=()=>ok(String(fr.result).split(",")[1]);fr.onerror=fail;fr.readAsDataURL(file)});const r=await api("/reports/import-pdf",{nome:file.name,base64});setGerando(false);if(r?.error)return setErro(r.error);await carregar();};
  const baixar=async(id)=>{const r=await fetch(`${API_URL}/api/reports/${id}/pdf`,{credentials:"include"});if(!r.ok)return setErro("Não foi possível gerar o PDF.");const url=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=url;a.download=`relatorio-rycs-${id}.pdf`;a.click();URL.revokeObjectURL(url);};
  return <div className="vx-fade"><div className="vx-page-head"><div><div className="vx-eyebrow">Documentos executivos</div><h1 className="vx-disp">Relatórios</h1><p>Selecione o período e o recorte para visualizar indicadores reais da operação.</p></div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><select aria-label="Tipo de relatório" className="vx-input" value={tipo} onChange={(e)=>setTipo(e.target.value)}>{Object.entries(TIPOS_RELATORIO).map(([valor,rotulo])=><option key={valor} value={valor}>{rotulo}</option>)}</select><select aria-label="Período do relatório" className="vx-input" style={{width:130}} value={periodo} onChange={(e)=>setPeriodo(e.target.value)}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option></select><button className="vx-btn vx-btn-primary" disabled={gerando} onClick={gerar}>{gerando?"Processando…":"Gerar relatório"}</button></div></div>{erro&&<div className="vx-notice vx-notice-amber" style={{marginBottom:14}}>{erro}</div>}{visualizacao&&<div className="vx-card" style={{padding:18,marginBottom:16}}><div className="vx-eyebrow">Visualização atual</div><h2 className="vx-disp" style={{fontSize:19,margin:"4px 0 12px"}}>{visualizacao.titulo}</h2><div className="vx-grid vx-g3">{visualizacao.resumo.map((item)=><div key={item.rotulo} className="vx-notice"><div className="vx-mut" style={{fontSize:12}}>{item.rotulo}</div><b className="vx-disp" style={{fontSize:18}}>{item.valor}</b></div>)}</div>{visualizacao.linhas?.length>0&&<div className="vx-compact-list" style={{marginTop:14}}>{visualizacao.linhas.slice(0,20).map((item,i)=><div key={`${item.titulo}-${i}`}><div><b>{item.titulo}</b><span>{item.detalhe}</span></div><span className="vx-chip">{item.valor}</span></div>)}</div>}</div>}<div className="vx-grid">{lista.map((r)=><div key={r.id} className="vx-card vx-row" style={{padding:15}}><div><b>{r.titulo}</b><div className="vx-mut" style={{fontSize:12}}>{r.periodo} · {r.origem} · {r.status}</div></div><button className="vx-btn vx-btn-sm" onClick={()=>baixar(r.id)}><Download size={13}/>PDF RYCS</button></div>)}{!lista.length&&<div className="vx-card" style={{padding:28,textAlign:"center"}}><FileText size={25} color="var(--muted)"/><p className="vx-mut">Nenhum relatório gerado. Escolha o período e o tipo para gerar o primeiro relatório.</p></div>}</div><p className="vx-chart-source">Os indicadores usam somente registros operacionais autorizados da sua empresa.</p></div>;
}

export function AssistenteEmpresa({ emp, contexto, aviso }) {
  const [aberto, setAberto] = useState(false), [pergunta, setPergunta] = useState(""), [resposta, setResposta] = useState(null), [enviando, setEnviando] = useState(false), [ouvindo, setOuvindo] = useState(false), [historico, setHistorico] = useState([]), [verHistorico, setVerHistorico] = useState(false);
  const consultar = async () => { if (!pergunta.trim()) return; setEnviando(true); const r = await api("/assistant/query", { pergunta, contexto }); setEnviando(false); if (r?.error) return aviso(r.error); setResposta(r); setVerHistorico(false); };
  const confirmar = async () => { const r=await api(`/assistant/confirm/${resposta.historyId}`,{}); if(r?.error)return aviso(r.error); setResposta({...resposta,executado:true}); aviso(r.message); };
  const carregarHistorico = async () => { const r=await api("/assistant/history"); if(Array.isArray(r)){setHistorico(r);setVerHistorico(true);} };
  const ditar = () => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return aviso("Ditado não disponível neste navegador. Digite o comando ou envie uma transcrição à base.");
    const rec = new Speech(); rec.lang = "pt-BR"; rec.interimResults = false; setOuvindo(true);
    rec.onresult = (e) => setPergunta(e.results[0][0].transcript); rec.onerror = () => aviso("Não foi possível transcrever o áudio."); rec.onend = () => setOuvindo(false); rec.start();
  };
  return <><button className="vx-btn vx-btn-primary vx-ai-trigger" onClick={() => setAberto(!aberto)}><Bot size={17} /> Inteligência Artificial</button>{aberto && <div className="vx-card vx-ai-panel"><div className="vx-row"><div><b>Inteligência Artificial</b><div className="vx-mut" style={{fontSize:11}}>Contexto: {contexto} · empresa: {emp.nome}</div></div><div style={{display:"flex"}}><button title="Histórico" className="vx-btn vx-btn-sm vx-btn-ghost" onClick={carregarHistorico}><History size={15}/></button><button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={() => setAberto(false)}><X size={15}/></button></div></div><textarea aria-label="Mensagem para Inteligência Artificial" className="vx-input" rows={3} style={{marginTop:10}} value={pergunta} onChange={(e)=>setPergunta(e.target.value)} placeholder="Explique sua situação; o texto transcrito continua editável antes do envio."/><div style={{display:"flex",gap:7,marginTop:8,flexWrap:"wrap"}}><button className="vx-btn" onClick={ditar}><Mic size={14}/>{ouvindo?"Ouvindo…":"Falar"}</button><button className="vx-btn vx-btn-primary" disabled={enviando} onClick={consultar}><Send size={14}/>{enviando?"Consultando RAG…":"Preparar proposta"}</button></div>{verHistorico&&<div style={{marginTop:12}}><div className="vx-eyebrow">Histórico autorizado</div>{historico.length?historico.slice(0,8).map((h)=><div key={h.id} style={{padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:12}}><b>{h.pergunta}</b><div className="vx-mut">{h.contexto} · {h.status}</div></div>):<p className="vx-mut">Nenhuma análise registrada.</p>}</div>}{resposta&&!verHistorico&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--border)"}}><div className="vx-eyebrow">Proposta para revisão</div><div style={{fontSize:13.5,whiteSpace:"pre-wrap",marginTop:5}}>{resposta.resposta}</div><div className="vx-notice" style={{marginTop:9}}><b>{resposta.proposta?.titulo}</b><div className="vx-mut" style={{fontSize:11.5}}>{resposta.proposta?.impacto} · {resposta.proposta?.calculo}</div></div><div className="vx-mut" style={{fontSize:11.5,marginTop:8}}>Confiança: {resposta.confianca}% · {resposta.acaoRecomendada}</div>{resposta.fontes?.map((f)=><div key={`${f.documentId}-${f.secao}`} className="vx-chip" style={{margin:"6px 5px 0 0"}}><FileText size={11}/>{f.documento} · seção {f.secao} · v{f.versao}</div>)}<button className="vx-btn vx-btn-primary vx-btn-block" style={{marginTop:10}} disabled={resposta.executado} onClick={confirmar}>{resposta.executado?<><CheckCircle2 size={14}/>Confirmado e registrado</>:"Confirmar execução"}</button></div>}</div>}</>;
}
