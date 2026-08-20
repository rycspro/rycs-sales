import { Clock, XCircle } from "lucide-react";
import { dataCurta } from "../../lib/utils.js";

export default function StatusTriagem({ eu }) {
  const recusado = eu.status === "recusado";
  return (
    <div className="vx-fade" style={{ maxWidth: 480 }}>
      <div className="vx-card" style={{ padding: 26, textAlign: "center" }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center",
          background: recusado ? "var(--red-100)" : "var(--amber-100)",
        }}>
          {recusado ? <XCircle size={22} color="var(--red)" /> : <Clock size={22} color="var(--amber)" />}
        </div>
        <div className="vx-disp" style={{ fontSize: 22, color: recusado ? "var(--red)" : "var(--ink)" }}>
          {recusado ? "Triagem recusada" : "Triagem em análise"}
        </div>
        <p className="vx-mut" style={{ fontSize: 13.5 }}>
          {recusado
            ? "Você pode refazer a triagem em 30 dias. Os cursos preparatórios continuam abertos para estudo."
            : "Seu cadastro está na fila. Resposta em até 48h no WhatsApp cadastrado."}
        </p>
        <div className="vx-card" style={{ textAlign: "left", marginTop: 16, padding: 14, background: "var(--surface-2)", border: "none" }}>
          <div className="vx-row" style={{ fontSize: 13, padding: "5px 0" }}><span className="vx-mut">Nome</span><b>{eu.nome}</b></div>
          <div className="vx-row" style={{ fontSize: 13, padding: "5px 0" }}><span className="vx-mut">Perfil</span><b>{eu.perfil === "sdr" ? "SDR" : eu.perfil === "closer" ? "Closer" : "Iniciante"}</b></div>
          <div className="vx-row" style={{ fontSize: 13, padding: "5px 0" }}><span className="vx-mut">Nota da triagem</span><b>{eu.nota}/100</b></div>
          <div className="vx-row" style={{ fontSize: 13, padding: "5px 0" }}><span className="vx-mut">Enviado em</span><b>{dataCurta(eu.criadoEm)}</b></div>
        </div>
      </div>
    </div>
  );
}
