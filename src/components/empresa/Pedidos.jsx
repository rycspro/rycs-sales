import { useEffect, useId, useState } from "react";
import { Plus, ReceiptText, Trash2, Search, Send, Check, X, Copy, Sparkles, AlertTriangle, Plug } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { STATUS_PEDIDO, ORIGENS, editavel, errosDoPedido, normalizarPedido, totais, textoPedido } from "../../../shared/pedidos.js";

// Gerador de pedidos: junta o lead da RYCS, a conversa do WhatsApp ou do
// Instagram e o catálogo do ERP num rascunho. A empresa confere, aprova e só
// então o pedido vai para o ERP.

function Selo({ status }) {
  const s = STATUS_PEDIDO[status] || STATUS_PEDIDO.rascunho;
  return <span className={`vx-badge vx-badge-${s.tom}`}>{s.nome}</span>;
}

export default function Pedidos({ aviso, abrirId, aoAbrir, irParaIntegracoes }) {
  const [dados, setDados] = useState(null);
  const [status, setStatus] = useState("");
  const [aberto, setAberto] = useState(abrirId || "");
  const carregar = () => api(`/pedidos${status ? `?status=${status}` : ""}`).then((r) => { if (r && !r.error) setDados(r); else aviso?.(r?.error || "Não foi possível carregar os pedidos."); });
  useEffect(() => { carregar(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (abrirId) { setAberto(abrirId); aoAbrir?.(); } }, [abrirId]); // eslint-disable-line react-hooks/exhaustive-deps

  const novo = async () => {
    const r = await api("/pedidos", { itens: [] });
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível criar o pedido.");
    setAberto(r.id); carregar();
  };

  if (!dados) return <div style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
  if (aberto) return <Editor id={aberto} erp={dados.erp} aviso={aviso} onVoltar={() => { setAberto(""); carregar(); }} irParaIntegracoes={irParaIntegracoes} />;

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div><div className="vx-eyebrow">Execução comercial</div><h1 className="vx-disp">Pedidos</h1><p>Gere o pedido a partir da conversa ou do lead, confira e envie ao seu ERP.</p></div>
        <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={novo}><Plus size={15} aria-hidden="true" /> Novo pedido</button>
      </div>

      {!dados.erp?.conectado && (
        <div className="vx-card" style={{ padding: 14, marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Plug size={18} aria-hidden="true" style={{ color: "var(--brand)" }} />
          <div style={{ flex: "1 1 240px", fontSize: 13, lineHeight: 1.5 }}><b>Nenhum ERP conectado.</b> Você já pode montar pedidos com os serviços cadastrados na RYCS. Com o ERP, entram o catálogo e os clientes, e o pedido aprovado vai direto para lá.</div>
          <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={irParaIntegracoes}>Conectar ERP</button>
        </div>
      )}

      <div className="vx-seg vx-subnav" style={{ marginBottom: 14 }}>
        {[["", "Todos"], ["rascunho", "Rascunhos"], ["aprovado", "Aprovados"], ["enviado", "No ERP"], ["erro", "Recusados"], ["conferir", "Conferir"], ["cancelado", "Cancelados"]].map(([k, l]) => <button key={k} type="button" data-on={status === k ? "1" : "0"} onClick={() => setStatus(k)}>{l}</button>)}
      </div>

      {dados.pedidos.length === 0 ? (
        <div className="vx-card" style={{ padding: 32, textAlign: "center" }}>
          <ReceiptText size={30} aria-hidden="true" style={{ color: "var(--muted-2)", marginBottom: 8 }} />
          <div className="vx-disp" style={{ fontSize: 16 }}>{status ? "Nenhum pedido neste status" : "Nenhum pedido ainda"}</div>
          <p className="vx-mut" style={{ fontSize: 13, margin: "6px auto 0", maxWidth: 420, lineHeight: 1.5 }}>Abra uma conversa em WhatsApp ou Instagram, ou um lead no Pipeline, e toque em “Gerar pedido”.</p>
        </div>
      ) : (
        <div className="vx-grid">
          {dados.pedidos.map((p) => (
            <button key={p.id} type="button" className="vx-card vx-row" onClick={() => setAberto(p.id)} style={{ padding: 14, textAlign: "left", cursor: "pointer", font: "inherit", color: "var(--ink)", flexWrap: "wrap" }}>
              <span style={{ minWidth: 0, flex: "1 1 200px" }}>
                <b>Pedido {p.numero}</b> {p.cliente && <span>· {p.cliente}</span>}
                <span className="vx-mut" style={{ display: "block", fontSize: 12 }}>{dataCurta(p.criadoEm)}{p.canal ? ` · ${ORIGENS[p.canal]}` : ""}{p.erpNumero ? ` · nº ${p.erpNumero} no ERP` : ""}</span>
                {p.erro && <span style={{ display: "block", fontSize: 12, color: "var(--red)" }}>{p.erro}</span>}
              </span>
              <span style={{ textAlign: "right" }}><Selo status={p.status} /><span className="vx-mono" style={{ display: "block", fontSize: 13, marginTop: 4 }}>{money(p.total)}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Editor({ id, erp, aviso, onVoltar, irParaIntegracoes }) {
  const uid = useId();
  const [p, setP] = useState(null);
  const [f, setF] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const aplicar = (r) => { setP(r); setF({ cliente: r.cliente, itens: r.itens, desconto: r.desconto || "", frete: r.frete || "", observacoes: r.observacoes }); };
  useEffect(() => { api(`/pedidos/${id}`).then((r) => { if (r && !r.error) aplicar(r); else { aviso?.(r?.error || "Pedido não encontrado."); onVoltar(); } }); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p || !f) return <div style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
  const pode = editavel(p.status);
  const limpo = normalizarPedido(f);
  const erros = pode ? errosDoPedido(limpo) : [];
  const t = totais(limpo);
  const cli = (k) => (e) => setF({ ...f, cliente: { ...f.cliente, [k]: e.target.value } });
  const item = (i, k, v) => setF({ ...f, itens: f.itens.map((x, n) => (n === i ? { ...x, [k]: v } : x)) });

  const agir = async (f2, ok) => {
    setOcupado(true);
    try {
      const r = await f2();
      if (!r || r.error) { aviso?.(r?.error || "Não foi possível concluir."); const atual = await api(`/pedidos/${id}`); if (atual && !atual.error) aplicar(atual); return null; }
      aplicar(r);
      if (ok) aviso?.(ok);
      return r;
    } finally { setOcupado(false); }
  };
  const salvar = () => agir(() => apiPatch(`/pedidos/${id}`, limpo), "Rascunho salvo.");
  const aprovar = async () => {
    const s = await agir(() => apiPatch(`/pedidos/${id}`, limpo));
    if (!s) return;
    await agir(() => api(`/pedidos/${id}/aprovar`, {}), "Pedido aprovado.");
  };
  const enviar = (reenviar) => {
    if (reenviar ? !window.confirm(`Confirme que o pedido ${p.numero} NÃO está no ${erp?.nome || "ERP"}. Reenviar vai criar um novo pedido lá.`) : !window.confirm(`Enviar o pedido ${p.numero}, de ${money(p.total)}, para o ${erp?.nome || "ERP"}?`)) return;
    agir(() => api(`/pedidos/${id}/enviar`, { reenviar }), "Pedido enviado ao ERP.");
  };
  const cancelar = () => { if (window.confirm(`Cancelar o pedido ${p.numero}?`)) agir(() => api(`/pedidos/${id}/cancelar`, {}), "Pedido cancelado."); };
  const copiar = async () => { try { await navigator.clipboard.writeText(textoPedido({ ...limpo, numero: p.numero }, money)); aviso?.("Resumo copiado."); } catch { aviso?.("Não foi possível copiar."); } };
  const add = (x) => setF({ ...f, itens: [...f.itens, { erpId: x.erpId || "", codigo: x.codigo || "", nome: x.nome, unidade: x.unidade || "UN", quantidade: 1, valor: x.preco || "", origem: x.origem || "manual" }] });

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div><div className="vx-eyebrow">Pedido {p.numero}</div><h1 className="vx-disp" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{limpo.cliente.nome || "Cliente não informado"} <Selo status={p.status} /></h1>
          <p>{p.motor === "manual" ? "Pedido digitado." : "Rascunho montado pela RYCS. Confira cada linha antes de aprovar."}{p.erpNumero ? ` Nº ${p.erpNumero} no ERP.` : ""}</p></div>
        <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={onVoltar}>Voltar</button>
      </div>
      {p.erro && <div role="alert" className="vx-notice vx-notice-amber" style={{ marginBottom: 12 }}><AlertTriangle size={14} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 6 }} />{p.erro}</div>}

      <div className="vx-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", alignItems: "start" }}>
        <section className="vx-card" style={{ padding: 16, gridColumn: "1 / -1" }}>
          <h2 className="vx-disp" style={{ fontSize: 16, margin: "0 0 10px" }}>Cliente</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 10 }}>
            {[["nome", "Nome ou razão social", "text"], ["documento", "CPF ou CNPJ", "text"], ["telefone", "Telefone", "tel"], ["email", "E-mail", "email"], ["endereco", "Endereço de entrega", "text"]].map(([k, l, tipo]) => (
              <div key={k}><label className="vx-label" htmlFor={`${uid}-${k}`}>{l}</label><input id={`${uid}-${k}`} className="vx-input" type={tipo} value={f.cliente[k] || ""} disabled={!pode} onChange={cli(k)} style={{ minHeight: 44 }} /></div>
            ))}
          </div>
          {erp?.conectado && pode && <BuscaCliente uid={uid} vinculado={f.cliente.erpId} onEscolher={(c) => setF({ ...f, cliente: { ...f.cliente, nome: c.nome, documento: c.documento || f.cliente.documento, telefone: f.cliente.telefone || c.telefone, email: f.cliente.email || c.email, erpId: c.externoId } })} onDesvincular={() => setF({ ...f, cliente: { ...f.cliente, erpId: "" } })} />}
        </section>

        <section className="vx-card" style={{ padding: 16, gridColumn: "1 / -1" }}>
          <h2 className="vx-disp" style={{ fontSize: 16, margin: "0 0 10px" }}>Itens</h2>
          {f.itens.length === 0 && <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 10px" }}>{p.motor === "manual" ? "Busque um produto abaixo." : "Não encontramos itens do seu catálogo nesta conversa. Busque abaixo."}</p>}
          {f.itens.map((i, n) => (
            <div key={n} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 110px), 1fr))", gap: 8, alignItems: "end", padding: "10px 0", borderTop: n ? "1px solid var(--border)" : 0 }}>
              <div style={{ gridColumn: "span 2", minWidth: 0 }}>
                <label className="vx-label" htmlFor={`${uid}-i${n}`}>Produto <span className="vx-mut" style={{ fontWeight: 400 }}>· {ORIGENS[i.origem] || "Digitado"}{i.codigo ? ` · ${i.codigo}` : ""}</span></label>
                <input id={`${uid}-i${n}`} className="vx-input" value={i.nome} disabled={!pode || i.origem !== "manual"} onChange={(e) => item(n, "nome", e.target.value)} style={{ minHeight: 44 }} />
              </div>
              <div><label className="vx-label" htmlFor={`${uid}-q${n}`}>Quantidade ({i.unidade})</label><input id={`${uid}-q${n}`} className="vx-input" inputMode="decimal" value={i.quantidade} disabled={!pode} onChange={(e) => item(n, "quantidade", e.target.value)} style={{ minHeight: 44 }} /></div>
              <div><label className="vx-label" htmlFor={`${uid}-v${n}`}>Valor unitário</label><input id={`${uid}-v${n}`} className="vx-input" inputMode="decimal" value={i.valor} disabled={!pode} onChange={(e) => item(n, "valor", e.target.value)} style={{ minHeight: 44 }} /></div>
              <div className="vx-row" style={{ minHeight: 44 }}><span className="vx-mono" style={{ fontSize: 13 }}>{money((limpo.itens[n]?.quantidade || 0) * (limpo.itens[n]?.valor || 0))}</span>
                {pode && <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" aria-label={`Remover ${i.nome}`} style={{ minHeight: 44, minWidth: 44 }} onClick={() => setF({ ...f, itens: f.itens.filter((_, k) => k !== n) })}><Trash2 size={15} /></button>}</div>
            </div>
          ))}
          {pode && <BuscaProduto uid={uid} onAdicionar={add} />}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))", gap: 10, marginTop: 12, alignItems: "end" }}>
            <div><label className="vx-label" htmlFor={`${uid}-d`}>Desconto</label><input id={`${uid}-d`} className="vx-input" inputMode="decimal" value={f.desconto} disabled={!pode} onChange={(e) => setF({ ...f, desconto: e.target.value })} style={{ minHeight: 44 }} /></div>
            <div><label className="vx-label" htmlFor={`${uid}-fr`}>Frete</label><input id={`${uid}-fr`} className="vx-input" inputMode="decimal" value={f.frete} disabled={!pode} onChange={(e) => setF({ ...f, frete: e.target.value })} style={{ minHeight: 44 }} /></div>
            <div style={{ textAlign: "right", gridColumn: "span 2" }}><div className="vx-mut" style={{ fontSize: 12 }}>Subtotal {money(t.subtotal)}</div><b style={{ fontSize: 20 }}>{money(t.total)}</b></div>
          </div>
          <div style={{ marginTop: 10 }}><label className="vx-label" htmlFor={`${uid}-o`}>Observações</label><textarea id={`${uid}-o`} className="vx-input" rows={2} maxLength={1000} value={f.observacoes} disabled={!pode} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
        </section>

        {p.fontes?.length > 0 && (
          <section className="vx-card" style={{ padding: 16, gridColumn: "1 / -1" }}>
            <h2 className="vx-disp" style={{ fontSize: 16, margin: "0 0 8px", display: "flex", gap: 8, alignItems: "center" }}><Sparkles size={16} aria-hidden="true" style={{ color: "var(--brand)" }} /> De onde veio cada dado</h2>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              {p.fontes.map((x, n) => <li key={n}><span className="vx-badge vx-badge-muted">{ORIGENS[x.origem] || x.origem}</span> {x.detalhe}{x.aviso && <span style={{ color: "var(--amber)" }}> {x.aviso}</span>}</li>)}
            </ul>
          </section>
        )}
      </div>

      {pode && erros.length > 0 && <div className="vx-notice vx-notice-amber" style={{ marginTop: 12 }}>{erros.join(" ")}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {pode && <button type="button" className="vx-btn" style={{ minHeight: 44 }} disabled={ocupado} onClick={salvar}>Salvar rascunho</button>}
        {pode && <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} disabled={ocupado || erros.length > 0} onClick={aprovar}><Check size={15} aria-hidden="true" /> Aprovar pedido</button>}
        {p.status === "aprovado" && (erp?.conectado
          ? <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} disabled={ocupado} onClick={() => enviar(false)}><Send size={15} aria-hidden="true" /> {ocupado ? "Enviando…" : `Enviar ao ${erp.nome}`}</button>
          : <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={irParaIntegracoes}>Conectar ERP para enviar</button>)}
        {p.status === "conferir" && <button type="button" className="vx-btn" style={{ minHeight: 44 }} disabled={ocupado} onClick={() => enviar(true)}>Não está no ERP: reenviar</button>}
        <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={copiar}><Copy size={14} aria-hidden="true" /> Copiar resumo</button>
        {["rascunho", "erro", "aprovado"].includes(p.status) && <button type="button" className="vx-btn vx-btn-danger" style={{ minHeight: 44 }} disabled={ocupado} onClick={cancelar}><X size={14} aria-hidden="true" /> Cancelar pedido</button>}
      </div>
    </div>
  );
}

