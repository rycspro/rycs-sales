import { apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { TAXA } from "../../lib/constants.js";
import { Vazio } from "../ui.jsx";
import CardEnvio from "../CardEnvio.jsx";
import FinanceiroEmpresas from "./FinanceiroEmpresas.jsx";

export default function Admin({ db, setDb, up, aviso, aba }) {
  const triagem = db.sellers.filter((s) => s.status === "triagem");
  const paraLiberar = db.submissions.filter((s) => s.status === "ia_aprovado" || s.status === "conferido");
  const saques = db.withdrawals.filter((w) => w.status === "solicitado");

  const decidirTriagem = (s, st) => {
    apiPatch(`/sellers/${s.id}`, { status: st });
    up((d) => ({ sellers: d.sellers.map((x) => x.id === s.id ? { ...x, status: st } : x) }));
    aviso(st === "aprovado" ? `${s.nome} aprovado.` : "Cadastro recusado.");
  };

  const liberar = (sub) => {
    const emp = db.companies.find((c) => c.id === sub.companyId);
    if (!emp || emp.saldo < sub.valor) return aviso("Caixa da empresa insuficiente. Avise a empresa para abastecer.");
    const liquido = +(sub.valor * (1 - TAXA)).toFixed(2);
    const seller = db.sellers.find((s) => s.id === sub.sellerId);
    apiPatch(`/submissions/${sub.id}`, { status: "liberado", liquido });
    apiPatch(`/companies/${sub.companyId}`, { saldo: +(emp.saldo - sub.valor).toFixed(2) });
    if (seller) apiPatch(`/sellers/${seller.id}`, {
      pendente: +Math.max(0, seller.pendente - liquido).toFixed(2),
      disponivel: +(seller.disponivel + liquido).toFixed(2),
    });
    setDb((d) => ({
      ...d,
      submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, status: "liberado", liquido } : s),
      companies: d.companies.map((c) => c.id === sub.companyId ? { ...c, saldo: +(c.saldo - sub.valor).toFixed(2) } : c),
      sellers: d.sellers.map((s) => s.id === sub.sellerId
        ? { ...s, pendente: +Math.max(0, s.pendente - liquido).toFixed(2), disponivel: +(s.disponivel + liquido).toFixed(2) }
        : s),
    }));
    aviso(`${money(liquido)} liberados para saque.`);
  };

  const pagar = (w) => {
    apiPatch(`/withdrawals/${w.id}`, { status: "pago" });
    const seller = db.sellers.find((s) => s.id === w.sellerId);
    if (seller) apiPatch(`/sellers/${seller.id}`, { sacado: +(seller.sacado + w.valor).toFixed(2) });
    setDb((d) => ({
      ...d,
      withdrawals: d.withdrawals.map((x) => x.id === w.id ? { ...x, status: "pago" } : x),
      sellers: d.sellers.map((s) => s.id === w.sellerId ? { ...s, sacado: +(s.sacado + w.valor).toFixed(2) } : s),
    }));
    aviso("PIX marcado como pago.");
  };

  const receita = db.submissions.filter((s) => s.status === "liberado").reduce((a, s) => a + s.valor * TAXA, 0);

  return (
    <div className="vx-fade">
      <div className="vx-card" style={{ padding: 18, marginBottom: 22 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Receita da esteira</div>
        <div className="vx-disp vx-mono" style={{ fontSize: 30 }}>{money(receita)}</div>
        <div className="vx-mut" style={{ fontSize: 12 }}>taxa de serviço acumulada ({Math.round(TAXA * 100)}% por ação liberada)</div>
      </div>

      {aba === "triagem" && (!triagem.length
        ? <Vazio titulo="Fila vazia" texto="Novos cadastros de vendedores aparecem aqui com nota automática e vídeo de pitch." />
        : <div className="vx-grid">{triagem.map((s) => (
          <div key={s.id} className="vx-card" style={{ padding: 18 }}>
            <div className="vx-row">
              <div>
                <b>{s.nome}</b>
                <div className="vx-mut" style={{ fontSize: 12 }}>
                  {s.perfil === "sdr" ? "SDR" : s.perfil === "closer" ? "Closer" : "Iniciante"} · {s.cidade || "—"} · {dataCurta(s.criadoEm)}
                </div>
              </div>
              <div className="vx-disp vx-mono" style={{ fontSize: 26, color: s.nota >= 60 ? "var(--brand)" : "var(--amber)" }}>{s.nota}</div>
            </div>
            <div className="vx-mut" style={{ fontSize: 13, margin: "8px 0" }}>{s.experiencia || "Sem experiência declarada"}</div>
            {s.respostas?.length > 0 && (
              <ul className="vx-mut" style={{ fontSize: 12, paddingLeft: 18, margin: "0 0 10px" }}>
                {s.respostas.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
            {s.video && <div className="vx-mono" style={{ fontSize: 11.5, wordBreak: "break-all", marginBottom: 10 }}>Pitch: {s.video}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="vx-btn vx-btn-primary vx-btn-sm" style={{ flex: 1 }} onClick={() => decidirTriagem(s, "aprovado")}>Aprovar</button>
              <button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => decidirTriagem(s, "recusado")}>Recusar</button>
            </div>
          </div>
        ))}</div>)}

      {aba === "liberar" && (!paraLiberar.length
        ? <Vazio titulo="Nada para liberar" texto="Ações aprovadas pela IA ou conferidas pela empresa chegam aqui para o repasse final." />
        : <div className="vx-grid">{paraLiberar.map((sub) => (
          <CardEnvio key={sub.id} sub={sub} db={db} extra={
            <div style={{ marginTop: 12 }}>
              <div className="vx-mut vx-mono" style={{ fontSize: 11.5, marginBottom: 8 }}>
                bruto {money(sub.valor)} · taxa {money(sub.valor * TAXA)} · líquido {money(sub.valor * (1 - TAXA))}
              </div>
              <button className="vx-btn vx-btn-primary vx-btn-sm vx-btn-block" onClick={() => liberar(sub)}>Liberar para saque</button>
            </div>
          } />
        ))}</div>)}

      {aba === "saques" && (!saques.length
        ? <Vazio titulo="Sem saques na fila" texto="Solicitações de PIX dos vendedores aparecem aqui para pagamento." />
        : <div className="vx-grid">{saques.map((w) => {
          const s = db.sellers.find((x) => x.id === w.sellerId);
          return (
            <div key={w.id} className="vx-card vx-row" style={{ padding: 16 }}>
              <div>
                <b className="vx-mono">{money(w.valor)}</b>
                <div className="vx-mut" style={{ fontSize: 12 }}>{s?.nome} · {w.pix} · {dataCurta(w.criadoEm)}</div>
              </div>
              <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => pagar(w)}>Marcar pago</button>
            </div>
          );
        })}</div>)}

      {aba === "empresas" && <FinanceiroEmpresas db={db} />}
    </div>
  );
}
