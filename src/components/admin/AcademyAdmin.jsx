import { useEffect, useMemo, useState } from "react";
import {
  Archive, Award, BookOpen, Copy, Eye, EyeOff, GraduationCap, Plus, Users,
} from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { Stat, Vazio, Medidor } from "../ui.jsx";
import { CATEGORIAS, NIVEIS_CURSO } from "../../../shared/academy/catalogo.js";
import { useI18n } from "../../lib/i18n.jsx";

// O editor trabalha o curso inteiro em JSON. É o formato em que o conteúdo já
// vive no banco, e evita construir um editor de árvore que ninguém pediu antes
// de saber como a plataforma vai criar curso na prática.
const MODELO = {
  titulo: "", subtitulo: "", categoria: "Prospecção", nivel: "fundamentos",
  professor: "RYCS Academy", descricao: "", requisitos: "", gratuito: true, preco: 0, notaMinima: 70,
  modulos: [{ titulo: "Módulo 1", resumo: "", aulas: [{ titulo: "Primeira aula", duracaoMin: 5, conteudo: "Conteúdo da aula." }] }],
  prova: [{ pergunta: "Pergunta de exemplo?", alternativas: ["Alternativa A", "Alternativa B"], correta: 0, explicacao: "Por que esta é a correta." }],
};

