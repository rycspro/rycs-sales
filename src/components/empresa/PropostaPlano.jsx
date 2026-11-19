import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle, CreditCard, Crown, Loader, QrCode, X } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { lerProposta, limparProposta } from "../../lib/rotas.js";
import FormularioCartao, { CARTAO_VAZIO, TITULAR_VAZIO, erroDoCartao } from "./FormularioCartao.jsx";

// Proposta Enterprise aberta pelo link que a RYCS mandou (/proposta/<token>).
//
// Tudo o que a empresa vai pagar e aceitar fica numa tela só: plano-base,
// ciclo, valor, desconto, nicho, território e as condições por extenso. O
// botão de pagar só libera depois do "li e aceito" — o servidor também exige
// o aceite e grava quem aceitou e quando. A forma de pagamento (Pix, cartão
// ou as duas) é a que a RYCS definiu na proposta; o plano é liberado quando o
// gateway confirmar.

const CICLO_ROTULO = { MENSAL: "mensal", SEMESTRAL: "semestral", ANUAL: "anual" };
const SO_DIGITOS = (v) => String(v).replace(/\D/g, "");
const ROTULO_FORMA = { PIX: "Pix", CREDIT_CARD: "Cartão de crédito" };

export default function PropostaPlano({ token: tokenDaRota, aviso, aoConcluir }) {
  const [token] = useState(() => tokenDaRota || lerProposta());
  const [proposta, setProposta] = useState(null);
  const [aceite, setAceite] = useState(false);
  const [documento, setDocumento] = useState("");
  const [forma, setForma] = useState("PIX");
  const [cartao, setCartao] = useState(CARTAO_VAZIO);
  const [titular, setTitular] = useState(TITULAR_VAZIO);
  const [pagando, setPagando] = useState(false);
  const [pix, setPix] = useState(null);
  const [pago, setPago] = useState(false);
  const [fechada, setFechada] = useState(false);
  // Mensagens ficam dentro da janela: o aviso (toast) do app fica por baixo
  // da sobreposição e a empresa não o veria.
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    api(`/proposta/${encodeURIComponent(token)}`).then((r) => {
      if (r && !r.error) setForma(r.formasPagamento?.[0] || "PIX");
      setProposta(r && !r.error ? r : { error: r?.error || "Não foi possível abrir a proposta agora." });
    });
  }, [token]);

  // Pix gerado: confere a cada 5 s se a assinatura da proposta já ativou.
  useEffect(() => {
    if (!pix?.subscriptionId) return undefined;
    pollRef.current = setInterval(async () => {
      const r = await api("/subscription");
      if (r?.assinatura?.id === pix.subscriptionId && r.assinatura.status === "ativa") {
        clearInterval(pollRef.current);
        setPix(null);
        setPago(true);
        aoConcluir?.();
      }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [pix?.subscriptionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fechar = () => {
    clearInterval(pollRef.current);
    limparProposta();
    if (window.location.pathname.startsWith("/proposta/")) window.history.replaceState(null, "", "/");
    setFechada(true);
  };

  const pagar = async () => {
    if (!aceite) return;
    const ehCartao = forma === "CREDIT_CARD";
    const falta = ehCartao ? erroDoCartao(cartao, titular) : "";
    if (falta) return setErro(falta);
    setErro("");
    setPagando(true);
    const r = await api("/subscription", {
      proposta: token,
      aceiteCondicoes: true,
      formaPagamento: forma,
      documento: proposta?.precisaDocumento && !ehCartao ? documento : undefined,
      cartao: ehCartao ? cartao : undefined,
      titular: ehCartao ? titular : undefined,
    });
    setPagando(false);
    // O CVV não fica na tela depois de enviado, deu certo ou não.
    if (ehCartao) setCartao((c) => ({ ...c, cvv: "" }));
    if (!r || r.error) return setErro(r?.error || "Sem resposta do servidor. Verifique a conexão e tente de novo.");
    if (r.jaPago) { setPago(true); aoConcluir?.(); return; }
    // Cartão em análise no gateway: espera a confirmação como no Pix.
    if (ehCartao) { setPix({ subscriptionId: r.subscriptionId, cartao: true }); return; }
    if (r.pixCopiaECola || r.pixQrCodeBase64) { setPix(r); return; }
    if (r.invoiceUrl) {
      // Sem QR, mas com fatura: abrir a fatura é o caminho de pagamento.
      window.open(r.invoiceUrl, "_blank", "noopener");
      setPix({ subscriptionId: r.subscriptionId, fatura: true });
      return;
    }
    fechar();
    aviso(r.message || "Assinatura registrada.");
  };

  if (!token || fechada) return null;

  const folha = (conteudo, largura = 560) => (
    <div className="vx-overlay" style={{ zIndex: 1100 }} role="dialog" aria-modal="true" aria-label="Proposta Enterprise">
      <div className="vx-sheet" style={{ maxWidth: largura, maxHeight: "92vh", overflowY: "auto" }}>{conteudo}</div>
    </div>
  );

  if (!proposta) return folha(
    <div style={{ padding: 30, textAlign: "center" }} role="status">
      <Loader size={22} style={{ animation: "spin 1s linear infinite" }} />
      <p className="vx-mut" style={{ margin: "10px 0 0", fontSize: 13 }}>Abrindo a proposta…</p>
    </div>, 420);

  if (proposta.error) return folha(
    <div style={{ padding: "26px 10px", textAlign: "center" }}>
      <Crown size={30} color="var(--brand)" aria-hidden="true" />
      <h2 className="vx-disp" style={{ margin: "12px 0 6px", fontSize: 19 }}>Proposta Enterprise</h2>
      <p className="vx-mut" style={{ margin: "0 0 20px", fontSize: 13.5 }}>{proposta.error}</p>
      <button className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={fechar}>Fechar</button>
    </div>, 420);

  if (pago) return folha(
    <div style={{ padding: "30px 10px", textAlign: "center" }}>
      <CheckCircle size={56} color="var(--brand)" style={{ marginBottom: 14 }} aria-hidden="true" />
      <h2 className="vx-disp" style={{ margin: "0 0 8px", fontSize: 20 }}>Pagamento confirmado</h2>
      <p className="vx-mut" style={{ margin: "0 0 22px", fontSize: 13.5 }}>
        Seu plano Enterprise ({proposta.planoNome}) está ativo. Boas vendas!
      </p>
      <button className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={fechar}>Continuar</button>
    </div>, 420);

  if (pix) return folha(
    <div style={{ textAlign: "center", padding: "10px 4px" }}>
      {pix.cartao ? <CreditCard size={30} color="var(--brand)" aria-hidden="true" /> : <QrCode size={30} color="var(--brand)" aria-hidden="true" />}
      <h2 style={{ margin: "12px 0 4px", fontSize: 20 }}>{pix.cartao ? "Pagamento com cartão em análise" : "Pague com Pix para ativar"}</h2>
      <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 16px" }}>
        {money(proposta.valorFinal)}. {pix.fatura ? "Abrimos a fatura numa nova aba para você pagar. " : ""}O plano é liberado assim que o pagamento for confirmado.
      </p>
      {pix.pixQrCodeBase64 && (
        <img src={`data:image/png;base64,${pix.pixQrCodeBase64}`} alt="QR Code Pix"
          style={{ width: 200, height: 200, margin: "0 auto 16px", display: "block", borderRadius: 10 }} />
      )}
      {pix.pixCopiaECola && (
        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 44 }}
          onClick={() => { navigator.clipboard?.writeText(pix.pixCopiaECola); setCopiado(true); }}>
          {copiado ? "Código Pix copiado" : "Copiar código Pix"}
        </button>
      )}
      <div className="vx-mut" style={{ fontSize: 12, margin: "12px 0 4px", display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }} role="status">
        <Loader size={13} style={{ animation: "spin 1s linear infinite" }} aria-hidden="true" /> Aguardando a confirmação do pagamento
      </div>
      <button className="vx-btn vx-btn-block" style={{ marginTop: 8, minHeight: 44 }} onClick={fechar}>Fechar</button>
    </div>, 420);

  const p = proposta;
  const ciclo = CICLO_ROTULO[p.ciclo] || "mensal";
  const pctDesconto = p.valorOriginal > 0 && p.desconto > 0 ? Math.round((p.desconto / p.valorOriginal) * 100) : 0;
  const formas = p.formasPagamento?.length ? p.formasPagamento : ["PIX"];
  const ehCartao = forma === "CREDIT_CARD";
  // No cartão, o CPF/CNPJ do titular já vai no formulário do cartão.
  const docOk = !p.precisaDocumento || ehCartao || [11, 14].includes(SO_DIGITOS(documento).length);

  return folha(
    <>
      <div className="vx-row">
        <div>
          <div className="vx-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Crown size={13} aria-hidden="true" /> Proposta Enterprise
          </div>
          <h2 className="vx-disp" style={{ margin: "3px 0 2px" }}>Plano {p.planoNome} · {ciclo}</h2>
          <div className="vx-mut" style={{ fontSize: 12.5 }}>Para {p.cliente}</div>
        </div>
        <button className="vx-btn vx-btn-ghost" aria-label="Fechar proposta" onClick={fechar} style={{ minHeight: 44, minWidth: 44 }}><X size={16} /></button>
      </div>

      <div className="vx-checkout-total" style={{ marginTop: 14 }}>
        {p.desconto > 0 && (
          <>
            <span>Preço cheio ({p.meses} {p.meses > 1 ? "meses" : "mês"})</span>
            <b style={{ textDecoration: "line-through", fontWeight: 500 }}>{money(p.valorOriginal)}</b>
            <span>Desconto{pctDesconto ? ` de ${pctDesconto}%` : ""}</span>
            <b>- {money(p.desconto)}</b>
          </>
        )}
        <span>Total {ciclo}</span>
        <strong>{money(p.valorFinal)}</strong>
      </div>
      {p.meses > 1 && (
        <div className="vx-mut" style={{ fontSize: 12, margin: "-4px 0 12px" }}>
          Equivale a {money(p.valorFinal / p.meses)} por mês, pagos de uma vez a cada {p.meses} meses.
        </div>
      )}

      {(p.nicho || p.territorio) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {p.nicho && <span className="vx-badge vx-badge-brand">Nicho: {p.nicho}</span>}
          {p.territorio && <span className="vx-badge vx-badge-brand">Território: {p.territorio}</span>}
        </div>
      )}

      <div className="vx-eyebrow" style={{ marginBottom: 8 }}>O que está incluído</div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "grid", gap: 7 }}>
        {(p.inclui || []).map((i) => (
          <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
            <Check size={15} color="var(--brand)" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" /> {i}
          </li>
        ))}
      </ul>

      <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Condições</div>
      <div tabIndex={0} aria-label="Condições da proposta" style={{
        whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6, maxHeight: 260, overflowY: "auto",
        padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)",
      }}>{p.condicoes}</div>
      <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.6, margin: "10px 0 14px" }}>
        A cobrança se repete a cada {p.meses > 1 ? `${p.meses} meses` : "mês"} pelo mesmo valor até ser cancelada.
        Proposta válida até {new Date(p.expiraEm).toLocaleDateString("pt-BR")}.
      </div>

      <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Forma de pagamento</div>
      {formas.length > 1 ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }} role="group" aria-label="Forma de pagamento">
          {formas.map((f) => {
            const on = forma === f;
            return (
              <button key={f} type="button" aria-pressed={on} onClick={() => { setForma(f); setErro(""); }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44,
                  padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: on ? 600 : 400,
                  border: `1.5px solid ${on ? "var(--brand)" : "var(--border)"}`,
                  background: on ? "var(--brand-50)" : "var(--surface)",
                  color: on ? "var(--brand)" : "var(--ink)",
                }}>
                {f === "PIX" ? <QrCode size={15} aria-hidden="true" /> : <CreditCard size={15} aria-hidden="true" />} {ROTULO_FORMA[f]}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>
          {ehCartao ? <CreditCard size={15} color="var(--brand)" aria-hidden="true" /> : <QrCode size={15} color="var(--brand)" aria-hidden="true" />} {ROTULO_FORMA[forma]}
        </div>
      )}

      {ehCartao && (
        <div style={{ marginBottom: 12 }}>
          <FormularioCartao cartao={cartao} setCartao={setCartao} titular={titular} setTitular={setTitular} />
        </div>
      )}

      {p.precisaDocumento && !ehCartao && (
        <label style={{ display: "block", marginBottom: 12 }}>
          <div className="vx-label">CPF ou CNPJ da empresa</div>
          <input className="vx-input vx-mono" inputMode="numeric" value={documento}
            onChange={(e) => setDocumento(SO_DIGITOS(e.target.value).slice(0, 14))} placeholder="Somente números" />
        </label>
      )}

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 13.5, fontWeight: 600, padding: "10px 0", minHeight: 44 }}>
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0 }} />
        Li e aceito as condições desta proposta.
      </label>

      {erro && (
        <div role="alert" style={{
          fontSize: 13, lineHeight: 1.5, padding: "10px 12px", margin: "4px 0 8px", borderRadius: 10,
          background: "var(--red-100)", color: "var(--red)",
        }}>{erro}</div>
      )}

      <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 6, minHeight: 44 }}
        disabled={!aceite || !docOk || pagando} onClick={pagar}>
        {pagando
          ? <><Loader size={15} /> {ehCartao ? "Processando…" : "Gerando o Pix…"}</>
          : ehCartao
            ? <><CreditCard size={15} /> Pagar com cartão {money(p.valorFinal)}</>
            : <><QrCode size={15} /> Pagar com Pix {money(p.valorFinal)}</>}
      </button>
      <p className="vx-chart-source">
        Nenhuma cobrança é feita sem esta confirmação. O plano é liberado quando o pagamento for confirmado.
      </p>
    </>
  );
}
