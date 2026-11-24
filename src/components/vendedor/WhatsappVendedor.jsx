import CaixaCanal from "../empresa/leads/CaixaCanal.jsx";

// WhatsApp do profissional: ele conecta o próprio número para uma empresa em
// que está aprovado. Só as conversas com leads dessa empresa entram aqui.
export default function WhatsappVendedor({ aviso }) {
  return (
    <div className="vx-fade">
      <div className="vx-page-head"><div><div className="vx-eyebrow">Atendimento</div><h1 className="vx-disp">WhatsApp</h1><p>Atenda os leads das empresas pelo seu WhatsApp Business, com a auditoria da IA para melhorar a conversa.</p></div></div>
      <CaixaCanal canal="whatsapp" papel="vendedor" aviso={aviso} />
    </div>
  );
}
