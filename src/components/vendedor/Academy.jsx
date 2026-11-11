import { useEffect, useMemo, useState } from "react";
import { Award, BookOpen, GraduationCap } from "lucide-react";
import { api } from "../../lib/api.js";
import { Vazio } from "../ui.jsx";
import CursoPlayer from "./CursoPlayer.jsx";

const FUNCAO_LABEL = {
  sdr: "SDR",
  bdr: "BDR",
  closer: "Closer",
  pap: "PAP",
  "sem-exp": "Iniciante",
};

export default function Academy({ eu, aviso, funcaoInicial, recarregar, navegar, tour, limparTour }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [cursoAberto, setCursoAberto] = useState(null);
  const funcao = funcaoInicial || eu.perfil || "sem-exp";

  const carregar = async () => {
    const r = await api("/courses");
    if (!r || r.error) return setErro(r?.error || "Não foi possível carregar a Academy.");
    setDados(r);
  };

  useEffect(() => { carregar(); }, []);

  const cursosDaFuncao = useMemo(() => {
    const cursos = dados?.cursos || [];
    const diretos = cursos.filter((c) => c.funcao === funcao);
    return diretos.length ? diretos : cursos.filter((c) => !c.funcao);
  }, [dados, funcao]);

  const principal = cursosDaFuncao[0] || null;

  if (erro) return <div className="vx-notice vx-notice-amber">{erro}</div>;
  if (!dados) return <div className="vx-card vx-skeleton" style={{ height: 360 }} />;

  if (cursoAberto || principal) {
    const curso = cursoAberto || principal;
    return (
      <CursoPlayer
        courseId={curso.id}
        eu={eu}
        aviso={aviso}
        onCertified={recarregar}
        navegar={navegar}
        aulaInicialId={tour?.courseId === curso.id ? tour.aulaId : undefined}
        voltar={cursoAberto
          ? () => { setCursoAberto(null); limparTour?.(); carregar(); }
          : () => { limparTour?.(); carregar(); }}
      />
    );
  }

  return (
    <div className="vx-fade" style={{ maxWidth: 720 }}>
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">RYCS Academy</div>
          <h1 className="vx-disp">Certificação {FUNCAO_LABEL[funcao] || funcao}</h1>
          <p>Não há curso publicado para esta função ainda.</p>
        </div>
        <span className="vx-chip"><GraduationCap size={13} /> {FUNCAO_LABEL[funcao] || funcao}</span>
      </div>

      {dados.cursos?.length ? (
        <div className="vx-grid">
          {dados.cursos.map((curso) => (
            <button key={curso.id} className="vx-card vx-row" style={{ padding: 14, textAlign: "left", cursor: "pointer", gap: 12 }}
              onClick={() => setCursoAberto(curso)}>
              <BookOpen size={16} color="var(--brand)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{curso.titulo}</b>
                <div className="vx-mut" style={{ fontSize: 12 }}>{curso.totalAulas} aulas · {curso.progresso || 0}% concluído</div>
              </div>
              {curso.certificado && <Award size={15} color="var(--brand)" />}
            </button>
          ))}
        </div>
      ) : (
        <Vazio titulo="Nenhum curso publicado" texto="A plataforma ainda não publicou cursos para profissionais." />
      )}
    </div>
  );
}
