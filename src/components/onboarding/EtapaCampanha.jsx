import { useEffect, useRef, useState } from "react";
import { Check, X, QrCode } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import NovaCampanha from "../empresa/NovaCampanha.jsx";
import { ETAPAS, PARTES_IA } from "../../../shared/onboarding.js";

// Etapa 6: primeira campanha. A criação é a mesma tela de sempre
// (NovaCampanha). Depois de criada: as estratégias aprovadas ficam ligadas
// a ela, o caixa é abastecido por Pix e a campanha é publicada. O onboarding
// termina com a campanha criada e o depósito feito; o que ainda faltar para
// publicar aparece na lista e se resolve no painel.

function Estrategias({ estrategias }) {
  if (!estrategias) return <p className="vx-mut" style={{ fontSize: 14 }}>Nenhuma estratégia aprovada ainda. Quando a IA for ativada, você poderá gerá-las.</p>;
  return (
    <ul className="vx-onb-estrategias">
      {PARTES_IA.map((p) => (
        <li key={p.chave}>
          <b>{p.label}</b>
          <span className="vx-mut">{p.chave === "followups"
            ? `${(estrategias.followups || []).length} mensagens de retomada`
            : p.campos.map(([, r]) => r).join(" · ")}</span>
        </li>
      ))}
    </ul>
  );
}

function Deposito({ sugerido, aoGerado }) {
  const [valor, setValor] = useState(String(Math.max(5, Math.ceil(sugerido || 0))));
  const [minimo, setMinimo] = useState(1);
  const [cobranca, setCobranca] = useState(null);
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  useEffect(() => { api("/deposits/config").then((c) => { if (c?.minimo) setMinimo(c.minimo); }); }, []);

  const gerar = async (e) => {
    e.preventDefault();
    const v = Number(String(valor).replace(/\./g, "").replace(",", "."));
    if (!v || v < minimo) return setErro(`Depósito mínimo de ${money(minimo)}.`);
    setErro("");
    setGerando(true);
    const r = await api("/deposits", { valor: v });
    setGerando(false);
    if (!r || r.error) return setErro(r?.error || "Não foi possível gerar o Pix.");
    setCobranca({ ...r, valor: v });
    aoGerado?.();
  };

  if (cobranca) return (
    <div className="vx-onb-pix" role="status">
      <QrCode size={22} aria-hidden="true" />
      <p><b>Pix de {money(cobranca.valor)} gerado.</b> {cobranca.instrucoes}</p>
      {cobranca.pixQrCodeBase64 && <img src={`data:image/png;base64,${cobranca.pixQrCodeBase64}`} alt="QR Code do Pix" width={200} height={200} />}
      {cobranca.pixCopiaECola && (
        <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={() => navigator.clipboard?.writeText(cobranca.pixCopiaECola)}>Copiar código Pix</button>
      )}
      {cobranca.pix && <p>Chave Pix: <b>{cobranca.pix}</b> · referência <b>{cobranca.referencia}</b></p>}
      <p className="vx-onb-dica">Esta tela atualiza sozinha quando o pagamento for confirmado.</p>
    </div>
  );

  return (
    <form onSubmit={gerar} className="vx-onb-linha" noValidate>
      <label className="vx-label" htmlFor="onb-deposito" style={{ position: "absolute", left: -9999 }}>Valor do depósito em reais</label>
      <div className="vx-onb-moeda" style={{ flex: 1 }}>
        <span aria-hidden="true">R$</span>
        <input id="onb-deposito" className="vx-input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} aria-describedby={erro ? "onb-deposito-erro" : undefined} />
      </div>
      <button type="submit" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} disabled={gerando}>{gerando ? "Gerando…" : "Gerar Pix"}</button>
      {erro && <div id="onb-deposito-erro" className="vx-onb-erro" role="alert" style={{ flexBasis: "100%" }}>{erro}</div>}
    </form>
  );
}

