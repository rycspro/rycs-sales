import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CheckCheck, FileText, GraduationCap, Handshake, Landmark, ShieldCheck, Ticket, Upload, Users } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { Vazio } from "../ui.jsx";
import { useI18n } from "../../lib/i18n.jsx";

// Cada tipo emitido pelo backend ganha ícone e rótulo. O tipo desconhecido
// não quebra a tela: cai no genérico e continua legível.
const TIPOS = {
  submissao: { nome: "Aprovações", Icon: ShieldCheck, tom: "brand" },
  parceria: { nome: "Parcerias", Icon: Handshake, tom: "indigo" },
  candidatura: { nome: "Candidaturas", Icon: Users, tom: "indigo" },
  deposito: { nome: "Financeiro", Icon: Landmark, tom: "brand" },
  pagamento: { nome: "Financeiro", Icon: Landmark, tom: "brand" },
  assinatura: { nome: "Assinatura", Icon: Ticket, tom: "amber" },
  indicacao: { nome: "Indicações", Icon: Handshake, tom: "amber" },
  academy: { nome: "Academy", Icon: GraduationCap, tom: "indigo" },
  relatorio: { nome: "Relatórios", Icon: FileText, tom: "muted" },
  importacao: { nome: "Importações", Icon: Upload, tom: "muted" },
  mensagem: { nome: "Mensagens", Icon: Bell, tom: "muted" },
};

const generico = { nome: "Geral", Icon: Bell, tom: "muted" };

export default function NotificacoesEmpresa({ aviso }) {
  const { t } = useI18n();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("todas");

  const carregar = async () => {
    setCarregando(true);
    setErro("");
    const r = await api("/notifications");
    setCarregando(false);
    if (!Array.isArray(r)) return setErro(r?.error || t("notif.loadError"));
    setLista(r);
  };

  useEffect(() => { carregar(); }, []);

  const marcarTodas = async () => {
    const r = await apiPatch("/notifications/read-all", {});
    if (r?.error) return aviso?.(r.error);
    setLista((l) => l.map((n) => ({ ...n, lida: 1 })));
    aviso?.(t("notif.allRead"));
  };

  const abrir = async (n) => {
    if (n.lida) return;
    await apiPatch(`/notifications/${n.id}`, {});
    setLista((l) => l.map((x) => x.id === n.id ? { ...x, lida: 1 } : x));
  };

  const naoLidas = lista.filter((n) => !n.lida).length;

  // As abas saem dos tipos que realmente chegaram, não de uma lista fixa:
  // um filtro que nunca tem resultado é ruído na tela.
  const abas = useMemo(() => {
    const presentes = [...new Set(lista.map((n) => n.tipo))];
    return [["todas", t("notif.all")], ["nao-lidas", `${t("notif.unread")}${naoLidas ? ` (${naoLidas})` : ""}`],
      ...presentes.map((t) => [t, (TIPOS[t] || generico).nome])];
  }, [lista, naoLidas]);

  const visiveis = lista.filter((n) => filtro === "todas" ? true : filtro === "nao-lidas" ? !n.lida : n.tipo === filtro);

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">{t("notif.hub")}</div>
          <h1 className="vx-disp">{t("notif.title")}</h1>
          <p>{t("notif.desc")}</p>
        </div>
        <button className="vx-btn" onClick={marcarTodas} disabled={!naoLidas}>
          <CheckCheck size={14} /> {t("notif.markAllRead")}
        </button>
      </div>

      <div className="vx-seg vx-subnav" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        {abas.map(([k, label]) => (
          <button key={k} data-on={filtro === k ? "1" : "0"} onClick={() => setFiltro(k)}>{label}</button>
        ))}
      </div>

      {carregando && <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-skeleton" style={{ height: 20, marginBottom: 10 }} />
        <div className="vx-skeleton" style={{ height: 20, marginBottom: 10 }} />
        <div className="vx-skeleton" style={{ height: 20 }} />
      </div>}

      {!carregando && erro && <div className="vx-notice vx-notice-amber">{erro}</div>}

      {!carregando && !erro && !visiveis.length && (
        <Vazio
          titulo={filtro === "nao-lidas" ? t("notif.nothingPending") : t("notif.noNotifications")}
          texto={filtro === "nao-lidas"
            ? t("notif.allReadDesc")
            : t("notif.emptyDesc")}
        />
      )}

      {!carregando && !erro && !!visiveis.length && (
        <div className="vx-grid">
          {visiveis.map((n) => {
            const t = TIPOS[n.tipo] || generico;
            return (
              <button
                key={n.id}
                onClick={() => abrir(n)}
                className="vx-card"
                style={{
                  padding: 15, display: "flex", gap: 12, alignItems: "flex-start",
                  textAlign: "left", width: "100%", cursor: n.lida ? "default" : "pointer",
                  borderLeft: n.lida ? "1px solid var(--border)" : "3px solid var(--brand)",
                }}
              >
                <div className="vx-stat-icon" style={{ background: `var(--${t.tom === "muted" ? "surface-2" : `${t.tom}-100`})`, flexShrink: 0 }}>
                  <t.Icon size={15} color={t.tom === "muted" ? "var(--muted)" : `var(--${t.tom})`} strokeWidth={2.2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="vx-row" style={{ gap: 8 }}>
                    <b style={{ fontSize: 13.5 }}>{n.titulo}</b>
                    <span className="vx-mut vx-mono" style={{ fontSize: 11, flexShrink: 0 }}>{dataCurta(n.criadoEm)}</span>
                  </div>
                  {n.corpo && <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 3, whiteSpace: "pre-wrap" }}>{n.corpo}</div>}
                  <span className="vx-chip" style={{ marginTop: 7 }}>{t.nome}</span>
                </div>
                {!n.lida && <span className="vx-badge vx-badge-brand" style={{ flexShrink: 0 }}>{t("notif.new")}</span>}
              </button>
            );
          })}
        </div>
      )}

      {!carregando && !erro && !!lista.length && (
        <div className="vx-chart-source">
          <BellOff size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
          {t("notif.footer")}
        </div>
      )}
    </div>
  );
}
