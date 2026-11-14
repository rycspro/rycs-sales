import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { formatarData, primeiraCobranca, primeiroDebitoPixAutomatico } from "../../../shared/assinatura.js";
import { TAXA_ATIVACAO_PIX_AUTOMATICO } from "../../../shared/planos.js";
import { normalizarDocumento } from "../../../shared/onboarding.js";
import CheckoutStripe from "../empresa/CheckoutStripe.jsx";
import PricingPlanos from "../empresa/PricingPlanos.jsx";

// Etapa 5: plano e pagamento. Planos e preços vêm de shared/planos.js pelo
// servidor; nada fixo aqui. Pagamento nacional é só Pix: a empresa paga um Pix
// de ativação pelo QR e autoriza, no app do banco, o débito mensal; a etapa
// conclui quando o banco confirma. Empresas fora do Brasil pagam em dólar no
// Stripe. Não há cartão de crédito nacional.

const digitos = (v) => String(v || "").replace(/\D/g, "");
const usd = (n) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const voltouDoStripe = () => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("stripe") : null);

export default function EtapaPlano({ aoAtualizar, aoAvancar, aoVoltar }) {
  const id = useId();
  const [dados, setDados] = useState(null);
  const [erroCarga, setErroCarga] = useState("");
  const [plano, setPlano] = useState("");
  const [cartao, setCartao] = useState({ documento: "" });
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [forma, setForma] = useState("pix"); // pix | internacional
  const [stripe, setStripe] = useState(null); // { ativo, planos: [{ chave, mensal }] }
  const [confirmandoStripe, setConfirmandoStripe] = useState(() => voltouDoStripe() === "ok");
  const [embutido, setEmbutido] = useState(null); // checkout do Stripe dentro da etapa
  const [pix, setPix] = useState(null); // QR aberto: { payload, imagem, primeiraCobranca }
  const [copiado, setCopiado] = useState(false);
  const consulta = useRef(null);

  const carregar = async () => {
    setErroCarga("");
    const r = await api("/onboarding/plano");
    if (!r || r.error) return setErroCarga(r?.error || "Não foi possível carregar os planos.");
    setDados(r);
    setPlano((p) => p || r.planos[0]?.chave || "");
  };
  useEffect(() => { carregar(); api("/stripe/status").then((r) => r && !r.error && setStripe(r)); }, []);

  // Volta do checkout do Stripe: o webhook é quem conclui a etapa. A tela
  // espera a confirmação em vez de liberar sozinha.
  useEffect(() => {
    const volta = voltouDoStripe();
    if (!volta) return undefined;
    window.history.replaceState(null, "", window.location.pathname);
    if (volta !== "ok") { setForma("internacional"); setErro("Pagamento internacional não concluído. Você pode tentar de novo."); return undefined; }
    let vivo = true, tentativas = 0;
    const t = setInterval(async () => {
      tentativas += 1;
      const r = await api("/onboarding");
      if (!vivo) return;
      if (r && !r.error && r.etapas?.plano === "concluida") { clearInterval(t); aoAtualizar(r); aoAvancar(r); }
      else if (tentativas >= 40) { clearInterval(t); setConfirmandoStripe(false); setErro("O pagamento ainda não foi confirmado pelo Stripe. Atualize a página em instantes."); }
    }, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const assinarInternacional = async () => {
    setEnviando(true);
    const r = await api("/subscription/stripe", { plano, onboarding: true, retorno: window.location.pathname, embutido: !!stripe?.chavePublica });
    setEnviando(false);
    if (r?.clientSecret && r?.chavePublica) return setEmbutido(r);
    if (!r || r.error || !r.url) return setErro(r?.error || "Não foi possível abrir o pagamento internacional.");
    window.location.href = r.url;
  };

  const terminar = async () => {
    const r = await api("/onboarding");
    if (r && !r.error) { aoAtualizar(r); aoAvancar(r); }
    else setErro("Pagamento registrado, mas houve um erro ao avançar. Atualize a página.");
  };

  const manter = async () => {
    setErro("");
    setEnviando(true);
    const r = await api("/onboarding/plano/manter", {});
    setEnviando(false);
    if (!r || r.error) return setErro(r?.error || "Não foi possível continuar.");
    aoAtualizar(r);
    aoAvancar(r);
  };

  // Enquanto o QR está aberto, pergunta ao servidor se o banco já autorizou.
  useEffect(() => {
    if (!pix) return undefined;
    let vivo = true;
    const verificar = async () => {
      const r = await api("/subscription/pix-automatico");
      if (!vivo || !r || r.error) return;
      if (r.status === "autorizada") { clearInterval(consulta.current); await terminar(); }
      else if (r.status === "cancelada") {
        clearInterval(consulta.current);
        setPix(null);
        setErro(`O Pix Automático não foi autorizado${r.motivo ? ` (${r.motivo})` : ""}. Tente de novo ou use o cartão.`);
      }
    };
    consulta.current = setInterval(verificar, 4000);
    return () => { vivo = false; clearInterval(consulta.current); };
  }, [pix]);

  const assinarPix = async () => {
    const doc = normalizarDocumento(cartao.documento);
    if (!doc) {
      setErros({ documento: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)." });
      document.getElementById(`${id}-documento`)?.focus();
      return;
    }
    setErros({});
    setEnviando(true);
    const r = await api("/subscription", { plano, onboarding: true, formaPagamento: "PIX_AUTOMATICO", titular: { documento: doc } });
    setEnviando(false);
    if (!r || r.error) {
      if (r?.campo) setErros({ [r.campo]: r.error });
      return setErro(r?.error ? `O Pix Automático não está disponível agora: ${r.error}. Você pode usar o cartão de crédito.` : "Não foi possível gerar o Pix Automático. Tente de novo ou use o cartão.");
    }
    setPix({ payload: r.pixCopiaECola, imagem: r.pixQrCodeBase64, primeiraCobranca: r.primeiraCobranca });
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(pix.payload); setCopiado(true); setTimeout(() => setCopiado(false), 3000); } catch { /* o campo continua selecionável */ }
  };

  const ativarGratis = async () => {
    setEnviando(true);
    const r = await api("/onboarding/plano/gratis", {});
    setEnviando(false);
    if (!r || r.error) return setErro(r?.error || "Não foi possível ativar o plano grátis.");
    aoAtualizar(r);
    aoAvancar(r);
  };

  const assinar = async (e) => {
    e.preventDefault();
    setErro("");
    if (escolhido?.preco === 0) return ativarGratis();
    if (forma === "internacional") return assinarInternacional();
    return assinarPix();
  };

  if (erroCarga) return (
    <div className="vx-onb-card vx-onb-estado" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
      <p>{erroCarga}</p>
      <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} onClick={carregar}>Tentar novamente</button>
    </div>
  );
  if (!dados) return <div className="vx-onb-estado" role="status">Carregando os planos…</div>;
  if (confirmandoStripe) return <div className="vx-onb-estado" role="status">Confirmando o pagamento com o Stripe… Esta tela avança sozinha.</div>;

  const trial = dados.trialDias;
  const escolhido = dados.planos.find((p) => p.chave === plano);
  const precoUsd = stripe?.planos?.find((p) => p.chave === plano)?.mensal ?? escolhido?.preco;
  // Pix nacional: o primeiro débito automático cai no fim do trial (ou já no
  // próximo ciclo quando não há trial). Regra em server/routes/subscriptions.js.
  const cobrancaEm = forma === "pix"
    ? primeiroDebitoPixAutomatico({ trialDias: trial })
    : trial ? primeiraCobranca({ trialDias: trial }) : primeiraCobranca({ trialDias: 3 });

  if (dados.atual) return (
    <div>
      <button type="button" className="vx-onb-voltar-topo" onClick={aoVoltar}>
        <ArrowLeft size={15} /> Voltar
      </button>
      <div className="vx-onb-eyebrow">Passo 5 de 6</div>
      <h1 className="vx-disp vx-onb-titulo">Seu plano</h1>
      <div className="vx-onb-card vx-onb-secao" style={{ maxWidth: 640 }}>
        <div className="vx-onb-icone" aria-hidden="true"><Check size={22} /></div>
        <p style={{ fontSize: 15, margin: "0 0 6px" }}>A sua empresa já tem acesso liberado{dados.atual.nome ? <> no plano <b>{dados.atual.nome}</b></> : ""}.</p>
        <p className="vx-mut" style={{ fontSize: 14, margin: 0 }}>Nada é cobrado de novo. Para trocar de plano depois, use Minha Conta › Plano.</p>
        {erro && <div className="vx-onb-erro" role="alert">{erro}</div>}
        <div className="vx-onb-acoes">
          <span />
          <button type="button" className="vx-btn vx-btn-primary" onClick={manter} disabled={enviando}>{enviando ? "Salvando…" : "Continuar com este plano"}</button>
        </div>
      </div>
    </div>
  );

  if (embutido) return (
    <div>
      <button type="button" className="vx-onb-voltar-topo" onClick={aoVoltar}>
        <ArrowLeft size={15} /> Voltar
      </button>
      <div className="vx-onb-eyebrow">Passo 5 de 6</div>
      <h1 className="vx-disp vx-onb-titulo">Pagamento em dólar</h1>
      <div className="vx-onb-card vx-onb-secao" style={{ maxWidth: 680 }}>
        <CheckoutStripe
          chavePublica={embutido.chavePublica}
          clientSecret={embutido.clientSecret}
          subscriptionId={embutido.subscriptionId}
          aoErro={(m) => { setEmbutido(null); setErro(m); }}
          aoConcluir={async (a) => {
            if (a) return terminar();
            setEmbutido(null);
            setErro("O pagamento ainda não foi confirmado pelo Stripe. Atualize a página em instantes.");
          }}
        />
        <div className="vx-onb-acoes">
          <button type="button" className="vx-btn" onClick={() => setEmbutido(null)}>Voltar às formas de pagamento</button>
          <span />
        </div>
      </div>
    </div>
  );

  if (pix) return (
    <div>
      <button type="button" className="vx-onb-voltar-topo" onClick={aoVoltar}>
        <ArrowLeft size={15} /> Voltar
      </button>
      <div className="vx-onb-eyebrow">Passo 5 de 6</div>
      <h1 className="vx-disp vx-onb-titulo">Autorize o Pix Automático</h1>
      <div className="vx-onb-card vx-onb-secao" style={{ maxWidth: 640 }}>
        <ol className="vx-mut" style={{ fontSize: 14, lineHeight: 1.7, paddingLeft: 18, margin: "0 0 14px" }}>
          <li>Abra o app do banco da empresa e leia o QR Code (ou use o Pix copia e cola).</li>
          <li>Confira e pague a ativação de <b>{money(TAXA_ATIVACAO_PIX_AUTOMATICO)}</b>. No mesmo passo o banco pede para autorizar o débito mensal da RYCS.</li>
          <li>A mensalidade de <b>{escolhido ? money(escolhido.preco) : "—"}</b> é debitada automaticamente a partir de <b>{formatarData(pix.primeiraCobranca)}</b>. Você pode cancelar a autorização no app do banco quando quiser.</li>
        </ol>
        {pix.imagem && <img src={`data:image/png;base64,${pix.imagem}`} alt="QR Code do Pix Automático" width={220} height={220} style={{ display: "block", margin: "0 auto 14px" }} />}
        {pix.payload && (
          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-pix`}>Pix copia e cola</label>
            <textarea id={`${id}-pix`} className="vx-input vx-mono" rows={3} readOnly value={pix.payload} onFocus={(e) => e.target.select()} />
            <button type="button" className="vx-btn" style={{ minHeight: 44, marginTop: 8 }} onClick={copiar}>
              <Copy size={15} aria-hidden="true" /> {copiado ? "Código copiado" : "Copiar código"}
            </button>
          </div>
        )}
        <p className="vx-onb-dica" role="status">Aguardando a confirmação do banco… Esta tela avança sozinha quando a autorização for confirmada.</p>
        <div className="vx-onb-acoes">
          <button type="button" className="vx-btn" onClick={() => setPix(null)}>Voltar</button>
          <span />
        </div>
      </div>
    </div>
  );

  const campo = (chave, label, props = {}, mascara = (v) => v) => (
    <div className="vx-onb-campo">
      <label className="vx-label" htmlFor={`${id}-${chave}`}>{label}</label>
      <input id={`${id}-${chave}`} className="vx-input" value={cartao[chave]}
        onChange={(e) => { setCartao((c) => ({ ...c, [chave]: mascara(e.target.value) })); if (erros[chave]) setErros((x) => ({ ...x, [chave]: undefined })); }}
        aria-invalid={erros[chave] ? true : undefined} aria-describedby={erros[chave] ? `${id}-${chave}-erro` : undefined} {...props} />
      {erros[chave] && <div id={`${id}-${chave}-erro`} className="vx-onb-erro" role="alert">{erros[chave]}</div>}
    </div>
  );

  const selecionarPlano = (chave) => {
    setPlano(chave);
    setErro("");
    setErros({});
    setTimeout(() => document.getElementById(`${id}-pag`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  return (
    <form onSubmit={assinar} noValidate>
      <button type="button" className="vx-onb-voltar-topo" onClick={aoVoltar} disabled={enviando}>
        <ArrowLeft size={15} /> Voltar
      </button>
      <div className="vx-onb-eyebrow">Passo 5 de 6</div>
      <h1 className="vx-disp vx-onb-titulo">{trial ? `Escolha seu plano e comece com ${trial} dias grátis` : "Escolha seu plano"}</h1>
      <p className="vx-mut vx-onb-card-apoio">{trial
        ? `A cobrança só começa depois dos ${trial} dias. Você pode cancelar antes sem pagar nada.`
        : "O plano libera a publicação de campanhas e os profissionais para a sua empresa."}</p>

      <PricingPlanos
        plans={dados.planos.filter((p) => p.preco > 0)}
        onContratar={(chave) => selecionarPlano(chave)}
        onUsarGratis={ativarGratis}
        planoAtualChave={null}
      />

      {plano && escolhido && escolhido.preco > 0 && (
        <section className="vx-onb-card" id={`${id}-pag`} aria-labelledby={`${id}-pag-t`} style={{ marginTop: 24 }}>
          <h2 id={`${id}-pag-t`} className="vx-disp" style={{ fontSize: 18, margin: "0 0 14px" }}>Pagamento — {escolhido.nome}</h2>
          <fieldset className="vx-onb-campo" style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
            <legend className="vx-label">Forma de pagamento</legend>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["pix", "Pix"], ...(stripe?.ativo ? [["internacional", "Empresa fora do Brasil (US$)"]] : [])].map(([v, rotulo]) => (
                <label key={v} className="vx-btn" data-on={forma === v ? "1" : "0"}
                  style={{ minHeight: 44, flex: 1, justifyContent: "center", ...(forma === v ? { borderColor: "var(--brand)", color: "var(--brand)" } : {}) }}>
                  <input type="radio" name={`${id}-forma`} value={v} checked={forma === v}
                    onChange={() => { setForma(v); setErros({}); setErro(""); }} style={{ marginRight: 6 }} />
                  {rotulo}
                </label>
              ))}
            </div>
          </fieldset>
          {forma === "internacional" ? <>
            <p className="vx-mut" style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 12px" }}>
              Para empresas de fora do Brasil. O pagamento em dólar abre aqui mesmo, no formulário seguro do Stripe, com cartão internacional
              (ou UPI, na Índia). Não pedimos CPF ou CNPJ.
            </p>
          </> : <>
            <p className="vx-mut" style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 12px" }}>
              Você paga {money(TAXA_ATIVACAO_PIX_AUTOMATICO)} agora para ativar e autoriza, no app do banco, o débito automático da mensalidade. Dá para cancelar no próprio banco quando quiser.
            </p>
            {campo("documento", "CPF ou CNPJ da empresa", { inputMode: "numeric" }, (v) => digitos(v).slice(0, 14))}
          </>}

          <dl className="vx-onb-resumo">
            <div><dt>Plano</dt><dd>{escolhido ? `${escolhido.nome} · ${forma === "internacional" ? usd(precoUsd) : money(escolhido.preco)}/mês` : "—"}</dd></div>
            <div><dt>Cobrado hoje</dt><dd>{forma === "internacional" ? (trial ? usd(0) : usd(precoUsd)) : `${money(TAXA_ATIVACAO_PIX_AUTOMATICO)} (ativação)`}</dd></div>
            <div><dt>{forma === "internacional" ? "Primeira cobrança" : "Primeiro débito automático"}</dt><dd>{escolhido ? (forma === "internacional" ? (trial ? `${usd(precoUsd)} daqui a ${trial} dias` : "hoje, no Stripe") : `${money(escolhido.preco)} em ${formatarData(cobrancaEm)}`) : "—"}</dd></div>
          </dl>

          <div aria-live="polite">{erro && <div className="vx-onb-erro" role="alert">{erro}</div>}</div>
          <button type="submit" className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" disabled={enviando || !plano}>
            {forma === "internacional"
              ? (enviando ? "Abrindo o Stripe…" : "Continuar para o pagamento em dólar")
              : (enviando ? "Gerando o Pix…" : "Gerar Pix de ativação")}
          </button>
          <p className="vx-onb-dica" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <ShieldCheck size={15} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
            {forma === "internacional"
              ? "O pagamento em dólar é processado pelo Stripe. A RYCS não vê nem guarda os dados do cartão."
              : "O Pix é processado pelo Asaas e autorizado por você no app do seu banco."}
          </p>
        </section>
      )}
    </form>
  );
}
