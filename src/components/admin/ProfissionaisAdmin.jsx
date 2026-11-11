import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { money, dataCurta } from "../../lib/utils.js";
import { Medidor, Excluir } from "../ui.jsx";
import { DossieProfissional } from "./Dossie.jsx";
import { useI18n } from "../../lib/i18n.jsx";

const PERFIS = { sdr: "SDR", closer: "Closer", "sem-exp": "Iniciante", bdr: "BDR", pap: "PAP" };
const STATUS_TONE = { aprovado: "brand", parcial: "brand", analise: "amber", triagem: "amber", recusado: "red" };

export default function ProfissionaisAdmin({ db, up, aviso }) {
  const { t } = useI18n();
  const STATUS_LABEL = { aprovado: t("admin.pros.active"), parcial: t("admin.pros.active"), analise: t("admin.pros.underReview"), triagem: t("admin.pros.triage"), recusado: t("admin.pros.rejected") };
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [expandido, setExpandido] = useState(null);

  const profissionais = useMemo(() => {
    let list = db.sellers.map((s) => {
      const subs = db.submissions.filter((sub) => sub.sellerId === s.id);
      const liberados = subs.filter((sub) => sub.status === "liberado");
      const totalGanho = liberados.reduce((a, sub) => a + (sub.liquido || sub.valor), 0);
      const empresas = Object.keys(s.aplicacoes || {}).filter((k) => s.aplicacoes[k] === "aprovado");
      return { ...s, subs: subs.length, liberados: liberados.length, totalGanho, empresasAtivas: empresas.length };
    });

    if (filtroStatus !== "todos") list = list.filter((s) => s.status === filtroStatus);
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter((s) => s.nome.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.cidade?.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.totalGanho - a.totalGanho);
  }, [db, busca, filtroStatus]);

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 22 }}>{t("admin.pros.title")}</div>
        <span className="vx-badge vx-badge-muted">{profissionais.length}</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--muted)" }} />
          <input className="vx-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("admin.pros.searchPlaceholder")} style={{ paddingLeft: 32 }} />
        </div>
        <div className="vx-seg">
          {[["todos", t("admin.pros.filterAll")], ["aprovado", t("admin.pros.filterActive")], ["triagem", t("admin.pros.filterNoEval")], ["recusado", t("admin.pros.filterSuspended")]].map(([k, label]) => (
            <button key={k} data-on={filtroStatus === k ? "1" : "0"} onClick={() => setFiltroStatus(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="vx-grid">
        {profissionais.map((s) => {
          const isOpen = expandido === s.id;
          return (
            <div key={s.id} className="vx-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                onClick={() => setExpandido(isOpen ? null : s.id)}>
                {/* A foto já vinha do servidor e a tela mostrava só a inicial.
                    Quem avalia um profissional quer ver a pessoa. */}
                {s.foto ? (
                  <img src={s.foto} alt={s.nome} style={{ width: 38, height: 38, borderRadius: 999, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)" }} />
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: 999, background: "var(--brand-50)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                    {s.nome.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <b style={{ fontSize: 14 }}>{s.nome}</b>
                    <span className={`vx-badge vx-badge-${STATUS_TONE[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                      {/* A nota da triagem é o número que sustentou a aprovação.
                          Estava no banco e não aparecia em lugar nenhum. */}
                      {s.scoreTriagem != null && ` · ${Number(s.scoreTriagem).toFixed(2)}%`}
                    </span>
                    <span className="vx-badge vx-badge-muted">{PERFIS[s.perfil] || s.perfil}</span>
                  </div>
                  <div className="vx-mut" style={{ fontSize: 12 }}>{s.email} · {s.cidade || "—"}</div>
                </div>
                <div style={{ textAlign: "right", marginRight: 8 }}>
                  <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700 }}>{money(s.totalGanho)}</div>
                  <div className="vx-mut" style={{ fontSize: 11 }}>{s.liberados} {t("admin.pros.actions")}</div>
                </div>
                <div className="vx-disp vx-mono" style={{ fontSize: 22, color: s.nota >= 80 ? "var(--brand)" : s.nota >= 50 ? "var(--amber)" : s.nota >= 30 ? "#c2410c" : "var(--red)" }}>{s.nota ?? 100}</div>
                {isOpen ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
              </div>

              {isOpen && (
                <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--border)" }}>
                  <div className="vx-grid vx-g4" style={{ marginTop: 14, fontSize: 12.5 }}>
                    <div><span className="vx-mut">{t("admin.pros.available")}</span><div className="vx-mono" style={{ fontWeight: 600 }}>{money(s.disponivel)}</div></div>
                    <div><span className="vx-mut">{t("admin.pros.pending")}</span><div className="vx-mono" style={{ fontWeight: 600 }}>{money(s.pendente)}</div></div>
                    <div><span className="vx-mut">{t("admin.pros.withdrawn")}</span><div className="vx-mono" style={{ fontWeight: 600 }}>{money(s.sacado)}</div></div>
                    <div><span className="vx-mut">{t("admin.pros.activeCompanies")}</span><div style={{ fontWeight: 600 }}>{s.empresasAtivas}</div></div>
                  </div>
                  <div className="vx-grid vx-g4" style={{ marginTop: 10, fontSize: 12.5 }}>
                    <div><span className="vx-mut">{t("admin.pros.triageScore")}</span><div className="vx-mono" style={{ fontWeight: 600 }}>{s.scoreTriagem != null ? `${Number(s.scoreTriagem).toFixed(2)}%` : t("admin.pros.notEvaluated")}</div></div>
                    <div><span className="vx-mut">{t("admin.pros.photoQuality")}</span><div className="vx-mono" style={{ fontWeight: 600 }}>{s.fotoScore != null && s.foto ? `${s.fotoScore}%` : t("admin.pros.noPhoto")}</div></div>
                  </div>
                  {s.notaTriagem && (
                    <div style={{ marginTop: 10, fontSize: 12.5 }}>
                      <span className="vx-mut">{t("admin.pros.reviewNote")}</span>
                      <div style={{ lineHeight: 1.6 }}>{s.notaTriagem}</div>
                    </div>
                  )}
                  <div className="vx-grid vx-g4" style={{ marginTop: 10, fontSize: 12.5 }}>
                    <div><span className="vx-mut">WhatsApp</span><div style={{ fontWeight: 500 }}>{s.whats}</div></div>
                    <div><span className="vx-mut">PIX</span><div className="vx-mono" style={{ fontSize: 12 }}>{s.pix || "—"}</div></div>
                    <div><span className="vx-mut">{t("admin.pros.experience")}</span><div style={{ fontWeight: 500 }}>{s.experiencia || "—"}</div></div>
                    <div><span className="vx-mut">{t("admin.pros.registration")}</span><div>{dataCurta(s.criadoEm)}</div></div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 4 }}>
                      <span className="vx-mut">Score</span><b>{s.nota}/100</b>
                    </div>
                    <Medidor value={s.nota} tone={s.nota >= 80 ? "brand" : s.nota >= 50 ? "amber" : "red"} />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <span className="vx-mut" style={{ fontSize: 12.5 }}>{t("admin.pros.totalSubmissions")}: {s.subs} · {t("admin.pros.approved")}: {s.liberados} · {t("admin.pros.rate")}: {s.subs > 0 ? Math.round((s.liberados / s.subs) * 100) : 0}%</span>
                  </div>

                  <DossieProfissional sellerId={s.id} />

                  <hr className="vx-sep" />
                  <Excluir
                    key={s.id}
                    rota={`/sellers/${s.id}`}
                    label={t("admin.pros.delete")}
                    sucesso={t("admin.pros.deleteSuccess", { name: s.nome })}
                    aviso={aviso}
                    onRemovido={() => { setExpandido(null); up?.((d) => ({ sellers: d.sellers.filter((x) => x.id !== s.id) })); }}
                    conflito={(p) => `${s.nome} tem ${money((p.disponivel || 0) + (p.pendente || 0))} em conta` +
                      (p.saquesAbertos ? ` e ${p.saquesAbertos} saque(s) em aberto` : "") +
                      ". Excluir agora não repassa esse valor."}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
