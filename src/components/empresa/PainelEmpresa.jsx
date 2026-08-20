import { useState } from "react";
import { Wallet, ClipboardList, Banknote, Users } from "lucide-react";
import { apiPatch } from "../../lib/api.js";
import { money, agora } from "../../lib/utils.js";
import { Stat } from "../ui.jsx";

export default function PainelEmpresa({ emp, db, up, aviso }) {
  const [rec, setRec] = useState("");
  const subs = db.submissions.filter((s) => s.companyId === emp.id);
  const pagos = subs.filter((s) => s.status === "liberado");
  const gasto = pagos.reduce((a, s) => a + s.valor, 0);
  const agendas = subs.filter((s) => s.tipo === "agendamento" && s.status === "liberado").length;
  const vendas = subs.filter((s) => s.tipo === "venda" && s.status === "liberado").length;
  const time = db.sellers.filter((s) => s.aplicacoes?.[emp.id] === "aprovado").length;

  const abastecer = () => {
    const v = Number(String(rec).replace(",", "."));
    if (!v || v < 100) return aviso("Recarga mínima de R$ 100,00.");
    const novoSaldo = +(emp.saldo + v).toFixed(2);
    const novoTotal = +((emp.totalAportado || 0) + v).toFixed(2);
    const novosAportes = [...(emp.aportes || []), { valor: v, ts: agora() }];
    apiPatch(`/companies/${emp.id}`, { saldo: novoSaldo, totalAportado: novoTotal, aportes: novosAportes });
    up((d) => ({
      companies: d.companies.map((c) => c.id === emp.id
        ? { ...c, saldo: novoSaldo, totalAportado: novoTotal, aportes: novosAportes }
        : c),
    }));
    setRec(""); aviso(`Caixa abastecido em ${money(v)}.`);
  };

  return (
    <>
      <div className="vx-grid vx-g4" style={{ marginBottom: 22 }}>
        <Stat label="Caixa da operação" value={money(emp.saldo)} Icon={Wallet} tone="brand" />
        <Stat label="Reuniões agendadas" value={agendas} Icon={ClipboardList} tone="indigo" mono={false} />
        <Stat label="Vendas fechadas" value={vendas} Icon={Banknote} tone="amber" mono={false} />
        <Stat label="Vendedores ativos" value={time} Icon={Users} tone="muted" mono={false} />
      </div>

      <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 8 }}>Abastecer caixa</div>
        <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>
          Você só paga pelo que foi conferido. O valor sai do caixa no momento em que a ação é liberada.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="vx-input vx-mono" value={rec} onChange={(e) => setRec(e.target.value)} placeholder="1.000,00" inputMode="decimal" />
          <button className="vx-btn vx-btn-primary" onClick={abastecer}>Abastecer</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {[500, 1000, 5000].map((v) => (
            <button key={v} className="vx-btn vx-btn-sm" onClick={() => setRec(String(v))}>{money(v)}</button>
          ))}
        </div>
        <hr className="vx-sep" />
        <div className="vx-row" style={{ fontSize: 13 }}>
          <span className="vx-mut">Pago em comissões</span><b className="vx-mono">{money(gasto)}</b>
        </div>
        <div className="vx-row" style={{ fontSize: 13, marginTop: 6 }}>
          <span className="vx-mut">Total já investido na plataforma</span><b className="vx-mono">{money(emp.totalAportado || 0)}</b>
        </div>
      </div>

      <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 4 }}>Posição na vitrine</div>
        <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>
          Empresas em destaque aparecem no topo da lista dos vendedores e recebem cerca de 3x mais candidaturas.
        </p>
        <div className="vx-row" style={{ padding: "10px 0" }}>
          <div>
            <b style={{ fontSize: 13.5 }}>Destaque no topo</b>
            <div className="vx-mut" style={{ fontSize: 12 }}>R$ 490/mês, cancela quando quiser</div>
          </div>
          <button className={"vx-btn vx-btn-sm" + (emp.destaque ? "" : " vx-btn-primary")}
            onClick={() => { apiPatch(`/companies/${emp.id}`, { destaque: !emp.destaque }); up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, destaque: !c.destaque } : c) })); aviso(emp.destaque ? "Destaque cancelado." : "Destaque ativado."); }}>
            {emp.destaque ? "Cancelar destaque" : "Ativar destaque"}
          </button>
        </div>
      </div>
    </>
  );
}
