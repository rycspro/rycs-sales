import { Mail, MessageCircle, ExternalLink, Globe } from "lucide-react";

export default function SuporteEmpresa() {
  return (
    <div className="vx-fade" style={{ maxWidth: 680 }}>
      <div style={{ padding: "4px 0 16px" }}>
        <div className="vx-eyebrow">Ajuda</div>
        <h1 className="vx-disp" style={{ margin: "2px 0 3px" }}>Suporte</h1>
        <p style={{ margin: 0 }}>Entre em contato com a equipe RYCS.</p>
      </div>

      <div className="vx-card" style={{ padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 14 }}>
          Canais de atendimento
        </div>
        {[
          { icon: Mail, label: "E-mail", valor: "suporte@rycs.pro", href: "mailto:suporte@rycs.pro", desc: "Resposta em até 1 dia útil" },
          { icon: MessageCircle, label: "WhatsApp", valor: "(11) 99999-9999", href: "https://wa.me/5511999999999", desc: "Atendimento em horário comercial" },
        ].map(({ icon: Icon, label, valor, href, desc }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} strokeWidth={1.8} style={{ color: "var(--brand)" }} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{label}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{desc}</div>
              </div>
            </div>
            <a href={href} target="_blank" rel="noreferrer" className="vx-btn vx-btn-sm" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <ExternalLink size={12} />
              {valor}
            </a>
          </div>
        ))}
      </div>

      <div className="vx-card" style={{ padding: "20px 22px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 14 }}>
          Central de ajuda
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", color: "var(--muted)" }}>
          <Globe size={18} strokeWidth={1.5} />
          <span style={{ fontSize: 13.5 }}>Documentação e tutoriais em breve em <b>docs.rycs.pro</b>.</span>
        </div>
      </div>
    </div>
  );
}
