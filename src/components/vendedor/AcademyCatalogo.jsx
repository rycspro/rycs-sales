import { useEffect, useMemo, useState } from "react";
import { Award, BookOpen, CheckCircle2, Clock3, GraduationCap, Play, Search, Users } from "lucide-react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { Medidor, Vazio } from "../ui.jsx";
import CursoPlayer from "./CursoPlayer.jsx";

const ABAS = [
  ["explorar", "Explorar"],
  ["meus", "Meus cursos"],
  ["continuar", "Continuar"],
  ["gratuitos", "Gratuitos"],
  ["certificados", "Certificados"],
];

const NIVEL_NOME = { fundamentos: "Fundamentos", intermediario: "Intermediário", avancado: "Avançado" };

function CardCurso({ curso, abrir }) {
  const emAndamento = curso.matriculado && curso.progresso > 0 && curso.progresso < 100;
  return (
    <article className="vx-card vx-course-card" onClick={() => abrir(curso)}>
      <div className="vx-course-capa">
        <img src={curso.capa} alt="" loading="lazy" />
        <span className={"vx-badge " + (curso.gratuito ? "vx-badge-brand" : "vx-badge-amber")}>
          {curso.gratuito ? "Gratuito" : `R$ ${Number(curso.preco).toFixed(2).replace(".", ",")}`}
        </span>
        {curso.certificado && (
          <span className="vx-badge vx-badge-indigo vx-course-cert"><Award size={11} /> Certificado</span>
        )}
      </div>

      <div className="vx-course-corpo">
        <div className="vx-eyebrow">{curso.categoria} · {NIVEL_NOME[curso.nivel] || curso.nivel}</div>
        <h3>{curso.titulo}</h3>
        <p>{curso.subtitulo}</p>

        <div className="vx-course-meta">
          <span><BookOpen size={12} /> {curso.totalAulas} aulas</span>
          <span><Clock3 size={12} /> {curso.duracaoMin} min</span>
          <span><Users size={12} /> {curso.alunos}</span>
        </div>

        {curso.matriculado && (
          <div style={{ marginTop: 10 }}>
            <div className="vx-row" style={{ fontSize: 11.5, marginBottom: 4 }}>
              <span className="vx-mut">{curso.aulasConcluidas}/{curso.totalAulas} concluídas</span>
              <b className="vx-mono">{curso.progresso}%</b>
            </div>
            <Medidor value={curso.progresso} tone={curso.progresso === 100 ? "brand" : "amber"} />
          </div>
        )}

        <button className={"vx-btn vx-btn-block " + (curso.matriculado ? "" : "vx-btn-primary")} style={{ marginTop: 12 }}>
          {curso.certificado ? <><Award size={14} /> Ver certificado</>
            : emAndamento ? <><Play size={14} /> Continuar</>
              : curso.matriculado ? <><Play size={14} /> Começar</>
                : <><GraduationCap size={14} /> Ver curso</>}
        </button>
      </div>
    </article>
  );
}

