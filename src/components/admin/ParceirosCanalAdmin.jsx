import { useEffect, useState } from "react";
import { Handshake, Power, Pencil, RefreshCw } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";

// Parceria de Canal: profissional que traz uma carteira de empresas e ganha
// fechamento + recorrência + uso (regras em shared/parceriaCanal.js). Aqui o
// admin ativa o parceiro pelo e-mail da conta e, se negociou outros
// percentuais, fixa os dele. Campo vazio = padrão.

const FORM_INICIAL = { email: "", pctFechamento: "", pctRecorrencia: "", pctUso: "", observacao: "" };
const reais = (cents) => money((Number(cents) || 0) / 100);
const pctTxt = (v) => (v === null || v === undefined ? "" : String(v));

export default function ParceirosCanalAdmin({ aviso }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [liberando, setLiberando] = useState(false);

  const carregar = () => {
    setErro("");
    api("/admin/parceiros-canal").then((r) => {
      if (!r || r.error) return setErro(r?.error || "Não foi possível carregar os parceiros.");
      setDados(r);
    });
  };
  useEffect(carregar, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const padrao = dados?.padrao;
  const niveisTxt = padrao?.niveis?.map((n) => `${n.pct}%`).join(" / ");

  const salvar = async () => {
    if (!form.email.trim()) return aviso("Informe o e-mail da conta de profissional do parceiro.");
    setSalvando(true);
    const r = await api("/admin/parceiros-canal", form);
    setSalvando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível ativar o parceiro.");
    aviso(`${r.nome || r.email} é parceiro de canal.`);
    setForm(FORM_INICIAL);
    carregar();
  };

  const editar = (p) => {
    setForm({ email: p.email, pctFechamento: pctTxt(p.pctFechamento), pctRecorrencia: pctTxt(p.pctRecorrencia), pctUso: pctTxt(p.pctUso), observacao: p.observacao || "" });
    document.getElementById("canal-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const alternar = async (p) => {
    const status = p.status === "ativo" ? "inativo" : "ativo";
    if (status === "inativo" && !window.confirm(`Inativar ${p.nome || p.email}?\n\nAs próximas mensalidades e ações das empresas dele deixam de gerar comissão. O que já foi gerado continua sendo liberado.`)) return;
    const r = await apiPatch(`/admin/parceiros-canal/${p.id}`, { status });
    if (!r || r.error) return aviso(r?.error || "Não foi possível alterar o parceiro.");
    aviso(status === "ativo" ? "Parceiro reativado." : "Parceiro inativado.");
    carregar();
  };

  const arquivarPedido = async (pedido, status) => {
    const r = await apiPatch(`/admin/parceiros-canal/pedidos/${pedido.id}`, { status });
    if (!r || r.error) return aviso(r?.error || "Não foi possível atualizar o pedido.");
    aviso(status === "arquivado" ? "Pedido arquivado." : "Pedido reaberto.");
    carregar();
  };

  const usarPedido = (pedido) => {
    setForm({ ...FORM_INICIAL, email: pedido.email, observacao: pedido.base ? `${pedido.base} contatos na base` : "" });
    document.getElementById("canal-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pedidos = dados?.pedidos || [];
  const novos = pedidos.filter((x) => x.status === "novo").length;

  const liberar = async () => {
    setLiberando(true);
    const r = await api("/admin/parceiros-canal/liberar", {});
    setLiberando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível liberar as comissões.");
    aviso(r.liberadas ? `${r.liberadas} comissão(ões) liberada(s): ${reais(r.totalCents)}.` : "Nenhuma comissão com data de liberação vencida.");
    carregar();
  };

  const campoPct = (k, rotulo, dica) => (
    <label>
      <div className="vx-label">{rotulo}</div>
      <input className="vx-input vx-mono" inputMode="decimal" value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={dica} />
    </label>
  );

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Pessoas</div>
          <h1 className="vx-disp"><Handshake size={22} style={{ marginRight: 8, verticalAlign: "-4px" }} />Parceiros de canal</h1>
          <p>Profissionais que trazem uma carteira de empresas e ganham no fechamento, na recorrência e no uso, enquanto as empresas pagam.</p>
        </div>
      </div>

      <div id="canal-form" className="vx-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 className="vx-disp" style={{ fontSize: 16, margin: "0 0 6px" }}>Ativar ou editar parceiro</h3>
        <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 14px" }}>
          O parceiro precisa ter conta de profissional na RYCS; as empresas entram na carteira dele pelo link de indicação.
          {padrao && <> Padrão: {padrao.fechamento}% da primeira mensalidade, recorrência de {niveisTxt} por nível e {padrao.uso}% da taxa de uso. Deixe vazio para usar o padrão.</>}
        </p>
        <div className="vx-grid vx-g2" style={{ marginBottom: 12 }}>
          <label>
            <div className="vx-label">E-mail da conta do parceiro</div>
            <input className="vx-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="parceiro@empresa.com.br" />
          </label>
          <label>
            <div className="vx-label">Observação <span className="vx-mut" style={{ fontSize: 11 }}>(opcional)</span></div>
            <input className="vx-input" value={form.observacao} onChange={(e) => set("observacao", e.target.value)} placeholder="Ex.: contrato assinado em 20/11" />
          </label>
        </div>
        <div className="vx-grid vx-g3" style={{ marginBottom: 14 }}>
          {campoPct("pctFechamento", "Fechamento (%)", padrao ? `${padrao.fechamento} (padrão)` : "")}
          {campoPct("pctRecorrencia", "Recorrência fixa (%)", "vazio = por nível")}
          {campoPct("pctUso", "Uso (%)", padrao ? `${padrao.uso} (padrão)` : "")}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={salvar}>
            <Handshake size={14} /> {salvando ? "Salvando…" : "Salvar parceiro"}
          </button>
          {form.email && <button className="vx-btn" onClick={() => setForm(FORM_INICIAL)}>Limpar</button>}
        </div>
      </div>

      <h3 className="vx-disp" style={{ fontSize: 16, margin: "0 0 4px" }}>
        Pedidos de parceria {novos > 0 && <span className="vx-chip" style={{ marginLeft: 6, color: "var(--brand)", background: "var(--brand-50)" }}>{novos} novo{novos === 1 ? "" : "s"}</span>}
      </h3>
      <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 12px" }}>Cadastros feitos em rycs.pro/parceiros. Para ativar, a pessoa precisa ter conta de profissional com o mesmo e-mail.</p>
      {dados !== null && !pedidos.length ? (
        <div className="vx-card" style={{ padding: 20, marginBottom: 24 }}>
          <div className="vx-mut" style={{ fontSize: 13 }}>Nenhum pedido ainda. Divulgue rycs.pro/parceiros para receber cadastros.</div>
        </div>
      ) : pedidos.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          {pedidos.map((pd) => (
            <div key={pd.id} className="vx-card" style={{ padding: 16, opacity: pd.status === "novo" ? 1 : 0.7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <b>{pd.nome}</b>
                  <span className="vx-mut" style={{ fontSize: 12 }}> · {dataCurta(pd.criadoEm)}{pd.cidade ? ` · ${pd.cidade}` : ""}</span>
                  <div style={{ fontSize: 13, marginTop: 2, wordBreak: "break-word" }}>
                    {pd.email} · <a href={`https://wa.me/${pd.whats.length <= 11 ? "55" : ""}${pd.whats}`} target="_blank" rel="noreferrer">{pd.whats}</a>
                  </div>
                  <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>
                    {pd.base != null ? `${pd.base.toLocaleString("pt-BR")} contatos na base` : "Base não informada"}{pd.segmento ? ` · ${pd.segmento}` : ""}
                  </div>
                  {pd.mensagem && <div style={{ fontSize: 13, marginTop: 6, color: "var(--ink-2)" }}>{pd.mensagem}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 20, padding: "4px 10px", background: "var(--surface-2)", color: pd.conta === "vendedor" ? "var(--green-700)" : "var(--muted)" }}>
                    {pd.conta === "vendedor" ? "Tem conta de profissional" : pd.conta ? "Conta de outro tipo" : "Ainda sem conta"}
                  </span>
                  {pd.status === "novo" && <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => usarPedido(pd)}><Handshake size={13} /> Ativar</button>}
                  {pd.status === "aprovado" && <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 20, padding: "4px 10px", background: "var(--green-100)", color: "var(--green-700)" }}>Ativado</span>}
                  {pd.status !== "aprovado" && (
                    <button className="vx-btn vx-btn-sm" onClick={() => arquivarPedido(pd, pd.status === "novo" ? "arquivado" : "novo")}>
                      {pd.status === "novo" ? "Arquivar" : "Reabrir"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h3 className="vx-disp" style={{ fontSize: 16, margin: 0 }}>Parceiros</h3>
        <button className="vx-btn vx-btn-sm" disabled={liberando} onClick={liberar} title="O servidor já faz isso sozinho a cada hora">
          <RefreshCw size={13} /> {liberando ? "Liberando…" : "Liberar comissões vencidas"}
        </button>
      </div>
      {erro && <div className="vx-notice vx-notice-amber" style={{ marginBottom: 12 }}>{erro}</div>}

      {dados === null ? (
        <div className="vx-card" style={{ padding: 18 }}><div className="vx-skeleton" style={{ height: 22 }} /></div>
      ) : !dados.parceiros?.length ? (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <Handshake size={26} color="var(--muted)" style={{ marginBottom: 8 }} />
          <div className="vx-mut" style={{ fontSize: 13 }}>Nenhum parceiro de canal ainda. Ative o primeiro pelo e-mail da conta dele.</div>
        </div>
      ) : (
        <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1.5px solid var(--border)" }}>
                  {["Parceiro", "Empresas", "Pagantes", "Percentuais vigentes", "Aguardando", "Liberado", "Status", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", background: "var(--surface-2)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.parceiros.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600 }}>{p.nome || "—"}</div>
                      <div className="vx-mut" style={{ fontSize: 12 }}>{p.email} · desde {dataCurta(p.criadoEm)}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }} className="vx-mono">{p.empresas}</td>
                    <td style={{ padding: "10px 12px" }} className="vx-mono">{p.pagantes}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                      <div>{p.vigentes.fechamento}% fechamento · {p.vigentes.recorrencia}% recorrência · {p.vigentes.uso}% uso</div>
                      <div className="vx-mut">{p.pctRecorrencia != null ? "Recorrência fixa" : `Nível ${p.vigentes.nivel}`}{p.observacao ? ` · ${p.observacao}` : ""}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }} className="vx-mono">{reais(p.pendenteCents)}</td>
                    <td style={{ padding: "10px 12px", color: "var(--green-700)", fontWeight: 600 }} className="vx-mono">{reais(p.liberadoCents)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 20, padding: "3px 10px", background: p.status === "ativo" ? "var(--green-100)" : "var(--surface-2)", color: p.status === "ativo" ? "var(--green-700)" : "var(--muted)" }}>
                        {p.status === "ativo" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", textAlign: "right" }}>
                      <button className="vx-btn vx-btn-sm" style={{ gap: 5, marginRight: 6 }} onClick={() => editar(p)}>
                        <Pencil size={13} /> Editar
                      </button>
                      <button className="vx-btn vx-btn-sm" style={{ gap: 5 }} onClick={() => alternar(p)}>
                        <Power size={13} /> {p.status === "ativo" ? "Inativar" : "Reativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
