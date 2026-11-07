import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MessageSquare, Send, ListChecks } from "lucide-react";
import { api } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { STATUS } from "../../lib/constants.js";
import { Vazio } from "../ui.jsx";

// Atividade do profissional: duas visões que compartilham os dados reais do
// vendedor. "Conversas" fala com as empresas de vínculos aprovados (mesma rota
// e regras de /messages usadas pela empresa); "Tarefas" lista os envios do
// profissional e o estado de cada ação. Sem dado fictício: tudo vem de
// db.submissions, db.campaigns e da API de mensagens.

const TOM_BADGE = { brand: "vx-badge-brand", amber: "vx-badge-amber", red: "vx-badge-red", indigo: "vx-badge-indigo", muted: "vx-badge-muted" };
const ABERTAS = new Set(["analisando", "ia_aprovado", "revisao", "conferido"]);

function Conversas({ eu, db, aviso }) {
  const [msgs, setMsgs] = useState(null);
  const [ativa, setAtiva] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef(null);

  const carregar = async () => {
    const r = await api("/messages");
    setMsgs(Array.isArray(r) ? r : []);
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Empresas com quem dá para conversar: vínculos aprovados + qualquer uma que
  // já tenha histórico de mensagens com este profissional.
  const empresas = useMemo(() => {
    const ids = new Set(Object.entries(eu?.aplicacoes || {}).filter(([, v]) => v === "aprovado").map(([id]) => id));
    (msgs || []).forEach((m) => ids.add(m.companyId));
    return [...ids]
      .map((id) => db.companies.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => {
        const conversa = (msgs || []).filter((m) => m.companyId === c.id).sort((a, b) => a.ts - b.ts);
        const ultima = conversa[conversa.length - 1];
        const naoLidas = conversa.filter((m) => m.de !== "vendedor" && !m.lida).length;
        return { empresa: c, ultima, naoLidas };
      })
      .sort((a, b) => (b.ultima?.ts || 0) - (a.ultima?.ts || 0));
  }, [msgs, eu, db.companies]);

  const conversaAtiva = ativa ? (msgs || []).filter((m) => m.companyId === ativa).sort((a, b) => a.ts - b.ts) : [];

  useEffect(() => {
    if (!ativa) return;
    fim.current?.scrollIntoView({ block: "end" });
    api("/messages/ler", { companyId: ativa, sellerId: eu.id }).catch(() => {});
  }, [ativa, conversaAtiva.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    const r = await api("/messages", { companyId: ativa, sellerId: eu.id, texto: t });
    setEnviando(false);
    if (r?.error) return aviso?.(r.error);
    setTexto("");
    await carregar();
  };

  if (msgs === null) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  if (ativa) {
    const emp = db.companies.find((c) => c.id === ativa);
    return (
      <div className="vx-fade" style={{ display: "flex", flexDirection: "column", minHeight: 320 }}>
        <button type="button" className="vx-btn vx-btn-sm vx-btn-ghost" onClick={() => setAtiva(null)} style={{ alignSelf: "flex-start", marginBottom: 12, paddingLeft: 0 }}>
          <ArrowLeft size={16} /> Conversas
        </button>
        <div className="vx-card" style={{ padding: 16, marginBottom: 12 }}>
          <strong style={{ fontSize: 15 }}>{emp?.nome || "Empresa"}</strong>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {conversaAtiva.length === 0 && <p className="vx-mut" style={{ textAlign: "center", padding: 20, fontSize: 13 }}>Nenhuma mensagem ainda. Diga olá.</p>}
          {conversaAtiva.map((m) => {
            const meu = m.de === "vendedor";
            return (
              <div key={m.id} style={{ alignSelf: meu ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                <div style={{
                  padding: "9px 13px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.45,
                  background: meu ? "var(--brand)" : "var(--surface-2)", color: meu ? "#fff" : "var(--ink)",
                  borderBottomRightRadius: meu ? 4 : 14, borderBottomLeftRadius: meu ? 14 : 4,
                }}>{m.texto}</div>
                <div className="vx-mut" style={{ fontSize: 10.5, marginTop: 3, textAlign: meu ? "right" : "left" }}>{dataCurta(m.ts)}</div>
              </div>
            );
          })}
          <div ref={fim} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
          <input className="vx-input" value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva uma mensagem…" onKeyDown={(e) => { if (e.key === "Enter") enviar(); }} />
          <button className="vx-btn vx-btn-primary" onClick={enviar} disabled={enviando || !texto.trim()} aria-label="Enviar">
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (empresas.length === 0)
    return <Vazio titulo="Nenhuma conversa" texto="As conversas aparecem quando você é aprovado em uma campanha. A empresa fala com você por aqui." />;

  return (
    <div className="vx-fade vx-grid">
      {empresas.map(({ empresa, ultima, naoLidas }) => (
        <button key={empresa.id} type="button" className="vx-card vx-row" style={{ padding: 14, textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => setAtiva(empresa.id)}>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>{empresa.nome}</b>
            <div className="vx-mut" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
              {ultima ? `${ultima.de === "vendedor" ? "Você: " : ""}${ultima.texto || "[anexo]"}` : "Sem mensagens"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {ultima && <span className="vx-mut" style={{ fontSize: 11 }}>{dataCurta(ultima.ts)}</span>}
            {naoLidas > 0 && <span className="vx-badge vx-badge-red">{naoLidas}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

function Tarefas({ eu, db }) {
  const meus = db.submissions.filter((s) => s.sellerId === eu.id);
  const emAberto = meus.filter((s) => ABERTAS.has(s.status)).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  const concluidas = meus.filter((s) => !ABERTAS.has(s.status)).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

  const nomeCampanha = (s) => db.campaigns?.find((c) => c.id === s.campaignId)?.titulo
    || db.companies.find((c) => c.id === s.companyId)?.nome || "Campanha";

  const Linha = (s) => {
    const st = STATUS[s.status] || { txt: s.status, tone: "muted", Icon: ListChecks };
    const Icon = st.Icon || ListChecks;
    return (
      <div key={s.id} className="vx-card vx-row" style={{ padding: 14 }}>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>{s.tipo || "Ação"}</b>
          <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {nomeCampanha(s)}{s.criadoEm ? ` · ${dataCurta(s.criadoEm)}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {s.valor > 0 && <b className="vx-mono" style={{ fontSize: 13 }}>{money(s.valor)}</b>}
          <span className={"vx-badge " + (TOM_BADGE[st.tone] || "vx-badge-muted")} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon size={12} /> {st.txt}
          </span>
        </div>
      </div>
    );
  };

  if (meus.length === 0)
    return <Vazio titulo="Nenhuma tarefa ainda" texto="Suas ações enviadas nas campanhas aparecem aqui, com o estado de cada uma." />;

  return (
    <div className="vx-fade">
      {emAberto.length > 0 && <>
        <h3 className="vx-disp" style={{ fontSize: 15, margin: "0 0 10px" }}>Em andamento</h3>
        <div className="vx-grid" style={{ marginBottom: 20 }}>{emAberto.map(Linha)}</div>
      </>}
      {concluidas.length > 0 && <>
        <h3 className="vx-disp" style={{ fontSize: 15, margin: "0 0 10px" }}>Concluídas</h3>
        <div className="vx-grid">{concluidas.map(Linha)}</div>
      </>}
    </div>
  );
}

export default function AtividadeProfissional({ conversas = false, eu, db, aviso }) {
  if (!eu) return null;
  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {conversas ? <MessageSquare size={24} /> : <ListChecks size={24} />}
            {conversas ? "Conversas" : "Tarefas"}
          </h1>
          <p>{conversas ? "Fale com as empresas das suas campanhas aprovadas." : "Acompanhe o estado das suas ações enviadas."}</p>
        </div>
      </div>
      {conversas ? <Conversas eu={eu} db={db} aviso={aviso} /> : <Tarefas eu={eu} db={db} />}
    </div>
  );
}
