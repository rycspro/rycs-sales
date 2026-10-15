import { useEffect, useId, useState } from "react";
import { CampoSenha } from "../ui.jsx";
import Termos from "../auth/Termos.jsx";
import RecuperarSenha from "../auth/RecuperarSenha.jsx";
import MolduraOnboarding from "./MolduraOnboarding.jsx";
import { api } from "../../lib/api.js";
import { parametro, limparConviteOnboarding } from "../../lib/rotas.js";
import { ETAPAS, SENHA_MIN_EMPRESA, validarSenhaEmpresa, normalizarWhatsapp } from "../../../shared/onboarding.js";

// Etapa 1 do onboarding para quem ainda não tem conta: criar o acesso
// (e-mail, senha e WhatsApp), entrar com uma conta existente ou recuperar a
// senha, tudo na mesma tela. Quem chega por convite do admin tem o e-mail
// travado no do convite.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Máscara enquanto digita: (11) 91234-5678.
function mascaraWhatsapp(valor) {
  const d = String(valor || "").replace(/\D/g, "").replace(/^55(?=\d{10,})/, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function Campo({ id, label, erro, dica, children }) {
  return (
    <div className="vx-onb-campo">
      <label className="vx-label" htmlFor={id}>{label}</label>
      {children}
      {dica && <div id={`${id}-dica`} className="vx-onb-dica">{dica}</div>}
      {erro && <div id={`${id}-erro`} className="vx-onb-erro" role="alert">{erro}</div>}
    </div>
  );
}

export default function EtapaAcesso({ onRegister, onLogin, conviteToken = null }) {
  const id = useId();
  const [modo, setModo] = useState("cadastro"); // cadastro | login | recuperar | termos
  const [voltarPara, setVoltarPara] = useState("cadastro");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [indicacao, setIndicacao] = useState(() => (parametro("ref") || "").toUpperCase());
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Convite: null = sem convite; { carregando } enquanto consulta.
  const [convite, setConvite] = useState(conviteToken ? { carregando: true } : null);
  useEffect(() => {
    if (!conviteToken) return;
    let vivo = true;
    api(`/onboarding/convites/${encodeURIComponent(conviteToken)}`).then((r) => {
      if (!vivo) return;
      if (r?.ok) { setConvite({ ok: true, email: r.email, trialDias: r.trialDias }); setEmail(r.email); }
      else { setConvite({ ok: false, erro: r?.error || "Não foi possível validar o convite." }); limparConviteOnboarding(); }
    });
    return () => { vivo = false; };
  }, [conviteToken]);
  const conviteValido = convite?.ok === true;

  const limparErro = (campo) => setErros((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  const trocarModo = (novo) => { setErros({}); setErroGeral(""); setModo(novo); };

  const validar = () => {
    const e = {};
    if (!EMAIL_RE.test(email.trim())) e.email = "Informe um e-mail válido.";
    if (modo === "cadastro") {
      const s = validarSenhaEmpresa(senha);
      if (s) e.senha = s;
      if (!normalizarWhatsapp(whatsapp)) e.whatsapp = "Informe um WhatsApp válido, com DDD.";
    } else if (!senha) e.senha = "Informe sua senha.";
    setErros(e);
    return !Object.keys(e).length;
  };

  const enviar = async (ev) => {
    ev.preventDefault();
    setErroGeral("");
    if (!validar()) return;
    setSalvando(true);
    if (modo === "cadastro") {
      const r = await onRegister({
        role: "empresa", email: email.trim(), senha, whats: whatsapp,
        aceitouTermos: true, indicacao: indicacao || undefined,
        convite: conviteValido ? conviteToken : undefined,
      });
      setSalvando(false);
      if (r?.ok) { limparConviteOnboarding(); return; }
      if (r?.campo) setErros({ [r.campo]: r.error });
      else setErroGeral(r?.error || "Não foi possível criar o acesso. Tente de novo.");
      return;
    }
    const r = await onLogin(email.trim(), senha);
    setSalvando(false);
    if (!r?.ok) setErroGeral(r?.error || "Não foi possível entrar. Tente de novo.");
  };

  if (modo === "termos") return <Termos onAceitar={() => setModo(voltarPara)} onVoltar={() => setModo(voltarPara)} />;

  const trial = conviteValido && convite.trialDias > 0 ? convite.trialDias : 0;
  const proximos = ETAPAS.slice(1).map((e) => ({
    ...e,
    texto: {
      empresa: "Perfil da empresa",
      academy: "Marketing Academy: seus materiais",
      ia: "A IA monta tudo sozinha",
      plano: trial ? `Plano com ${trial} dias grátis` : "Plano e pagamento",
      campanha: "Sua primeira campanha no ar",
    }[e.chave],
  }));

  const props = (nome) => ({
    "aria-invalid": erros[nome] ? true : undefined,
    "aria-describedby": [erros[nome] && `${id}-${nome}-erro`, `${id}-${nome}-dica`].filter(Boolean).join(" ") || undefined,
  });

  return (
    <MolduraOnboarding etapas={{}} ativa="acesso">
      <div className="vx-onb-duas">
        <section className="vx-onb-hero">
          <div className="vx-onb-eyebrow">Passo 1 de 6</div>
          <h1 className="vx-disp">Crie seu acesso e conecte sua empresa a profissionais de vendas.</h1>
          <p>Em poucos passos a IA conhece o seu negócio, cria o script e o funil de WhatsApp e leva você até a sua primeira campanha.</p>
          <ul className="vx-onb-proximos" aria-label="Próximos passos">
            {proximos.map((e) => <li key={e.chave}><span aria-hidden="true">{e.n}</span>{e.texto}</li>)}
          </ul>
        </section>

        <section className="vx-onb-card" aria-live="polite">
          {modo === "recuperar" ? (
            <RecuperarSenha emailInicial={email} onVoltar={() => trocarModo("login")} />
          ) : (
            <form onSubmit={enviar} noValidate>
              <h2 className="vx-disp vx-onb-card-titulo">{modo === "cadastro" ? "Crie seu acesso" : "Acesse sua conta"}</h2>
              <p className="vx-mut vx-onb-card-apoio">
                {modo === "cadastro" ? "Use seu e-mail, uma senha e o WhatsApp da empresa para começar." : "Use seu e-mail e sua senha para continuar o cadastro."}
              </p>

              {convite?.carregando && <div className="vx-onb-aviso">Conferindo o convite…</div>}
              {conviteValido && (
                <div className="vx-onb-aviso">
                  Convite da RYCS para <b>{convite.email}</b>.{trial ? ` Inclui ${trial} dias grátis no plano escolhido.` : ""}
                </div>
              )}
              {convite?.ok === false && <div className="vx-onb-erro" role="alert">{convite.erro}</div>}

              <Campo id={`${id}-email`} label="E-mail" erro={erros.email}>
                <input id={`${id}-email`} className="vx-input" type="email" autoComplete="email" inputMode="email"
                  value={email} onChange={(e) => { setEmail(e.target.value); limparErro("email"); }} readOnly={conviteValido && modo === "cadastro"} {...props("email")} />
              </Campo>

              <Campo id={`${id}-senha`} label="Senha" erro={erros.senha}
                dica={modo === "cadastro" ? `Mínimo de ${SENHA_MIN_EMPRESA} caracteres. Toque no olho para ver a senha.` : "Toque no olho para ver a senha."}>
                <CampoSenha id={`${id}-senha`} value={senha} onChange={(e) => { setSenha(e.target.value); limparErro("senha"); }}
                  autoComplete={modo === "cadastro" ? "new-password" : "current-password"} required={false}
                  invalido={!!erros.senha} descricao={props("senha")["aria-describedby"]} />
              </Campo>

              {modo === "cadastro" && <>
                <Campo id={`${id}-whatsapp`} label="WhatsApp" erro={erros.whatsapp} dica="Com DDD. É por onde a RYCS fala com você sobre a operação.">
                  <input id={`${id}-whatsapp`} className="vx-input" type="tel" inputMode="numeric" autoComplete="tel-national"
                    placeholder="(11) 91234-5678" value={whatsapp} onChange={(e) => { setWhatsapp(mascaraWhatsapp(e.target.value)); limparErro("whatsapp"); }} {...props("whatsapp")} />
                </Campo>
                {indicacao && (
                  <Campo id={`${id}-indicacao`} label="Código de indicação">
                    <input id={`${id}-indicacao`} className="vx-input vx-mono" value={indicacao}
                      onChange={(e) => setIndicacao(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} />
                  </Campo>
                )}
              </>}

              {modo === "login" && (
                <button type="button" className="vx-onb-link" style={{ minHeight: 44 }} onClick={() => trocarModo("recuperar")}>
                  Esqueci minha senha
                </button>
              )}

              {erroGeral && <div className="vx-onb-erro" role="alert">{erroGeral}</div>}

              <button className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" type="submit" disabled={salvando || convite?.carregando}>
                {salvando ? (modo === "cadastro" ? "Criando acesso…" : "Entrando…") : "Continuar"}
              </button>

              <p className="vx-onb-termos">
                Ao continuar, você aceita os{" "}
                <button type="button" className="vx-onb-link" onClick={() => { setVoltarPara(modo); setModo("termos"); }}>Termos de Uso</button> da RYCS.
              </p>

              <hr className="vx-sep" />
              {modo === "cadastro"
                ? <button type="button" className="vx-btn vx-btn-ghost vx-btn-block vx-onb-btn" onClick={() => trocarModo("login")}>Já tenho conta — entrar</button>
                : <button type="button" className="vx-btn vx-btn-ghost vx-btn-block vx-onb-btn" onClick={() => trocarModo("cadastro")}>Ainda não tenho conta — criar acesso</button>}
            </form>
          )}
        </section>
      </div>
    </MolduraOnboarding>
  );
}
