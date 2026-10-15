import { useEffect, useId, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import MolduraOnboarding from "./MolduraOnboarding.jsx";
import EtapaEmpresa from "./EtapaEmpresa.jsx";
import { api } from "../../lib/api.js";
import { ROTAS } from "../../lib/rotas.js";
import { ETAPAS, etapaDe, podeAbrirEtapa, normalizarWhatsapp, formatarWhatsapp } from "../../../shared/onboarding.js";

// Onboarding da empresa já autenticada. O servidor diz em qual etapa ela
// está; a URL só pode pedir uma etapa já liberada. Pedido de etapa à frente
// volta para a primeira não concluída.

function caminhoDe(chave) { return `${ROTAS.onboarding}/${chave}`; }

function Acoes({ aoVoltar, rotuloContinuar = "Continuar", salvando, desabilitado, tipo = "submit", aoContinuar }) {
  return (
    <div className="vx-onb-acoes">
      {aoVoltar ? <button type="button" className="vx-btn" onClick={aoVoltar}>Voltar</button> : <span />}
      <button type={tipo} className="vx-btn vx-btn-primary" disabled={salvando || desabilitado} onClick={aoContinuar}>
        {salvando ? "Salvando…" : rotuloContinuar}
      </button>
    </div>
  );
}

// Etapa 1 para quem já está logado: conta antiga sem WhatsApp, ou revisão.
function AcessoLogado({ estado, email, aoAtualizar, aoAvancar }) {
  const id = useId();
  const concluida = estado.etapas.acesso === "concluida";
  const [whatsapp, setWhatsapp] = useState(estado.whatsapp ? formatarWhatsapp(estado.whatsapp) : "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (!normalizarWhatsapp(whatsapp)) { setErro("Informe um WhatsApp válido, com DDD."); return; }
    setErro("");
    setSalvando(true);
    const r = await api("/onboarding/acesso", { whatsapp });
    setSalvando(false);
    if (!r || r.error) { setErro(r?.error || "Não foi possível salvar. Tente de novo."); return; }
    aoAtualizar(r);
    aoAvancar(r);
  };

  return (
    <div className="vx-onb-duas">
      <section className="vx-onb-hero">
        <div className="vx-onb-eyebrow">Passo 1 de 6</div>
        <h1 className="vx-disp">{concluida ? "Seu acesso está pronto." : "Confirme o seu acesso."}</h1>
        <p>{concluida
          ? "Você pode ajustar o WhatsApp da empresa aqui e seguir para o perfil."
          : "Antes de seguir, precisamos do WhatsApp da empresa. É por onde a RYCS fala com você sobre a operação."}</p>
      </section>
      <section className="vx-onb-card">
        <form onSubmit={enviar} noValidate>
          {concluida && <div className="vx-onb-icone" aria-hidden="true"><CheckCircle2 size={22} /></div>}
          <h2 className="vx-disp vx-onb-card-titulo">Acesso</h2>
          <p className="vx-mut vx-onb-card-apoio">Entrando como <b>{email}</b>.</p>
          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-w`}>WhatsApp</label>
            <input id={`${id}-w`} className="vx-input" type="tel" inputMode="numeric" autoComplete="tel-national"
              placeholder="(11) 91234-5678" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
              aria-invalid={erro ? true : undefined} aria-describedby={erro ? `${id}-erro` : `${id}-dica`} />
            <div id={`${id}-dica`} className="vx-onb-dica">Com DDD.</div>
            {erro && <div id={`${id}-erro`} className="vx-onb-erro" role="alert">{erro}</div>}
          </div>
          <Acoes salvando={salvando} rotuloContinuar={concluida ? "Salvar e continuar" : "Continuar"} />
        </form>
      </section>
    </div>
  );
}

// Etapas 2 a 6 entram nos próximos passos da entrega (SPEC §10).
function EtapaPendenteDeEntrega({ chave, aoVoltar }) {
  const etapa = etapaDe(chave);
  return (
    <div className="vx-onb-card" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="vx-onb-eyebrow">Passo {etapa.n} de {ETAPAS.length}</div>
      <h1 className="vx-disp vx-onb-card-titulo" style={{ marginTop: 8 }}>{etapa.label}</h1>
      <p className="vx-mut vx-onb-card-apoio">Esta etapa ainda está em construção.</p>
      <Acoes aoVoltar={aoVoltar} tipo="button" desabilitado />
    </div>
  );
}

export default function Onboarding({ estado, setEstado, email, etapaPedida, aoSair }) {
  const permitida = etapaPedida && podeAbrirEtapa(estado.etapas, etapaPedida);
  const [ativa, setAtiva] = useState(permitida ? etapaPedida : estado.atual);

  // A URL acompanha a etapa aberta. replaceState para o "voltar" do navegador
  // não virar um caminho para pular etapas.
  useEffect(() => {
    if (window.location.pathname !== caminhoDe(ativa)) window.history.replaceState({}, "", caminhoDe(ativa));
  }, [ativa]);

  // Voltar/avançar do navegador com uma etapa fora de ordem: corrige.
  useEffect(() => {
    if (etapaPedida && etapaPedida !== ativa)
      setAtiva(podeAbrirEtapa(estado.etapas, etapaPedida) ? etapaPedida : estado.atual);
  }, [etapaPedida]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = (chave) => { if (podeAbrirEtapa(estado.etapas, chave)) { setAtiva(chave); window.scrollTo?.(0, 0); } };
  const anterior = (chave) => ETAPAS[ETAPAS.findIndex((e) => e.chave === chave) - 1]?.chave || null;
  const avancar = (novo) => { setAtiva(novo.atual || ativa); window.scrollTo?.(0, 0); };

  return (
    <MolduraOnboarding etapas={estado.etapas} ativa={ativa} aoAbrir={abrir} aoSair={aoSair}>
      {ativa === "acesso" ? <AcessoLogado estado={estado} email={email} aoAtualizar={setEstado} aoAvancar={avancar} />
        : ativa === "empresa" ? <EtapaEmpresa aoAtualizar={setEstado} aoAvancar={avancar} aoVoltar={() => abrir("acesso")} />
        : <EtapaPendenteDeEntrega chave={ativa} aoVoltar={() => abrir(anterior(ativa))} />}
    </MolduraOnboarding>
  );
}
