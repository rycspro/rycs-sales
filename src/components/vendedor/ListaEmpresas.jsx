import { useEffect, useState } from "react";
import { Wallet, Clock, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import { CompanyScoreChip } from "../CompanyScore.jsx";
import { atendeCertificacaoDaCampanha } from "../../../shared/campaignAcademy.js";

export default function ListaEmpresas({ eu, db, up, aviso, abrir, recarregar, irAcademy }) {
  const ordenadas = [...db.companies].sort((a, b) => Number(b.destaque) - Number(a.destaque));
  const [estudando, setEstudando] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [campanhaAberta, setCampanhaAberta] = useState(null);
  const [convites, setConvites] = useState([]);
  useEffect(() => { api("/partnerships/invitations").then((r) => { if (Array.isArray(r)) setConvites(r); }); }, []);
  const responderConvite = async (convite, status) => {
    const r = await apiPatch(`/partnerships/${convite.id}`, { status });
    if (r?.error) return aviso(r.error);
    setConvites((lista) => lista.map((c) => c.id === convite.id ? { ...c, status } : c));
    await recarregar?.(); aviso(status === "aprovado" ? "Parceria aceita. A empresa já aparece na sua operação." : "Convite recusado.");
  };
  const escolherResposta = (companyId, pergunta, opcao) => setRespostas((atual) => {
    const respostasDaEmpresa = [...(atual[companyId] || [])];
    respostasDaEmpresa[pergunta] = opcao;
    return { ...atual, [companyId]: respostasDaEmpresa };
  });
  const candidatar = (c) => {
    api("/applications", { sellerId: eu.id, companyId: c.id }).then((r) => {
      if (r?.error) return aviso(r.error);
      up((d) => ({
      sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, aplicacoes: { ...s.aplicacoes, [c.id]: "pendente" } } : s),
      }));
      aviso(`Solicitação enviada para ${c.nome}.`);
    });
  };
  const enviarQuiz = async (c) => {
    const questoes = c.qualificacao?.questoes || [];
    const rs = respostas[c.id] || [];
    if (rs.length !== questoes.length || rs.some((x) => x === undefined)) return aviso("Responda todas as questões antes de enviar.");
    setEnviando(true);
    const r = await api(`/company-training/${c.id}/quiz`, { respostas: rs });
    setEnviando(false);
    if (r?.error) return aviso(r.error);
    aviso(r.aprovado ? `Avaliação concluída: ${r.quizScore}%. Você já pode se candidatar.` : `Você fez ${r.quizScore}%. Revise o material e tente novamente.`);
    await recarregar();
  };
  const candidatarCampanha = async (campanha) => {
    const r = await api(`/campaigns/${campanha.id}/apply`, {});
    if (r?.error) return aviso(r.error);
    aviso("Candidatura enviada para aprovação.");
    await recarregar();
  };

  return (
    <div className="vx-fade">
      {convites.some((c) => c.status === "pendente") && <section className="vx-card" style={{padding:18,marginBottom:22,borderColor:"var(--brand)"}}><div className="vx-row"><div><div className="vx-eyebrow">Convites de parceria</div><div className="vx-disp" style={{fontSize:17}}>Empresas querem trabalhar com você</div></div><span className="vx-chip vx-mono">{convites.filter((c)=>c.status==="pendente").length}</span></div>{convites.filter((c)=>c.status==="pendente").map((c)=><div key={c.id} className="vx-row" style={{paddingTop:12,marginTop:12,borderTop:"1px solid var(--border)",flexWrap:"wrap"}}><div><b>{c.empresaNome}</b><div className="vx-mut" style={{fontSize:12}}>{c.produto}{c.segmento?` · ${c.segmento}`:""}</div></div><div style={{display:"flex",gap:7}}><button className="vx-btn vx-btn-danger vx-btn-sm" onClick={()=>responderConvite(c,"recusado")}>Recusar</button><button className="vx-btn vx-btn-primary vx-btn-sm" onClick={()=>responderConvite(c,"aprovado")}>Aceitar parceria</button></div></div>)}</section>}

      {!!db.campaigns?.length && <>
        <div className="vx-row" style={{ marginBottom: 12 }}>
          <h2 className="vx-disp" style={{ fontSize: 19, margin: 0 }}>Campanhas disponíveis</h2>
          <span className="vx-chip vx-mono">{db.campaigns.length}</span>
        </div>
        <div className="vx-grid" style={{ marginBottom: 24 }}>
          {db.campaigns.map((campanha) => {
            const empresa = db.companies.find((c) => c.id === campanha.companyId);
            const certificada = atendeCertificacaoDaCampanha(campanha, eu.certificacoes);
            const candidatura = campanha.candidaturas?.[0];
            return <div key={campanha.id} className="vx-card" style={{ padding: 18 }}>
              <div className="vx-disp" style={{ fontSize: 17 }}>{campanha.titulo}</div>
              <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 3 }}>{empresa?.nome || campanha.produto} · {campanha.funcao?.toUpperCase()}</div>
              <button className="vx-btn vx-btn-block" style={{ marginTop: 12 }} onClick={() => setCampanhaAberta(campanhaAberta === campanha.id ? null : campanha.id)}>
                <BookOpen size={15} />{campanhaAberta === campanha.id ? "Fechar treinamento" : "Ver treinamento da campanha"}
              </button>
              {campanhaAberta === campanha.id && <div style={{ marginTop: 10 }}>
                {(campanha.treinamento || []).map((m, i) => <div key={m.id || i} style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}><b style={{ fontSize: 13 }}>{m.titulo}</b><div className="vx-mut" style={{ fontSize: 12.5, marginTop: 3, whiteSpace: "pre-wrap" }}>{m.conteudo}</div></div>)}
              </div>}
              {candidatura?.status === "aprovado" ? <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 10 }} onClick={() => abrir(campanha.companyId, campanha.id)}>Trabalhar nesta campanha</button>
                : candidatura?.status === "pendente" ? <button className="vx-btn vx-btn-block" style={{ marginTop: 10 }} disabled>Aguardando aprovação</button>
                : !certificada ? <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 10 }} onClick={() => irAcademy(campanha.funcao)}>Fazer prova da Academy</button>
                : <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 10 }} onClick={() => candidatarCampanha(campanha)}>Candidatar-se</button>}
            </div>;
          })}
        </div>
      </>}

      <div className="vx-row" style={{ marginBottom: 12 }}>
        <h2 className="vx-disp" style={{ fontSize: 19, margin: 0 }}>Empresas na operação</h2>
        <span className="vx-chip vx-mono">{ordenadas.length}</span>
      </div>

      <div className="vx-grid">
        {ordenadas.map((c) => {
          const st = eu.aplicacoes?.[c.id];
          const qualificacao = c.qualificacao || {};
          const questoes = qualificacao.questoes || [];
          const scoreQuiz = eu.aplicacoesDetalhe?.[c.id]?.quizScore;
          return (
            <div key={c.id} className="vx-empresa-card">
              {/* Faixa de topo com a cor da marca: dá presença ao card sem
                  exigir que toda empresa tenha logotipo. */}
              <div className="vx-empresa-topo" style={{ background: `linear-gradient(120deg, ${c.cor}, transparent 78%)` }} />

              <div className="vx-empresa-corpo">
                <div className="vx-empresa-cabeca">
                  <div className="vx-empresa-logo" style={{ borderColor: c.cor }}>
                    {c.logo
                      ? <img src={c.logo} alt="" />
                      : <span style={{ color: c.cor }}>{String(c.nome || "?").slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="vx-disp" style={{ fontSize: 19 }}>{c.nome}</span>
                      <CompanyScoreChip nota={c.nota} />
                      {c.destaque && <span className="vx-badge vx-badge-amber">Destaque</span>}
                    </div>
                    <div className="vx-mut" style={{ fontSize: 13, marginTop: 3 }}>{c.produto}</div>
                  </div>
                </div>

                {/* Ficha: é o que faz o profissional decidir se quer vender
                    para esta empresa antes de se candidatar. */}
                <div className="vx-empresa-ficha">
                  <div><span className="vx-eyebrow">Ticket médio</span><b>{c.ticket || "—"}</b></div>
                  <div><span className="vx-eyebrow">Segmento</span><b>{c.segmento || "—"}</b></div>
                  <div><span className="vx-eyebrow">Região</span><b>{c.regiao || "Brasil"}</b></div>
                  <div><span className="vx-eyebrow">Vagas</span><b>{c.vagas ?? "—"}</b></div>
                </div>

                <div className="vx-empresa-icp">
                  <span className="vx-eyebrow">Cliente ideal</span>
                  <p>{c.icp || "A empresa ainda não descreveu o cliente ideal."}</p>
                </div>

                {!!c.diferenciais && (
                  <div className="vx-empresa-icp">
                    <span className="vx-eyebrow">Diferenciais</span>
                    <p>{c.diferenciais}</p>
                  </div>
                )}

                <div className="vx-eyebrow" style={{ marginTop: 14, marginBottom: 6 }}>Quanto você recebe por ação</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {ORDEM_ACOES.filter((k) => c.comissoes[k]).map((k) => (
                    <span key={k} className="vx-chip vx-mono">{ACOES[k].nome} <b style={{ color: "var(--brand)" }}>{money(c.comissoes[k])}</b></span>
                  ))}
                </div>

              {st === "aprovado" ? (
                <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => abrir(c.id)}>Abrir área da empresa</button>
              ) : st === "pendente" ? (
                <button className="vx-btn vx-btn-block" disabled>Aguardando a empresa aprovar</button>
              ) : st === "recusado" ? (
                <button className="vx-btn vx-btn-danger vx-btn-block" disabled>Não aprovado nesta operação</button>
              ) : (
                <>
                  {!!(c.curso?.length || questoes.length) && <button className="vx-btn vx-btn-block" style={{ marginBottom: 8 }} onClick={() => setEstudando(estudando === c.id ? null : c.id)}><BookOpen size={15} />{estudando === c.id ? "Fechar preparação" : "Conhecer a empresa e fazer avaliação"}</button>}
                  {questoes.length && scoreQuiz !== undefined && <div className="vx-mut" style={{ fontSize: 12, marginBottom: 8, color: scoreQuiz >= (qualificacao.notaMinimaQuiz || 70) ? "var(--brand)" : undefined }}><CheckCircle2 size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Última avaliação: {scoreQuiz}% · mínimo {qualificacao.notaMinimaQuiz || 70}%</div>}
                  <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => candidatar(c)}>Pedir para vender ({c.vagas} vagas)</button>
                </>
              )}
              {estudando === c.id && <div className="vx-card" style={{ marginTop: 12, padding: 14, background: "var(--surface-2)" }}>
                <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Preparação para {c.nome}</div>
                {(c.curso || []).map((m, i) => <div key={m.id || i} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}><b style={{ fontSize: 13 }}>{m.titulo}</b><div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4, whiteSpace: "pre-wrap" }}>{m.conteudo}</div></div>)}
                {!!questoes.length && <div style={{ marginTop: 14 }}><b style={{ fontSize: 13.5 }}>Avaliação de conhecimento</b>{questoes.map((q, i) => <div key={i} style={{ marginTop: 12 }}><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 7 }}>{i + 1}. {q.pergunta}</div>{q.opcoes.map((op, n) => <button key={n} className="vx-btn vx-btn-sm vx-btn-block" style={{ marginTop: 5, justifyContent: "flex-start", borderColor: respostas[c.id]?.[i] === n ? "var(--brand)" : undefined, background: respostas[c.id]?.[i] === n ? "var(--brand-50)" : undefined }} onClick={() => escolherResposta(c.id, i, n)}>{op}</button>)}</div>)}<button className="vx-btn vx-btn-primary vx-btn-block" disabled={enviando} style={{ marginTop: 14 }} onClick={() => enviarQuiz(c)}>{enviando ? "Enviando…" : "Enviar avaliação"}</button></div>}
                {!c.curso?.length && !questoes.length && <div className="vx-mut" style={{ fontSize: 13 }}><AlertCircle size={14} style={{ verticalAlign: -2 }} /> Esta empresa ainda não publicou material.</div>}
              </div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
