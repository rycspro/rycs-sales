import { useMemo } from "react";
import { BarChart2, ClipboardList, DollarSign, Megaphone } from "lucide-react";
import CampanhasEmpresa from "./CampanhasEmpresa.jsx";
import LeadsEmpresa from "./LeadsEmpresa.jsx";
import TarefasEmpresa from "./TarefasEmpresa.jsx";
import ValoresEmpresa from "./ValoresEmpresa.jsx";

const ABAS = [
  { key: "campanhas", label: "Campanhas", icon: Megaphone },
  { key: "leads", label: "Leads", icon: BarChart2 },
  { key: "tarefas", label: "Tarefas", icon: ClipboardList },
  { key: "valores", label: "Valores", icon: DollarSign },
];

function Badge({ n }) {
  if (!n) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 18, height: 18, borderRadius: 9, padding: "0 5px",
      fontSize: 11, fontWeight: 600, lineHeight: 1,
      background: "var(--brand)", color: "#fff",
    }}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export default function CampanhasHub({ emp, db, up, aviso, recarregar, secao, setSecao }) {
  const badges = useMemo(() => {
    const campanhas = (db.campaigns || []).filter((c) => c.companyId === emp.id);
    const leads = (db.leads || []).filter((l) => l.companyId === emp.id);
    const tarefas = (db.submissions || []).filter((s) => s.companyId === emp.id && s.status === "analisando");
    const pendentes = campanhas.reduce((acc, c) => acc + ((c.candidaturas || []).filter((a) => a.status === "pendente").length), 0);
    return {
      campanhas: pendentes || 0,
      leads: leads.filter((l) => l.etapa === "novo").length,
      tarefas: tarefas.length,
      valores: 0,
    };
  }, [db, emp.id]);

  return (
    <div className="vx-fade" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Premium tab navigation */}
      <div style={{ borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none" }}>
          {ABAS.map(({ key, label, icon: Icon }) => {
            const ativa = secao === key;
            return (
              <button
                key={key}
                onClick={() => setSecao(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "11px 18px", whiteSpace: "nowrap",
                  background: "transparent", border: "none",
                  borderBottom: `2px solid ${ativa ? "var(--brand)" : "transparent"}`,
                  cursor: "pointer", color: ativa ? "var(--brand)" : "var(--muted)",
                  fontSize: 13.5, fontWeight: ativa ? 600 : 400,
                  transition: "all .15s", marginBottom: -1,
                }}
              >
                <Icon size={15} strokeWidth={ativa ? 2.3 : 2} />
                {label}
                <Badge n={badges[key]} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {secao === "campanhas" && <CampanhasEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar} />}
      {secao === "leads" && <LeadsEmpresa emp={emp} db={db} aviso={aviso} />}
      {secao === "tarefas" && <TarefasEmpresa emp={emp} db={db} aviso={aviso} recarregar={recarregar} />}
      {secao === "valores" && <ValoresEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
    </div>
  );
}
