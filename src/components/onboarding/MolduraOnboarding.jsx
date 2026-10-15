import { Check } from "lucide-react";
import { ETAPAS, normalizarEtapas, podeAbrirEtapa } from "../../../shared/onboarding.js";

// Moldura comum das etapas: logo e progresso fixos no topo, conteúdo abaixo.
// O progresso mostra as seis etapas; as já liberadas viram botão para voltar
// a elas, as de depois ficam só como indicação.

export function Progresso({ etapas, ativa, aoAbrir }) {
  const e = normalizarEtapas(etapas);
  const n = ETAPAS.find((x) => x.chave === ativa)?.n || 1;
  return (
    <nav aria-label={`Progresso do cadastro: passo ${n} de ${ETAPAS.length}`}>
      <ol className="vx-onb-passos">
        {ETAPAS.map((etapa) => {
          const estado = etapa.chave === ativa ? "atual" : e[etapa.chave] === "concluida" ? "concluida" : "pendente";
          const conteudo = <>
            <span className="vx-onb-passo-n" aria-hidden="true">
              {estado === "concluida" ? <Check size={14} strokeWidth={3} /> : etapa.n}
            </span>
            <span className="vx-onb-passo-txt">{etapa.label}</span>
          </>;
          const rotulo = `${etapa.label}: ${estado === "atual" ? "etapa atual" : estado === "concluida" ? "concluída" : "pendente"}`;
          const clicavel = aoAbrir && estado !== "atual" && podeAbrirEtapa(etapas, etapa.chave);
          return (
            <li key={etapa.chave} data-estado={estado} aria-current={estado === "atual" ? "step" : undefined}>
              {clicavel
                ? <button type="button" onClick={() => aoAbrir(etapa.chave)} aria-label={rotulo}>{conteudo}</button>
                : <span aria-label={rotulo} style={{ display: "flex", alignItems: "center", gap: 7 }}>{conteudo}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function MolduraOnboarding({ etapas, ativa, aoAbrir, aoSair, children }) {
  return (
    <div className="vx-onb">
      <header className="vx-onb-topo">
        <div className="vx-onb-topo-inner">
          <img className="vx-logo" src="/logo-rycs.png" alt="RYCS" style={{ width: 72 }} />
          <Progresso etapas={etapas} ativa={ativa} aoAbrir={aoAbrir} />
          {aoSair && <button type="button" className="vx-btn vx-btn-sm vx-btn-ghost" style={{ minHeight: 44 }} onClick={aoSair}>Sair</button>}
        </div>
      </header>
      <main className="vx-onb-corpo vx-fade">{children}</main>
    </div>
  );
}
