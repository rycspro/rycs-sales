import { useCallback, useEffect, useState } from "react";
import { CreditCard, Globe, Loader, ShieldCheck, X } from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { PLANOS, ORDEM_PLANOS, CICLOS, valorCobradoNoCiclo } from "../../../shared/planos.js";
import PricingPlanos from "./PricingPlanos.jsx";
import CheckoutStripe from "./CheckoutStripe.jsx";
import HoloCard from "../HoloCard.jsx";

const PLANOS_ESTATICOS = ORDEM_PLANOS.filter((k) => PLANOS[k].preco > 0).map((k) => ({
  chave: k, nome: PLANOS[k].nome, preco: PLANOS[k].preco, takeRate: PLANOS[k].takeRate, inclui: PLANOS[k].inclui, trial: PLANOS[k].trial,
}));

const SO_DIGITOS = (v) => String(v).replace(/\D/g, "");
const mascaraCartao = (v) => SO_DIGITOS(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();

export default function PlanosEmpresa({ aviso, recarregar }) {
  const [planos, setPlanos] = useState([]);
  const [atual, setAtual] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [ciclo, setCiclo] = useState(CICLOS.MENSAL);
  const [voucher, setVoucher] = useState("");
  const [desconto, setDesconto] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [forma, setForma] = useState("");
  const [cartao, setCartao] = useState({ nome: "", numero: "", validadeMes: "", validadeAno: "", cvv: "" });
  const [titular, setTitular] = useState({ nome: "", email: "", documento: "", cep: "", numero: "", telefone: "" });
  const [salvarCartao, setSalvarCartao] = useState(false);
  const [cartoesSalvos, setCartoesSalvos] = useState([]);
  const [cardSalvoId, setCardSalvoId] = useState(null); // cartão salvo selecionado
  const [stripe, setStripe] = useState(null);
  const [embutido, setEmbutido] = useState(null);

  const carregar = useCallback(async () => {
    const [p, s] = await Promise.all([api("/plans"), api("/subscription")]);
    if (Array.isArray(p) && p.length > 0) setPlanos(p.filter((x) => x.preco > 0));
    else setPlanos(PLANOS_ESTATICOS);
    if (s && !s.error) setAtual(s);
  }, []);

  useEffect(() => {
    carregar();
    api("/stripe/status").then((r) => r && !r.error && setStripe(r));
    api("/saved-cards").then((r) => Array.isArray(r) && setCartoesSalvos(r));
  }, [carregar]);

  const abrirModal = (p, cicloEscolhido = CICLOS.MENSAL) => {
    setSelecionado(p);
    setCiclo(cicloEscolhido);
    setVoucher("");
    setDesconto(null);
    setForma("");
    setEmbutido(null);
    setCardSalvoId(null);
    setSalvarCartao(false);
    setCartao({ nome: "", numero: "", validadeMes: "", validadeAno: "", cvv: "" });
    setTitular({ nome: "", email: "", documento: "", cep: "", numero: "", telefone: "" });
  };

  const aplicar = async () => {
    const r = await api(`/vouchers/validate?codigo=${encodeURIComponent(voucher)}&plano=${selecionado.chave}&ciclo=${ciclo}`);
    if (r?.error) { setDesconto(null); return aviso(r.error); }
    setDesconto(r);
    aviso("Voucher aplicado ao checkout.");
  };

  const contratar = async () => {
    // Empresa fora do Brasil: paga em dólar na página do Stripe.
    if (forma === "STRIPE") {
      setProcessando(true);
      const r = await api("/subscription/stripe", { plano: selecionado.chave, ciclo, retorno: window.location.pathname, embutido: !!stripe?.chavePublica });
      setProcessando(false);
      if (r?.clientSecret && r?.chavePublica) { setEmbutido(r); return; }
      if (!r || r.error || !r.url) return aviso(r?.error || "Não foi possível abrir o pagamento internacional.");
      window.location.href = r.url;
      return;
    }
    const ehCartao = forma === "CREDIT_CARD" || forma === "DEBIT_CARD";
    if (ehCartao && !cardSalvoId) {
      const LABELS = { nome: "nome no cartão", numero: "número do cartão", validadeMes: "mês de validade", validadeAno: "ano de validade", cvv: "CVV" };
      const faltando = Object.entries(cartao).filter(([, v]) => !String(v).trim());
      if (faltando.length) return aviso(`Preencha: ${faltando.map(([k]) => LABELS[k] || k).join(", ")}.`);
      if (!titular.cep || !titular.numero) return aviso("Informe CEP e número do endereço de cobrança.");
    }

    setProcessando(true);
    const r = await api("/subscription", {
      plano: selecionado.chave,
      ciclo,
      voucher: voucher || undefined,
      formaPagamento: forma,
      savedCardId: cardSalvoId || undefined,
      cartao: ehCartao && !cardSalvoId ? cartao : undefined,
      titular: ehCartao && !cardSalvoId ? titular : undefined,
      salvarCartao: ehCartao && !cardSalvoId && salvarCartao ? true : undefined,
    });
    setProcessando(false);

    if (r?.error) return aviso(r.error);

    // Atualizar cartões salvos caso tenha salvo um novo
    if (salvarCartao) api("/saved-cards").then((c) => Array.isArray(c) && setCartoesSalvos(c));

    if (r.jaPago) { aviso("Pagamento confirmado. Liberando seu acesso."); setSelecionado(null); await carregar(); return; }
    await carregar();
    aviso(r.message || "Plano contratado com sucesso.");
  };

  const abrirPortal = async () => {
    const r = await api("/subscription/stripe/portal", { retorno: window.location.pathname });
    if (r?.url) window.location.href = r.url;
    else aviso(r?.error || "Não foi possível abrir o portal de pagamento.");
  };

  const cancelar = async () => {
    const r = await apiDelete("/subscription");
    if (r?.error) return aviso(r.error);
    await carregar();
    await recarregar?.();
    aviso(r.message);
  };

  // Voltar ao plano gratuito. Com assinatura paga ativa/pendente/trial, o caminho
  // correto é cancelar (encerra a recorrência no gateway); sem ela, troca direta.
  const usarGratis = async () => {
    const status = atual?.assinatura?.status;
    if (["ativa", "pendente", "trial", "inadimplente"].includes(status)) return cancelar();
    const r = await api("/subscription", { plano: "free", ciclo: CICLOS.MENSAL });
    if (r?.error) return aviso(r.error);
    await carregar();
    await recarregar?.();
    aviso(r.message || "Plano alterado para Grátis.");
  };

  if (!planos.length) return <div className="vx-card vx-skeleton" style={{ height: 180 }} />;

  // Valor-base do checkout conforme o ciclo escolhido (semestral/anual = 6/12
  // meses com desconto, cobrados de uma vez).
  // Origem do pagamento derivada da forma: vazio = nada escolhido; STRIPE =
  // internacional; qualquer outra (cartão/Pix) = nacional.
  const origem = forma ? (forma === "STRIPE" ? "internacional" : "nacional") : null;
  const baseCiclo = selecionado ? valorCobradoNoCiclo(selecionado.chave, ciclo) : 0;
  const cicloLabel = { MENSAL: "mensal", SEMESTRAL: "semestral", ANUAL: "anual" }[ciclo] || "mensal";
  const cicloSufixo = { MENSAL: "/mês", SEMESTRAL: "/semestre", ANUAL: "/ano" }[ciclo] || "/mês";
  const ehRecorrenteLongo = ciclo !== CICLOS.MENSAL;
  const precoFinal = desconto?.valorFinal ?? baseCiclo;
  const usdPlano = selecionado && stripe?.planos?.find((x) => x.chave === selecionado.chave);
  const precoUsd = usdPlano ? ({ MENSAL: usdPlano.mensal, SEMESTRAL: usdPlano.semestral, ANUAL: usdPlano.anual }[ciclo] ?? usdPlano.mensal) : 0;
  const usd = (n) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="vx-fade">
      <div>
        <div style={{ padding: "4px 0 16px" }}>
          <div className="vx-eyebrow">Assinatura empresarial</div>
          <h1 className="vx-disp" style={{ margin: "2px 0 3px" }}>Planos RYCS</h1>
          <p style={{ margin: 0 }}>Escolha o plano que acompanha o ritmo da sua operação: quanto mais você escala, menor a taxa por movimentações. Comece com 5 dias grátis nos planos Scale e Premium, sem compromisso.</p>
        </div>

        <div style={{ padding: "4px 0 8px" }}>
            <PricingPlanos
              plans={planos}
              planoAtualChave={atual?.plano}
              onUsarGratis={usarGratis}
              onContratar={(chave, cicloEscolhido) => {
                const p = planos.find((x) => x.chave === chave);
                if (p) abrirModal(p, cicloEscolhido);
              }}
            />

            {atual?.assinatura?.status === "pendente" && (
              <div className="vx-notice vx-notice-amber" style={{ marginTop: 14 }}>
                Existe uma assinatura aguardando pagamento. Atualize a página após pagar; o webhook confirmará o status.
              </div>
            )}
            {["ativa", "pendente", "trial"].includes(atual?.assinatura?.status) && (
              <button className="vx-btn vx-btn-danger" style={{ marginTop: 14 }} onClick={cancelar}>Cancelar assinatura</button>
            )}
            {atual?.assinatura?.gateway === "stripe" && ["ativa", "trial", "inadimplente"].includes(atual?.assinatura?.status) && (
              <button className="vx-btn" style={{ marginTop: 14, marginLeft: 8 }} onClick={abrirPortal}>
                <CreditCard size={14} /> Cartão e faturas (Stripe)
              </button>
            )}
        </div>
      </div>

      {/* Modal de checkout */}
      {selecionado && (
        <div className="vx-overlay" onClick={() => setSelecionado(null)}>
          <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: embutido ? 640 : 520 }}>
            <div className="vx-row">
              <div>
                <div className="vx-eyebrow">Checkout seguro</div>
                <h2 className="vx-disp" style={{ margin: "3px 0" }}>{selecionado.nome}</h2>
              </div>
              <button className="vx-btn vx-btn-ghost" onClick={() => setSelecionado(null)}><X size={16} /></button>
            </div>

            {embutido ? (
              <CheckoutStripe
                chavePublica={embutido.chavePublica}
                clientSecret={embutido.clientSecret}
                subscriptionId={embutido.subscriptionId}
                aoErro={(m) => { setEmbutido(null); aviso(m); }}
                aoConcluir={async (a) => {
                  setEmbutido(null);
                  setSelecionado(null);
                  await carregar();
                  await recarregar?.();
                  aviso(a ? `Plano ${selecionado.nome} liberado!` : "Pagamento recebido. O plano aparece em instantes; atualize a página se precisar.");
                }}
              />
            ) : (
              <>
                {/* Resumo */}
                <div className="vx-checkout-total">
                  <span>Plano {selecionado.nome} · {cicloLabel}</span><b>{money(baseCiclo)}</b>
                  {ehRecorrenteLongo && (
                    <><span>Cobrança</span><b>{money(baseCiclo)}{cicloSufixo}</b></>
                  )}
                  {desconto && (
                    <>
                      <span>Voucher {desconto.codigo}</span><b>- {money(desconto.desconto)}</b>
                      <span>Total</span><strong>{money(desconto.valorFinal)}</strong>
                    </>
                  )}
                </div>

                {/* Voucher */}
                <label style={{ display: "block", marginBottom: 16 }}>
                  <span className="vx-label">Voucher</span>
                  <div style={{ display: "flex", gap: 7 }}>
                    <input className="vx-input" value={voucher}
                      onChange={(e) => { setVoucher(e.target.value.toUpperCase()); setDesconto(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && voucher) aplicar(); }} />
                    <button className="vx-btn" onClick={aplicar} disabled={!voucher}>Aplicar</button>
                  </div>
                </label>

                {/* Forma de pagamento — 1º escolhe a origem (nacional/internacional),
                    depois a forma específica. Nacional = Asaas (cartão/Pix, R$);
                    internacional = Stripe (cartão em US$). */}
                <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Forma de pagamento</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  {[
                    { id: "nacional", titulo: "Pagamento nacional", sub: "Cartão de crédito ou débito · R$", icone: <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">🇧🇷</span> },
                    ...(stripe?.ativo ? [{ id: "internacional", titulo: "Pagamento internacional", sub: "Cartão · US$", icone: <Globe size={26} strokeWidth={1.8} aria-hidden="true" /> }] : []),
                  ].map(({ id, titulo, sub, icone }) => {
                    const on = origem === id;
                    return (
                      <button key={id} type="button"
                        onClick={() => setForma(id === "nacional" ? "CREDIT_CARD" : "STRIPE")}
                        style={{
                          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                          padding: "16px 12px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                          border: `1.5px solid ${on ? "var(--brand)" : "var(--border)"}`,
                          background: on ? "var(--brand-50)" : "var(--surface)",
                          color: on ? "var(--brand)" : "var(--ink)", transition: "border-color .15s, background .15s",
                        }}>
                        {icone}
                        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{titulo}</span>
                        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Formas específicas do pagamento nacional (Asaas) */}
                {origem === "nacional" && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    {[["CREDIT_CARD", "Cartão de crédito"], ["DEBIT_CARD", "Cartão de débito"]].map(([k, t]) => (
                      <button key={k} className="vx-btn" onClick={() => setForma(k)} style={{
                        flex: 1, fontSize: 12,
                        borderColor: forma === k ? "var(--brand)" : undefined,
                        background: forma === k ? "var(--brand-50)" : undefined,
                        color: forma === k ? "var(--brand)" : undefined,
                      }}>{t}</button>
                    ))}
                  </div>
                )}

                {/* Cartões salvos + Formulário de cartão */}
                {(forma === "CREDIT_CARD" || forma === "DEBIT_CARD") && (
                  <>
                    {cartoesSalvos.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div className="vx-label" style={{ marginBottom: 6 }}>Cartões salvos</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {cartoesSalvos.map((c) => (
                            <button key={c.id} className="vx-btn" onClick={() => { setCardSalvoId(cardSalvoId === c.id ? null : c.id); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, justifyContent: "flex-start",
                                borderColor: cardSalvoId === c.id ? "var(--brand)" : undefined,
                                background: cardSalvoId === c.id ? "var(--brand-50)" : undefined,
                                color: cardSalvoId === c.id ? "var(--brand)" : undefined,
                              }}>
                              <CreditCard size={15} />
                              <span>{c.bandeira} •••• {c.final4}</span>
                              {c.apelido && <span className="vx-mut" style={{ fontSize: 11 }}>({c.apelido})</span>}
                            </button>
                          ))}
                          <button className="vx-btn" onClick={() => setCardSalvoId(null)}
                            style={{
                              fontSize: 12, justifyContent: "flex-start",
                              borderColor: !cardSalvoId ? "var(--brand)" : undefined,
                              background: !cardSalvoId ? "var(--brand-50)" : undefined,
                              color: !cardSalvoId ? "var(--brand)" : undefined,
                            }}>
                            + Usar novo cartão
                          </button>
                        </div>
                      </div>
                    )}

                    {!cardSalvoId && (<>
                    <div style={{ margin: "4px auto 16px", maxWidth: 320 }}>
                      <HoloCard
                        holder={cartao.nome || "RYCS"}
                        number={cartao.numero || "0000000000000000"}
                        expires={cartao.validadeMes && cartao.validadeAno ? `${String(cartao.validadeMes).padStart(2, "0")}/${String(cartao.validadeAno).slice(-2)}` : "••/••"}
                        cvv={cartao.cvv || "•••"}
                        tier={forma === "DEBIT_CARD" ? "Débito" : "Crédito"}
                      />
                    </div>
                    <label><div className="vx-label">Nome impresso no cartão</div>
                      <input className="vx-input" value={cartao.nome}
                        onChange={(e) => setCartao({ ...cartao, nome: e.target.value })} autoComplete="cc-name" /></label>

                    <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">Número do cartão</div>
                      <input className="vx-input vx-mono" inputMode="numeric" value={mascaraCartao(cartao.numero)}
                        onChange={(e) => setCartao({ ...cartao, numero: SO_DIGITOS(e.target.value) })}
                        placeholder="0000 0000 0000 0000" autoComplete="cc-number" /></label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                      <label><div className="vx-label">Mês</div>
                        <input className="vx-input vx-mono" inputMode="numeric" maxLength={2} placeholder="12"
                          value={cartao.validadeMes}
                          onChange={(e) => setCartao({ ...cartao, validadeMes: SO_DIGITOS(e.target.value).slice(0, 2) })} /></label>
                      <label><div className="vx-label">Ano</div>
                        <input className="vx-input vx-mono" inputMode="numeric" maxLength={4} placeholder="2030"
                          value={cartao.validadeAno}
                          onChange={(e) => setCartao({ ...cartao, validadeAno: SO_DIGITOS(e.target.value).slice(0, 4) })} /></label>
                      <label><div className="vx-label">CVV</div>
                        <input className="vx-input vx-mono" inputMode="numeric" maxLength={4} placeholder="123"
                          value={cartao.cvv}
                          onChange={(e) => setCartao({ ...cartao, cvv: SO_DIGITOS(e.target.value).slice(0, 4) })} /></label>
                    </div>

                    <div className="vx-eyebrow" style={{ margin: "16px 0 10px" }}>Endereço de cobrança</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <label><div className="vx-label">CEP</div>
                        <input className="vx-input vx-mono" inputMode="numeric" value={titular.cep}
                          onChange={(e) => setTitular({ ...titular, cep: SO_DIGITOS(e.target.value).slice(0, 8) })} /></label>
                      <label><div className="vx-label">Número</div>
                        <input className="vx-input" value={titular.numero}
                          onChange={(e) => setTitular({ ...titular, numero: e.target.value })} /></label>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                      <label><div className="vx-label">E-mail do titular</div>
                        <input className="vx-input" type="email" value={titular.email}
                          onChange={(e) => setTitular({ ...titular, email: e.target.value })} /></label>
                      <label><div className="vx-label">Telefone</div>
                        <input className="vx-input vx-mono" inputMode="tel" value={titular.telefone}
                          onChange={(e) => setTitular({ ...titular, telefone: e.target.value })} /></label>
                    </div>

                    <div className="vx-mut" style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
                      <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      Os dados do cartão vão direto ao processador de pagamento. A RYCS não guarda o número nem o CVV.
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer", fontSize: 12.5 }}>
                      <input type="checkbox" checked={salvarCartao} onChange={(e) => setSalvarCartao(e.target.checked)} />
                      Salvar este cartão para pagamentos futuros
                    </label>
                    </>)}
                  </>
                )}

                {forma === "STRIPE" && (
                  <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>
                    <ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                    Para empresas fora do Brasil: {usd(precoUsd)}{cicloSufixo}, pagos no formulário seguro do Stripe, aqui mesmo, com cartão
                    internacional (ou UPI, na Índia). Cupons são aplicados direto no Stripe. O plano é liberado quando o Stripe confirmar.
                  </div>
                )}

                <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }}
                  disabled={processando || !forma} onClick={contratar}>
                  {processando
                    ? <><Loader size={15} /> Processando…</>
                    : forma === "STRIPE"
                      ? <><CreditCard size={15} /> Continuar para o pagamento ({usd(precoUsd)})</>
                      : <><CreditCard size={15} /> Confirmar {money(precoFinal ?? selecionado.preco)}</>}
                </button>
                <p className="vx-chart-source">
                  Nenhuma cobrança é feita sem esta confirmação. Ativação apenas após confirmação do gateway.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
