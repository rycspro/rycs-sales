import { useState } from "react";
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { money } from "../../lib/utils.js";
import { ACOES, TAXA } from "../../lib/constants.js";
import { apiPatch } from "../../lib/api.js";
import { useI18n } from "../../lib/i18n.jsx";
import Curso from "./Curso.jsx";
import Tarefas from "./Tarefas.jsx";
import MeusEnvios from "./MeusEnvios.jsx";
import Chat from "../Chat.jsx";

function pedirRevisaoHumana(setDb, aviso, t, sub) {
  const liquido = +(sub.valor * (1 - TAXA)).toFixed(2);
  const motivo = "Vendedor contestou e pediu revisão humana. Motivo original da IA: " + (sub.motivo || "—");
  apiPatch(`/submissions/${sub.id}`, { status: "revisao", motivo });
  setDb((d) => {
    const seller = d.sellers.find((s) => s.id === sub.sellerId);
    if (seller) apiPatch(`/sellers/${seller.id}`, { pendente: +(seller.pendente + liquido).toFixed(2) });
    return {
      ...d,
      submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, status: "revisao", motivo } : s),
      sellers: d.sellers.map((s) => s.id === sub.sellerId ? { ...s, pendente: +(s.pendente + liquido).toFixed(2) } : s),
    };
  });
  aviso(t("seller.submissions.sentForReview"));
}

function TreinamentoCampanha({ campanha, t }) {
  const [aberto, setAberto] = useState(false);
  const modulos = campanha?.treinamento || [];
  if (!modulos.length) return null;
  return (
    <div className="vx-card" style={{ marginBottom: 14, padding: 0, overflow: "hidden" }}>
      <button
        style={{ width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
        onClick={() => setAberto((v) => !v)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 13.5 }}>
          <BookOpen size={14} color="var(--brand)" /> {t("seller.workspace.campaignTraining")}
          <span className="vx-chip" style={{ fontSize: 11 }}>{t("seller.workspace.modulesCount", { count: modulos.length })}</span>
        </span>
        {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {aberto && (
        <div style={{ padding: "0 16px 14px" }}>
          {modulos.map((m, i) => (
            <div key={m.id || i} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
              <b style={{ fontSize: 13 }}>{m.titulo}</b>
              <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4, whiteSpace: "pre-wrap" }}>{m.conteudo}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampanhaHeader({ campanha, empresa, t }) {
  const tarefas = campanha?.tarefas || {};
  const tiposAtivos = Object.entries(tarefas).filter(([, v]) => v > 0);
  return (
    <div className="vx-card" style={{ padding: 16, marginBottom: 14, background: "var(--surface-2)" }}>
      <div className="vx-row" style={{ marginBottom: 4, flexWrap: "wrap", gap: 6 }}>
        <div>
          <div className="vx-eyebrow">{empresa.nome}</div>
          <div className="vx-disp" style={{ fontSize: 18, margin: "2px 0" }}>{campanha.titulo}</div>
        </div>
        {campanha.funcao && <span className="vx-chip">{campanha.funcao.toUpperCase()}</span>}
      </div>
      {campanha.descricao && <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 10px" }}>{campanha.descricao}</p>}
      {campanha.requisitos && (
        <div className="vx-notice" style={{ marginBottom: 10, fontSize: 12 }}>
          <b>{t("seller.workspace.requirements")}:</b> {campanha.requisitos}
        </div>
      )}
      {tiposAtivos.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tiposAtivos.map(([tipo, valor]) => (
            <span key={tipo} className="vx-chip vx-mono" style={{ fontSize: 11 }}>
              {ACOES[tipo]?.nome || tipo} <b style={{ color: "var(--brand)" }}>{money(valor)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Workspace({ campanha, empresa, eu, db, setDb, up, aviso, voltar, recarregar }) {
  const { t } = useI18n();
  const [aba, setAba] = useState("tarefas");
  const feitos = eu.curso?.[empresa.id];
  const todosFeitos = feitos === "todos" || (Array.isArray(feitos) && feitos.length === empresa.curso.length);

  const semCampanha = !campanha;

  const TABS = [["tarefas", t("seller.workspace.tabs.tasks")], ["curso", t("seller.workspace.tabs.companyCourse")], ["envios", t("seller.workspace.tabs.mySubmissions")], ["chat", t("seller.workspace.tabs.chat")]];

  return (
    <div className="vx-fade">
      <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 12, marginLeft: -8 }} onClick={voltar}>
        <ArrowLeft size={14} /> {t("seller.workspace.campaigns")}
      </button>

      {campanha
        ? <CampanhaHeader campanha={campanha} empresa={empresa} t={t} />
        : <div className="vx-row" style={{ marginBottom: 12 }}>
            <h2 className="vx-disp" style={{ fontSize: 22, margin: 0 }}>{empresa.nome}</h2>
            <span className="vx-chip vx-mono">{t("seller.workspace.balance")} {money(empresa.saldo)}</span>
          </div>}

      {campanha && <TreinamentoCampanha campanha={campanha} t={t} />}

      <div className="vx-tabs" style={{ margin: "4px 0 18px" }}>
        {TABS.map(([k, label]) => (
          <button key={k} className="vx-tab" data-on={aba === k ? "1" : "0"} onClick={() => setAba(k)}>{label}</button>
        ))}
      </div>

      {aba === "curso" && <Curso empresa={empresa} eu={eu} up={up} aviso={aviso} />}
      {aba === "tarefas" && (
        semCampanha
          ? <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
              <BookOpen size={24} color="var(--muted)" />
              <p className="vx-mut" style={{ marginTop: 10 }}>{t("seller.workspace.noCampaignMsg")}</p>
              <button className="vx-btn vx-btn-sm" style={{ marginTop: 8 }} onClick={voltar}>{t("seller.workspace.viewCampaigns")}</button>
            </div>
          : <Tarefas campanha={campanha} empresa={empresa} eu={eu} db={db} setDb={setDb} aviso={aviso} liberado={true} irCurso={() => setAba("curso")} recarregar={recarregar} />
      )}
      {aba === "envios" && <MeusEnvios empresa={empresa} eu={eu} db={db} pedirRevisao={(sub) => pedirRevisaoHumana(setDb, aviso, t, sub)} />}
      {aba === "chat" && <Chat empresa={empresa} sellerId={eu.id} db={db} up={up} de="vendedor" />}
    </div>
  );
}
