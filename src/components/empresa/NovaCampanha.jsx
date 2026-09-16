import { useState } from "react";
import { Sparkles, ArrowRight, ArrowLeft, Check, Wallet, Loader } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";
import { OBJETIVOS, ORDEM_OBJETIVOS, montarCampanha, custoEstimado } from "../../../shared/objetivosCampanha.js";
import { saldoDisponivel } from "../../../shared/empresa.js";

// Criação de campanha em três passos.
//
// A tela antiga pedia trinta campos de uma vez, sem hierarquia: título, prazo,
// evidência por ação e limite por profissional no mesmo nível de importância.
// Para quem contrata, isso é um formulário de configuração — não uma decisão
// comercial. E quem não sabe a diferença entre SDR e BDR erra a escolha ali,
// recebe o profissional errado e conclui que a plataforma não funciona.
//
// Aqui a pergunta é outra: o que você precisa que aconteça. O objetivo
// escolhido configura função, ações remuneradas, prova exigida e prazo. Sobra
// para a empresa decidir só o que é dela: para quem, onde, quanto.
//
// Os campos avançados continuam existindo — ficam no editor completo, depois
// que a campanha nasce. Nada foi removido, só tirado do caminho.

const PASSOS = ["Objetivo", "Detalhes", "Revisão"];