export default function AcademyAdmin({ aviso }) {
  const { t } = useI18n();
  const STATUS = {
    rascunho: { nome: t("admin.academy.draft"), tom: "amber" },
    publicado: { nome: t("admin.academy.published"), tom: "brand" },
    arquivado: { nome: t("admin.academy.archived"), tom: "muted" },
  };
  const [stats, setStats] = useState(null);
  const [cursos, setCursos] = useState([]);
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);
  const [rascunho, setRascunho] = useState(() => JSON.stringify(MODELO, null, 2));
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const [c, s] = await Promise.all([api("/courses?todos=1"), api("/admin/courses/stats")]);
    if (c?.error || s?.error) return setErro(c?.error || s?.error);
    setCursos(c.cursos || []);
    setStats(s);
  };

  useEffect(() => { carregar(); }, []);

  const mudarStatus = async (curso, status) => {
    const r = await apiPatch(`/admin/courses/${curso.id}`, { status });
    if (r?.error) return aviso(r.error);
    await carregar();
    aviso(`"${curso.titulo}" agora está ${STATUS[status].nome.toLowerCase()}.`);
  };

  const duplicar = async (curso) => {
    const r = await api(`/admin/courses/${curso.id}/duplicate`, {});
    if (r?.error) return aviso(r.error);
    await carregar();
    aviso(t("admin.academy.duplicateSuccess"));
  };

  const criar = async () => {
    let corpo;
    try { corpo = JSON.parse(rascunho); }
    catch (e) { return aviso(`JSON inválido: ${e.message}`); }
    if (!String(corpo.titulo || "").trim()) return aviso(t("admin.academy.needsTitle"));

    setSalvando(true);
    const r = await api("/admin/courses", corpo);
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    setCriando(false);
    setRascunho(JSON.stringify(MODELO, null, 2));
    await carregar();
    aviso(t("admin.academy.createSuccess"));
  };

  const porStatus = useMemo(() => {
    const g = { publicado: [], rascunho: [], arquivado: [] };
    for (const c of cursos) (g[c.status] || g.rascunho).push(c);
    return g;
  }, [cursos]);

  if (erro) return <div className="vx-notice vx-notice-amber">{erro}</div>;

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">{t("admin.academy.platformContent")}</div>
          <h1 className="vx-disp">RYCS Academy</h1>
          <p>{t("admin.academy.subtitle")}</p>
        </div>
        <button className="vx-btn vx-btn-primary" onClick={() => setCriando(!criando)}>
          <Plus size={14} /> {criando ? t("common.cancel") : t("admin.academy.newCourse")}
        </button>
      </div>

      {stats && (
        <div className="vx-grid vx-g4">
          <Stat label={t("admin.academy.publishedCourses")} value={stats.publicados} Icon={BookOpen} tone="brand" mono />
          <Stat label={t("admin.academy.enrollments")} value={stats.matriculas} Icon={Users} tone="indigo" mono />
          <Stat label={t("admin.academy.certificates")} value={stats.certificados} Icon={Award} tone="amber" mono />
          <Stat label={t("admin.academy.completionRate")} value={`${stats.taxaConclusao}%`} Icon={GraduationCap} tone="muted" />
        </div>
      )}

      {criando && (
        <div className="vx-card" style={{ padding: 18, marginTop: 16 }}>
          <div className="vx-eyebrow">{t("admin.academy.newCourse")}</div>
          <h3 className="vx-disp" style={{ fontSize: 16, margin: "3px 0 10px" }}>{t("admin.academy.courseStructure")}</h3>
          <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 0 }}>
            Módulos, aulas e prova no formato abaixo. A capa é gerada a partir do título e da categoria.
            O curso nasce como rascunho — ninguém vê até você publicar.
          </p>
          <textarea className="vx-input vx-mono" rows={18} value={rascunho}
            spellCheck={false} style={{ fontSize: 12, lineHeight: 1.5 }}
            onChange={(e) => setRascunho(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={criar}>
              {salvando ? t("admin.academy.creating") : t("admin.academy.createCourse")}
            </button>
            <button className="vx-btn" onClick={() => setRascunho(JSON.stringify(MODELO, null, 2))}>{t("admin.academy.restoreTemplate")}</button>
          </div>
          <div className="vx-chart-source">
            Categorias disponíveis: {CATEGORIAS.join(", ")}. Níveis: {Object.keys(NIVEIS_CURSO).join(", ")}.
          </div>
        </div>
      )}

      {["publicado", "rascunho", "arquivado"].map((st) => (
        !porStatus[st].length ? null : (
          <div key={st} style={{ marginTop: 22 }}>
            <div className="vx-row" style={{ marginBottom: 10 }}>
              <h2 className="vx-disp" style={{ fontSize: 16, margin: 0 }}>{STATUS[st].nome}</h2>
              <span className="vx-chip vx-mono">{porStatus[st].length}</span>
            </div>
            <div className="vx-grid">
              {porStatus[st].map((c) => {
                const desempenho = stats?.porCurso.find((x) => x.id === c.id) || { alunos: 0, certificados: 0 };
                return (
                  <div key={c.id} className="vx-card" style={{ padding: 14, display: "flex", gap: 13, flexWrap: "wrap" }}>
                    <img src={c.capa} alt="" style={{ width: 116, height: 65, objectFit: "cover", borderRadius: 9, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div className="vx-row" style={{ gap: 8 }}>
                        <b style={{ fontSize: 14 }}>{c.titulo}</b>
                        <span className={`vx-badge vx-badge-${STATUS[st].tom}`} style={{ flexShrink: 0 }}>{STATUS[st].nome}</span>
                      </div>
                      <div className="vx-mut" style={{ fontSize: 12 }}>
                        {c.categoria} · {c.totalAulas} {t("admin.academy.lessons")} · {c.duracaoMin} min · {c.gratuito ? t("admin.academy.free") : `R$ ${Number(c.preco).toFixed(2)}`}
                      </div>
                      <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 3 }}>
                        {desempenho.alunos} {t("admin.academy.students")} · {desempenho.certificados} {t("admin.academy.certs")}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        {c.status !== "publicado" && (
                          <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => mudarStatus(c, "publicado")}>
                            <Eye size={12} /> {t("admin.academy.publish")}
                          </button>
                        )}
                        {c.status === "publicado" && (
                          <button className="vx-btn vx-btn-sm" onClick={() => mudarStatus(c, "rascunho")}>
                            <EyeOff size={12} /> {t("admin.academy.unpublish")}
                          </button>
                        )}
                        <button className="vx-btn vx-btn-sm" onClick={() => duplicar(c)}><Copy size={12} /> {t("admin.academy.duplicate")}</button>
                        {c.status !== "arquivado" && (
                          <button className="vx-btn vx-btn-sm" onClick={() => mudarStatus(c, "arquivado")}>
                            <Archive size={12} /> {t("admin.academy.archive")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ))}

      {!cursos.length && (
        <div style={{ marginTop: 20 }}>
          <Vazio titulo={t("admin.academy.emptyTitle")}
            texto={t("admin.academy.emptyText")} />
        </div>
      )}

      {!!stats?.porCurso.length && (
        <div className="vx-card" style={{ padding: 18, marginTop: 22 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 10 }}>{t("admin.academy.performance")}</div>
          {stats.porCurso.map((c) => (
            <div key={c.id} style={{ marginBottom: 12 }}>
              <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 4 }}>
                <span>{c.titulo}</span>
                <b className="vx-mono">{c.alunos ? Math.round((c.certificados / c.alunos) * 100) : 0}%</b>
              </div>
              <Medidor value={c.alunos ? (c.certificados / c.alunos) * 100 : 0} tone="brand" />
              <div className="vx-mut" style={{ fontSize: 11 }}>{c.certificados} de {c.alunos} aluno(s) concluíram</div>
            </div>
          ))}
          <div className="vx-chart-source">Conclusão é certificado emitido, não aula assistida.</div>
        </div>
      )}
    </div>
  );
}
