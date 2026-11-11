import { useState } from "react";
import { Award, BarChart3, BriefcaseBusiness, CheckCircle2, MapPin, MessageSquare, UserRound, X } from "lucide-react";
import { apiPatch } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import Chat from "../Chat.jsx";

const PERFIL_LABEL = { sdr: "SDR", bdr: "BDR", closer: "Closer", pap: "Porta a porta", "sem-exp": "Em formação" };
const arr = (v) => Array.isArray(v) ? v : [];
const norm = (v) => String(v || "").toLocaleLowerCase("pt-BR");
const text = (v, empty = "Não informado") => v || empty;

function iniciais(nome = "") {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("") || "PR";
}

function Tags({ itens }) {
  return arr(itens).length ? <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{itens.map((x) => <span key={x} className="vx-chip">{x}</span>)}</div> : <span className="vx-mut">Não informado</span>;
}

function resumoIA(p) {
  const partes = [];
  if (p.perfilComercial?.estilo) partes.push(`Perfil comportamental: ${p.perfilComercial.estilo}.`);
  if (p.bio) partes.push(p.bio);
  else if (p.experiencia) partes.push(`Experiência: ${p.experiencia}.`);
  const fortes = [...arr(p.skills), ...arr(p.segmentos)].slice(0, 5);
  if (fortes.length) partes.push(`Pontos fortes: ${fortes.join(", ")}.`);
  if (p.perfil || arr(p.modalidades).length) partes.push(`Operação ideal: ${[PERFIL_LABEL[p.perfil] || p.perfil, ...arr(p.modalidades).slice(0, 3)].filter(Boolean).join(", ")}.`);
  if (p.perfilComercial?.abordagem) partes.push(`Estilo de abordagem: ${p.perfilComercial.abordagem}.`);
  return partes.length ? partes.join(" ") : "Sem dados suficientes para gerar resumo. O profissional pode completar o perfil para aparecer aqui.";
}

function fitCultural(p, emp, db) {
  const campanhas = (db.campaigns || []).filter((c) => c.companyId === emp.id && c.status !== "encerrada");
  const campanha = campanhas[0] || {};
  const pontos = [];
  const atencao = [];
  let score = 35;
  if (campanha.funcao && p.perfil === campanha.funcao) { score += 18; pontos.push("função alinhada à campanha"); } else if (campanha.funcao) atencao.push("função principal diferente da campanha");
  if (campanha.regiao && norm(`${p.cidade} ${p.estado} ${arr(p.regioes).join(" ")}`).includes(norm(campanha.regiao))) { score += 10; pontos.push("região compatível"); } else if (campanha.regiao) atencao.push("região não confirmada");
  if (campanha.segmento && arr(p.segmentos).some((s) => norm(campanha.segmento).includes(norm(s)) || norm(s).includes(norm(campanha.segmento)))) { score += 14; pontos.push("experiência no segmento"); }
  if (arr(p.modalidades).some((m) => norm(`${emp.produto || ""} ${emp.icp || ""}`).includes(norm(m)))) { score += 8; pontos.push("preferências próximas da operação"); }
  if (p.disponibilidade) { score += 7; pontos.push("disponibilidade declarada"); } else atencao.push("disponibilidade não informada");
  if (Number(p.nota || 0) >= 80) { score += 8; pontos.push("score operacional alto"); } else atencao.push("score requer acompanhamento");
  return { campanha, percentual: Math.min(100, score), pontos: pontos.length ? pontos : ["dados reais disponíveis"], atencao: atencao.length ? atencao : ["sem ponto crítico identificado"] };
}

