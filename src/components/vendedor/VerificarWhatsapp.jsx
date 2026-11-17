import { useEffect, useId, useState } from "react";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { CODIGO_TAMANHO, formatarNumero, whatsVerificado } from "../../../shared/whatsappVerificacao.js";

// Confirma que o WhatsApp do perfil é do profissional: a RYCS envia um código
// de 6 dígitos pelo WhatsApp oficial e ele digita aqui.
export default function VerificarWhatsapp({ eu, up, aviso }) {
  const id = useId();
  const [status, setStatus] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    api("/whatsapp/verificacao").then((r) => { if (r && !r.error) setStatus(r); });
  }, [eu.whats, eu.whatsVerificadoNumero]);

  const pendente = status?.pendente;
  useEffect(() => {
    if (!pendente) return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pendente]);

  if (!status) return null;
  const verificado = whatsVerificado(eu);
  const esperaReenvio = pendente ? Math.max(0, Math.ceil((pendente.reenviarEm - agora) / 1000)) : 0;

  const enviar = async () => {
    setErro(""); setEnviando(true);
    const r = await api("/whatsapp/verificacao/enviar", {});
    setEnviando(false);
    if (!r || r.error) return setErro(r?.error || "Não foi possível enviar o código.");
    setCodigo("");
    setAgora(Date.now());
    setStatus((s) => ({ ...s, pendente: { expiraEm: r.expiraEm, reenviarEm: r.reenviarEm } }));
    aviso?.("Código enviado para o seu WhatsApp.");
  };

  const confirmar = async (e) => {
    e.preventDefault();
    setErro(""); setConfirmando(true);
    const r = await api("/whatsapp/verificacao/confirmar", { codigo });
    setConfirmando(false);
    if (!r || r.error) return setErro(r?.error || "Não foi possível confirmar o código.");
    up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, whatsVerificadoNumero: r.numero, whatsVerificadoEm: r.verificadoEm } : s) }));
    setStatus((s) => ({ ...s, verificado: true, verificadoEm: r.verificadoEm, pendente: null }));
    aviso?.("WhatsApp verificado.");
  };

  if (verificado) {
    return (
      <div className="vx-card" style={{ padding: "12px 16px", marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <ShieldCheck size={18} color="var(--green)" />
        <span style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600 }}>WhatsApp verificado</span>
        <span className="vx-mut" style={{ fontSize: 12.5 }}>
          {formatarNumero(eu.whatsVerificadoNumero)}{eu.whatsVerificadoEm ? ` · desde ${dataCurta(eu.whatsVerificadoEm)}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="vx-card" style={{ padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <MessageCircle size={18} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Verifique seu WhatsApp</div>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "3px 0 12px", lineHeight: 1.55 }}>
            {status.numero
              ? <>A RYCS vai enviar um código de {CODIGO_TAMANHO} dígitos para <b style={{ color: "var(--ink)" }}>{formatarNumero(status.numero)}</b>. Use o número de WhatsApp Business que você usa para trabalhar.</>
              : "Cadastre seu WhatsApp, com DDD, em \"Editar perfil\" para poder verificar."}
          </p>

          {!status.configurado && <p className="vx-mut" style={{ fontSize: 12.5, margin: 0 }}>A verificação pelo WhatsApp ainda não está disponível. Tente mais tarde.</p>}

          {status.configurado && status.numero && !pendente && (
            <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" style={{ minHeight: 44 }} onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar código"}
            </button>
          )}

          {status.configurado && pendente && (
            <form onSubmit={confirmar} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <label style={{ flex: "0 1 200px" }}>
                <span className="vx-label" id={`${id}-c`}>Código de {CODIGO_TAMANHO} dígitos</span>
                <input className="vx-input vx-mono" aria-labelledby={`${id}-c`} inputMode="numeric" autoComplete="one-time-code"
                  maxLength={CODIGO_TAMANHO} value={codigo} autoFocus
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, CODIGO_TAMANHO))}
                  style={{ letterSpacing: "0.3em", fontSize: 16, minHeight: 44 }} />
              </label>
              <button type="submit" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} disabled={confirmando || codigo.length !== CODIGO_TAMANHO}>
                {confirmando ? "Confirmando…" : "Confirmar"}
              </button>
              <button type="button" className="vx-btn vx-btn-ghost" style={{ minHeight: 44 }} onClick={enviar} disabled={enviando || esperaReenvio > 0}>
                {esperaReenvio > 0 ? `Reenviar em ${esperaReenvio}s` : "Reenviar código"}
              </button>
            </form>
          )}

          {erro && <p role="alert" style={{ color: "var(--danger)", fontSize: 12.5, margin: "8px 0 0" }}>{erro}</p>}
        </div>
      </div>
    </div>
  );
}
