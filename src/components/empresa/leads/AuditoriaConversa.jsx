import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, CheckCircle2, MinusCircle, RefreshCw, Copy } from "lucide-react";
import { api } from "../../../lib/api.js";
import { SITUACAO } from "../../../../shared/canais.js";

// Auditoria da conversa pela IA da RYCS, com os materiais da empresa. Só
// aponta: cada item leva às mensagens que o sustentam.

const ICONE = { ok: [CheckCircle2, "var(--green)"], atencao: [AlertTriangle, "var(--amber)"], sem_dado: [MinusCircle, "var(--muted-2)"] };
const dia = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AuditoriaConversa({ conversaId, aviso, irPara, usarSugestao, aoAuditar }) {
  const [a, setA] = useState(undefined);
  const [rodando, setRodando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setA(undefined);
    api(`/canais/conversas/${conversaId}/auditoria`).then((r) => { if (vivo) setA(r?.auditoria ?? null); });
    return () => { vivo = false; };
  }, [conversaId]);

  const auditar = async () => {
    setRodando(true);
    const r = await api(`/canais/conversas/${conversaId}/auditoria`, {});
    setRodando(false);
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível auditar agora.");
    setA(r.auditoria);
    aoAuditar?.();
  };

  const VerMensagem = ({ ids = [] }) => ids.map((m, i) => (
    <button key={m} type="button" onClick={() => irPara?.(m)} className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: "2px 6px", fontSize: 11.5, color: "var(--brand)" }}>ver mensagem{ids.length > 1 ? ` ${i + 1}` : ""}</button>
  ));
  const Titulo = ({ children }) => <h3 style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", margin: "16px 0 6px" }}>{children}</h3>;

  return (
    <aside aria-label="Auditoria da conversa" style={{ padding: 16, fontSize: 13, lineHeight: 1.5, minWidth: 0 }}>
      <div className="vx-row">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Sparkles size={16} aria-hidden="true" style={{ color: "var(--brand)" }} /><b style={{ fontSize: 14 }}>Auditoria da IA</b></div>
        <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} disabled={rodando || a === undefined} onClick={auditar}><RefreshCw size={13} aria-hidden="true" /> {rodando ? "Auditando…" : a ? "Refazer" : "Auditar"}</button>
      </div>

      {a === undefined && <div className="vx-mut" style={{ marginTop: 12 }}>Carregando…</div>}
      {a === null && <p className="vx-mut" style={{ margin: "10px 0 0" }}>Ainda não auditada. A IA audita sozinha depois de 30 minutos sem mensagem nova, ou agora no botão acima.</p>}
      {a && (
        <>
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>
            {dia(a.criadoEm)} · {a.motor === "claude" ? "IA com os seus materiais" : "Motor interno da RYCS"}{a.desatualizada ? " · há mensagens novas desde então" : ""}
          </div>
          {a.resumo && <p style={{ margin: "10px 0 0" }}>{a.resumo}</p>}
          {a.placar?.medidos > 0 && <p style={{ margin: "8px 0 0" }}><b>{a.placar.atendidos} de {a.placar.medidos}</b> critérios medidos atendidos.</p>}

          <Titulo>Critérios</Titulo>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {(a.criterios || []).map((c, i) => {
              const [Icone, cor] = ICONE[c.situacao] || ICONE.sem_dado;
              return (
                <li key={`${c.nome}-${i}`} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 8 }}>
                  <Icone size={16} aria-label={SITUACAO[c.situacao]} style={{ color: cor, marginTop: 2 }} />
                  <div style={{ minWidth: 0 }}><b>{c.nome}</b><div className="vx-mut" style={{ fontSize: 12.5 }}>{c.comentario} <VerMensagem ids={c.mensagens} /></div></div>
                </li>
              );
            })}
          </ul>

          {a.afirmacoesSemFonte?.length > 0 && <>
            <Titulo>Sem base nos seus materiais</Titulo>
            {a.afirmacoesSemFonte.map((x, i) => <div key={i} className="vx-notice vx-notice-amber" style={{ marginBottom: 8 }}>“{x.trecho}” {x.motivo} <VerMensagem ids={[x.mensagem]} /></div>)}
          </>}
          {a.riscos?.length > 0 && <>
            <Titulo>Riscos</Titulo>
            {a.riscos.map((x, i) => <div key={i} style={{ marginBottom: 6, color: "var(--red)" }}>{x.descricao} <VerMensagem ids={x.mensagens} /></div>)}
          </>}
          {a.materiais?.length > 0 && <>
            <Titulo>O material responde</Titulo>
            {a.materiais.map((x, i) => <div key={i} style={{ marginBottom: 8 }}><VerMensagem ids={[x.mensagem]} /><div className="vx-mut" style={{ fontSize: 12.5 }}><b style={{ color: "var(--ink)" }}>{x.fonte.documento}:</b> {x.fonte.trecho}</div></div>)}
          </>}
          {a.proximoPasso && <><Titulo>Próximo passo</Titulo><p style={{ margin: 0 }}>{a.proximoPasso}</p></>}
          {a.sugestaoResposta && <>
            <Titulo>Sugestão de resposta</Titulo>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 10, whiteSpace: "pre-wrap" }}>{a.sugestaoResposta}</div>
            {usarSugestao && <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44, marginTop: 8 }} onClick={() => usarSugestao(a.sugestaoResposta)}><Copy size={13} aria-hidden="true" /> Usar no campo de resposta</button>}
          </>}
          {a.motor === "claude" && a.fontes?.length > 0 && <><Titulo>Materiais consultados</Titulo><div className="vx-mut" style={{ fontSize: 12 }}>{[...new Set(a.fontes.map((f) => f.documento))].join(" · ")}</div></>}
        </>
      )}
    </aside>
  );
}