export default function AcademyCatalogo({ eu, aviso }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("explorar");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [aberto, setAberto] = useState(null);
  const [certificados, setCertificados] = useState([]);

  const carregar = async () => {
    const r = await api("/courses");
    if (!r || r.error) return setErro(r?.error || "Não foi possível carregar a Academy.");
    setDados(r);
  };

  useEffect(() => { carregar(); }, []);
  useEffect(() => {
    if (aba === "certificados") api("/courses/me/certificates").then((r) => setCertificados(r?.certificados || []));
  }, [aba]);

  const cursos = useMemo(() => {
    if (!dados) return [];
    let lista = dados.cursos;
    if (aba === "meus") lista = lista.filter((c) => c.matriculado);
    if (aba === "continuar") lista = lista.filter((c) => c.matriculado && c.progresso > 0 && c.progresso < 100);
    if (aba === "gratuitos") lista = lista.filter((c) => c.gratuito);
    if (categoria) lista = lista.filter((c) => c.categoria === categoria);
    if (busca) {
      const q = busca.toLowerCase();
      lista = lista.filter((c) =>
        c.titulo.toLowerCase().includes(q) || c.subtitulo.toLowerCase().includes(q) ||
        c.categoria.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q));
    }
    return lista;
  }, [dados, aba, categoria, busca]);

  if (erro) return <div className="vx-notice vx-notice-amber">{erro}</div>;
  if (!dados) return <div className="vx-grid vx-g3">{[1, 2, 3].map((i) => <div key={i} className="vx-card vx-skeleton" style={{ height: 300 }} />)}</div>;

  if (aberto) {
    return <CursoPlayer courseId={aberto.id} eu={eu} aviso={aviso}
      voltar={() => { setAberto(null); carregar(); }} />;
  }

  // Categorias com curso de verdade. Filtro que nunca retorna nada é ruído.
  const categoriasAtivas = [...new Set(dados.cursos.map((c) => c.categoria))];
  const emAndamento = dados.cursos.filter((c) => c.matriculado && c.progresso > 0 && c.progresso < 100);

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Formação comercial</div>
          <h1 className="vx-disp">RYCS Academy</h1>
          <p>Cursos produzidos pela RYCS. Conclua as aulas, faça a prova e receba o certificado no seu perfil.</p>
        </div>
        <span className="vx-chip"><GraduationCap size={13} /> {dados.cursos.length} cursos</span>
      </div>

      {/* Continuar assistindo: quem já começou volta para onde parou sem
          procurar o curso na grade. */}
      {aba === "explorar" && !!emAndamento.length && (
        <div style={{ marginBottom: 22 }}>
          <h2 className="vx-disp" style={{ fontSize: 16, margin: "0 0 10px" }}>Continuar assistindo</h2>
          <div className="vx-grid">
            {emAndamento.map((c) => (
              <button key={c.id} className="vx-card vx-row" style={{ padding: 12, textAlign: "left", width: "100%", cursor: "pointer", gap: 12 }}
                onClick={() => setAberto(c)}>
                <img src={c.capa} alt="" style={{ width: 78, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13.5 }}>{c.titulo}</b>
                  <div className="vx-mut" style={{ fontSize: 11.5, marginBottom: 5 }}>{c.aulasConcluidas} de {c.totalAulas} aulas</div>
                  <Medidor value={c.progresso} tone="amber" />
                </div>
                <span className="vx-chip vx-mono">{c.progresso}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="vx-seg vx-subnav" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        {ABAS.map(([k, label]) => (
          <button key={k} data-on={aba === k ? "1" : "0"} onClick={() => setAba(k)}>{label}</button>
        ))}
      </div>

      {aba === "certificados" ? (
        !certificados.length ? (
          <Vazio titulo="Nenhum certificado ainda"
            texto="Conclua um curso e passe na prova com a nota mínima. O certificado aparece aqui e no seu perfil, com código de verificação." />
        ) : (
          <div className="vx-grid vx-g2">
            {certificados.map((c) => (
              <div key={c.codigo} className="vx-card" style={{ padding: 18, borderLeft: "3px solid var(--brand)" }}>
                <div className="vx-row">
                  <div className="vx-eyebrow"><Award size={12} /> Certificado RYCS</div>
                  <span className="vx-badge vx-badge-brand vx-mono">{c.percentual}%</span>
                </div>
                <div className="vx-disp" style={{ fontSize: 16, margin: "8px 0 3px" }}>{c.titulo}</div>
                <div className="vx-mut" style={{ fontSize: 12 }}>{c.categoria} · emitido em {dataCurta(c.emitidoEm)}</div>
                <div className="vx-mono" style={{ fontSize: 12, marginTop: 10, color: "var(--brand)" }}>{c.codigo}</div>
                <div className="vx-chart-source">Código de verificação. Qualquer empresa na plataforma pode conferir a autenticidade.</div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="vx-grid vx-g2" style={{ marginBottom: 16 }}>
            <label>
              <span className="vx-label">Buscar</span>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 11, top: 12, color: "var(--muted)" }} />
                <input className="vx-input" style={{ paddingLeft: 32 }} value={busca}
                  placeholder="Tema, categoria ou título" onChange={(e) => setBusca(e.target.value)} />
              </div>
            </label>
            <label>
              <span className="vx-label">Categoria</span>
              <select className="vx-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Todas as categorias</option>
                {categoriasAtivas.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          {!cursos.length ? (
            <Vazio titulo="Nenhum curso neste filtro"
              texto={aba === "meus" ? "Você ainda não se matriculou em nenhum curso. Abra Explorar e comece pelo primeiro."
                : "Ajuste a busca ou a categoria para ver mais cursos."} />
          ) : (
            <div className="vx-course-grid">
              {cursos.map((c) => <CardCurso key={c.id} curso={c} abrir={setAberto} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
