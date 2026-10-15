import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { formatarData, primeiraCobranca, primeiroDebitoPixAutomatico } from "../../../shared/assinatura.js";
import { TAXA_ATIVACAO_PIX_AUTOMATICO } from "../../../shared/planos.js";
import { normalizarDocumento } from "../../../shared/onboarding.js";

// Etapa 5: plano e pagamento. Planos e preços vêm de shared/planos.js pelo
// servidor; nada fixo aqui. O cartão vai ao gateway (Asaas) na requisição do
// checkout e não fica na RYCS: o que volta é bandeira e quatro dígitos.
// Pix Automático: a empresa paga um Pix de ativação pelo QR e autoriza, no
// app do banco, o débito mensal; a etapa conclui quando o banco confirma.

const digitos = (v) => String(v || "").replace(/\D/g, "");
const mascaraCartao = (v) => digitos(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
const mascaraValidade = (v) => { const d = digitos(v).slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
const mascaraCep = (v) => { const d = digitos(v).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };

function validarCartao(c) {
  const e = {};
  if (c.nome.trim().length < 3) e.nome = "Informe o nome como está no cartão.";
  if (digitos(c.numero).length < 13) e.numero = "Número do cartão incompleto.";
  const [mes, ano] = c.validade.split("/").map(Number);
  const agora = new Date();
  const fimValidade = new Date(2000 + (ano || 0), mes || 0, 1);
  if (!(mes >= 1 && mes <= 12) || !ano || fimValidade <= agora) e.validade = "Validade inválida (MM/AA).";
  if (!/^\d{3,4}$/.test(c.cvv)) e.cvv = "CVV com 3 ou 4 dígitos.";
  if (!normalizarDocumento(c.documento)) e.documento = "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).";
  if (digitos(c.cep).length !== 8) e.cep = "CEP com 8 dígitos.";
  if (!c.numeroEndereco.trim()) e.numeroEndereco = "Informe o número do endereço.";
  return e;
}

export default function EtapaPlano({ aoAtualizar, aoAvancar, aoVoltar }) {
  const id = useId();
  const [dados, setDados] = useState(null);
  const [erroCarga, setErroCarga] = useState("");
  const [plano, setPlano] = useState("");
  const [cartao, setCartao] = useState({ nome: "", numero: "", validade: "", cvv: "", documento: "", cep: "", numeroEndereco: "", telefone: "" });
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [forma, setForma] = useState("cartao"); // cartao | pix
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
  useEffect(() => { carregar(); }, []);

  const terminar = async () => {
    const r = await api("/onboarding");
    if (r && !r.error) { aoAtualizar(r); aoAvancar(r); }
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

  const assinar = async (e) => {
    e.preventDefault();
    setErro("");
    if (forma === "pix") return assinarPix();
    const v = validarCartao(cartao);
    setErros(v);
    if (Object.keys(v).length) {
      document.getElementById(`${id}-${Object.keys(v)[0]}`)?.focus();
      return;
    }
    const [mes, ano] = cartao.validade.split("/");
    setEnviando(true);
    const r = await api("/subscription", {
      plano, onboarding: true, formaPagamento: "CREDIT_CARD",
      cartao: { nome: cartao.nome, numero: digitos(cartao.numero), validadeMes: mes, validadeAno: ano, cvv: cartao.cvv },
      titular: { nome: cartao.nome, documento: digitos(cartao.documento), cep: digitos(cartao.cep), numero: cartao.numeroEndereco, telefone: digitos(cartao.telefone) },
    });
    setEnviando(false);
    if (!r || r.error) {
      // Recusa do cartão vem do gateway com o motivo. Os dados ficam na tela
      // para corrigir; o CVV é pedido de novo.
      setCartao((c) => ({ ...c, cvv: "" }));
      if (r?.campo) setErros({ [r.campo]: r.error });
      return setErro(r?.error ? `Não foi possível cadastrar o cartão: ${r.error}` : "Não foi possível cadastrar o cartão. Tente de novo.");
    }
    await terminar();
  };

  if (erroCarga) return (
    <div className="vx-onb-card vx-onb-estado" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
      <p>{erroCarga}</p>
      <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} onClick={carregar}>Tentar novamente</button>
    </div>
  );
  if (!dados) return <div className="vx-onb-estado" role="status">Carregando os planos…</div>;

  const trial = dados.trialDias;
  const escolhido = dados.planos.find((p) => p.chave === plano);
  // Sem trial, a primeira cobrança do cartão é agendada para 3 dias (regra do
  // checkout em server/routes/subscriptions.js).
  const cobrancaEm = forma === "pix"
    ? primeiroDebitoPixAutomatico({ trialDias: trial })
    : trial ? primeiraCobranca({ trialDias: trial }) : primeiraCobranca({ trialDias: 3 });

  if (dados.atual) return (
    <div>
      <div className="vx-onb-eyebrow">Passo 5 de 6</div>
      <h1 className="vx-disp vx-onb-titulo">Seu plano</h1>
      <div className="vx-onb-card vx-onb-secao" style={{ maxWidth: 640 }}>
        <div className="vx-onb-icone" aria-hidden="true"><Check size={22} /></div>
        <p style={{ fontSize: 15, margin: "0 0 6px" }}>A sua empresa já tem acesso liberado{dados.atual.nome ? <> no plano <b>{dados.atual.nome}</b></> : ""}.</p>
        <p className="vx-mut" style={{ fontSize: 14, margin: 0 }}>Nada é cobrado de novo. Para trocar de plano depois, use Minha Conta › Plano.</p>
        {erro && <div className="vx-onb-erro" role="alert">{erro}</div>}
        <div className="vx-onb-acoes">
          <button type="button" className="vx-btn" onClick={aoVoltar}>Voltar</button>
          <button type="button" className="vx-btn vx-btn-primary" onClick={manter} disabled={enviando}>{enviando ? "Salvando…" : "Continuar com este plano"}</button>
        </div>
      </div>
    </div>
  );

  if (pix) return (
    <div>
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
          <button type="button" className="vx-btn" onClick={() => { setPix(null); setForma("cartao"); }}>Usar cartão de crédito</button>
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

  return (
    <form onSubmit={assinar} noValidate>
      <div className="vx-onb-eyebrow">Passo 5 de 6</div>
      <h1 className="vx-disp vx-onb-titulo">{trial ? `Escolha seu plano e comece com ${trial} dias grátis` : "Escolha seu plano"}</h1>
      <p className="vx-mut vx-onb-card-apoio">{trial
        ? `A cobrança só começa depois dos ${trial} dias. Você pode cancelar antes sem pagar nada.`
        : "O plano libera a publicação de campanhas e os profissionais para a sua empresa."}</p>

      <div className="vx-onb-plano">
        <fieldset className="vx-onb-planos">
          <legend className="vx-label">Planos</legend>
          {dados.planos.map((p) => (
            <label key={p.chave} className="vx-onb-card vx-onb-opcao" data-on={plano === p.chave ? "1" : "0"}>
              <input type="radio" name={`${id}-plano`} value={p.chave} checked={plano === p.chave} onChange={() => setPlano(p.chave)} />
              <span>
                <b className="vx-disp">{p.nome}</b>
                <span className="vx-onb-preco">{money(p.preco)}<small>/mês</small></span>
                <ul>{(p.inclui || []).map((i) => <li key={i}>{i}</li>)}</ul>
              </span>
            </label>
          ))}
        </fieldset>

        <section className="vx-onb-card" aria-labelledby={`${id}-pag`}>
          <h2 id={`${id}-pag`} className="vx-disp" style={{ fontSize: 18, margin: "0 0 14px" }}>Pagamento</h2>
          <fieldset className="vx-onb-campo" style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
            <legend className="vx-label">Forma de pagamento</legend>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["cartao", "Cartão de crédito"], ["pix", "Pix Automático"]].map(([v, rotulo]) => (
                <label key={v} className="vx-btn" data-on={forma === v ? "1" : "0"}
                  style={{ minHeight: 44, flex: 1, justifyContent: "center", ...(forma === v ? { borderColor: "var(--brand)", color: "var(--brand)" } : {}) }}>
                  <input type="radio" name={`${id}-forma`} value={v} checked={forma === v}
                    onChange={() => { setForma(v); setErros({}); setErro(""); }} style={{ marginRight: 6 }} />
                  {rotulo}
                </label>
              ))}
            </div>
          </fieldset>
          {forma === "cartao" ? <>
            {campo("nome", "Nome no cartão", { autoComplete: "cc-name" })}
            {campo("numero", "Número do cartão", { autoComplete: "cc-number", inputMode: "numeric" }, mascaraCartao)}
            <div className="vx-onb-dois">
              {campo("validade", "Validade", { autoComplete: "cc-exp", inputMode: "numeric", placeholder: "MM/AA" }, mascaraValidade)}
              {campo("cvv", "CVV", { autoComplete: "cc-csc", inputMode: "numeric", maxLength: 4 }, (v) => digitos(v).slice(0, 4))}
            </div>
            {campo("documento", "CPF ou CNPJ do titular", { inputMode: "numeric" }, (v) => digitos(v).slice(0, 14))}
            <div className="vx-onb-dois">
              {campo("cep", "CEP de cobrança", { autoComplete: "postal-code", inputMode: "numeric" }, mascaraCep)}
              {campo("numeroEndereco", "Número", { autoComplete: "address-line2" })}
            </div>
          </> : <>
            <p className="vx-mut" style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 12px" }}>
              Você paga {money(TAXA_ATIVACAO_PIX_AUTOMATICO)} agora para ativar e autoriza, no app do banco, o débito automático da mensalidade. Dá para cancelar no próprio banco quando quiser.
            </p>
            {campo("documento", "CPF ou CNPJ da empresa", { inputMode: "numeric" }, (v) => digitos(v).slice(0, 14))}
          </>}

          <dl className="vx-onb-resumo">
            <div><dt>Plano</dt><dd>{escolhido ? `${escolhido.nome} · ${money(escolhido.preco)}/mês` : "—"}</dd></div>
            <div><dt>Cobrado hoje</dt><dd>{forma === "pix" ? `${money(TAXA_ATIVACAO_PIX_AUTOMATICO)} (ativação)` : money(0)}</dd></div>
            <div><dt>{forma === "pix" ? "Primeiro débito automático" : "Primeira cobrança"}</dt><dd>{escolhido ? `${money(escolhido.preco)} em ${formatarData(cobrancaEm)}` : "—"}{trial && forma === "cartao" ? ` (daqui a ${trial} dias)` : ""}</dd></div>
          </dl>

          <div aria-live="polite">{erro && <div className="vx-onb-erro" role="alert">{erro}</div>}</div>
          <button type="submit" className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" disabled={enviando || !plano}>
            {forma === "pix"
              ? (enviando ? "Gerando o Pix…" : "Gerar Pix de ativação")
              : enviando ? "Cadastrando o cartão…" : trial ? `Começar os ${trial} dias grátis` : "Assinar e continuar"}
          </button>
          <p className="vx-onb-dica" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <ShieldCheck size={15} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
            {forma === "pix"
              ? "O Pix Automático é processado pelo Asaas e autorizado por você no app do seu banco."
              : "Os dados do cartão vão direto ao Asaas, nosso processador de pagamentos. A RYCS não guarda número nem CVV."}
          </p>
        </section>
      </div>

      <div className="vx-onb-acoes">
        <button type="button" className="vx-btn" onClick={aoVoltar} disabled={enviando}>Voltar</button>
        <span />
      </div>
    </form>
  );
}
