import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { money, dataCurta, agora } from "../../lib/utils.js";
import { Medidor, Excluir } from "../ui.jsx";
import { apiPatch } from "../../lib/api.js";
import { takeRateDoPlano } from "../../../shared/planos.js";
import { DossieEmpresa } from "./Dossie.jsx";
import CobrancaEmpresa from "./CobrancaEmpresa.jsx";

export default function EmpresasAdmin({ db, up, aviso }) {
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState(null);
  const [empresaCobranca, setEmpresaCobranca] = useState(null);

  const empresas = useMemo(() => {
    let list = db.companies.map((c) => {
      const subs = db.submissions.filter((s) => s.companyId === c.id);
      const liberados = subs.filter((s) => s.status === "liberado");
      const totalLiberado = liberados.reduce((a, s) => a + s.valor, 0);
      const receitaTaxa = totalLiberado * takeRateDoPlano(c.assinatura);
      const profissionais = db.sellers.filter((s) => s.aplicacoes?.[c.id] === "aprovado").length;
      const diasAtivos = Math.max(1, Math.ceil((agora() - c.criadoEm) / 86400000));
      const burnDiario = totalLiberado / diasAtivos;
      const runway = burnDiario > 0 ? Math.floor(c.saldo / burnDiario) : null;
      return { ...c, subs: subs.length, liberados: liberados.length, totalLiberado, receitaTaxa, profissionais, runway };
    });

    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter((c) => c.nome.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.totalLiberado - a.totalLiberado);
  }, [db, busca]);

  const totalSaldo = empresas.reduce((a, c) => a + c.saldo, 0);
  const totalAportado = empresas.reduce((a, c) => a + (c.totalAportado || 0), 0);
  const decidirCadastro = async (c, statusCadastro) => {
    // A rota lê `status`; esta tela mandava `statusCadastro`. O campo chegava
    // vazio, a validação recusava, e o botão de aprovar empresa nunca
    // funcionou — falhava com "Status inválido", que não diz nada a quem
    // clicou.
    const r = await apiPatch(`/companies/${c.id}/status`, { status: statusCadastro });

    if (!r || r.error) {
      // Cadastro incompleto volta com a lista de pendências. Sem mostrá-la, o
      // admin lê "Cadastro incompleto" e não tem como saber o que falta.
      const detalhe = r?.pendencias?.length ? `: falta ${r.pendencias.join(", ")}` : "";
      return aviso((r?.error || "Não foi possível atualizar o cadastro.") + detalhe);
    }

    up?.((d) => ({ companies: d.companies.map((x) => x.id === c.id ? { ...x, statusCadastro } : x) }));
    aviso(statusCadastro === "aprovada" ? `${c.nome} aprovada para operar.` : `${c.nome} suspensa.`);
  };

  if (empresaCobranca) {
    return <CobrancaEmpresa empresa={empresaCobranca} aviso={aviso} onVoltar={() => setEmpresaCobranca(null)} />;
  }

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 22 }}>Empresas</div>
        <span className="vx-badge vx-badge-muted">{empresas.length}</span>
      </div>

      <div className="vx-grid vx-g2" style={{ marginBottom: 16, fontSize: 13 }}>
        <div className="vx-card" style={{ padding: 14, textAlign: "center" }}>
          <span className="vx-mut">Saldo total</span>
          <div className="vx-mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--brand)" }}>{money(totalSaldo)}</div>
        </div>
        <div className="vx-card" style={{ padding: 14, textAlign: "center" }}>
          <span className="vx-mut">Total aportado</span>
          <div className="vx-mono" style={{ fontSize: 18, fontWeight: 700 }}>{money(totalAportado)}</div>
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--muted)" }} />
        <input className="vx-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa" style={{ paddingLeft: 32 }} />
      </div>

      <div className="vx-grid">
        {empresas.map((c) => {
          const isOpen = expandido === c.id;
          return (
            <div key={c.id} className="vx-card" style={{ overflow: "hidden", borderLeft: `3px solid ${c.cor}` }}>
              <div style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                onClick={() => setExpandido(isOpen ? null : c.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <b style={{ fontSize: 15 }}>{c.nome}</b>
                    {c.destaque && <span className="vx-badge vx-badge-amber">Destaque</span>}
                    <span className={`vx-badge ${c.statusCadastro === "aprovada" ? "vx-badge-brand" : c.statusCadastro === "em_analise" ? "vx-badge-amber" : "vx-badge-muted"}`}>{({ rascunho: "Rascunho", em_analise: "Em análise", aprovada: "Aprovada", suspensa: "Suspensa" })[c.statusCadastro] || "Rascunho"}</span>
                  </div>
                  <div className="vx-mut" style={{ fontSize: 12 }}>{c.profissionais} profissionais · {c.liberados} ações liberadas</div>
                </div>
                <div style={{ textAlign: "right", marginRight: 8 }}>
                  <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700 }}>{money(c.saldo)}</div>
                  <div className="vx-mut" style={{ fontSize: 11 }}>saldo</div>
                </div>
                {isOpen ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
              </div>

              {isOpen && (
                <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--border)" }}>
                  <div className="vx-grid vx-g4" style={{ marginTop: 14, fontSize: 12.5 }}>
                    <div><span className="vx-mut">Saldo</span><div className="vx-mono" style={{ fontWeight: 600 }}>{money(c.saldo)}</div></div>
                    <div><span className="vx-mut">Aportado</span><div className="vx-mono" style={{ fontWeight: 600 }}>{money(c.totalAportado || 0)}</div></div>
                    <div><span className="vx-mut">Pago em comissões</span><div className="vx-mono" style={{ fontWeight: 600 }}>{money(c.totalLiberado)}</div></div>
                    <div><span className="vx-mut">Receita RYCS</span><div className="vx-mono" style={{ fontWeight: 600, color: "var(--brand)" }}>{money(c.receitaTaxa + (c.destaque ? 490 : 0))}</div></div>
                  </div>
                  <div className="vx-grid vx-g4" style={{ marginTop: 10, fontSize: 12.5 }}>
                    <div><span className="vx-mut">Submissões</span><div style={{ fontWeight: 600 }}>{c.subs}</div></div>
                    <div><span className="vx-mut">Liberadas</span><div style={{ fontWeight: 600 }}>{c.liberados}</div></div>
                    <div><span className="vx-mut">Profissionais</span><div style={{ fontWeight: 600 }}>{c.profissionais}</div></div>
                    <div><span className="vx-mut">Cadastro</span><div>{dataCurta(c.criadoEm)}</div></div>
                  </div>
                  {c.runway !== null && (
                    <div style={{ marginTop: 12 }}>
                      <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 4 }}>
                        <span className="vx-mut">Runway do saldo</span>
                        <b style={{ color: c.runway < 7 ? "var(--red)" : c.runway < 20 ? "var(--amber)" : "var(--brand)" }}>
                          {c.runway} dia{c.runway === 1 ? "" : "s"}
                        </b>
                      </div>
                      <Medidor value={Math.min(100, (c.runway / 30) * 100)} tone={c.runway < 7 ? "red" : c.runway < 20 ? "amber" : "brand"} />
                      {c.runway < 10 && (
                        <div style={{ fontSize: 12, color: "var(--amber)", marginTop: 6 }}>Caixa baixo — avisar empresa para abastecer.</div>
                      )}
                    </div>
                  )}

                  <hr className="vx-sep" />
                  <div style={{ marginBottom: 12 }}>
                    <button className="vx-btn vx-btn-sm" onClick={() => setEmpresaCobranca(c)}>
                      Cobrança e Acesso
                    </button>
                  </div>
                  <DossieEmpresa companyId={c.id} />

                  <div className="vx-row" style={{ marginTop: 16, marginBottom: 12, alignItems: "center" }}>
                    <div><b style={{ fontSize: 13 }}>Habilitação operacional</b><div className="vx-mut" style={{ fontSize: 12 }}>A aprovação libera publicação de campanhas.</div></div>
                    <div style={{ display: "flex", gap: 7 }}>
                      {c.statusCadastro !== "aprovada" && <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => decidirCadastro(c, "aprovada")}>Aprovar empresa</button>}
                      {c.statusCadastro === "aprovada" && <button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => decidirCadastro(c, "suspensa")}>Suspender</button>}
                    </div>
                  </div>
                  <Excluir
                    key={c.id}
                    rota={`/companies/${c.id}`}
                    label="Excluir empresa"
                    sucesso={`Empresa ${c.nome} excluída da plataforma.`}
                    aviso={aviso}
                    onRemovido={() => { setExpandido(null); up?.((d) => ({ companies: d.companies.filter((x) => x.id !== c.id) })); }}
                    conflito={(p) => `${c.nome} tem ${money(p.saldo || 0)} em caixa` +
                      (p.acoesEmAnalise ? ` e ${p.acoesEmAnalise} ação(ões) em análise` : "") +
                      ". Excluir agora não devolve esse saldo."}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
