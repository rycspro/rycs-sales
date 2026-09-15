import MolduraAuth from "./MolduraAuth.jsx";
import { ROTAS, navegar } from "../../lib/rotas.js";

// Bifurcação para quem chega sem endereço específico.
//
// Os links diretos são o caminho normal — a landing manda cada botão para o
// ambiente certo. Esta tela existe para quem digitou /cadastro ou guardou um
// link antigo: melhor perguntar uma vez do que abrir o formulário errado.

const OPCOES = [
  {
    role: "vendedor", destino: ROTAS.cadastroVendedor,
    titulo: "Sou profissional de vendas",
    texto: "Quero atender campanhas de empresas e ser remunerado por ação verificada.",
    itens: ["Sem custo para participar", "Campanhas de várias empresas", "Saque via Pix a partir de R$ 10"],
    cta: "Criar conta de profissional",
  },
  {
    role: "empresa", destino: ROTAS.cadastroEmpresa,
    titulo: "Sou empresa",
    texto: "Quero uma força de vendas sob demanda, pagando só pelo que for entregue.",
    itens: ["Profissionais já triados", "Pagamento por ação aprovada", "Sem contratação nem custo fixo"],
    cta: "Criar conta da empresa",
  },
];

export default function EscolhaCadastro() {
  return (
    <MolduraAuth
      largura={760}
      tarja="Criar conta"
      titulo="Qual é o seu lado da operação?"
      subtitulo="Cada perfil tem um ambiente próprio. Escolha para abrir o cadastro certo."
      rodape={<button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navegar(ROTAS.login)}>Já tenho conta — entrar</button>}
    >
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {OPCOES.map((o) => (
          <div key={o.role} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column" }}>
            <div className="vx-disp" style={{ fontSize: 17 }}>{o.titulo}</div>
            <p className="vx-mut" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>{o.texto}</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.9, flex: 1 }}>
              {o.itens.map((i) => <li key={i}>• {i}</li>)}
            </ul>
            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }} onClick={() => navegar(o.destino)}>{o.cta}</button>
          </div>
        ))}
      </div>
    </MolduraAuth>
  );
}