export default function EtapaCampanha({ estado, emp, aviso, aoAtualizar, aoAvancar, aoVoltar }) {
  const [dados, setDados] = useState(null);
  const [erroCarga, setErroCarga] = useState("");
  const [aguardandoPix, setAguardandoPix] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [pendencias, setPendencias] = useState([]);
  const [erro, setErro] = useState("");
  const timer = useRef(null);

  const carregar = async () => {
    const r = await api("/onboarding/campanha");
    if (!r || r.error) { setErroCarga(r?.error || "Não foi possível carregar a campanha."); return; }
    setErroCarga("");
    setDados(r);
  };
  useEffect(() => { carregar(); return () => clearTimeout(timer.current); }, []);

  // Pix gerado: confere a cada 5 segundos se o saldo entrou.
  useEffect(() => {
    if (!aguardandoPix || dados?.caixaOk) return;
    timer.current = setTimeout(carregar, 5000);
    return () => clearTimeout(timer.current);
  }, [aguardandoPix, dados]); // eslint-disable-line react-hooks/exhaustive-deps

  const concluir = async () => {
    setErro("");
    const r = await api("/onboarding/campanha/concluir", {});
    if (!r || r.error) return setErro(r?.error || "Não foi possível concluir.");
    aoAtualizar(r);
  };

  const publicar = async () => {
    setErro("");
    setPendencias([]);
    setPublicando(true);
    const r = await api(`/campaigns/${dados.campanha.id}/status`, { status: "ativa" });
    setPublicando(false);
    if (r?.ok) { aviso?.("Campanha publicada."); return concluir(); }
    setPendencias(r?.pendencias || []);
    setErro(r?.error || "Não foi possível publicar agora.");
    carregar();
  };

  if (erroCarga) return (
    <div className="vx-onb-card vx-onb-estado" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
      <p>{erroCarga}</p>
      <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} onClick={carregar}>Tentar novamente</button>
    </div>
  );
  if (!dados || !emp) return <div className="vx-onb-estado" role="status">Carregando…</div>;

  const selos = (
    <ul className="vx-onb-selos" aria-label="Etapas concluídas">
      {ETAPAS.filter((e) => estado.etapas[e.chave] === "concluida").map((e) => (
        <li key={e.chave}><Check size={13} aria-hidden="true" /> {e.label}</li>
      ))}
    </ul>
  );

  return (
    <div>
      <div className="vx-onb-eyebrow">Passo 6 de 6{estado.trialDias ? " · Teste grátis ativo" : ""}</div>
      <h1 className="vx-disp vx-onb-titulo">Cadastro concluído. Suba sua primeira campanha.</h1>
      {selos}

      <section className="vx-onb-card vx-onb-secao">
        <h2 className="vx-disp">Estratégias aplicadas</h2>
        <p className="vx-onb-dica" style={{ marginTop: -8 }}>Somente leitura: o script, o funil e os follow-ups que você aprovou entram na campanha.</p>
        <Estrategias estrategias={dados.estrategias} />
      </section>

      {!dados.campanha ? (
        <NovaCampanha emp={emp} aviso={aviso} aoCancelar={aoVoltar}
          aoCriar={async (criada) => {
            const r = await api("/onboarding/campanha", { campaignId: criada.id });
            if (!r || r.error) setErro(r?.error || "A campanha foi criada, mas não foi ligada ao cadastro. Tente de novo.");
            carregar();
          }} />
      ) : (
        <section className="vx-onb-card vx-onb-secao" aria-live="polite">
          <h2 className="vx-disp">{dados.campanha.titulo}</h2>
          <p className="vx-mut" style={{ marginTop: -8, fontSize: 14 }}>
            {dados.campanha.status === "ativa" ? "Publicada." : "Rascunho criado."}
            {dados.campanha.orcamento ? ` Orçamento de ${money(dados.campanha.orcamento)}.` : ""}
            {dados.saldoDisponivel != null ? ` Saldo disponível: ${money(dados.saldoDisponivel)}.` : ""}
          </p>

          {!dados.caixaOk && <>
            <h3 className="vx-onb-eyebrow" style={{ margin: "16px 0 8px" }}>Adicione saldo para publicar</h3>
            <p className="vx-mut" style={{ fontSize: 14, marginTop: 0 }}>O saldo paga as ações dos profissionais. Ele é creditado assim que o Pix for confirmado.</p>
            <Deposito sugerido={Math.max(0, dados.campanha.orcamento - (dados.saldoDisponivel || 0))} aoGerado={() => setAguardandoPix(true)} />
          </>}

          <h3 className="vx-onb-eyebrow" style={{ margin: "18px 0 8px" }}>Para publicar</h3>
          <ul className="vx-onb-requisitos">
            {dados.requisitos.map((r) => (
              <li key={r.label} data-ok={r.ok ? "1" : "0"}>
                {r.ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                <span>{r.label}<span className="vx-sr">{r.ok ? " (ok)" : " (pendente)"}</span></span>
              </li>
            ))}
          </ul>
          {pendencias.length > 0 && <p className="vx-onb-dica">Falta: {pendencias.join(", ")}. Você resolve isso no painel, em Campanhas e em Minha Conta.</p>}
          {erro && <div className="vx-onb-erro" role="alert">{erro}</div>}

          <div className="vx-onb-acoes">
            <button type="button" className="vx-btn" onClick={concluir} disabled={!dados.caixaOk || publicando}>
              Salvar rascunho e ir para o painel
            </button>
            <button type="button" className="vx-btn vx-btn-primary" onClick={publicar} disabled={!dados.caixaOk || publicando || dados.campanha.status === "ativa"}>
              {publicando ? "Publicando…" : "Publicar campanha"}
            </button>
          </div>
          {!dados.caixaOk && <p className="vx-onb-dica">Os botões liberam quando o saldo entrar.</p>}
        </section>
      )}
    </div>
  );
}
