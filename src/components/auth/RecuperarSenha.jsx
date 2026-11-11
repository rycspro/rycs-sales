import { useEffect, useId, useState } from "react";
import { MailCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { REENVIO_RESET_MS } from "../../../shared/onboarding.js";
import { useI18n } from "../../lib/i18n.jsx";

// Recuperação de senha na mesma tela do login: pedir o link, confirmar o
// envio e reenviar. O servidor responde igual exista ou não o e-mail, e
// também segura reenvios em sequência; o contador aqui só evita o clique
// que não faria nada.

export default function RecuperarSenha({ emailInicial = "", onVoltar }) {
  const { t } = useI18n();
  const idEmail = useId();
  const [email, setEmail] = useState(emailInicial);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const [erro, setErro] = useState("");
  const [liberaEm, setLiberaEm] = useState(0);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    if (!liberaEm) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [liberaEm]);

  const restante = Math.max(0, Math.ceil((liberaEm - agora) / 1000));

  const enviar = async (reenvio = false) => {
    setErro("");
    setEnviando(true);
    const r = await api("/auth/forgot-password", { email });
    setEnviando(false);
    if (!r || r.error) { setErro(r?.error || t("auth.recover.sendFailed")); return; }
    setEnviado(true);
    setReenviado(reenvio);
    setLiberaEm(Date.now() + REENVIO_RESET_MS);
    setAgora(Date.now());
  };

  if (enviado) return (
    <div>
      <div className="vx-onb-icone" aria-hidden="true"><MailCheck size={22} /></div>
      <h2 className="vx-disp vx-onb-card-titulo">{t("auth.recover.linkSent")}</h2>
      <p className="vx-mut vx-onb-card-apoio">
        {t("auth.recover.linkSentDesc")}
      </p>
      <div aria-live="polite">
        {reenviado && <div className="vx-onb-ok">{t("auth.recover.newLinkSent")}</div>}
        {erro && <div className="vx-onb-erro" role="alert">{erro}</div>}
      </div>
      <button type="button" className="vx-btn vx-btn-block vx-onb-btn" onClick={() => enviar(true)} disabled={enviando || restante > 0}>
        {enviando ? t("auth.recover.sending") : restante > 0 ? t("auth.recover.resendIn", { s: restante }) : t("auth.recover.resendLink")}
      </button>
      <button type="button" className="vx-btn vx-btn-ghost vx-btn-block vx-onb-btn" onClick={onVoltar}>{t("auth.recover.backToLogin")}</button>
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); enviar(false); }} noValidate={false}>
      <h2 className="vx-disp vx-onb-card-titulo">{t("auth.recover.title")}</h2>
      <p className="vx-mut vx-onb-card-apoio">{t("auth.recover.desc")}</p>
      <div className="vx-onb-campo">
        <label className="vx-label" htmlFor={idEmail}>{t("login.email")}</label>
        <input id={idEmail} className="vx-input" type="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {erro && <div className="vx-onb-erro" role="alert">{erro}</div>}
      <button className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" type="submit" disabled={enviando}>
        {enviando ? t("auth.recover.sending") : t("auth.recover.sendLink")}
      </button>
      <button type="button" className="vx-btn vx-btn-ghost vx-btn-block vx-onb-btn" onClick={onVoltar}>{t("auth.recover.backToLogin")}</button>
    </form>
  );
}
