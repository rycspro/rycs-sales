import { useEffect, useMemo, useRef, useState } from "react";
import { CircleDollarSign, ContactRound, Download, FileSpreadsheet, Filter, Kanban, List, Megaphone, Percent, Sparkles, TrendingUp, Upload } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { ETAPAS, ORDEM_ETAPAS } from "../../../shared/pipeline.js";
import { lerArquivoLeads, parseTabela, sugerirMapeamento } from "../../lib/importers.js";
import PipelineKanban from "./PipelineKanban.jsx";
import { useI18n } from "../../lib/i18n.jsx";

const CAMPOS_KEYS = [["nome","leadsImp.name"],["empresa","leadsImp.company"],["cargo","leadsImp.role"],["telefone","leadsImp.phone"],["email","leadsImp.email"],["valorEstimado","leadsImp.estValue"]];

export default function LeadsEmpresa({ emp, db, aviso }) {
  const { t } = useI18n();
  const CAMPOS = CAMPOS_KEYS.map(([campo, key]) => [campo, t(key)]);
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
    if (!campaignId || !sellerId) return aviso(t("leadsImp.pickCampaignPro"));
    if (mapa.nome == null || mapa.nome < 0) return aviso(t("leadsImp.mapName"));
    setEnviando(true); const r = await api("/leads/import", { campaignId, sellerId, linhas: normalizados }); setEnviando(false);
    if (!r || r.error) return aviso(r?.error || t("leadsImp.importFailed"));
    setRelatorio(r); await carregar(); aviso(t("leadsImp.importedCount", { count: r.importados }));
  };

  return <div className="vx-fade">
    <div className="vx-page-head"><div><div className="vx-eyebrow">{t("leadsImp.eyebrow")}</div><h1 className="vx-disp">{t("leadsImp.title")}</h1><p>{t("leadsImp.desc")}</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="vx-btn" onClick={baixarModelo}><Download size={14}/> {t("leadsImp.csvTemplate")}</button><button className="vx-btn vx-btn-primary" onClick={() => setAberto(!aberto)}><Upload size={14}/> {t("leadsImp.importLeads")}</button></div></div>

    {aberto && <section className="vx-card" style={{padding:18,marginBottom:18}}>
      <div className="vx-row"><div><div className="vx-disp" style={{fontSize:17}}>{t("leadsImp.assistedImport")}</div><div className="vx-mut" style={{fontSize:12}}>{t("leadsImp.assistedDesc")}</div></div><FileSpreadsheet size={20} color="var(--brand)"/></div>
      <div className="vx-grid vx-g2" style={{marginTop:14}}><label><span className="vx-label">{t("leadsImp.campaignReq")}</span><select className="vx-input" value={campaignId} onChange={(e)=>setCampaignId(e.target.value)}><option value="">{t("misc.select")}</option>{campanhas.map((c)=><option key={c.id} value={c.id}>{c.titulo}</option>)}</select></label><label><span className="vx-label">{t("leadsImp.proReq")}</span><select className="vx-input" value={sellerId} onChange={(e)=>setSellerId(e.target.value)}><option value="">{t("misc.select")}</option>{time.map((s)=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></label></div>
      <input ref={fileRef} hidden type="file" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e)=>lerArquivo(e.target.files?.[0])}/>
      <button className="vx-btn" style={{marginTop:12}} onClick={()=>fileRef.current?.click()}><Upload size={14}/> {t("leadsImp.pickFile")}</button>
      <label style={{display:"block",marginTop:12}}><span className="vx-label">{t("leadsImp.pasteLabel")}</span><textarea className="vx-input" rows={4} value={texto} onChange={(e)=>setTexto(e.target.value)} placeholder="nome;empresa;telefone;email&#10;Ana;Clínica Vida;11999999999;ana@exemplo.com"/></label>
      <button className="vx-btn vx-btn-sm" onClick={()=>aplicarTabela(parseTabela(texto))}>{t("leadsImp.readPasted")}</button>
      {!!tabela.colunas.length && <><div className="vx-sep"/><div className="vx-disp" style={{fontSize:15}}>{t("leadsImp.columnMapping")}</div><div className="vx-grid vx-g3" style={{marginTop:10}}>{CAMPOS.map(([campo,label])=><label key={campo}><span className="vx-label">{label}</span><select className="vx-input" value={mapa[campo] ?? -1} onChange={(e)=>setMapa({...mapa,[campo]:Number(e.target.value)})}><option value={-1}>{t("leadsImp.ignore")}</option>{tabela.colunas.map((c,i)=><option key={i} value={i}>{c}</option>)}</select></label>)}</div>
      <div className="vx-table-wrap" style={{marginTop:14}}><table className="vx-table"><thead><tr>{CAMPOS.map(([,l])=><th key={l}>{l}</th>)}</tr></thead><tbody>{normalizados.slice(0,5).map((l,i)=><tr key={i}>{CAMPOS.map(([c])=><td key={c}>{l[c] || "—"}</td>)}</tr>)}</tbody></table></div><div className="vx-chart-source">{t("leadsImp.preview", { count: normalizados.length })}</div>
      <button className="vx-btn vx-btn-primary" style={{marginTop:12}} disabled={enviando || !normalizados.length} onClick={importar}>{enviando ? t("leadsImp.validating") : t("leadsImp.confirmImport")}</button></>}
      {relatorio && <div className="vx-grid vx-g4" style={{marginTop:14}}>{[[t("leadsImp.received"),relatorio.totalRecebido],[t("leadsImp.imported"),relatorio.importados],[t("leadsImp.duplicates"),relatorio.duplicados],[t("leadsImp.invalid"),relatorio.invalidos]].map(([l,v])=><div className="vx-scenario" key={l}><span>{l}</span><strong className="vx-mono">{v}</strong></div>)}</div>}
    </section>}

    <div className="vx-grid vx-g4" style={{marginBottom:16}}>
      {[
        [t("leadsImp.stat.pipeline"), money(total), CircleDollarSign],
        [t("leadsImp.stat.won"), ganhos, TrendingUp],
        [t("leadsImp.stat.conversion"), `${leads.length?Math.round(ganhos/leads.length*100):0}%`, Percent],
        [t("leadsImp.stat.campaigns"), new Set(leads.map((l)=>l.campaignId).filter(Boolean)).size, Megaphone],
      ].map(([label, val, Icon]) => (
        <div key={label} className="vx-glass-panel vx-tile">
          <div className="vx-tile-top">
            <span>{label}</span>
            <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div className="vx-tile-val">{val}</div>
        </div>
      ))}
    </div>
    <div className="vx-card" style={{padding:14,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <button className={`vx-btn vx-btn-sm ${modoVisao==="lista"?"vx-btn-primary":"vx-btn-ghost"}`} onClick={()=>setModoVisao("lista")}><List size={13}/> {t("pipeline.list")}</button>
        <button className={`vx-btn vx-btn-sm ${modoVisao==="kanban"?"vx-btn-primary":"vx-btn-ghost"}`} onClick={()=>setModoVisao("kanban")}><Kanban size={13}/> Kanban</button>
        <Filter size={15}/>
        <select className="vx-input" style={{maxWidth:200}} value={etapa} onChange={(e)=>setEtapa(e.target.value)}>
          <option value="">{t("pipeline.allStages")}</option>{ORDEM_ETAPAS.map((e)=><option key={e} value={e}>{ETAPAS[e].nome}</option>)}
        </select>
        <select className="vx-input" style={{maxWidth:180}} value={filtroSeller} onChange={(e)=>setFiltroSeller(e.target.value)}>
          <option value="">{t("pipeline.allSellers")}</option>{time.map((s)=><option key={s.id} value={s.id}>{s.nome}</option>)}
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
    <div className="vx-grid">{!visiveis.length&&<div className="vx-card" style={{padding:28,textAlign:"center"}}><TrendingUp size={26} color="var(--muted)"/><div className="vx-disp" style={{marginTop:8}}>{t("leadsImp.noLeadsStage")}</div><div className="vx-mut" style={{fontSize:13,marginTop:4}}>{t("leadsImp.noLeadsDesc")}</div></div>}{visiveis.map((l)=><div key={l.id} className="vx-card vx-row" style={{padding:14,borderLeft:`3px solid ${ETAPAS[l.etapa]?.cor||"var(--muted)"}`}}><div style={{minWidth:0}}><b>{l.nome}</b><div className="vx-mut" style={{fontSize:12}}>{l.empresa||t("leadsImp.noCompany")}{l.cargo?` · ${l.cargo}`:""}</div><div className="vx-mut" style={{fontSize:11.5,marginTop:3}}>{t("leadsImp.updated")} {dataCurta(l.atualizadoEm||l.criadoEm)}</div></div><div style={{textAlign:"right"}}><span className="vx-badge">{ETAPAS[l.etapa]?.nome||l.etapa}</span><div className="vx-mono" style={{fontSize:12,marginTop:5}}>{money(l.valorEstimado||0)}</div></div></div>)}</div>
    )}
    <div className="vx-notice" style={{marginTop:14}}><Sparkles size={13} style={{verticalAlign:-2,marginRight:6}}/>{t("leadsImp.aiNotice")}</div>
  </div>;
}
