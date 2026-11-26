import { useState, useCallback } from "react";
import CaixaCanal from "../empresa/leads/CaixaCanal.jsx";
import ConectarEvolution from "./ConectarEvolution.jsx";
import { api } from "../../lib/api.js";

// WhatsApp pessoal do profissional via Evolution API (QR Code).
// Separado do WhatsappVendedor (que usa a API oficial da Meta).

export default function WhatsappPessoal({ aviso }) {
  const [info, setInfo] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    api("/evolution/info").then((r) => {
      if (r && !r.error) setInfo(r);
      setCarregando(false);
    });
  }, []);

  // Carrega no mount.
  useState(() => { carregar(); });

  if (carregando) return <div style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  const conectado = info?.status === "ativa";

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Atendimento</div>
          <h1 className="vx-disp">WhatsApp Pessoal</h1>
          <p>Conecte seu WhatsApp pessoal por QR Code e atenda leads diretamente pela RYCS.</p>
        </div>
      </div>

      <ConectarEvolution aviso={aviso} recarregarInfo={carregar} />

      {conectado && <CaixaCanal canal="evolution" papel="vendedor" aviso={aviso} />}
    </div>
  );
}
