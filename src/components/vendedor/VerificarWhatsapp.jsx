import { useEffect, useId, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { CODIGO_TAMANHO, formatarNumero, whatsVerificado } from "../../../shared/whatsappVerificacao.js";

// Lucide não traz o logo de marca do WhatsApp — usamos o glifo oficial.
function IconeWhatsapp({ size = 22, cor = "#25D366" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={cor} aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

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
      <div className="vx-card" style={{ padding: "12px 16px", marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: "rgba(37,211,102,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconeWhatsapp size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            WhatsApp verificado <ShieldCheck size={14} color="var(--green)" />
          </div>
          <div className="vx-mut" style={{ fontSize: 12.5 }}>{formatarNumero(numero)}{em ? ` · desde ${dataCurta(em)}` : ""}</div>
        </div>
      </div>
    );
  }

  const disponivel = status.recebimento || status.configurado;

  return (
    <div className="vx-card" style={{ padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "rgba(37,211,102,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconeWhatsapp size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>Verifique seu WhatsApp</div>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "4px 0 12px", lineHeight: 1.55 }}>
            {status.numero
              ? <>Confirme que <b style={{ color: "var(--ink)" }}>{formatarNumero(status.numero)}</b> é seu. Use o número de WhatsApp Business que você usa para trabalhar.</>
              : "Cadastre seu WhatsApp, com DDD, em \"Editar perfil\" para poder verificar."}
          </p>

          {!disponivel && <p className="vx-mut" style={{ fontSize: 12.5, margin: 0 }}>A verificação pelo WhatsApp ainda não está disponível. Tente mais tarde.</p>}
        </div>

        {/* Ação no canto direito do card */}
        {(status.numero || erro) && (
          <div style={{ marginLeft: "auto", flexShrink: 0 }}>
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
        )}
      </div>
    </div>
  );
}