function useBusca(caminho, campo) {
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState([]);
  useEffect(() => {
    if (busca.trim().length < 2) { setLista([]); return; }
    let vivo = true;
    const t = setTimeout(() => api(`${caminho}?busca=${encodeURIComponent(busca.trim())}`).then((r) => { if (vivo) setLista(r?.[campo] || []); }), 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [busca, caminho, campo]);
  return [busca, setBusca, lista];
}

const Resultados = ({ children }) => <div style={{ marginTop: 6, border: "1px solid var(--border)", borderRadius: 10, maxHeight: 240, overflowY: "auto", background: "var(--surface-solid)" }}>{children}</div>;
const opcao = { width: "100%", textAlign: "left", padding: "10px 12px", minHeight: 44, border: 0, borderBottom: "1px solid var(--border)", background: "transparent", cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--ink)" };

function BuscaProduto({ uid, onAdicionar }) {
  const [busca, setBusca, lista] = useBusca("/pedidos/catalogo", "produtos");
  const escolher = (x) => { onAdicionar(x); setBusca(""); };
  return (
    <div style={{ marginTop: 10 }}>
      <label className="vx-label" htmlFor={`${uid}-bp`}><Search size={12} aria-hidden="true" /> Adicionar produto ou serviço</label>
      <input id={`${uid}-bp`} className="vx-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou código" style={{ minHeight: 44 }} />
      {busca.trim().length >= 2 && (
        <Resultados>
          {lista.map((x) => <button key={x.externoId} type="button" style={opcao} onClick={() => escolher(x)}>{x.nome}{x.codigo ? ` (${x.codigo})` : ""}<span className="vx-mut"> · {x.preco ? money(x.preco) : "sem preço"} · {ORIGENS[x.origem]}{x.estoque != null ? ` · estoque ${x.estoque}` : ""}</span></button>)}
          <button type="button" style={{ ...opcao, borderBottom: 0, color: "var(--brand)" }} onClick={() => escolher({ nome: busca.trim(), origem: "manual" })}>Digitar “{busca.trim()}” como item avulso</button>
        </Resultados>
      )}
    </div>
  );
}

function BuscaCliente({ uid, vinculado, onEscolher, onDesvincular }) {
  const [busca, setBusca, lista] = useBusca("/pedidos/clientes", "clientes");
  if (vinculado) return <div style={{ marginTop: 10, fontSize: 13 }}><span className="vx-badge vx-badge-brand">Cliente do ERP</span> <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }} onClick={onDesvincular}>Desvincular</button></div>;
  return (
    <div style={{ marginTop: 10 }}>
      <label className="vx-label" htmlFor={`${uid}-bc`}><Search size={12} aria-hidden="true" /> Cliente já cadastrado no ERP</label>
      <input id={`${uid}-bc`} className="vx-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, documento ou telefone" style={{ minHeight: 44 }} />
      {busca.trim().length >= 2 && (
        <Resultados>
          {lista.length === 0 && <div className="vx-mut" style={{ padding: 12, fontSize: 13 }}>Nenhum cliente encontrado. Ele será cadastrado no ERP com o pedido.</div>}
          {lista.map((c) => <button key={c.externoId} type="button" style={opcao} onClick={() => { onEscolher(c); setBusca(""); }}>{c.nome}<span className="vx-mut"> {[c.documento, c.telefone].filter(Boolean).join(" · ")}</span></button>)}
        </Resultados>
      )}
    </div>
  );
}
