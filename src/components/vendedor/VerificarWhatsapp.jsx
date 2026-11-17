import { useEffect, useId, useState } from "react";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { CODIGO_TAMANHO, formatarNumero, whatsVerificado } from "../../../shared/whatsappVerificacao.js";

// Confirma que o WhatsApp do perfil é do profissional. Caminho principal: ele
// envia uma mensagem pronta para o WhatsApp da RYCS e o número que chega prova
// que é dele. Alternativa: a RYCS envia um código de 6 dígitos (quando o modelo
// de autenticação estiver aprovado na Meta).
export default function VerificarWhatsapp({ eu, up, aviso }) {
  const id = useId();
  const [status, setStatus] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [agora, setAgora] = useState(Date.now());

  const carregar = () => api("/whatsapp/verificacao").then((r) => { if (r && !r.error) setStatus(r); return r; });
  useEffect(() => { carregar(); }, [eu.whats, eu.whatsVerificadoNumero]);

  const pendente = status?.pendente;
  useEffect(() => {
    if (!pendente) return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pendente]);

  // Esperando a mensagem chegar: confere de tempos em tempos.
  const aguardando = !!status?.recebida && !status?.verificado;
  useEffect(() => {
    if (!aguardando) return undefined;
    const t = setInterval(async () => {
      const r = await carregar();
      if (r?.verificado) {
        up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, whatsVerificadoNumero: r.numero, whatsVerificadoEm: r.verificadoEm } : s) }));
        aviso?.("WhatsApp verificado.");
      }
    }, 4000);
    return () => clearInterval(t);
  }, [aguardando]);

  if (!status) return null;
  const verificado = whatsVerificado(eu) || status.verificado;
  const esperaReenvio = pendente ? Math.max(0, Math.ceil((pendente.reenviarEm - agora) / 1000)) : 0;

  const iniciarRecebida = async () => {
    setErro(""); setOcupado(true);
    const r = await api("/whatsapp/verificacao/recebida", {});
    setOcupado(false);
    if (!r || r.error) return setErro(r?.error || "Não foi possível iniciar a verificação.");
    setStatus((s) => ({ ...s, recebida: r }));
  };

  const enviarCodigo = async () => {
    setErro(""); setOcupado(true);
    const r = await api("/whatsapp/verificacao/enviar", {});
    setOcupado(false);
    if (!r || r.error) return setErro(r?.error || "Não foi possível enviar o código.");
    setCodigo("");
    setAgora(Date.now());
    setStatus((s) => ({ ...s, pendente: { expiraEm: r.expiraEm, reenviarEm: r.reenviarEm } }));
    aviso?.("Código enviado para o seu WhatsApp.");
  };

  const confirmar = async (e) => {
    e.preventDefault();
    setErro(""); setOcupado(true);
    const r = await api("/whatsapp/verificacao/confirmar", { codigo });
    setOcupado(false);
    if (!r || r.error) return setErro(r?.error || "Não foi possível confirmar o código.");
    up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, whatsVerificadoNumero: r.numero, whatsVerificadoEm: r.verificadoEm } : s) }));
    setStatus((s) => ({ ...s, verificado: true, verificadoEm: r.verificadoEm, pendente: null }));
    aviso?.("WhatsApp verificado.");
  };

  if (verificado) {
    const numero = eu.whatsVerificadoNumero || status.numero;
    const em = eu.whatsVerificadoEm || status.verificadoEm;
    return (
      <div className="vx-card" style={{ padding: "12px 16px", marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <ShieldCheck size={18} color="var(--green)" />
        <span style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600 }}>WhatsApp verificado</span>
        <span className="vx-mut" style={{ fontSize: 12.5 }}>{formatarNumero(numero)}{em ? ` · desde ${dataCurta(em)}` : ""}</span>
      </div>
    );
  }

  const disponivel = status.recebimento || status.configurado;

  return (
    <div className="vx-card" style={{ padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <MessageCircle size={18} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Verifique seu WhatsApp</div>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "3px 0 12px", lineHeight: 1.55 }}>
            {status.numero
              ? <>Confirme que <b style={{ color: "var(--ink)" }}>{formatarNumero(status.numero)}</b> é seu. Use o número de WhatsApp Business que você usa para trabalhar.</>
              : "Cadastre seu WhatsApp, com DDD, em \"Editar perfil\" para poder verificar."}
          </p>

          {!disponivel && <p className="vx-mut" style={{ fontSize: 12.5, margin: 0 }}>A verificação pelo WhatsApp ainda não está disponível. Tente mais tarde.</p>}

          {status.numero && status.recebimento && !status.recebida && !pendente && (
            <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" style={{ minHeight: 44 }} onClick={iniciarRecebida} disabled={ocupado}>
              {ocupado ? "Preparando…" : "Verificar pelo WhatsApp"}
            </button>
          )}

          {status.recebida && (
            <div style={{ display: "grid", gap: 10 }}>
              <p style={{ fontSize: 13, color: "var(--ink)", margin: 0, lineHeight: 1.55 }}>
                Toque no botão abaixo. O WhatsApp abre com a mensagem pronta: é só <b>enviar</b>, <b>do número {formatarNumero(status.numero)}</b>.
                A verificação conclui aqui sozinha quando a mensagem chegar.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <a className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} href={status.recebida.link} target="_blank" rel="noreferrer">Abrir WhatsApp e enviar</a>
                <span className="vx-mut" style={{ fontSize: 12.5 }}>Aguardando sua mensagem…</span>
              </div>
              <p className="vx-mut" style={{ fontSize: 12, margin: 0 }}>
                Se o botão não abrir, envie para o WhatsApp da RYCS: <span className="vx-mono" style={{ color: "var(--ink)" }}>{status.recebida.texto}</span>
              </p>
            </div>
          )}

          {status.numero && !status.recebimento && status.configurado && !pendente && (
            <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" style={{ minHeight: 44 }} onClick={enviarCodigo} disabled={ocupado}>
              {ocupado ? "Enviando…" : "Receber código"}
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
              <button type="submit" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} disabled={ocupado || codigo.length !== CODIGO_TAMANHO}>
                {ocupado ? "Confirmando…" : "Confirmar"}
              </button>
              <button type="button" className="vx-btn vx-btn-ghost" style={{ minHeight: 44 }} onClick={enviarCodigo} disabled={ocupado || esperaReenvio > 0}>
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
