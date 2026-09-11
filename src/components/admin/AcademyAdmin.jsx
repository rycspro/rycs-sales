import { useEffect, useMemo, useState } from "react";
import {
  Archive, Award, BookOpen, Copy, Eye, EyeOff, GraduationCap, Plus, Users,
} from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { Stat, Vazio, Medidor } from "../ui.jsx";
import { CATEGORIAS, NIVEIS_CURSO } from "../../../shared/academy/catalogo.js";

const STATUS = {
  rascunho: { nome: "Rascunho", tom: "amber" },
  publicado: { nome: "Publicado", tom: "brand" },
  arquivado: { nome: "Arquivado", tom: "muted" },
};

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
    aviso("Cópia criada como rascunho. Edite e publique quando estiver pronta.");
  };

  const criar = async () => {
    let corpo;
    try { corpo = JSON.parse(rascunho); }
    catch (e) { return aviso(`JSON inválido: ${e.message}`); }
    if (!String(corpo.titulo || "").trim()) return aviso("O curso precisa de um título.");

    setSalvando(true);
    const r = await api("/admin/courses", corpo);
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    setCriando(false);
    setRascunho(JSON.stringify(MODELO, null, 2));
    await carregar();
    aviso("Curso criado como rascunho. Revise e publique.");
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
          <div className="vx-eyebrow">Conteúdo da plataforma</div>
          <h1 className="vx-disp">RYCS Academy</h1>
          <p>Cursos, alunos e certificados emitidos. O que você publica aqui aparece para todos os profissionais.</p>
        </div>
        <button className="vx-btn vx-btn-primary" onClick={() => setCriando(!criando)}>
          <Plus size={14} /> {criando ? "Cancelar" : "Novo curso"}
        </button>
      </div>

      {stats && (
        <div className="vx-grid vx-g4">
          <Stat label="Cursos publicados" value={stats.publicados} Icon={BookOpen} tone="brand" mono />
          <Stat label="Matrículas" value={stats.matriculas} Icon={Users} tone="indigo" mono />
          <Stat label="Certificados emitidos" value={stats.certificados} Icon={Award} tone="amber" mono />
          <Stat label="Taxa de conclusão" value={`${stats.taxaConclusao}%`} Icon={GraduationCap} tone="muted" />
        </div>
      )}

      {criando && (
        <div className="vx-card" style={{ padding: 18, marginTop: 16 }}>
          <div className="vx-eyebrow">Novo curso</div>
          <h3 className="vx-disp" style={{ fontSize: 16, margin: "3px 0 10px" }}>Estrutura do curso</h3>
          <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 0 }}>
            Módulos, aulas e prova no formato abaixo. A capa é gerada a partir do título e da categoria.
            O curso nasce como rascunho — ninguém vê até você publicar.
          </p>
          <textarea className="vx-input vx-mono" rows={18} value={rascunho}
            spellCheck={false} style={{ fontSize: 12, lineHeight: 1.5 }}
            onChange={(e) => setRascunho(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={criar}>
              {salvando ? "Criando…" : "Criar curso"}
            </button>
            <button className="vx-btn" onClick={() => setRascunho(JSON.stringify(MODELO, null, 2))}>Restaurar modelo</button>
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
                        {c.categoria} · {c.totalAulas} aulas · {c.duracaoMin} min · {c.gratuito ? "Gratuito" : `R$ ${Number(c.preco).toFixed(2)}`}
                      </div>
                      <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 3 }}>
                        {desempenho.alunos} aluno(s) · {desempenho.certificados} certificado(s)
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        {c.status !== "publicado" && (
                          <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => mudarStatus(c, "publicado")}>
                            <Eye size={12} /> Publicar
                          </button>
                        )}
                        {c.status === "publicado" && (
                          <button className="vx-btn vx-btn-sm" onClick={() => mudarStatus(c, "rascunho")}>
                            <EyeOff size={12} /> Despublicar
                          </button>
                        )}
                        <button className="vx-btn vx-btn-sm" onClick={() => duplicar(c)}><Copy size={12} /> Duplicar</button>
                        {c.status !== "arquivado" && (
                          <button className="vx-btn vx-btn-sm" onClick={() => mudarStatus(c, "arquivado")}>
                            <Archive size={12} /> Arquivar
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
          <Vazio titulo="Nenhum curso no catálogo"
            texto="Crie o primeiro curso em Novo curso. Ele nasce como rascunho e só aparece para os profissionais quando você publicar." />
        </div>
      )}

      {!!stats?.porCurso.length && (
        <div className="vx-card" style={{ padding: 18, marginTop: 22 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Desempenho por curso</div>
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
