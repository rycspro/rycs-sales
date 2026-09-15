import { useState } from "react";
import { Campo } from "../ui.jsx";
import Termos from "./Termos.jsx";
import MolduraAuth from "./MolduraAuth.jsx";
import { ROTAS, navegar, parametro } from "../../lib/rotas.js";

// Ambiente de cadastro da empresa.
//
// Produto, ticket e ICP já eram aceitos pelo /auth/register e nunca eram
// pedidos: o formulário único não tinha onde colocá-los sem mostrá-los ao
// profissional. Eram gravados vazios e a empresa descobria depois, dentro do
// painel, que precisava preencher tudo antes de publicar a primeira campanha.

export default function CadastroEmpresa({ onRegister }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [produto, setProduto] = useState("");
  const [ticket, setTicket] = useState("");
  const [icp, setIcp] = useState("");
  const [indicacao, setIndicacao] = useState(() => (parametro("ref") || "").toUpperCase());
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!aceitouTermos) return;
    setLoading(true);
    await onRegister({
      role: "empresa", nome, email, senha, produto, ticket, icp,
      aceitouTermos: true, indicacao: indicacao || undefined,
    });
    setLoading(false);
  };

  if (showTermos) return (
    <Termos onAceitar={() => { setAceitouTermos(true); setShowTermos(false); }} onVoltar={() => setShowTermos(false)} />
  );

  return (
    <MolduraAuth
      tarja="Empresa contratante"
      titulo="Crie a conta da sua empresa"
      subtitulo="Publique campanhas, receba profissionais já triados e pague por ação verificada — sem contratação e sem custo fixo."
      rodape={
        <>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navegar(ROTAS.login)}>Já tenho conta — entrar</button>
          <div style={{ marginTop: 4 }}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navegar(ROTAS.cadastroVendedor)} style={{ fontSize: 12.5 }}>
              Sou profissional e quero vender
            </button>
          </div>
        </>
      }
    >
      <form onSubmit={submit}>
        <Campo label="Nome da empresa">
          <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como aparece para os profissionais" required />
        </Campo>
        <Campo label="E-mail corporativo">
          <input className="vx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@suaempresa.com.br" required />
        </Campo>
        <Campo label="Senha">
          <input className="vx-input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
        </Campo>

        <Campo label="O que a empresa vende">
          <input className="vx-input" value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex.: CRM para distribuidoras" />
        </Campo>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Campo label="Ticket médio">
              <input className="vx-input" value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="Ex.: R$ 1.200/mês" />
            </Campo>
          </div>
          <div style={{ flex: 1 }}>
            <Campo label="Cliente ideal">
              <input className="vx-input" value={icp} onChange={(e) => setIcp(e.target.value)} placeholder="Ex.: PMEs de 20 a 200 func." />
            </Campo>
          </div>
        </div>
        <p className="vx-mut" style={{ fontSize: 12, marginTop: -4, marginBottom: 12, lineHeight: 1.5 }}>
          Esses três campos alimentam o direcionamento das campanhas. Dá para ajustar depois, no painel da empresa.
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
          {loading ? "Criando…" : "Criar conta da empresa"}
        </button>
      </form>

      <hr className="vx-sep" />
      <div className="vx-mut" style={{ fontSize: 12.3, lineHeight: 1.6 }}>
        <b style={{ color: "var(--text-2)" }}>O que acontece depois:</b> a conta já entra operando. Você adiciona saldo,
        cria a primeira campanha e só é cobrado pelas ações que a auditoria aprovar.
      </div>
    </MolduraAuth>
  );
}
