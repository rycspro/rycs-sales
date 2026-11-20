import { useEffect, useId, useState } from "react";
import { api, apiDelete } from "../../lib/api.js";
import { valor, caixa, ErroMeta } from "./whatsappFormato.jsx";

// Saldo e gastos na Meta. O saldo do WhatsApp vem da conta de pagamento dele na
// Meta ("PMA - …"), separada da conta de anúncios. Se o servidor não conseguir
// ler essa conta, o saldo é estimado: recargas registradas menos o gasto.

const SALDO_BAIXO = 5;
const hojeISO = () => new Date().toISOString().slice(0, 10);

export default function SaldoWhatsapp({ aviso }) {
  const id = useId();
  const [d, setD] = useState(null);
  const [valorRec, setValorRec] = useState("");
  const [data, setData] = useState(hojeISO());
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = () => api("/admin/whatsapp/saldo").then((r) => setD(r && !r.error ? r : { erro: r?.error || "Não foi possível consultar a Meta." }));
  useEffect(() => { carregar(); }, []);

  const registrar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const r = await api("/admin/whatsapp/recargas", { valor: valorRec, em: data, observacao: obs });
    setSalvando(false);
    if (r?.error) return aviso?.(r.error);
    setValorRec(""); setObs("");
    aviso?.("Recarga registrada.");
    carregar();
  };
  const apagar = async (rec) => {
    if (!window.confirm(`Apagar a recarga de ${valor(rec.valor, d?.moeda)}?`)) return;
    await apiDelete(`/admin/whatsapp/recargas/${rec.id}`);
    carregar();
  };

  if (!d) return <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Consultando a Meta...</div>;
  if (d.erro) return <div className="vx-card" style={{ padding: 18 }}><ErroMeta erro={d.erro} /></div>;

  const moeda = d.moeda || "BRL";
  const w = d.whatsapp;
  const p = d.pagamento;
  const real = !!p?.ok && p.dados.saldoDisponivel != null;
  const saldo = real ? p.dados.saldoDisponivel : d.saldoEstimado;
  const baixo = saldo != null && saldo < SALDO_BAIXO;
  const a = d.anuncios;
  const linkCobranca = d.links?.[0]?.url;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-row" style={{ gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <div className="vx-disp" style={{ fontSize: 15 }}>WhatsApp: saldo e gastos</div>
          <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44, marginLeft: "auto" }} onClick={() => { setD(null); carregar(); }}>Atualizar</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10, marginTop: 14 }}>
          <div style={{ ...caixa, borderColor: baixo ? "var(--red)" : "var(--border)" }}>
            <div className="vx-mut" style={{ fontSize: 12 }}>{real ? "Saldo disponível" : "Saldo estimado"}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums", color: baixo ? "var(--red)" : "var(--ink)" }}>
              {saldo == null ? "—" : valor(saldo, real ? p.dados.moeda || moeda : moeda)}
            </div>
            <div className="vx-mut" style={{ fontSize: 11.5 }}>
              {real ? "direto da Meta" : d.recargas.length ? `${valor(d.totalRecargas, moeda)} em recargas` : "registre uma recarga abaixo"}
            </div>
          </div>
          {[["Gasto hoje", w.ok ? w.hoje : null], ["Últimos 7 dias", w.ok ? w.seteDias : null], ["Este mês", w.ok ? w.mes : null]].map(([r, v]) => (
            <div key={r} style={caixa}>
              <div className="vx-mut" style={{ fontSize: 12 }}>{r}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{valor(v, moeda)}</div>
            </div>
          ))}
        </div>
        {baixo && (
          <div role="alert" style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid var(--red)", fontSize: 12.5, lineHeight: 1.6 }}>
            <b>Saldo baixo.</b> Se acabar, a Meta recusa os envios e o disparo para na primeira recusa.
            {linkCobranca ? <> Recarregue na <a href={linkCobranca} target="_blank" rel="noreferrer">Central de cobrança da Meta, conta do WhatsApp</a>{real ? "." : " e registre a recarga aqui."}</> : null}
          </div>
        )}
        {!w.ok && <div style={{ marginTop: 10 }}><ErroMeta erro={w.erro} /></div>}
        {real ? (
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "12px 0 0", lineHeight: 1.55 }}>
            O saldo vem da conta de pagamento do WhatsApp na Meta ({p.dados.nome || p.dados.id}), onde caem as recargas.
            Ela é separada da conta de anúncios. A Meta fecha o gasto por dia, então o de hoje pode aparecer com atraso.
            {linkCobranca ? <> Recargas e forma de pagamento: <a href={linkCobranca} target="_blank" rel="noreferrer">Central de cobrança</a>.</> : null}
          </p>
        ) : (
          <>
            {p?.ok
              ? <p className="vx-mut" style={{ fontSize: 12.5, margin: "12px 0 0" }}>Forma de pagamento na Meta: {p.dados.formaPagamento || "a Meta não informou"}</p>
              : p?.erro ? <div style={{ marginTop: 10 }}><ErroMeta erro={`Não deu para ler o saldo na conta de pagamento do WhatsApp: ${p.erro}`} /></div> : null}
            <p className="vx-mut" style={{ fontSize: 12.5, margin: "12px 0 0", lineHeight: 1.55 }}>
              Sem o saldo direto da Meta, o saldo estimado é a soma das recargas registradas aqui menos o gasto que a
              Meta informa desde o dia da primeira recarga. A Meta fecha o gasto por dia, então o de hoje pode aparecer com atraso. O valor exato fica na
              {linkCobranca ? <> <a href={linkCobranca} target="_blank" rel="noreferrer">Central de cobrança</a>.</> : " Central de cobrança da Meta."}
            </p>
          </>
        )}

        {!real && <form onSubmit={registrar} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 10, marginTop: 14, alignItems: "end" }}>
          <div>
            <label className="vx-label" htmlFor={`${id}-v`}>Valor da recarga ({moeda})</label>
            <input id={`${id}-v`} className="vx-input" inputMode="decimal" value={valorRec} onChange={(e) => setValorRec(e.target.value)} placeholder="10,00" style={{ minHeight: 44 }} />
          </div>
          <div>
            <label className="vx-label" htmlFor={`${id}-d`}>Data</label>
            <input id={`${id}-d`} className="vx-input" type="date" value={data} max={hojeISO()} onChange={(e) => setData(e.target.value)} style={{ minHeight: 44 }} />
          </div>
          <div>
            <label className="vx-label" htmlFor={`${id}-o`}>Observação</label>
            <input id={`${id}-o`} className="vx-input" maxLength={200} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Pix, cartão…" style={{ minHeight: 44 }} />
          </div>
          <button type="submit" className="vx-btn vx-btn-primary" disabled={salvando || !valorRec} style={{ minHeight: 44 }}>{salvando ? "Salvando…" : "Registrar recarga"}</button>
        </form>}
        {!real && d.recargas.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            {d.recargas.map((r) => (
              <div key={r.id} className="vx-row" style={{ gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                <span>{new Date(r.em).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{valor(r.valor, moeda)}</b>
                <span className="vx-mut" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r.observacao}</span>
                <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 36 }} onClick={() => apagar(r)}>Apagar</button>
              </div>
            ))}
          </div>
        )}
        {w.ok && w.dias.length > 0 && (
          <details style={{ marginTop: 12, fontSize: 12.5 }}>
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Gasto do WhatsApp por dia</summary>
            {w.dias.map((x) => (
              <div key={x.dia} className="vx-row" style={{ gap: 10, padding: "4px 0", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums" }}>
                <span>{x.dia.split("-").reverse().join("/")}</span><span className="vx-mut">{x.mensagens} mensagens</span><span>{valor(x.custo, moeda)}</span>
              </div>
            ))}
          </details>
        )}
      </div>

      <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-disp" style={{ fontSize: 15 }}>Conta de anúncios</div>
        {!a.ok ? <div style={{ marginTop: 8 }}><ErroMeta erro={a.erro} /></div> : (
          <div style={{ fontSize: 13, lineHeight: 1.8, marginTop: 8 }}>
            <div><span className="vx-mut">Conta:</span> {a.dados.nome || "—"} · {a.dados.status}</div>
            <div><span className="vx-mut">Forma de pagamento:</span> {a.dados.formaPagamento || "a Meta não informou"}{a.dados.prePaga ? " (pré-paga)" : ""}</div>
            <div><span className="vx-mut">A pagar agora:</span> {valor(a.dados.aPagar, a.dados.moeda)}</div>
            <div><span className="vx-mut">Gasto total da conta:</span> {valor(a.dados.gastoTotal, a.dados.moeda)}</div>
            <div><span className="vx-mut">Limite de gasto:</span> {a.dados.limiteGasto ? valor(a.dados.limiteGasto, a.dados.moeda) : "sem limite"}</div>
          </div>
        )}
        <p className="vx-mut" style={{ fontSize: 12.5, margin: "8px 0 0", lineHeight: 1.5 }}>
          O saldo dos anúncios é separado do WhatsApp: dinheiro posto na conta de anúncios não paga mensagens do WhatsApp, e vice-versa.
        </p>
      </div>
    </div>
  );
}
