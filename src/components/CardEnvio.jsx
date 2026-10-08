import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ACOES, CAMPOS, STATUS, MOTIVO_COR } from "../lib/constants.js";
import { money, dataCurta } from "../lib/utils.js";
import { Selo, Medidor } from "./ui.jsx";

export default function CardEnvio({ sub, db, extra }) {
  const [aberto, setAberto] = useState(false);
  const c = db.companies.find((x) => x.id === sub.companyId);
  const campanha = db.campaigns?.find((x) => x.id === sub.campaignId);
  const s = db.sellers.find((x) => x.id === sub.sellerId);
  const st = STATUS[sub.status] || STATUS.analisando;
  const acao = ACOES[sub.tipo] || { nome: sub.tipo || "Tarefa", prova: Object.keys(sub.prova || {}) };
  return (
    <div className="vx-card" style={{ padding: 16 }}>
      <div className="vx-row" style={{ alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{acao.nome}</div>
          <div className="vx-mut" style={{ fontSize: 12 }}>{campanha?.titulo || "Sem campanha"} · {c?.nome || "Empresa"} · {dataCurta(sub.criadoEm)}</div>
        </div>
        <div className="vx-disp vx-mono" style={{ fontSize: 17, color: "var(--brand)" }}>{money(sub.valor)}</div>
      </div>

      <div className="vx-row" style={{ margin: "12px 0 6px" }}>
        <Selo s={sub.status} />
        {typeof sub.confianca === "number" && (
          <span className="vx-mut vx-mono" style={{ fontSize: 11.5 }}>
            {sub.confianca}% · {sub.fonte === "ia" ? "análise por IA" : "checagem local"}
          </span>
        )}
      </div>
      {typeof sub.confianca === "number" && (
        <div style={{ marginBottom: 10 }}>
          <Medidor value={sub.confianca} tone={st.tone === "red" ? "red" : st.tone === "amber" ? "amber" : st.tone === "indigo" ? "indigo" : "brand"} />
        </div>
      )}

      {sub.status === "analisando" && (
        <div className="vx-mut vx-mono" style={{ fontSize: 12, marginBottom: 8 }}>A IA está cruzando os dados enviados…</div>
      )}
      {sub.motivo && (
        <div style={{ fontSize: 12.5, color: MOTIVO_COR[sub.status] || "var(--muted)", marginBottom: 10 }}>{sub.motivo}</div>
      )}

      <button className="vx-btn vx-btn-sm vx-btn-block" onClick={() => setAberto((v) => !v)}>
        <ChevronDown size={14} style={{ transform: aberto ? "rotate(180deg)" : "none", transition: ".15s" }} />
        {aberto ? "Ocultar detalhes" : "Abrir detalhes"}
      </button>

      {aberto && (
        <div className="vx-mono" style={{ fontSize: 12, color: "var(--ink-2)", background: "var(--surface-2)", padding: 11, borderRadius: 10, marginTop: 10 }}>
          {[
            ["Campanha", campanha?.titulo || "Sem campanha"],
            ["Empresa", c?.nome || "—"],
            ["Tarefa", acao.nome],
            ["Tipo", sub.tipo],
            ["Data", dataCurta(sub.criadoEm)],
            ["Valor", money(sub.valor)],
            ["Status", st.txt],
          ].map(([label, value]) => (
            <div key={label} className="vx-row" style={{ padding: "2px 0", gap: 10 }}>
              <span className="vx-mut">{label}</span>
              <b style={{ textAlign: "right", wordBreak: "break-word" }}>{value}</b>
            </div>
          ))}
          <hr className="vx-sep" />
          {acao.prova.map((k) => (
            <div key={k} className="vx-row" style={{ padding: "2px 0", gap: 10 }}>
              <span className="vx-mut">{CAMPOS[k]?.label || k}</span>
              <b style={{ textAlign: "right", wordBreak: "break-all" }}>{sub.prova?.[k] || "—"}</b>
            </div>
          ))}
          {Object.entries(sub.prova || {}).filter(([k]) => !acao.prova.includes(k)).map(([k, v]) => (
            <div key={k} className="vx-row" style={{ padding: "2px 0", gap: 10 }}>
              <span className="vx-mut">{CAMPOS[k]?.label || k}</span>
              <b style={{ textAlign: "right", wordBreak: "break-all" }}>{String(v || "—")}</b>
            </div>
          ))}
          {(sub.prova?.evidencias || []).length > 0 ? (
            <>
              <hr className="vx-sep" style={{ margin: "6px 0" }} />
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)" }}>Evidências</div>
              {sub.prova.evidencias.map((ev, i) => {
                const val = String(ev.valor || "");
                const isDataImg = val.startsWith("data:image");
                const isDataVid = val.startsWith("data:video");
                const isLink = /^https?:\/\//i.test(val);
                return (
                  <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <div className="vx-mut" style={{ fontSize: 10.5, marginBottom: 4 }}>#{i + 1} {ev.slot || "evidência"}</div>
                    {isDataImg ? (
                      <img src={val} alt="evidência" style={{ width: "100%", maxHeight: 160, objectFit: "contain", borderRadius: 6, background: "var(--surface-3)" }} />
                    ) : isDataVid ? (
                      <video src={val} controls style={{ width: "100%", maxHeight: 140, borderRadius: 6 }} />
                    ) : isLink ? (
                      <a href={val} target="_blank" rel="noreferrer" style={{ color: "var(--brand)", fontSize: 12, wordBreak: "break-all" }}>Abrir link</a>
                    ) : (
                      <span style={{ fontSize: 12, wordBreak: "break-word" }}>{val || "—"}</span>
                    )}
                    {ev.metadata && (isDataImg || isDataVid) && (
                      <div style={{ marginTop: 5, fontSize: 10.5, color: "var(--ink-3)", display: "flex", flexDirection: "column", gap: 1 }}>
                        {ev.metadata.capturadoEm && <span>📷 Capturada em: {new Date(ev.metadata.capturadoEm).toLocaleString("pt-BR")}</span>}
                        {ev.metadata.latitude != null && ev.metadata.longitude != null && (
                          <span>📍 <a href={`https://maps.google.com/?q=${ev.metadata.latitude},${ev.metadata.longitude}`} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>
                            {ev.metadata.latitude.toFixed(5)}, {ev.metadata.longitude.toFixed(5)}
                          </a></span>
                        )}
                        {ev.metadata.ip && <span>🌐 IP do envio: {ev.metadata.ip}</span>}
                        {ev.metadata.recebidoEm && <span>🕒 Enviada à plataforma em: {new Date(ev.metadata.recebidoEm).toLocaleString("pt-BR")}</span>}
                        {!ev.metadata.capturadoEm && !ev.metadata.latitude && (
                          <span style={{ color: "#b45309" }}>⚠ Sem metadados de câmera (horário/local não encontrados na foto)</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <div className="vx-row" style={{ padding: "2px 0", gap: 10 }}>
              <span className="vx-mut">Evidência</span>
              <b style={{ textAlign: "right", wordBreak: "break-all" }}>{sub.prova?.video || sub.prova?.contrato || (sub.arquivos || []).join(", ") || "—"}</b>
            </div>
          )}
        </div>
      )}
      {extra}
    </div>
  );
}