export default function NovaCampanha({ emp, aoCriar, aoCancelar, aviso, iniciarComIA = false }) {
  const [passo, setPasso] = useState(0);
  const [objetivo, setObjetivo] = useState(null);
  const [campanha, setCampanha] = useState(null);
  const [brief, setBrief] = useState("");
  const [gerando, setGerando] = useState(false);
  const [explicacao, setExplicacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const disponivel = saldoDisponivel(emp);
  const set = (k, v) => setCampanha((c) => ({ ...c, [k]: v }));

  const escolher = (chave) => {
    setObjetivo(chave);
    setCampanha(montarCampanha(chave, emp));
    setExplicacao("");
    setPasso(1);
  };

  const gerarComIA = async () => {
    if (brief.trim().length < 10) return aviso("Escreva uma frase dizendo o que você precisa.");
    setGerando(true);
    const r = await api("/campaigns/sugerir", { brief });
    setGerando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível montar a campanha.");
    setObjetivo(r.campanha.objetivoChave);
    setCampanha(r.campanha);
    setExplicacao(r.explicacao);
    setPasso(1);
  };

  const criar = async () => {
    if (!campanha?.titulo?.trim()) return aviso("Dê um título à campanha.");
    setSalvando(true);
    const r = await api("/campaigns", campanha);
    setSalvando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível criar a campanha.");
    aoCriar?.({ ...campanha, id: r.id, companyId: emp.id, status: "rascunho", criadoEm: Date.now() });
  };

  const obj = objetivo ? OBJETIVOS[objetivo] : null;
  const custo = campanha ? custoEstimado(campanha, campanha.limitePorProfissional || 10) : null;

  return (
    <div className="vx-fade" style={{ maxWidth: 780 }}>
      {/* trilha dos passos */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {PASSOS.map((p, i) => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              color: i === passo ? "var(--brand)" : i < passo ? "var(--text-2)" : "var(--muted)",
              fontSize: 13, fontWeight: i === passo ? 600 : 500,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center",
                fontSize: 11, fontWeight: 700,
                background: i <= passo ? "var(--brand-50)" : "transparent",
                border: `1px solid ${i <= passo ? "var(--brand)" : "var(--border)"}`,
                color: i <= passo ? "var(--brand)" : "var(--muted)",
              }}>{i < passo ? <Check size={12} /> : i + 1}</span>
              {p}
            </div>
            {i < PASSOS.length - 1 && <div style={{ width: 22, height: 1, background: "var(--border)" }} />}
          </div>
        ))}
      </div>

      {/* ---------------------------------------------- passo 1: objetivo */}
      {passo === 0 && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>{iniciarComIA ? "Criar campanha com IA" : "O que você quer que a RYCS faça?"}</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            A escolha define qual profissional atende, o que é remunerado e que prova cada ação exige.
          </p>

          {!iniciarComIA && <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
            {ORDEM_OBJETIVOS.map((k) => {
              const o = OBJETIVOS[k];
              return (
                <button key={k} className="vx-card" onClick={() => escolher(k)}
                  style={{
                    padding: 16, textAlign: "left", cursor: "pointer", border: "1px solid var(--border)",
                    background: "var(--surface)", display: "flex", alignItems: "flex-start", gap: 13,
                  }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <b style={{ fontSize: 15 }}>{o.nome}</b>
                      <span className="vx-badge vx-badge-muted">{o.funcao.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>{o.resumo}</div>
                    <div className="vx-mut" style={{ fontSize: 12, marginTop: 6 }}>{o.paraQuem}</div>
                  </div>
                  <ArrowRight size={16} color="var(--muted)" style={{ flexShrink: 0, marginTop: 4 }} />
                </button>
              );
            })}
          </div>}

          {/* atalho assistido */}
          <div className="vx-card" style={{ padding: 16, marginTop: 16, borderColor: "var(--brand-100)", background: "var(--brand-50)" }}>
            <div className="vx-eyebrow" style={{ color: "var(--brand)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Sparkles size={12} /> Montar com IA
            </div>
            <p className="vx-mut" style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.6 }}>
              Escreva com suas palavras o que você precisa. A campanha vem montada como rascunho,
              e você revisa tudo antes de publicar.
            </p>
            <textarea className="vx-input" style={{ minHeight: 70, fontSize: 13 }} value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Ex.: preciso de reuniões com distribuidoras de bebida no interior de SP; quem fecha é meu time." />
            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 10 }}
              disabled={gerando} onClick={gerarComIA}>
              {gerando ? <><Loader size={14} /> Montando…</> : <><Sparkles size={14} /> Montar campanha</>}
            </button>
          </div>

          <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginTop: 14 }} onClick={aoCancelar}>Cancelar</button>
        </>
      )}

      {/* ---------------------------------------------- passo 2: detalhes */}
      {passo === 1 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>{obj?.nome}</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Já configuramos função, ações e evidências. Falta o que só você sabe.
          </p>

          {explicacao && (
            <div style={{ padding: "11px 14px", borderRadius: 10, background: "var(--brand-50)", border: "1px solid var(--brand-100)", marginTop: 14, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-2)" }}>
              {explicacao}
            </div>
          )}

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <label><div className="vx-label">Nome da campanha</div>
              <input className="vx-input" value={campanha.titulo} onChange={(e) => set("titulo", e.target.value)} /></label>

            <label style={{ display: "block", marginTop: 12 }}><div className="vx-label">Quem é o cliente que você quer</div>
              <textarea className="vx-input" style={{ minHeight: 64 }} value={campanha.publico}
                onChange={(e) => set("publico", e.target.value)}
                placeholder="Ex.: distribuidoras de bebida com 10 a 80 funcionários" /></label>

            <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
              <label><div className="vx-label">Região</div>
                <input className="vx-input" value={campanha.regiao} onChange={(e) => set("regiao", e.target.value)} placeholder="Ex.: interior de SP" /></label>
              <label><div className="vx-label">Quantos profissionais</div>
                <input className="vx-input vx-mono" type="number" min="1" value={campanha.vagas}
                  onChange={(e) => set("vagas", Number(e.target.value))} /></label>
            </div>
          </div>

          {/* valores: o ponto onde a empresa decide o que paga */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-row" style={{ marginBottom: 4 }}>
              <b style={{ fontSize: 14 }}>Quanto você paga por ação</b>
              <span className="vx-chip"><Wallet size={12} /> {money(disponivel)} disponível</span>
            </div>
            <p className="vx-mut" style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.6 }}>
              {campanha.valoresDerivadosDoTicket
                ? `Sugestões calculadas a partir do seu ticket (${emp.ticket}). São ponto de partida — quem decide o preço é você.`
                : "Sem ticket no cadastro da empresa não dá para sugerir valor. Preencha cada ação abaixo."}
            </p>
            <div className="vx-grid vx-g2">
              {Object.keys(campanha.tarefas).map((k) => (
                <label key={k}>
                  <div className="vx-label">{ACOES[k]?.nome || k}</div>
                  <input className="vx-input vx-mono" type="number" min="0" step="0.5" value={campanha.tarefas[k]}
                    onChange={(e) => set("tarefas", { ...campanha.tarefas, [k]: Number(e.target.value) })} />
                </label>
              ))}
            </div>

            <label style={{ display: "block", marginTop: 12 }}><div className="vx-label">Orçamento total da campanha</div>
              <input className="vx-input vx-mono" type="number" min="0" value={campanha.orcamento}
                onChange={(e) => set("orcamento", Number(e.target.value))} /></label>
            {campanha.orcamento > disponivel && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--amber)" }}>
                O orçamento passa do seu saldo disponível. Dá para salvar como rascunho, mas não para publicar.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(0)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(2)}>Revisar <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ---------------------------------------------- passo 3: revisão */}
      {passo === 2 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Confira antes de criar</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            A campanha nasce como rascunho. Publicar é um segundo passo, depois do treinamento.
          </p>

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-grid vx-g2" style={{ fontSize: 13 }}>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Campanha</span><div style={{ fontWeight: 600 }}>{campanha.titulo}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Objetivo</span><div style={{ fontWeight: 600 }}>{obj?.nome}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Profissional</span><div style={{ fontWeight: 600 }}>{campanha.funcao.toUpperCase()}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Vagas</span><div style={{ fontWeight: 600 }}>{campanha.vagas}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Região</span><div style={{ fontWeight: 600 }}>{campanha.regiao || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Prazo por ação</span><div style={{ fontWeight: 600 }}>{campanha.prazoHoras}h</div></div>
            </div>

            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>O que você paga</div>
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              {Object.entries(campanha.tarefas).map(([k, v]) => (
                <div key={k} className="vx-row">
                  <span style={{ color: "var(--text-2)" }}>{ACOES[k]?.nome || k}</span>
                  <b className="vx-mono">{money(Number(v))}</b>
                </div>
              ))}
            </div>
            {custo?.estimativaPorProfissional > 0 && (
              <div className="vx-mut" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                Se um profissional bater o limite de {campanha.limitePorProfissional} ações de cada tipo,
                a campanha consome cerca de <b className="vx-mono">{money(custo.estimativaPorProfissional)}</b> com ele.
                É estimativa de teto, não previsão: você só paga ação aprovada.
              </div>
            )}

            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Ainda falta, antes de publicar</div>
            <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, lineHeight: 1.8, color: "var(--muted)" }}>
              <li>Ao menos um módulo de treinamento sobre o seu produto</li>
              <li>Saldo disponível cobrindo o orçamento</li>
              <li>Plano pago ativo</li>
            </ul>
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(1)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={criar}>
              {salvando ? "Criando…" : <>Criar campanha <Check size={14} /></>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
