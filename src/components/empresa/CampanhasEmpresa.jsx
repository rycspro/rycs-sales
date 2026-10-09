import { useEffect, useMemo, useState } from "react";
import { CirclePause, ClipboardCheck, Plus, Rocket, Save, Wallet } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { lerJson, gravarJson, remover as removerArmazenado } from "../../lib/armazenamento.js";
import { campanhaPodeSerPublicada, saldoDisponivel } from "../../../shared/empresa.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import NovaCampanha from "./NovaCampanha.jsx";
import CampaignsDashboard from "./CampaignsDashboard.jsx";
import CampaignDetail from "./CampaignDetail.jsx";

const novaCampanha = (emp) => ({
  titulo: "", descricao: "", produto: emp.produto || "", objetivo: "Gerar reuniões qualificadas",
  publico: emp.icp || "", regiao: emp.regiao || "", funcao: "sdr", vagas: 2, orcamento: 0,
  prazoHoras: 48, limitePorProfissional: 10, aceitaLeadProprio: false, exigeCertificacao: true,
  duracaoDias: 30,
  tarefas: { agendamento: 0, realizada: 0, venda:0, ligacao:0, follow:0 }, evidencias: {
    agendamento: ["Lead no ICP", "Data e participantes", "Confirmação", "Vídeo ou registro verificável"],
    realizada: ["Presença", "Duração", "Gravação ou transcrição autorizada"],
  }, criteriosAprovacao: { agendamento: "Lead válido, não duplicado e reunião confirmada.", realizada: "Participantes presentes e reunião concluída conforme a campanha." }, treinamento: [], requisitos: "",
});

