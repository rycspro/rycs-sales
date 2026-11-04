import { useState } from "react";
import { api } from "../../lib/api.js";

export default function ConfiguracoesEmpresa({ emp, up, aviso }) {
  if (!emp) return null;

  return (
    <div className="vx-fade">
      <h1 className="vx-disp" style={{ fontSize: 22, marginBottom: 24 }}>Configurações</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 680 }}>
        <div className="vx-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Dados da empresa</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", fontSize: 13.5 }}>
            <div><span style={{ color: "var(--muted)" }}>Nome</span><div style={{ fontWeight: 500 }}>{emp.nome || "—"}</div></div>
            <div><span style={{ color: "var(--muted)" }}>CNPJ</span><div style={{ fontWeight: 500 }}>{emp.documento || "—"}</div></div>
            <div><span style={{ color: "var(--muted)" }}>Razão social</span><div style={{ fontWeight: 500 }}>{emp.razaoSocial || "—"}</div></div>
            <div><span style={{ color: "var(--muted)" }}>Segmento</span><div style={{ fontWeight: 500 }}>{emp.segmento || "—"}</div></div>
          </div>
        </div>

        <div className="vx-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Contatos</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", fontSize: 13.5 }}>
            <div><span style={{ color: "var(--muted)" }}>Representante legal</span><div style={{ fontWeight: 500 }}>{emp.representanteLegal || "—"}</div></div>
            <div><span style={{ color: "var(--muted)" }}>Contato financeiro</span><div style={{ fontWeight: 500 }}>{emp.contatoFinanceiro || "—"}</div></div>
            <div><span style={{ color: "var(--muted)" }}>Contato comercial</span><div style={{ fontWeight: 500 }}>{emp.contatoComercial || "—"}</div></div>
            <div><span style={{ color: "var(--muted)" }}>Endereço</span><div style={{ fontWeight: 500 }}>{emp.endereco || "—"}</div></div>
          </div>
        </div>

        <div className="vx-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Preferências</h2>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0 }}>Em breve: notificações, integrações e personalização da conta.</p>
        </div>
      </div>
    </div>
  );
}
