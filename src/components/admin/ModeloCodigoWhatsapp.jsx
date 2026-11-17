import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";

// Modelo de autenticação usado na verificação do WhatsApp dos profissionais.
// O Gerenciador do WhatsApp não deixa criá-lo nesta conta; daqui ele é criado pela API.
const STATUS = {
  APPROVED: ["Aprovado", "vx-badge-brand", "A verificação já está liberada para os profissionais."],
  PENDING: ["Em análise", "vx-badge-amber", "A Meta está analisando. Assim que aprovar, a verificação libera sozinha em até 10 minutos."],
  REJECTED: ["Recusado", "vx-badge-red", "A Meta recusou o modelo."],
  PAUSED: ["Pausado", "vx-badge-amber", "A Meta pausou o modelo por qualidade."],
  DISABLED: ["Desativado", "vx-badge-red", "A Meta desativou o modelo."],
};

export default function ModeloCodigoWhatsapp({ aviso }) {
  const [estado, setEstado] = useState(null);
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);

  const carregar = () => api("/admin/whatsapp/modelo-codigo").then((r) => {
    if (!r || r.error) return setErro(r?.error || "Não foi possível consultar o modelo.");
    setErro(""); setEstado(r);
  });
  useEffect(() => { carregar(); }, []);

  const criar = async () => {
    setCriando(true); setErro("");
    const r = await api("/admin/whatsapp/modelo-codigo", {});
    setCriando(false);
    if (!r || r.error) return setErro(r?.error || "Não foi possível criar o modelo.");
    setEstado(r);
    aviso?.("Modelo enviado para análise da Meta.");
  };

  if (!estado && !erro) return null;
  const [rotulo, classe, texto] = STATUS[estado?.status] || [];

  return (
    <div className="vx-card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
      <ShieldCheck size={18} color="var(--brand)" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          Código de verificação dos profissionais
          {rotulo && <span className={`vx-badge ${classe}`}>{rotulo}</span>}
        </div>
        <p className="vx-mut" style={{ fontSize: 12.5, margin: "3px 0 0", lineHeight: 1.55 }}>
          {estado && !estado.configurado && "Envio pelo WhatsApp ainda não configurado no servidor."}
          {estado?.configurado && !estado.status && <>Falta criar o modelo <span className="vx-mono">{estado.nome}</span> ({estado.idioma}) na Meta. Sem ele, os profissionais não conseguem verificar o WhatsApp.</>}
          {texto}{estado?.motivo ? ` Motivo: ${estado.motivo}.` : ""}
        </p>
        {erro && <p role="alert" style={{ color: "var(--danger)", fontSize: 12.5, margin: "6px 0 0" }}>{erro}</p>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {estado?.configurado && !estado.status && (
          <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" style={{ minHeight: 44 }} onClick={criar} disabled={criando}>
            {criando ? "Criando…" : "Criar modelo na Meta"}
          </button>
        )}
        {estado?.status && estado.status !== "APPROVED" && (
          <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={carregar}>Atualizar</button>
        )}
      </div>
    </div>
  );
}