export default function CampanhasEmpresa({ emp, db, up, aviso, recarregar }) {
  const campanhas = (db.campaigns || []).filter((c) => c.companyId === emp.id);
  // Criar e editar deixam de ser a mesma tela. Criar é decisão comercial e
  // ganha um assistente de três passos; editar é ajuste fino e continua no
  // editor completo, com todos os campos à mão.
  const [criando, setCriando] = useState(false);
  const [criarComIA, setCriarComIA] = useState(false);
  const [modo, setModo] = useState("dashboard");
  const [recarregarDashboard, setRecarregarDashboard] = useState(0);
  const [selecionada, setSelecionada] = useState(campanhas[0]?.id || "nova");
  const existente = campanhas.find((c) => c.id === selecionada);
  const [rascunhoNovo, setRascunhoNovo] = useState(() => lerJson(`rycs-campanha-${emp.id}`, null) || novaCampanha(emp));
  const [edicao, setEdicao] = useState(null);
  const [alterado,setAlterado]=useState(false);
  const campanha = edicao?.id === selecionada ? edicao : existente || rascunhoNovo;
  const set = (k, valor) => {
    const atualizar = (c) => ({ ...c, [k]: valor });
    existente ? setEdicao(atualizar(campanha)) : setRascunhoNovo(atualizar(campanha));
    setAlterado(true);
  };
  const check = useMemo(() => campanhaPodeSerPublicada(campanha, emp), [campanha, emp]);
  const disponivel = saldoDisponivel(emp);
  useEffect(()=>{if(!existente)gravarJson(`rycs-campanha-${emp.id}`,rascunhoNovo);},[rascunhoNovo,existente,emp.id]);
  useEffect(()=>{const sair=(e)=>{if(alterado){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",sair);return()=>window.removeEventListener("beforeunload",sair);},[alterado]);
  const passos=["Informações gerais","Objetivo e público","Profissionais e Time","Leads","Academy","Tarefas e Valores","Aprovações","Orçamento e ROI","Revisão","Publicação"];
  const concluidos=[campanha.titulo,campanha.publico,true,true,(campanha.treinamento||[]).length,Object.values(campanha.tarefas||{}).some(Number),campanha.criteriosAprovacao,campanha.orcamento,check.pendencias.length===0,campanha.status==="ativa"].filter(Boolean).length;

  const salvar = async () => {
    if (!campanha.titulo.trim()) return aviso("Dê um título à campanha.");
    let r;
    if (existente) r = await apiPatch(`/campaigns/${existente.id}`, campanha);
    else r = await api("/campaigns", campanha);
    if (!r || r.error) return aviso(r?.error || "Não foi possível salvar.");
    if (existente) {
      up((d) => ({ campaigns: d.campaigns.map((c) => c.id === existente.id ? { ...c, ...campanha } : c) }));
    } else {
      const criada = { ...campanha, id: r.id, companyId: emp.id, status: "rascunho", criadoEm: Date.now() };
      up((d) => ({ campaigns: [...(d.campaigns || []), criada] }));
      setSelecionada(r.id); setEdicao(criada); setRascunhoNovo(novaCampanha(emp));
    }
    aviso("Campanha salva como rascunho.");
    setAlterado(false);removerArmazenado(`rycs-campanha-${emp.id}`);
    return r.id || existente.id;
  };
  const mudarStatus = async (status) => {
    const id = existente?.id || await salvar();
    if (!id) return;
    if (existente) await apiPatch(`/campaigns/${id}`, campanha);
    const r = await api(`/campaigns/${id}/status`, { status });
    if (!r || r.error) return aviso(r?.pendencias?.join(" · ") || r?.error || "Não foi possível alterar a campanha.");
    up((d) => ({ campaigns: d.campaigns.map((c) => c.id === id ? { ...c, ...campanha, status } : c) }));
    setEdicao((c) => c ? { ...c, status } : c);
    aviso(status === "ativa" ? "Campanha publicada." : "Campanha pausada.");
  };
  const adicionarModulo = () => set("treinamento", [...(campanha.treinamento || []), { id: `mod-${Date.now()}`, titulo: "", conteudo: "" }]);
  const decidirCandidatura = async (app, status) => {
    const r = await apiPatch(`/campaigns/${campanha.id}/applications/${app.id}`, { status });
    if (!r || r.error) return aviso(r?.error || "Não foi possível decidir a candidatura.");
    aviso(status === "aprovado" ? "Profissional aprovado e liberado para trabalhar." : "Candidatura recusada.");
    await recarregar?.();
  };

  if (criando) return (
    <NovaCampanha
      emp={emp}
      aviso={aviso}
      iniciarComIA={criarComIA}
      aoCancelar={() => { setCriando(false); setCriarComIA(false); }}
      aoCriar={(criada) => {
        up((d) => ({ campaigns: [...(d.campaigns || []), criada] }));
        setSelecionada(criada.id);
        setEdicao(criada);
        setCriando(false);
        setCriarComIA(false);
        setModo("editor");
        setRecarregarDashboard((n) => n + 1);
        aviso("Campanha criada como rascunho. Adicione o treinamento para publicar.");
      }}
    />
  );

  if (modo === "dashboard") return <CampaignsDashboard
    campanhas={campanhas}
    recarregarSinal={recarregarDashboard}
    onCriar={() => { setCriarComIA(false); setCriando(true); }}
    onCriarIA={() => { setCriarComIA(true); setCriando(true); }}
    onAbrir={(c) => { setSelecionada(c.id); setEdicao({ ...c }); setModo("detalhe"); }}
  />;

  if (modo === "detalhe" && existente) return <CampaignDetail
    campanha={existente}
    db={db}
    onVoltar={() => setModo("dashboard")}
    onEditar={() => { setEdicao({ ...existente }); setModo("editor"); }}
    onStatus={mudarStatus}
  />;

  return <div className="vx-fade">
    <div className="vx-row" style={{ alignItems: "flex-start", gap: 16, marginBottom: 16 }}><div><button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ paddingLeft: 0, marginBottom: 4 }} onClick={() => setModo(existente ? "detalhe" : "dashboard")}>← {existente ? "Dashboard da campanha" : "Central de campanhas"}</button><div className="vx-eyebrow">Configuração da campanha</div><h2 className="vx-disp" style={{ fontSize: 24, margin: "5px 0" }}>{campanha.titulo || "Nova campanha"}</h2><p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>Ajuste orçamento, tarefas, evidências e treinamento.</p></div><button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => { setCriarComIA(false); setCriando(true); }}><Plus size={14} /> Nova campanha</button></div>
    <div className="vx-card" style={{padding:14,marginBottom:14}}><div className="vx-row"><b>Progresso da campanha</b><span className="vx-chip vx-mono">{concluidos}/10 {alterado?"· não salvo":"· salvo"}</span></div><div className="vx-meter-track" style={{margin:"10px 0"}}><div className="vx-meter-fill" style={{width:`${concluidos*10}%`,background:"var(--brand)"}}/></div><div className="vx-steps">{passos.map((p,i)=><span key={p} data-done={i<concluidos?"1":"0"}>{i+1}. {p}</span>)}</div></div>

    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10 }}>{campanhas.map((c) => <button key={c.id} className="vx-btn vx-btn-sm" onClick={() => { setSelecionada(c.id); setEdicao({ ...c }); }} style={{ borderColor: selecionada === c.id ? "var(--brand)" : undefined }}>{c.titulo} · {c.status}</button>)}</div>

    <div className="vx-grid vx-g2">
      <section className="vx-card" style={{ padding: 18 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 12 }}>Identidade e público</div>
        <label><div className="vx-label">Título</div><input className="vx-input" value={campanha.titulo} onChange={(e) => set("titulo", e.target.value)} /></label>
        <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">Objetivo</div><input className="vx-input" value={campanha.objetivo} onChange={(e) => set("objetivo", e.target.value)} /></label>
        <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">Descrição</div><textarea className="vx-input" style={{ minHeight: 72 }} value={campanha.descricao} onChange={(e) => set("descricao", e.target.value)} /></label>
        <div className="vx-grid vx-g2" style={{ marginTop: 10 }}><label><div className="vx-label">Função</div><select className="vx-input" value={campanha.funcao} onChange={(e) => set("funcao", e.target.value)}><option value="sdr">SDR</option><option value="bdr">BDR</option><option value="closer">Closer</option><option value="pap">PAP</option></select></label><label><div className="vx-label">Região</div><input className="vx-input" value={campanha.regiao} onChange={(e) => set("regiao", e.target.value)} /></label></div>
        <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">ICP da campanha</div><textarea className="vx-input" style={{ minHeight: 72 }} value={campanha.publico} onChange={(e) => set("publico", e.target.value)} /></label>
      </section>

      <section className="vx-card" style={{ padding: 18 }}>
        <div className="vx-row"><div className="vx-disp" style={{ fontSize: 17 }}>Orçamento</div><span className="vx-chip"><Wallet size={12} /> {disponivel === Infinity ? "Sem limite de caixa" : `${money(disponivel)} disponível`}</span></div>
        <div className="vx-grid vx-g2" style={{ marginTop: 12 }}><label><div className="vx-label">Limite da campanha</div><input className="vx-input vx-mono" type="number" min="0" value={campanha.orcamento} onChange={(e) => set("orcamento", Number(e.target.value))} /></label><label><div className="vx-label">Vagas</div><input className="vx-input vx-mono" type="number" min="1" value={campanha.vagas} onChange={(e) => set("vagas", Number(e.target.value))} /></label></div>
        <div className="vx-grid vx-g2" style={{ marginTop: 10 }}>{ORDEM_ACOES.map((k)=><label key={k}><div className="vx-label">{ACOES[k].nome}</div><input className="vx-input vx-mono" type="number" min="0" value={campanha.tarefas?.[k] || 0} onChange={(e) => set("tarefas", { ...campanha.tarefas, [k]: Number(e.target.value) })} /></label>)}</div>
        <div className="vx-grid vx-g3" style={{ marginTop: 10 }}><label><div className="vx-label">Prazo em horas</div><input className="vx-input vx-mono" type="number" min="1" value={campanha.prazoHoras} onChange={(e) => set("prazoHoras", Number(e.target.value))} /></label><label><div className="vx-label">Duração (dias)</div><input className="vx-input vx-mono" type="number" min="1" value={campanha.duracaoDias || 30} onChange={(e) => set("duracaoDias", Number(e.target.value))} /></label><label><div className="vx-label">Limite por profissional</div><input className="vx-input vx-mono" type="number" min="0" value={campanha.limitePorProfissional} onChange={(e) => set("limitePorProfissional", Number(e.target.value))} /></label></div>
        <label style={{ display: "flex", gap: 8, marginTop: 13, fontSize: 13 }}><input type="checkbox" checked={campanha.aceitaLeadProprio} onChange={(e) => set("aceitaLeadProprio", e.target.checked)} /> Aceitar prospecção própria</label>
        <label style={{ display: "flex", gap: 8, marginTop: 9, fontSize: 13 }}><input type="checkbox" checked={campanha.exigeCertificacao} onChange={(e) => set("exigeCertificacao", e.target.checked)} /> Exigir certificação</label>
      </section>
    </div>

    <section className="vx-card" style={{ padding: 18, marginTop: 16 }}><div className="vx-row"><div><div className="vx-disp" style={{ fontSize: 17 }}>Treinamento específico</div><div className="vx-mut" style={{ fontSize: 12 }}>Ao menos um módulo é obrigatório para publicar.</div></div><button className="vx-btn vx-btn-sm" onClick={adicionarModulo}><Plus size={14} /> Módulo</button></div>{(campanha.treinamento || []).map((m, i) => <div key={m.id} className="vx-grid vx-g2" style={{ marginTop: 10 }}><input className="vx-input" placeholder="Título" value={m.titulo} onChange={(e) => set("treinamento", campanha.treinamento.map((x, n) => n === i ? { ...x, titulo: e.target.value } : x))} /><input className="vx-input" placeholder="Conteúdo ou URL" value={m.conteudo} onChange={(e) => set("treinamento", campanha.treinamento.map((x, n) => n === i ? { ...x, conteudo: e.target.value } : x))} /></div>)}</section>

    {!!existente?.candidaturas?.length && <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-disp" style={{ fontSize: 17, marginBottom: 10 }}>Candidaturas</div>
      <div className="vx-grid">
        {existente.candidaturas.map((app) => {
          const profissional = db.sellers.find((s) => s.id === app.sellerId);
          return <div key={app.id} className="vx-row" style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
            <div><b style={{ fontSize: 13.5 }}>{profissional?.nome || "Profissional"}</b><div className="vx-mut" style={{ fontSize: 12 }}>{app.status}</div></div>
            {app.status === "pendente" && <div style={{ display: "flex", gap: 7 }}><button className="vx-btn vx-btn-sm" onClick={() => decidirCandidatura(app, "recusado")}>Recusar</button><button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => decidirCandidatura(app, "aprovado")}>Aprovar</button></div>}
          </div>;
        })}
      </div>
    </section>}

    <section className="vx-card" style={{ padding: 16, marginTop: 16, borderColor: check.ok ? "var(--brand)" : "var(--amber)" }}><div style={{ display: "flex", gap: 9 }}><ClipboardCheck size={18} color={check.ok ? "var(--brand)" : "var(--amber)"} /><div><b>{check.ok ? "Pronta para publicar" : "Pendências de publicação"}</b>{!check.ok && <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 3 }}>{check.pendencias.join(" · ")}</div>}</div></div></section>
    <div style={{ display: "flex", gap: 9, marginTop: 16 }}><button className="vx-btn vx-btn-primary" onClick={salvar}><Save size={14} /> Salvar</button>{campanha.status === "ativa" ? <button className="vx-btn" onClick={() => mudarStatus("pausada")}><CirclePause size={14} /> Pausar</button> : <button className="vx-btn" disabled={!check.ok} onClick={() => mudarStatus("ativa")}><Rocket size={14} /> Publicar</button>}</div>
  </div>;
}
