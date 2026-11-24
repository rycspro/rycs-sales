import { useEffect, useId, useState } from "react";
import { RefreshCw, Send, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api.js";
import { STATUS_GRUPO, STATUS_ENVIO_GRUPO } from "../../../shared/grupoSuporte.js";
import { dataHora } from "./whatsappFormato.jsx";

// Grupos de suporte: cada empresa que paga o plano recebe o convite do grupo.
// A Meta só deixa criar grupo pela API quem é conta oficial verificada; até lá
// o admin cola o link (por empresa, ou um grupo padrão).

const COR_ENVIO = { enviado: "var(--green)", erro: "var(--red)", sem_numero: "var(--red)", pediu_para_sair: "var(--red)" };

export default function GruposSuporte({ aviso }) {
  const id = useId();
  const [p, setP] = useState(null);
  const [padrao, setPadrao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = () => api("/admin/whatsapp/grupos").then((r) => {
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível carregar os grupos."); return; }
    setP(r); setPadrao(r.linkPadrao || "");
  });
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const agir = async (caminho, corpo, ok) => {
    setSalvando(true);
    const r = await api(caminho, corpo);
    setSalvando(false);
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível salvar."); return; }
    aviso?.(ok);
    setTimeout(carregar, 1500);
  };

  if (!p) return <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Carregando...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!p.modeloAprovado && (
        <div className="vx-card" style={{ padding: 16, borderColor: "var(--amber)", background: "var(--amber-50)", display: "flex", gap: 10 }}>
          <AlertTriangle size={18} aria-hidden="true" style={{ color: "var(--amber)", flexShrink: 0 }} />
          <div style={{ fontSize: 13, lineHeight: 1.55, minWidth: 0 }}>
            <b>O modelo <span className="vx-mono">{p.modelo.nome}</span> ainda não está aprovado na Meta.</b> Até lá, o WhatsApp só sai para quem escreveu para a RYCS nas últimas 24h. Os outros recebem o convite no sistema e por e-mail, e o WhatsApp sai sozinho quando o modelo for aprovado.
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap", background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
              {p.modelo.corpo}{"\n\n"}Botão: {p.modelo.botao.texto} → {p.modelo.botao.url}
            </div>
          </div>
        </div>
      )}

      <section className="vx-card" style={{ padding: 16 }}>
        <h2 className="vx-disp" style={{ fontSize: 16, margin: "0 0 4px" }}>Grupo padrão</h2>
        <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 12px", lineHeight: 1.5 }}>
          {p.contaOficial
            ? "O número da RYCS é conta oficial: cada empresa ganha um grupo próprio. O grupo padrão só é usado se a criação falhar."
            : "A Meta só permite criar grupo pela API para conta oficial verificada, e o número da RYCS ainda não é. Se você informar um grupo padrão, toda empresa que pagar recebe este mesmo convite (os participantes veem o número uns dos outros). Deixe vazio para criar um grupo por empresa e colar o link na lista abaixo."}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); agir("/admin/whatsapp/grupos/padrao", { link: padrao }, "Grupo padrão salvo."); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ flex: "1 1 260px" }}>
            <label className="vx-label" htmlFor={`${id}-p`}>Link de convite</label>
            <input id={`${id}-p`} className="vx-input" value={padrao} onChange={(e) => setPadrao(e.target.value)} placeholder="https://chat.whatsapp.com/..." style={{ minHeight: 44 }} />
          </div>
          <button type="submit" className="vx-btn vx-btn-primary" disabled={salvando} style={{ minHeight: 44 }}>Salvar</button>
        </form>
      </section>

      <section className="vx-card" style={{ padding: 16 }}>
        <div className="vx-row" style={{ marginBottom: 10 }}>
          <h2 className="vx-disp" style={{ fontSize: 16, margin: 0 }}>Empresas</h2>
          <button type="button" className="vx-btn vx-btn-sm" onClick={carregar} style={{ minHeight: 44 }}><RefreshCw size={14} aria-hidden="true" /> Atualizar</button>
        </div>
        {p.itens.length === 0 && <div className="vx-mut" style={{ fontSize: 13 }}>Nenhuma empresa com plano pago ainda.</div>}
        {p.itens.map((g) => <Linha key={g.companyId} g={g} salvando={salvando} agir={agir} />)}
      </section>
    </div>
  );
}

function Linha({ g, salvando, agir }) {
  const id = useId();
  const [link, setLink] = useState(g.origem === "manual" ? g.link : "");
  const naFila = !!g.status;
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "12px 0", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <b style={{ fontSize: 14 }}>{g.nome}</b>
        <div className="vx-mut" style={{ fontSize: 12 }}>
          {naFila ? STATUS_GRUPO[g.status] : "Plano ativo antes desta função: convite ainda não enviado"}
          {g.origem === "padrao" ? " (grupo padrão)" : ""}{g.pagoEm ? ` · pago em ${dataHora(g.pagoEm)}` : ""}
        </div>
        {naFila && g.status === "pronto" && (
          <div style={{ fontSize: 12, color: COR_ENVIO[g.envio] || "var(--amber)" }}>{STATUS_ENVIO_GRUPO[g.envio] || g.envio}{g.enviadoEm ? ` em ${dataHora(g.enviadoEm)}` : ""}</div>
        )}
        {g.erro && <div style={{ fontSize: 12, color: "var(--red)", overflowWrap: "anywhere" }}>{g.erro}</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); agir(`/admin/whatsapp/grupos/${g.companyId}/link`, { link }, "Link salvo. O convite entrou na fila."); }} style={{ display: "flex", gap: 8, flex: "2 1 320px", alignItems: "end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px" }}>
          <label className="vx-label" htmlFor={`${id}-l`}>Link do grupo desta empresa</label>
          <input id={`${id}-l`} className="vx-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://chat.whatsapp.com/..." style={{ minHeight: 44 }} />
        </div>
        <button type="submit" className="vx-btn vx-btn-sm" disabled={salvando || !link.trim()} style={{ minHeight: 44 }}>Salvar link</button>
        {g.link && (
          <button type="button" className="vx-btn vx-btn-sm" disabled={salvando} style={{ minHeight: 44 }}
            onClick={() => { if (window.confirm(`Enviar o convite do grupo para ${g.nome} pelo WhatsApp da RYCS?`)) agir(`/admin/whatsapp/grupos/${g.companyId}/enviar`, {}, "Convite na fila."); }}>
            <Send size={14} aria-hidden="true" /> {g.enviadoEm ? "Reenviar" : "Enviar"}
          </button>
        )}
      </form>
    </div>
  );
}
