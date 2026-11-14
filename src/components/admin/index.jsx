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
import ConvitesOnboarding from "./ConvitesOnboarding.jsx";
import VouchersAdmin from "./VouchersAdmin.jsx";

export default function Admin({ db, setDb, up, aviso, aba, recarregar }) {
  const triagem = db.sellers.filter((s) => s.status === "triagem");
  const paraLiberar = db.submissions.filter((s) => s.status === "ia_aprovado" || s.status === "conferido");
  const saques = db.withdrawals.filter((w) => w.status === "solicitado");
  // Os já resolvidos também precisam aparecer: é neles que mora o saque
  // marcado pago sem Pix, que some da fila e fica invisível para quem
  // precisa consertar.
  const saquesResolvidos = db.withdrawals
    .filter((w) => w.status !== "solicitado")
    .sort((a, b) => b.criadoEm - a.criadoEm)
    .slice(0, 15);

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
    // Este botão não move dinheiro: só registra que alguém já transferiu por
    // fora. Dizer isso aqui é o que evita marcar como pago um Pix que não
    // existiu — o profissional fica sem o saldo e sem o dinheiro.
    if (!window.confirm(`Isto NÃO envia Pix. Só registra que você já transferiu ${money(w.valor)} por fora da plataforma.\n\nPara o sistema enviar o Pix, use "Enviar Pix agora".\n\nConfirma que o Pix já foi feito?`)) return;
    const r = await apiPatch(`/withdrawals/${w.id}`, { status: "pago" });
    if (r?.error) return aviso(r.error);
    await recarregar();
    aviso("Saque marcado como pago.");
  };

  // "Solicitado" não prova que o Pix ficou parado — só que a confirmação não
  // chegou. Antes de devolver saldo ou cobrar de novo, pergunta ao banco.
  const conferir = async (w) => {
    const r = await api(`/admin/withdrawals/${w.id}/reconciliar`, {});
    if (r?.error) return aviso(r.error);
    await recarregar();
    aviso(r.message);
  };

  // O que de fato manda o dinheiro. Confere a transferência anterior no banco
  // antes de enviar, para não pagar a mesma pessoa duas vezes.
  const enviarPix = async (w) => {
    const s = db.sellers.find((x) => x.id === w.sellerId);
    if (!window.confirm(`Enviar Pix de ${money(w.valor)} para ${s?.nome || "o profissional"} agora?`)) return;
    const r = await api(`/admin/withdrawals/${w.id}/pagar-pix`, {});
    if (r?.error) return aviso(r.error);
    await recarregar();
    aviso(r.message);
  };

  // Devolve o valor ao saldo para o profissional poder pedir de novo. O
  // servidor confere no banco antes: se o Pix saiu, recusa em vez de pagar
  // duas vezes.
  const estornar = async (w) => {
    const s = db.sellers.find((x) => x.id === w.sellerId);
    if (!window.confirm(`Devolver ${money(w.valor)} ao saldo de ${s?.nome || "o profissional"}?\n\nUse isto apenas quando o Pix NÃO saiu. O sistema confere no banco antes de devolver.`)) return;
    const r = await api(`/admin/withdrawals/${w.id}/estornar`, {});
    if (r?.error) return aviso(r.error);
    await recarregar();
    aviso(r.message);
  };

  if (aba === "dashboard") return <DashboardAdmin db={db} />;
  if (aba === "profissionais") return <ProfissionaisAdmin db={db} up={up} aviso={aviso} />;
  if (aba === "empresas") return <EmpresasAdmin db={db} up={up} aviso={aviso} />;
  if (aba === "cobranca") return <AssinaturasAdmin />;
  if (aba === "vouchers") return <VouchersAdmin aviso={aviso} />;
  if (aba === "depositos") return <DepositosAdmin aviso={aviso} recarregar={recarregar} />;
  if (aba === "academy") return <AcademyAdmin aviso={aviso} />;
  if (aba === "beta") return <BetaEnvironmentAdmin aviso={aviso} recarregar={recarregar} />;
  if (aba === "emails") return <CentralEmails aviso={aviso} />;
  if (aba === "onboarding") return <ConvitesOnboarding aviso={aviso} />;

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
              <div className="vx-disp vx-mono" style={{ fontSize: 26, color: s.nota >= 80 ? "var(--brand)" : s.nota >= 50 ? "var(--amber)" : s.nota >= 30 ? "#c2410c" : "var(--red)" }}>{s.nota ?? 100}</div>
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="vx-btn vx-btn-sm" onClick={() => conferir(w)}>Conferir no banco</button>
                <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => enviarPix(w)}>Enviar Pix agora</button>
                <button className="vx-btn vx-btn-sm" onClick={() => estornar(w)}>Devolver ao saldo</button>
                <button className="vx-btn vx-btn-sm" onClick={() => pagar(w)}>Só registrar</button>
              </div>
            </div>
          );
        })}</div>)}

      {aba === "saques" && saquesResolvidos.length > 0 && (
        <>
          <h3 className="vx-disp" style={{ fontSize: 15, margin: "22px 0 10px" }}>Saques resolvidos</h3>
          <div className="vx-grid">{saquesResolvidos.map((w) => {
            const s = db.sellers.find((x) => x.id === w.sellerId);
            const rotulo = { pago: "Pago", falhou: "Não concluído", cancelado: "Cancelado" }[w.status] || w.status;
            return (
              <div key={w.id} className="vx-card vx-row" style={{ padding: 16 }}>
                <div>
                  <b className="vx-mono">{money(w.valor)}</b>
                  <span className={"vx-badge " + (w.status === "pago" ? "vx-badge-brand" : "vx-badge-muted")} style={{ marginLeft: 8 }}>{rotulo}</span>
                  <div className="vx-mut" style={{ fontSize: 12 }}>{s?.nome} · {w.pix} · {dataCurta(w.criadoEm)}</div>
                  {!w.asaasId && w.status === "pago" && (
                    <div style={{ fontSize: 12, color: "var(--amber)", marginTop: 3 }}>Marcado pago sem transferência no gateway — nenhum Pix saiu pela plataforma.</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="vx-btn vx-btn-sm" onClick={() => conferir(w)}>Conferir no banco</button>
                  {w.status !== "cancelado" && (
                    <>
                      <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => enviarPix(w)}>Enviar Pix agora</button>
                      <button className="vx-btn vx-btn-sm" onClick={() => estornar(w)}>Devolver ao saldo</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}</div>
        </>
      )}
    </div>
  );
}
