import { useState } from "react";
import { Campo } from "../ui.jsx";
import Termos from "./Termos.jsx";
import MolduraAuth from "./MolduraAuth.jsx";
import { FUNCOES, ORDEM_FUNCOES } from "../../../shared/funcoes.js";
import { ROTAS, navegar, parametro } from "../../lib/rotas.js";

// Ambiente de cadastro do profissional.
//
// Separado do cadastro de empresa porque as duas contas não têm nada em comum
// além de e-mail e senha: o profissional informa função, cidade e WhatsApp e
// entra em triagem; a empresa informa produto e ticket e entra operando. Um
// formulário único com um seletor no topo obrigava as duas a lerem campos que
// não são suas — e só conseguia pedir o que servisse para ambas, que é o mínimo.

export default function CadastroProfissional({ onRegister }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [whats, setWhats] = useState("");
  const [cidade, setCidade] = useState("");
  const [perfil, setPerfil] = useState("sdr");
  const [indicacao, setIndicacao] = useState(() => (parametro("ref") || "").toUpperCase());
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!aceitouTermos) return;
    setLoading(true);
    await onRegister({
      role: "vendedor", nome, email, senha, whats, cidade, perfil,
      aceitouTermos: true, indicacao: indicacao || undefined,
    });
    setLoading(false);
  };

  if (showTermos) return (
    <Termos onAceitar={() => { setAceitouTermos(true); setShowTermos(false); }} onVoltar={() => setShowTermos(false)} />
  );

  return (
    <MolduraAuth
      tarja="Profissional de vendas"
      titulo="Crie sua conta de profissional"
      subtitulo="Você recebe campanhas de empresas, registra suas ações e é remunerado por ação verificada."
      rodape={
        <>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navegar(ROTAS.login)}>Já tenho conta — entrar</button>
          <div style={{ marginTop: 4 }}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navegar(ROTAS.cadastroEmpresa)} style={{ fontSize: 12.5 }}>
              Sou empresa e quero contratar
            </button>
          </div>
        </>
      }
    >
      <form onSubmit={submit}>
        <Campo label="Seu nome">
          <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você quer ser chamado" required />
        </Campo>
        <Campo label="E-mail">
          <input className="vx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
        </Campo>
        <Campo label="Senha">
          <input className="vx-input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
        </Campo>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Campo label="WhatsApp">
              <input className="vx-input" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(11) 90000-0000" inputMode="tel" />
            </Campo>
          </div>
          <div style={{ flex: 1 }}>
            <Campo label="Cidade">
              <input className="vx-input" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="São Paulo, SP" />
            </Campo>
          </div>
        </div>

        <Campo label="Como você atua hoje">
          <select className="vx-input" value={perfil} onChange={(e) => setPerfil(e.target.value)}>
            {ORDEM_FUNCOES.map((k) => (
              <option key={k} value={k}>{FUNCOES[k].nome} — {FUNCOES[k].completo}</option>
            ))}
          </select>
        </Campo>
        <p className="vx-mut" style={{ fontSize: 12, marginTop: -4, marginBottom: 12, lineHeight: 1.5 }}>
          {FUNCOES[perfil]?.descricao}
        </p>

        <Campo label="Código de indicação (opcional)">
          <input className="vx-input vx-mono" value={indicacao} placeholder="Ex.: SXMD9JG"
            onChange={(e) => setIndicacao(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
            style={{ letterSpacing: ".08em" }} />
        </Campo>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "12px 0", cursor: "pointer", fontSize: 12.5, color: "var(--text-2)" }}>
          <input type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)} style={{ marginTop: 2 }} />
          <span>
            Li e aceito os{" "}
            <button type="button" onClick={() => setShowTermos(true)} style={{ color: "var(--brand)", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "inherit" }}>
              Termos de Uso e Política de Privacidade
            </button>
          </span>
        </label>

        <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading || !aceitouTermos}>
          {loading ? "Criando…" : "Criar conta de profissional"}
        </button>
      </form>

      <hr className="vx-sep" />
      <div className="vx-mut" style={{ fontSize: 12.3, lineHeight: 1.6 }}>
        <b style={{ color: "var(--text-2)" }}>O que acontece depois:</b> sua conta passa por uma triagem curta antes de
        liberar as campanhas. Se o resultado for parcial, você é direcionado ao RYCS Academy para completar a trilha e
        tentar de novo.
      </div>
    </MolduraAuth>
  );
}
