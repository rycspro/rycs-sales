import { useId, useState } from "react";
import { ArrowRight, MailCheck, Users, Zap } from "lucide-react";
import { CampoSenha } from "../ui.jsx";
import RecuperarSenha from "./RecuperarSenha.jsx";
import MolduraAuth from "./MolduraAuth.jsx";
import { api } from "../../lib/api.js";
import { ROTAS, navegar } from "../../lib/rotas.js";
import { SENHA_MIN_EMPRESA, validarSenhaEmpresa } from "../../../shared/onboarding.js";

// Página pública de entrada da empresa.
// Modo "inicio" — dois caminhos:
//   "Criar conta" → formulário simples (e-mail, senha, termos) + e-mail de confirmação.
//   "Iniciar vendas" → navega para /onboarding (fluxo de 6 etapas com EtapaAcesso).
// Registra eventos de funil para o analytics (criou_conta / iniciou_onboarding).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Opt({ titulo, descricao, itens, cta, onClick, icone: Icone, destaque = false }) {
  return (
    <div
      style={{
        border: `1.5px solid ${destaque ? "var(--brand)" : "var(--border)"}`,
        borderRadius: 14, padding: 20, display: "flex", flexDirection: "column",
        background: destaque ? "var(--brand-50)" : "var(--surface)",
        boxShadow: destaque ? "var(--shadow-brand)" : "var(--shadow-card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center",
          background: destaque ? "var(--brand)" : "var(--surface-2)",
          color: destaque ? "#fff" : "var(--brand)", flexShrink: 0,
        }}>
          <Icone size={18} strokeWidth={2.3} aria-hidden="true" />
        </div>
        <span className="vx-disp" style={{ fontSize: 16 }}>{titulo}</span>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.6 }}>{descricao}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.9, flex: 1 }}>
        {itens.map((i) => <li key={i}>• {i}</li>)}
      </ul>
      <button
        type="button"
        className={`vx-btn vx-btn-block${destaque ? " vx-btn-primary" : ""}`}
        style={{ minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
        onClick={onClick}
      >
        {cta} <ArrowRight size={15} strokeWidth={2.3} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function EntradaEmpresa() {
  const id = useId();
  const [modo, setModo] = useState("inicio"); // inicio | criar | link-enviado | recuperar
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [termos, setTermos] = useState(false);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);

  const iniciarVendas = () => {
    // Registra intenção e envia para o fluxo guiado (EtapaAcesso).
    api("/onboarding/evento", { evento: "iniciou_onboarding", dados: { caminho: "guiado" } });
    navegar(ROTAS.onboarding);
  };

  const enviarCriarConta = async (e) => {
    e.preventDefault();
    const novos = {};
    if (!EMAIL_RE.test(email.trim())) novos.email = "E-mail inválido.";
    const errSenha = validarSenhaEmpresa(senha);
    if (errSenha) novos.senha = errSenha;
    if (!termos) novos.termos = "Aceite os termos para continuar.";
    setErros(novos);
    if (Object.keys(novos).length) return;

    setErroGeral("");
    setSalvando(true);
    const r = await api("/onboarding/criar-conta", { email: email.trim().toLowerCase(), senha });
    setSalvando(false);

    if (!r || r.error) {
      if (r?.campo) setErros({ [r.campo]: r.error });
      else setErroGeral(r?.error || "Não foi possível criar a conta. Tente de novo.");
      return;
    }
    setModo("link-enviado");
  };

  if (modo === "recuperar") {
    return <RecuperarSenha onVoltar={() => setModo("criar")} />;
  }

  if (modo === "link-enviado") {
    return (
      <MolduraAuth
        tarja="Confirme seu e-mail"
        titulo="Link enviado!"
        subtitulo={`Enviamos um link de confirmação para ${email}. Clique nele para ativar sua conta.`}
      >
        <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "var(--brand-50)",
            display: "grid", placeItems: "center", margin: "0 auto 16px",
          }}>
            <MailCheck size={28} strokeWidth={1.8} color="var(--brand)" aria-hidden="true" />
          </div>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 20px", lineHeight: 1.6 }}>
            Verifique também a pasta de spam. O link expira em 24 horas.
          </p>
          <button
            className="vx-btn vx-btn-ghost vx-btn-sm"
            style={{ minHeight: 44, width: "100%" }}
            onClick={async () => {
              const r = await api("/onboarding/criar-conta/reenviar", { email });
              if (r?.error) setErroGeral(r.error);
            }}
          >
            Reenviar link
          </button>
          {erroGeral && <div className="vx-onb-erro" role="alert" style={{ marginTop: 10 }}>{erroGeral}</div>}
        </div>
      </MolduraAuth>
    );
  }

  if (modo === "criar") {
    return (
      <MolduraAuth
        tarja="Empresa"
        titulo="Criar sua conta"
        subtitulo="Acesso rápido à plataforma. Você vai preencher os dados da empresa depois."
        rodape={
          <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }}
            onClick={() => setModo("inicio")}>
            ← Voltar
          </button>
        }
      >
        <form onSubmit={enviarCriarConta} noValidate>
          {erroGeral && <div className="vx-onb-erro" role="alert" style={{ marginBottom: 14 }}>{erroGeral}</div>}

          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-email`}>E-mail</label>
            <input
              id={`${id}-email`} className="vx-input" type="email" autoComplete="email"
              placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)}
              aria-invalid={erros.email ? true : undefined} aria-describedby={erros.email ? `${id}-email-erro` : undefined}
              style={{ minHeight: 48 }}
            />
            {erros.email && <div id={`${id}-email-erro`} className="vx-onb-campo vx-onb-erro" role="alert">{erros.email}</div>}
          </div>

          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-senha`}>Senha</label>
            <CampoSenha
              id={`${id}-senha`} value={senha} onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password" minLength={SENHA_MIN_EMPRESA}
              invalido={!!erros.senha} descricao={erros.senha ? `${id}-senha-erro` : `${id}-senha-dica`}
            />
            <div id={`${id}-senha-dica`} className="vx-onb-dica">Mínimo de {SENHA_MIN_EMPRESA} caracteres.</div>
            {erros.senha && <div id={`${id}-senha-erro`} className="vx-onb-erro" role="alert">{erros.senha}</div>}
          </div>

          <div className="vx-onb-campo">
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minHeight: 44, fontSize: 13.5 }}>
              <input
                type="checkbox" checked={termos} onChange={(e) => setTermos(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--brand)", flexShrink: 0 }}
                aria-describedby={erros.termos ? `${id}-termos-erro` : undefined}
              />
              Concordo com os{" "}
              <a
                href="https://rycs.pro/termos" target="_blank" rel="noreferrer"
                className="vx-onb-link" style={{ fontSize: "inherit" }}
              >
                Termos de Uso
              </a>{" "}e a{" "}
              <a
                href="https://rycs.pro/privacidade" target="_blank" rel="noreferrer"
                className="vx-onb-link" style={{ fontSize: "inherit" }}
              >
                Política de Privacidade
              </a>
            </label>
            {erros.termos && <div id={`${id}-termos-erro`} className="vx-onb-erro" role="alert">{erros.termos}</div>}
          </div>

          <button
            type="submit"
            className="vx-btn vx-btn-primary vx-btn-block"
            style={{ minHeight: 52, marginTop: 8 }}
            disabled={salvando}
          >
            {salvando ? "Criando conta…" : "Criar conta e confirmar e-mail"}
          </button>

          <p style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", marginTop: 12 }}>
            Já tem conta?{" "}
            <button type="button" className="vx-onb-link" onClick={() => navegar(ROTAS.login)}>
              Entrar
            </button>
            {" · "}
            <button type="button" className="vx-onb-link" onClick={() => setModo("recuperar")}>
              Esqueci minha senha
            </button>
          </p>
        </form>
      </MolduraAuth>
    );
  }

  // modo === "inicio"
  return (
    <MolduraAuth
      tarja="Empresa"
      titulo="Como você quer começar?"
      subtitulo="Escolha o caminho que faz mais sentido para você agora."
      rodape={
        <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }}
          onClick={() => navegar(ROTAS.login)}>
          Já tenho conta — entrar
        </button>
      }
    >
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <Opt
          icone={Users}
          titulo="Criar conta"
          descricao="Crie seu acesso agora e explore a plataforma. Você preenche os dados da empresa quando quiser."
          itens={["Acesso imediato após confirmação", "Sem compromisso", "Configure no seu ritmo"]}
          cta="Criar conta"
          onClick={() => setModo("criar")}
        />
        <Opt
          icone={Zap}
          titulo="Iniciar vendas"
          descricao="Configure tudo de uma vez: empresa, materiais, IA e plano. Pronto para sua primeira campanha."
          itens={["Guia passo a passo", "IA cria seu script de vendas", "Campanha publicada ao final"]}
          cta="Iniciar vendas agora"
          destaque
          onClick={iniciarVendas}
        />
      </div>
    </MolduraAuth>
  );
}
