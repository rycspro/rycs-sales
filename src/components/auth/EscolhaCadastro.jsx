import MolduraAuth from "./MolduraAuth.jsx";
import { ROTAS, navegar } from "../../lib/rotas.js";
import { useI18n } from "../../lib/i18n.jsx";

// Bifurcação para quem chega sem endereço específico.
//
// Os links diretos são o caminho normal — a landing manda cada botão para o
// ambiente certo. Esta tela existe para quem digitou /cadastro ou guardou um
// link antigo: melhor perguntar uma vez do que abrir o formulário errado.

function buildOpcoes(t) {
  return [
    {
      role: "vendedor", destino: ROTAS.cadastroVendedor,
      titulo: t("auth.choose.proTitle"),
      texto: t("auth.choose.proDesc"),
      itens: [t("auth.choose.proItem1"), t("auth.choose.proItem2"), t("auth.choose.proItem3")],
      cta: t("auth.register.createProAccount"),
    },
    {
      role: "empresa", destino: ROTAS.cadastroEmpresa,
      titulo: t("auth.choose.companyTitle"),
      texto: t("auth.choose.companyDesc"),
      itens: [t("auth.choose.companyItem1"), t("auth.choose.companyItem2"), t("auth.choose.companyItem3")],
      cta: t("auth.choose.createCompanyAccount"),
    },
  ];
}

export default function EscolhaCadastro() {
  const { t } = useI18n();
  const OPCOES = buildOpcoes(t);
  return (
    <MolduraAuth
      largura={760}
      tarja={t("auth.choose.createAccount")}
      titulo={t("auth.choose.whichSide")}
      subtitulo={t("auth.choose.whichSideDesc")}
      rodape={<button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navegar(ROTAS.login)}>{t("auth.register.hasAccount")}</button>}
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
