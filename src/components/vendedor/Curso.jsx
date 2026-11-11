import { CheckCircle2 } from "lucide-react";
import { apiPatch } from "../../lib/api.js";
import { Medidor } from "../ui.jsx";
import { useI18n } from "../../lib/i18n.jsx";

export default function Curso({ empresa, eu, up, aviso }) {
  const { t } = useI18n();
  const feitos = eu.curso?.[empresa.id];
  const lista = feitos === "todos" ? empresa.curso.map((m) => m.id) : (feitos || []);
  const marcar = (id) => {
    up((d) => {
      const s = d.sellers.find((x) => x.id === eu.id);
      const atuais = s?.curso?.[empresa.id] === "todos" ? empresa.curso.map((m) => m.id) : (s?.curso?.[empresa.id] || []);
      const novos = atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id];
      if (novos.length === empresa.curso.length) aviso(t("seller.course.completed"));
      apiPatch("/course-progress", { sellerId: eu.id, companyId: empresa.id, moduleIds: novos });
      return {
        sellers: d.sellers.map((x) => x.id !== eu.id ? x : { ...x, curso: { ...x.curso, [empresa.id]: novos } }),
      };
    });
  };
  const pct = Math.round((lista.length / empresa.curso.length) * 100);

  return (
    <>
      <div className="vx-card" style={{ padding: 15, marginBottom: 14 }}>
        <div className="vx-row" style={{ fontSize: 13, marginBottom: 8 }}>
          <span className="vx-mut">{t("seller.course.prepCompleted")}</span>
          <b className="vx-mono">{pct}%</b>
        </div>
        <Medidor value={pct} tone="brand" />
      </div>
      <div className="vx-grid">
        {empresa.curso.map((m, i) => {
          const ok = lista.includes(m.id);
          return (
            <div key={m.id} className="vx-card" style={{ padding: 16 }}>
              <div className="vx-row" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="vx-mono vx-mut" style={{ fontSize: 11 }}>{t("seller.course.module", { n: i + 1, min: m.min })}</div>
                  <div style={{ fontWeight: 600, marginTop: 3 }}>{m.titulo}</div>
                </div>
                {ok && <span className="vx-badge vx-badge-brand"><CheckCircle2 size={12} strokeWidth={2.5} />{t("seller.course.read")}</span>}
              </div>
              <p className="vx-mut" style={{ fontSize: 13.5, margin: "10px 0 12px" }}>{m.conteudo}</p>
              <button className="vx-btn vx-btn-sm" onClick={() => marcar(m.id)}>
                {ok ? t("seller.course.unmark") : t("seller.course.markRead")}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
