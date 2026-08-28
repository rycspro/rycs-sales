import { useState } from "react";
import { Wallet, Clock, Banknote, CheckCircle2 } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { Stat, Campo } from "../ui.jsx";
import MeusEnvios from "./MeusEnvios.jsx";

// O servidor muda o status e ajusta o pendente; o cliente não envia valores.
async function pedirRevisaoHumana(recarregar, aviso, sub) {
  const r = await api(`/submissions/${sub.id}/contestar`, {});
  if (r?.error) return aviso(r.error);
  await recarregar();
  aviso("Enviado para conferência humana da empresa.");
}

export default function Carteira({ eu, db, setDb, aviso, recarregar }) {
  const [pix, setPix] = useState(eu.pix || "");
  const [valor, setValor] = useState("");
  const meus = db.submissions.filter((s) => s.sellerId === eu.id);
  const saques = db.withdrawals.filter((w) => w.sellerId === eu.id);
  const MIN = 20;

  // O servidor debita o saldo e dispara o Pix numa transação. O cliente não
  // envia saldo nem chave de destino: a chave usada é a do cadastro.
  const sacar = async () => {
    const v = Number(String(valor).replace(",", "."));
    if (!pix.trim()) return aviso("Informe a chave PIX.");
    if (!v || v < MIN) return aviso(`Saque mínimo de ${money(MIN)}.`);

    if (pix.trim() !== (eu.pix || "")) {
      const r = await apiPatch(`/sellers/${eu.id}`, { pix: pix.trim() });
      if (r?.error) return aviso(r.error);
    }

    const r = await api("/payments/withdraw", { valor: v });
    if (!r || r.error) return aviso(r?.error || "Não foi possível solicitar o saque.");

    await recarregar();
    setValor("");
    aviso(r.message || "Saque solicitado.");
  };

  return (
    <div className="vx-fade">
      <div className="vx-grid vx-g4" style={{ marginBottom: 22 }}>
        <Stat label="Disponível" value={money(eu.disponivel)} Icon={Wallet} tone="brand" />
        <Stat label="Em análise" value={money(eu.pendente)} Icon={Clock} tone="amber" />
        <Stat label="Já sacado" value={money(eu.sacado)} Icon={Banknote} tone="indigo" />
        <Stat label="Ações aprovadas" value={meus.filter((s) => s.status === "liberado").length} Icon={CheckCircle2} tone="muted" mono={false} />
      </div>

      <div className="vx-card" style={{ padding: 18, marginBottom: 20 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 12 }}>Sacar por PIX</div>
        <Campo label="Chave PIX"><input className="vx-input" value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CPF, e-mail ou telefone" /></Campo>
        <Campo label={`Valor (mínimo ${money(MIN)})`}>
          <input className="vx-input vx-mono" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </Campo>
        <button className="vx-btn vx-btn-primary vx-btn-block" disabled={eu.disponivel < MIN} onClick={sacar}>
          {eu.disponivel < MIN ? `Faltam ${money(Math.max(0, MIN - eu.disponivel))} para sacar` : "Solicitar saque"}
        </button>
      </div>

      {saques.length > 0 && (
        <>
          <h3 className="vx-disp" style={{ fontSize: 16, marginBottom: 10 }}>Saques</h3>
          <div className="vx-grid" style={{ marginBottom: 20 }}>
            {saques.map((w) => (
              <div key={w.id} className="vx-card vx-row" style={{ padding: 14, fontSize: 13.5 }}>
                <div>
                  <b className="vx-mono">{money(w.valor)}</b>
                  <div className="vx-mut" style={{ fontSize: 11.5 }}>{w.pix} · {dataCurta(w.criadoEm)}</div>
                </div>
                <span className={"vx-badge " + (w.status === "pago" ? "vx-badge-brand" : "vx-badge-amber")}>
                  {w.status === "pago" ? "Pago" : "Processando"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="vx-disp" style={{ fontSize: 16, marginBottom: 10 }}>Extrato de ações</h3>
      <MeusEnvios empresa={null} eu={eu} db={db} pedirRevisao={(sub) => pedirRevisaoHumana(recarregar, aviso, sub)} />
    </div>
  );
}
