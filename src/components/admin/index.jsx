import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { takeRateDoPlano } from "../../../shared/planos.js";
import { Vazio } from "../ui.jsx";
import CardEnvio from "../CardEnvio.jsx";
import DashboardAdmin from "./DashboardAdmin.jsx";
import ProfissionaisAdmin from "./ProfissionaisAdmin.jsx";
import EmpresasAdmin from "./EmpresasAdmin.jsx";
import DepositosAdmin from "./DepositosAdmin.jsx";
import AssinaturasAdmin from "./AssinaturasAdmin.jsx";
import AcademyAdmin from "./AcademyAdmin.jsx";
import BetaEnvironmentAdmin from "./BetaEnvironmentAdmin.jsx";
import CentralEmails from "./CentralEmails.jsx";

export default function Admin({ db, setDb, up, aviso, aba, recarregar }) {
  const triagem = db.sellers.filter((s) => s.status === "triagem");
  const paraLiberar = db.submissions.filter((s) => s.status === "ia_aprovado" || s.status === "conferido");
  const saques = db.withdrawals.filter((w) => w.status === "solicitado");

  const decidirTriagem = (s, st) => {
    apiPatch(`/sellers/${s.id}`, { status: st });
    up((d) => ({ sellers: d.sellers.map((x) => x.id === s.id ? { ...x, status: st } : x) }));
    aviso(st === "aprovado" ? `${s.nome} aprovado.` : "Cadastro recusado.");
  };

  // O servidor faz a conta e move o dinheiro numa transação; aqui só
  // disparamos e recarregamos o estado real.
  const liberar = async (sub) => {
    const r = await api(`/submissions/${sub.id}/liberar`, {});
    if (r?.error) return aviso(r.error);
    await recarregar();
    aviso(`${money(r.liquido)} liberados para saque.`);
  };

  // O servidor credita o "sacado" e guarda a transição de estado; tentar
  // fazer isso pelo cliente falharia em silêncio, já que campos financeiros
  // não são graváveis por PATCH.
  const pagar = async (w) => {
    if (!window.confirm(`Confirmar que o Pix de ${money(w.valor)} foi enviado?`)) return;
    const r = await apiPatch(`/withdrawals/${w.id}`, { status: "pago" });
    if (r?.error) return aviso(r.error);
    await recarregar();
    aviso("Saque marcado como pago.");
  };

  if (aba === "dashboard") return <DashboardAdmin db={db} />;
  if (aba === "profissionais") return <ProfissionaisAdmin db={db} up={up} aviso={aviso} />;
  if (aba === "empresas") return <EmpresasAdmin db={db} up={up} aviso={aviso} />;
  if (aba === "cobranca") return <AssinaturasAdmin />;
  if (aba === "depositos") return <DepositosAdmin aviso={aviso} recarregar={recarregar} />;
  if (aba === "academy") return <AcademyAdmin aviso={aviso} />;
  if (aba === "beta") return <BetaEnvironmentAdmin aviso={aviso} recarregar={recarregar} />;
  if (aba === "emails") return <CentralEmails aviso={aviso} />;

  return (
    <div className="vx-fade">
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
                profissional {money(sub.valor)} · taxa da empresa {money(sub.valor * takeRateDoPlano(db.companies.find((c) => c.id === sub.companyId)?.assinatura))}
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
    </div>
  );
}