export default function TimeEmpresa({ emp, db, up, aviso }) {
  const [perfil, setPerfil] = useState(null), [chat, setChat] = useState(null);
  const [perfilPendente, setPerfilPendente] = useState(null);
  const time = db.sellers.filter((s) => s.aplicacoes?.[emp.id] === "aprovado");
  const decidir = async (s, st) => { const r = await apiPatch("/applications", { sellerId:s.id, companyId:emp.id, status:st }); if (r?.error) return aviso(r.error); up((d)=>({sellers:d.sellers.map((x)=>x.id===s.id?{...x,aplicacoes:{...x.aplicacoes,[emp.id]:st}}:x)})); aviso(st==="aprovado"?`${s.nome} entrou no seu time.`:"Candidatura recusada."); setPerfilPendente(null); };
  const perfLabel = (p) => PERFIL_LABEL[p] || p;
  const dados = (s) => { const subs=db.submissions.filter((x)=>x.sellerId===s.id&&x.companyId===emp.id), leads=(db.leads||[]).filter((l)=>l.sellerId===s.id&&l.companyId===emp.id), campanhas=(db.campaigns||[]).filter((c)=>c.companyId===emp.id&&c.candidaturas?.some((a)=>a.sellerId===s.id&&a.status==="aprovado")); const aprovadas=subs.filter((x)=>x.status==="liberado").length; return {subs,leads,campanhas,aprovadas,taxa:subs.length?Math.round(aprovadas/subs.length*100):0,ultima:Math.max(0,...subs.map((x)=>x.criadoEm||0),...leads.map((x)=>x.atualizadoEm||x.criadoEm||0))}; };
  const timeSorted = [...time].sort((a, b) => { const da=dados(a), db2=dados(b); if ((da.ultima>0)!==(db2.ultima>0)) return da.ultima>0?-1:1; return db2.ultima-da.ultima; });
  return <div className="vx-fade"><div className="vx-page-head"><div><div className="vx-eyebrow">Equipe vinculada</div><h1 className="vx-disp">Time da empresa</h1><p>Somente profissionais aprovados aparecem aqui. Quem já trabalhou fica no topo.</p></div><span className="vx-chip"><UserRound size={13}/>{time.length} profissionais</span></div>
    <div className="vx-talent-grid">{timeSorted.map((s)=>{const d=dados(s);return <article key={s.id} className="vx-card" style={{padding:17}}><div className="vx-row"><div style={{display:"flex",alignItems:"center",gap:10}}><div className="vx-avatar" style={s.foto?{padding:0,overflow:"hidden"}:undefined}>{s.foto?<img src={s.foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:s.nome.split(/\s+/).slice(0,2).map((x)=>x[0]).join("")}</div><div><b>{s.nome}</b><div className="vx-mut" style={{fontSize:12}}>{perfLabel(s.perfil)} · {s.cidade||"Brasil"}</div></div></div><span className="vx-badge vx-badge-brand">{d.taxa}% aprovadas</span></div><div className="vx-grid vx-g3" style={{marginTop:13}}><div className="vx-scenario"><span>Tarefas</span><strong>{d.subs.length}</strong></div><div className="vx-scenario"><span>Leads</span><strong>{d.leads.length}</strong></div><div className="vx-scenario"><span>Certificados</span><strong>{s.certificacoes?.length||0}</strong></div></div><div className="vx-chart-source">Última atividade: {d.ultima?dataCurta(d.ultima):"sem atividade"}</div><div style={{display:"flex",gap:7,marginTop:12,flexWrap:"wrap"}}><button className="vx-btn vx-btn-sm" onClick={()=>setPerfil(s)}><BarChart3 size={13}/>Perfil e desempenho</button><button className="vx-btn vx-btn-primary vx-btn-sm" onClick={()=>setChat(s)}><MessageSquare size={13}/>Enviar mensagem</button><button className="vx-btn vx-btn-danger vx-btn-sm" onClick={()=>decidir(s,"recusado")}>Remover</button></div></article>})}</div>
    {!time.length&&<div className="vx-card" style={{padding:24,textAlign:"center"}}><UserRound size={25} color="var(--muted)"/><p className="vx-mut">Solicite parceria em Profissionais Ativos ou aprove uma candidatura.</p></div>}
    {perfilPendente&&(()=>{const s=perfilPendente,fit=fitCultural(s,emp,db),ri=resumoIA(s);return <div className="vx-overlay" onClick={()=>setPerfilPendente(null)}><div className="vx-sheet" onClick={(e)=>e.stopPropagation()} style={{maxWidth:920}}><div className="vx-row"><div><div className="vx-eyebrow">Solicitação recebida</div><h2 className="vx-disp" style={{margin:"4px 0"}}>{s.nome}</h2></div><button className="vx-btn vx-btn-ghost" aria-label="Fechar" onClick={()=>setPerfilPendente(null)}><X size={16}/></button></div>
      <div className="vx-row" style={{alignItems:"flex-start",gap:14,flexWrap:"wrap",marginTop:8}}><div className="vx-avatar" style={{width:76,height:76,fontSize:22,...(s.foto?{padding:0,overflow:"hidden"}:{})}}>{s.foto?<img src={s.foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:iniciais(s.nome)}</div><div style={{flex:1,minWidth:200}}><b style={{fontSize:16}}>{s.nome}</b><div className="vx-mut" style={{fontSize:13,marginTop:3}}><MapPin size={12} style={{verticalAlign:-2}}/> {text([s.cidade,s.estado].filter(Boolean).join(" / "),"Cidade não informada")} · <BriefcaseBusiness size={12} style={{verticalAlign:-2}}/> {perfLabel(s.perfil)||"Função não informada"}</div><div style={{marginTop:8}}><Tags itens={[PERFIL_LABEL[s.perfil]||s.perfil,...arr(s.modalidades)].filter(Boolean)}/></div></div><span className={`vx-badge vx-badge-${Number(s.nota||0)>=80?"brand":Number(s.nota||0)>=50?"amber":"red"}`} style={{fontSize:18,padding:"6px 14px"}}>{s.nota||0} pts</span></div>
      <div className="vx-grid vx-g2" style={{marginTop:14}}>
        <section className="vx-card" style={{padding:14}}><h3 className="vx-disp" style={{fontSize:15}}>Resumo com IA</h3><p className="vx-mut" style={{lineHeight:1.6}}>{ri}</p><h3 className="vx-disp" style={{fontSize:15,marginTop:12}}>Fit cultural</h3><div className="vx-row"><b className="vx-mono" style={{fontSize:22}}>{fit.percentual}%</b><span className="vx-chip">{fit.campanha?.titulo||"campanha de referência"}</span></div><p className="vx-mut" style={{fontSize:13}}>Pontos positivos: {fit.pontos.join("; ")}.</p><p className="vx-mut" style={{fontSize:13}}>Atenção: {fit.atencao.join("; ")}.</p></section>
        <section className="vx-card" style={{padding:14}}><h3 className="vx-disp" style={{fontSize:15}}>Dados do perfil</h3><p><MapPin size={13} style={{verticalAlign:-2}}/> {text([s.cidade,s.estado].filter(Boolean).join(" / "),"Cidade/região não informada")}</p><p>Disponibilidade: {text(s.disponibilidade)}</p><p>Segmentos</p><Tags itens={arr(s.segmentos)}/><p style={{marginTop:8}}>Skills</p><Tags itens={arr(s.skills)}/><p style={{marginTop:8}}>LinkedIn: {s.linkedin?<a href={s.linkedin} target="_blank" rel="noreferrer" className="vx-link">{s.linkedin}</a>:"não informado"}</p></section>
      </div>
      <section className="vx-card" style={{padding:14,marginTop:14}}><h3 className="vx-disp" style={{fontSize:15}}><Award size={14} style={{verticalAlign:-2}}/> Academy e certificações</h3>{s.certificacoes?.length?<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{s.certificacoes.map((c)=><span key={`${c.funcao}-${c.percentual}`} className="vx-chip"><CheckCircle2 size={12}/>{perfLabel(c.funcao)} · {c.percentual}%</span>)}</div>:<p className="vx-mut">Nenhuma certificação publicada ainda.</p>}</section>
      <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}><button className="vx-btn vx-btn-primary" style={{flex:1,minWidth:140}} onClick={()=>decidir(s,"aprovado")}><CheckCircle2 size={14}/> Aprovar profissional</button><button className="vx-btn vx-btn-danger" style={{flex:1,minWidth:140}} onClick={()=>decidir(s,"recusado")}><X size={14}/> Recusar candidatura</button><button className="vx-btn vx-btn-sm" onClick={()=>{setPerfilPendente(null);setChat(s)}}><MessageSquare size={13}/> Enviar mensagem</button></div>
    </div></div>})()}
    {perfil&&(()=>{const d=dados(perfil);return <div className="vx-overlay" onClick={()=>setPerfil(null)}><div className="vx-sheet" onClick={(e)=>e.stopPropagation()}><div className="vx-row"><div><div className="vx-eyebrow">Dossiê autorizado</div><h2 className="vx-disp" style={{margin:"4px 0"}}>{perfil.nome}</h2></div><button className="vx-btn vx-btn-ghost" onClick={()=>setPerfil(null)}><X size={16}/></button></div><p className="vx-mut">{perfil.experiencia||"Experiência em atualização."}</p><div className="vx-grid vx-g2"><div className="vx-scenario"><span>Aprovações</span><strong>{d.aprovadas}/{d.subs.length}</strong></div><div className="vx-scenario"><span>Campanhas vinculadas</span><strong>{d.campanhas.length}</strong></div><div className="vx-scenario"><span>Leads</span><strong>{d.leads.length}</strong></div><div className="vx-scenario"><span>Nota</span><strong>{perfil.nota}/100</strong></div></div><h3 className="vx-disp" style={{fontSize:15}}><Award size={15} style={{verticalAlign:-2}}/> Academy e certificações</h3>{perfil.certificacoes?.length?perfil.certificacoes.map((c)=><span className="vx-chip" key={c.funcao}>{perfLabel(c.funcao)} · {c.percentual}%</span>):<p className="vx-mut">Sem certificações publicadas.</p>}<button className="vx-btn vx-btn-primary vx-btn-block" style={{marginTop:17}} onClick={()=>{setPerfil(null);setChat(perfil)}}><MessageSquare size={14}/>Enviar mensagem</button></div></div>})()}
    {chat&&<div className="vx-overlay" onClick={()=>setChat(null)}><div className="vx-sheet" onClick={(e)=>e.stopPropagation()}><div className="vx-row"><div><div className="vx-eyebrow">Mensagem direta</div><h2 className="vx-disp" style={{fontSize:18,margin:"3px 0"}}>{chat.nome}</h2></div><button className="vx-btn vx-btn-ghost" onClick={()=>setChat(null)}><X size={16}/></button></div><Chat empresa={emp} sellerId={chat.id} db={db} up={up} de="empresa"/></div></div>}
  </div>;
}
