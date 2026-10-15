import { useEffect, useId, useState } from "react";
import { MailCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { REENVIO_RESET_MS } from "../../../shared/onboarding.js";

// Recuperação de senha na mesma tela do login: pedir o link, confirmar o
// envio e reenviar. O servidor responde igual exista ou não o e-mail, e
// também segura reenvios em sequência; o contador aqui só evita o clique
// que não faria nada.

export default function RecuperarSenha({ emailInicial = "", onVoltar }) {
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
    if (!r || r.error) { setErro(r?.error || "Não foi possível enviar agora. Tente de novo."); return; }
    setEnviado(true);
    setReenviado(reenvio);
    setLiberaEm(Date.now() + REENVIO_RESET_MS);
    setAgora(Date.now());
  };

  if (enviado) return (
    <div>
      <div className="vx-onb-icone" aria-hidden="true"><MailCheck size={22} /></div>
      <h2 className="vx-disp vx-onb-card-titulo">Link enviado</h2>
      <p className="vx-mut vx-onb-card-apoio">
        Abra o e-mail e toque no link para criar sua nova senha. Se não encontrar, olhe na caixa de spam.
      </p>
      <div aria-live="polite">
        {reenviado && <div className="vx-onb-ok">Enviamos um novo link agora.</div>}
        {erro && <div className="vx-onb-erro" role="alert">{erro}</div>}
      </div>
      <button type="button" className="vx-btn vx-btn-block vx-onb-btn" onClick={() => enviar(true)} disabled={enviando || restante > 0}>
        {enviando ? "Enviando…" : restante > 0 ? `Reenviar link em ${restante}s` : "Reenviar link"}
      </button>
      <button type="button" className="vx-btn vx-btn-ghost vx-btn-block vx-onb-btn" onClick={onVoltar}>Voltar ao login</button>
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); enviar(false); }} noValidate={false}>
      <h2 className="vx-disp vx-onb-card-titulo">Recuperar senha</h2>
      <p className="vx-mut vx-onb-card-apoio">Informe seu e-mail e enviamos um link para você criar uma nova senha.</p>
      <div className="vx-onb-campo">
        <label className="vx-label" htmlFor={idEmail}>E-mail</label>
        <input id={idEmail} className="vx-input" type="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {erro && <div className="vx-onb-erro" role="alert">{erro}</div>}
      <button className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar link de recuperação"}
      </button>
      <button type="button" className="vx-btn vx-btn-ghost vx-btn-block vx-onb-btn" onClick={onVoltar}>Voltar ao login</button>
    </form>
  );
}
