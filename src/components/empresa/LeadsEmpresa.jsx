import { useEffect, useMemo, useRef, useState } from "react";
import { CircleDollarSign, ContactRound, Download, FileSpreadsheet, Filter, Kanban, List, Sparkles, TrendingUp, Upload } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { ETAPAS, ORDEM_ETAPAS } from "../../../shared/pipeline.js";
import { lerArquivoLeads, parseTabela, sugerirMapeamento } from "../../lib/importers.js";
import PipelineKanban from "./PipelineKanban.jsx";

const CAMPOS = [["nome","Nome *"],["empresa","Empresa"],["cargo","Cargo"],["telefone","Telefone"],["email","E-mail"],["valorEstimado","Valor estimado"]];

export default function LeadsEmpresa({ emp, db, aviso }) {
  const locais = (db.leads || []).filter((l) => l.companyId === emp.id);
  const [leads, setLeads] = useState(locais), [etapa, setEtapa] = useState("");
  const [aberto, setAberto] = useState(false), [tabela, setTabela] = useState({ colunas: [], linhas: [] }), [mapa, setMapa] = useState({});
  const [texto, setTexto] = useState(""), [campaignId, setCampaignId] = useState(""), [sellerId, setSellerId] = useState(""), [relatorio, setRelatorio] = useState(null), [enviando, setEnviando] = useState(false);
  const [modoVisao, setModoVisao] = useState("lista");
  const [filtroSeller, setFiltroSeller] = useState(""), [filtroCidade, setFiltroCidade] = useState(""), [filtroEstado, setFiltroEstado] = useState("");
  const fileRef = useRef(null);
  const carregar = () => api("/leads").then((r) => { if (Array.isArray(r)) setLeads(r); });
  useEffect(() => { carregar(); }, [emp.id]);
  const time = db.sellers?.filter((s) => s.aplicacoes?.[emp.id] === "aprovado") || [];
  const visiveis = useMemo(() => leads.filter((l) => {
    if (etapa && l.etapa !== etapa) return false;
    if (filtroSeller && l.sellerId !== filtroSeller) return false;
    return true;
  }), [leads, etapa, filtroSeller]);
  const total = leads.reduce((s, l) => s + Number(l.valorEstimado || 0), 0), ganhos = leads.filter((l) => l.etapa === "ganho").length;
  const campanhas = (db.campaigns || []).filter((c) => c.companyId === emp.id);
  const normalizados = useMemo(() => tabela.linhas.map((linha) => Object.fromEntries(CAMPOS.map(([campo]) => [campo, mapa[campo] >= 0 ? linha[mapa[campo]] || "" : ""]))), [tabela, mapa]);

  const aplicarTabela = (t) => { setTabela(t); setMapa(sugerirMapeamento(t.colunas)); setRelatorio(null); setAberto(true); };
  const lerArquivo = async (file) => { try { aplicarTabela(await lerArquivoLeads(file)); } catch (e) { aviso(e.message); } };
  const baixarModelo = () => {
    const blob = new Blob(["nome;empresa;cargo;telefone;email;valorEstimado\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "modelo-leads-rycs.csv"; a.click(); URL.revokeObjectURL(a.href);
  };
  const importar = async () => {
    if (!campaignId || !sellerId) return aviso("Escolha campanha e profissional responsável.");
    if (mapa.nome == null || mapa.nome < 0) return aviso("Mapeie a coluna Nome.");
    setEnviando(true); const r = await api("/leads/import", { campaignId, sellerId, linhas: normalizados }); setEnviando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível importar.");
    setRelatorio(r); await carregar(); aviso(`${r.importados} lead(s) importados.`);
  };

  return <div className="vx-fade">
    <div className="vx-page-head"><div><div className="vx-eyebrow">Execução comercial</div><h1 className="vx-disp">Leads da operação</h1><p>Cadastre, importe, valide duplicidades e acompanhe o funil por campanha.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="vx-btn" onClick={baixarModelo}><Download size={14}/> Modelo CSV</button><button className="vx-btn vx-btn-primary" onClick={() => setAberto(!aberto)}><Upload size={14}/> Importar leads</button></div></div>

    {aberto && <section className="vx-card" style={{padding:18,marginBottom:18}}>
      <div className="vx-row"><div><div className="vx-disp" style={{fontSize:17}}>Importação assistida</div><div className="vx-mut" style={{fontSize:12}}>CSV, XLSX, dados colados ou cadastro manual em linhas.</div></div><FileSpreadsheet size={20} color="var(--brand)"/></div>
      <div className="vx-grid vx-g2" style={{marginTop:14}}><label><span className="vx-label">Campanha *</span><select className="vx-input" value={campaignId} onChange={(e)=>setCampaignId(e.target.value)}><option value="">Selecione</option>{campanhas.map((c)=><option key={c.id} value={c.id}>{c.titulo}</option>)}</select></label><label><span className="vx-label">Profissional responsável *</span><select className="vx-input" value={sellerId} onChange={(e)=>setSellerId(e.target.value)}><option value="">Selecione</option>{time.map((s)=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></label></div>
      <input ref={fileRef} hidden type="file" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e)=>lerArquivo(e.target.files?.[0])}/>
      <button className="vx-btn" style={{marginTop:12}} onClick={()=>fileRef.current?.click()}><Upload size={14}/> Escolher CSV ou XLSX</button>
      <label style={{display:"block",marginTop:12}}><span className="vx-label">Ou cole uma tabela (primeira linha = cabeçalho)</span><textarea className="vx-input" rows={4} value={texto} onChange={(e)=>setTexto(e.target.value)} placeholder="nome;empresa;telefone;email&#10;Ana;Clínica Vida;11999999999;ana@exemplo.com"/></label>
      <button className="vx-btn vx-btn-sm" onClick={()=>aplicarTabela(parseTabela(texto))}>Ler dados colados</button>
      {!!tabela.colunas.length && <><div className="vx-sep"/><div className="vx-disp" style={{fontSize:15}}>Mapeamento de colunas</div><div className="vx-grid vx-g3" style={{marginTop:10}}>{CAMPOS.map(([campo,label])=><label key={campo}><span className="vx-label">{label}</span><select className="vx-input" value={mapa[campo] ?? -1} onChange={(e)=>setMapa({...mapa,[campo]:Number(e.target.value)})}><option value={-1}>Ignorar</option>{tabela.colunas.map((c,i)=><option key={i} value={i}>{c}</option>)}</select></label>)}</div>
      <div className="vx-table-wrap" style={{marginTop:14}}><table className="vx-table"><thead><tr>{CAMPOS.map(([,l])=><th key={l}>{l}</th>)}</tr></thead><tbody>{normalizados.slice(0,5).map((l,i)=><tr key={i}>{CAMPOS.map(([c])=><td key={c}>{l[c] || "—"}</td>)}</tr>)}</tbody></table></div><div className="vx-chart-source">Prévia de até 5 linhas · {normalizados.length} recebidas. Duplicidades são verificadas por telefone ou e-mail no servidor antes de gravar.</div>
      <button className="vx-btn vx-btn-primary" style={{marginTop:12}} disabled={enviando || !normalizados.length} onClick={importar}>{enviando?"Validando…":"Confirmar importação"}</button></>}
      {relatorio && <div className="vx-grid vx-g4" style={{marginTop:14}}>{[["Recebidos",relatorio.totalRecebido],["Importados",relatorio.importados],["Duplicados",relatorio.duplicados],["Inválidos",relatorio.invalidos]].map(([l,v])=><div className="vx-scenario" key={l}><span>{l}</span><strong className="vx-mono">{v}</strong></div>)}</div>}
    </section>}

    <div className="vx-grid vx-g4" style={{marginBottom:16}}><div className="vx-card" style={{padding:14}}><div className="vx-mut" style={{fontSize:12}}>Pipeline estimado</div><b className="vx-mono" style={{fontSize:19}}>{money(total)}</b></div><div className="vx-card" style={{padding:14}}><div className="vx-mut" style={{fontSize:12}}>Ganhos</div><b className="vx-mono" style={{fontSize:19}}>{ganhos}</b></div><div className="vx-card" style={{padding:14}}><div className="vx-mut" style={{fontSize:12}}>Conversão</div><b className="vx-mono" style={{fontSize:19}}>{leads.length?Math.round(ganhos/leads.length*100):0}%</b></div><div className="vx-card" style={{padding:14}}><div className="vx-mut" style={{fontSize:12}}>Campanhas</div><b className="vx-mono" style={{fontSize:19}}>{new Set(leads.map((l)=>l.campaignId).filter(Boolean)).size}</b></div></div>
    <div className="vx-card" style={{padding:14,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <button className={`vx-btn vx-btn-sm ${modoVisao==="lista"?"vx-btn-primary":"vx-btn-ghost"}`} onClick={()=>setModoVisao("lista")}><List size={13}/> Lista</button>
        <button className={`vx-btn vx-btn-sm ${modoVisao==="kanban"?"vx-btn-primary":"vx-btn-ghost"}`} onClick={()=>setModoVisao("kanban")}><Kanban size={13}/> Kanban</button>
        <Filter size={15}/>
        <select className="vx-input" style={{maxWidth:200}} value={etapa} onChange={(e)=>setEtapa(e.target.value)}>
          <option value="">Todas as etapas</option>{ORDEM_ETAPAS.map((e)=><option key={e} value={e}>{ETAPAS[e].nome}</option>)}
        </select>
        <select className="vx-input" style={{maxWidth:180}} value={filtroSeller} onChange={(e)=>setFiltroSeller(e.target.value)}>
          <option value="">Todos os vendedores</option>{time.map((s)=><option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <span className="vx-chip"><ContactRound size={13}/>{visiveis.length}</span>
      </div>
    </div>
    {modoVisao==="kanban" ? (
      <PipelineKanban
        campanha={campanhas.find((c)=>c.id===campaignId)||campanhas[0]||{etapasPipeline:[]}}
        leads={leads}
        sellers={time}
        aviso={aviso}
        onLeadsAtualizado={carregar}
      />
    ) : (
    <div className="vx-grid">{!visiveis.length&&<div className="vx-card" style={{padding:28,textAlign:"center"}}><TrendingUp size={26} color="var(--muted)"/><div className="vx-disp" style={{marginTop:8}}>Nenhum lead nesta etapa</div><div className="vx-mut" style={{fontSize:13,marginTop:4}}>Importe uma lista ou aguarde a execução das campanhas.</div></div>}{visiveis.map((l)=><div key={l.id} className="vx-card vx-row" style={{padding:14,borderLeft:`3px solid ${ETAPAS[l.etapa]?.cor||"var(--muted)"}`}}><div style={{minWidth:0}}><b>{l.nome}</b><div className="vx-mut" style={{fontSize:12}}>{l.empresa||"Empresa não informada"}{l.cargo?` · ${l.cargo}`:""}</div><div className="vx-mut" style={{fontSize:11.5,marginTop:3}}>Atualizado {dataCurta(l.atualizadoEm||l.criadoEm)}</div></div><div style={{textAlign:"right"}}><span className="vx-badge">{ETAPAS[l.etapa]?.nome||l.etapa}</span><div className="vx-mono" style={{fontSize:12,marginTop:5}}>{money(l.valorEstimado||0)}</div></div></div>)}</div>
    )}
    <div className="vx-notice" style={{marginTop:14}}><Sparkles size={13} style={{verticalAlign:-2,marginRight:6}}/>A Inteligência Artificial global usa o contexto desta tela e a Base de Conhecimento para sugerir abordagem e próximo passo sem inventar dados.</div>
  </div>;
}
