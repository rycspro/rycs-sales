import { useEffect, useId, useState } from "react";
import { RefreshCw, Unplug, Copy, Check, Plug } from "lucide-react";
import { api, apiDelete } from "../../../lib/api.js";
import { ERPS } from "../../../../shared/erp.js";

// Conexão do ERP da empresa (um por vez): Bling, Olist Tiny, Omie ou qualquer
// outro pelo endereço exclusivo.

const dia = (t) => (t ? new Date(t).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

export default function PainelErp({ provedor, aviso }) {
  const id = useId();
  const erp = ERPS[provedor];
  const [r, setR] = useState(null);
  const [dados, setDados] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState("");

  const carregar = () => api("/erp").then((x) => setR(x && !x.error ? x : { conectado: false, disponiveis: {} }));
  useEffect(() => { carregar(); }, []);
  useEffect(() => {
    if (!r?.sincronizando) return;
    const t = setInterval(carregar, 4000);
    return () => clearInterval(t);
  }, [r?.sincronizando]);
  useEffect(() => { if (r?.provedor === "generico" && provedor === "generico") setDados((d) => ({ url: d.url ?? r.urlSaida })); }, [r, provedor]);

  if (!r) return <div style={{ padding: 24, textAlign: "center" }}><div className="vx-spinner" /></div>;
  const meu = r.conectado && r.provedor === provedor;
  const outro = r.conectado && !meu;

  const conectar = async (e) => {
    e?.preventDefault();
    if (outro && !window.confirm(`O ${r.nome} será desconectado: só um ERP por vez. Continuar?`)) return;
    setOcupado(true);
    const x = await api(erp.login ? "/erp/bling/iniciar" : "/erp/conectar", erp.login ? { iniciar: true } : { provedor, dados });
    if (x?.url && erp.login) { window.location.href = x.url; return; }
    setOcupado(false);
    if (!x || x.error) return aviso?.(x?.error || "Não foi possível conectar.");
    setDados({}); setR(x);
    aviso?.(`${erp.nome} conectado.`);
    setTimeout(carregar, 1500);
  };
  const sincronizar = async () => { await api("/erp/sincronizar", {}); setR({ ...r, sincronizando: true }); };
  const desconectar = async () => {
    if (!window.confirm(`Desconectar o ${erp.nome}? A cópia de produtos e clientes é apagada da RYCS. Os pedidos continuam.`)) return;
    const x = await apiDelete("/erp");
    if (!x || x.error) return aviso?.(x?.error || "Não foi possível desconectar.");
    aviso?.("ERP desconectado."); carregar();
  };
  const copiar = async (t, k) => { try { await navigator.clipboard.writeText(t); setCopiado(k); setTimeout(() => setCopiado(""), 1500); } catch { aviso?.("Não foi possível copiar."); } };
  const Copiavel = ({ rotulo, valor, k }) => (
    <div>
      <label className="vx-label" htmlFor={`${id}-${k}`}>{rotulo}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input id={`${id}-${k}`} readOnly className="vx-input vx-mono" value={valor} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 0, fontSize: 12, minHeight: 44 }} />
        <button type="button" className="vx-btn vx-btn-sm" aria-label={`Copiar ${rotulo}`} style={{ minHeight: 44, minWidth: 44 }} onClick={() => copiar(valor, k)}>{copiado === k ? <Check size={14} style={{ color: "var(--green)" }} /> : <Copy size={14} />}</button>
      </div>
    </div>
  );

  const formulario = (
    <form onSubmit={conectar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="vx-mut" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{erp.ajuda}</p>
      {outro && <div className="vx-notice vx-notice-amber">O {r.nome} está conectado. Conectar o {erp.nome} troca de ERP e apaga a cópia de produtos e clientes do anterior.</div>}
      {erp.campos.map((c) => (
        <div key={c.chave}><label className="vx-label" htmlFor={`${id}-c-${c.chave}`}>{c.rotulo}</label>
          <input id={`${id}-c-${c.chave}`} className="vx-input" type={c.secreto ? "password" : c.tipo === "url" ? "url" : "text"} autoComplete="off" spellCheck={false} value={dados[c.chave] || ""} onChange={(e) => setDados({ ...dados, [c.chave]: e.target.value })} placeholder={c.tipo === "url" ? "https://..." : ""} style={{ minHeight: 44 }} /></div>
      ))}
      {erp.login && !r.disponiveis?.bling
        ? <div className="vx-notice vx-notice-amber">A conexão com o Bling está em ativação pela RYCS. Assim que for liberada, o botão aparece aqui.</div>
        : <button type="submit" className="vx-btn vx-btn-primary" disabled={ocupado} style={{ minHeight: 44 }}><Plug size={15} aria-hidden="true" /> {ocupado ? "Conectando…" : erp.login ? "Entrar com o Bling" : meu ? "Salvar" : provedor === "generico" ? "Gerar endereço" : "Conectar"}</button>}
    </form>
  );

  if (!meu) return formulario;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 13 }}>
      {r.ultimoErro && <div role="alert" className="vx-notice vx-notice-amber">{r.ultimoErro}</div>}
      {r.status === "expirada" && formulario}
      <div className="vx-grid vx-g2">
        {[["Produtos", r.produtos], ["Clientes", r.contatos]].map(([l, v]) => <div key={l} className="vx-scenario"><span>{l}</span><strong className="vx-mono">{v}</strong></div>)}
      </div>
      <div className="vx-mut">{r.sincronizando ? "Sincronizando agora…" : r.ultimoSyncEm ? `Última atualização em ${dia(r.ultimoSyncEm)}.` : "Ainda sem dados do ERP."}</div>

      {provedor === "generico" && <>
        <Copiavel rotulo="Endereço que recebe produtos e clientes" valor={r.urlEntrada} k="in" />
        <p className="vx-mut" style={{ margin: 0, lineHeight: 1.6 }}>Envie um POST com JSON: <code>{'{"produtos":[{"id","codigo","nome","preco","unidade","estoque"}],"clientes":[{"id","nome","documento","telefone","email"}]}'}</code>. Até 2000 de cada por envio. Mantenha o endereço em segredo.</p>
        <form onSubmit={conectar} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div><label className="vx-label" htmlFor={`${id}-url`}>Endereço que recebe os pedidos aprovados</label><input id={`${id}-url`} className="vx-input" type="url" value={dados.url || ""} onChange={(e) => setDados({ url: e.target.value })} placeholder="https://..." style={{ minHeight: 44 }} /></div>
          <button type="submit" className="vx-btn vx-btn-primary" disabled={ocupado} style={{ minHeight: 44 }}>Salvar</button>
        </form>
        <Copiavel rotulo="Segredo para conferir a assinatura (X-RYCS-Signature, HMAC SHA-256)" valor={r.segredo} k="seg" />
      </>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        {provedor !== "generico" && <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} disabled={r.sincronizando} onClick={sincronizar}><RefreshCw size={13} aria-hidden="true" /> Sincronizar agora</button>}
        <button type="button" className="vx-btn vx-btn-sm vx-btn-danger" style={{ minHeight: 44 }} onClick={desconectar}><Unplug size={13} aria-hidden="true" /> Desconectar</button>
      </div>
    </div>
  );
}
