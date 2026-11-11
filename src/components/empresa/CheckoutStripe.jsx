import { useEffect, useRef, useState } from "react";
import { Loader } from "lucide-react";
import { api } from "../../lib/api.js";

// Checkout do Stripe embutido na RYCS (Embedded Checkout).
//
// O formulário é do Stripe, num iframe dele: cartão, UPI, Apple/Google Pay e
// a autenticação do banco acontecem ali, sem o cliente sair da plataforma e
// sem a RYCS ver os dados do cartão. O Stripe.js só pode ser carregado de
// js.stripe.com (exigência do Stripe para conformidade PCI), por isso o
// script é injetado aqui e não empacotado. A versão do script acompanha a da
// API da conta (2026-09-30.endive): nela o método é createEmbeddedCheckoutPage
// e a sessão usa ui_mode "embedded_page".
//
// Quem libera o plano continua sendo o webhook. Ao concluir, esta tela só
// espera a assinatura aparecer como ativa/trial em GET /subscription.

let carregando = null;
function carregarStripeJs() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (!carregando) {
    carregando = new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = "https://js.stripe.com/endive/stripe.js";
      s.async = true;
      s.onload = () => (window.Stripe ? ok(window.Stripe) : falha(new Error("Stripe.js indisponível")));
      s.onerror = () => { carregando = null; falha(new Error("Stripe.js indisponível")); };
      document.head.appendChild(s);
    });
  }
  return carregando;
}

export default function CheckoutStripe({ chavePublica, clientSecret, subscriptionId, aoConcluir, aoErro }) {
  const alvo = useRef(null);
  const [fase, setFase] = useState("carregando"); // carregando | pronto | confirmando | erro

  useEffect(() => {
    let checkout = null;
    let vivo = true;
    carregarStripeJs()
      .then(async (Stripe) => {
        if (!vivo) return;
        const stripe = Stripe(chavePublica);
        const criar = (stripe.createEmbeddedCheckoutPage || stripe.initEmbeddedCheckout).bind(stripe);
        checkout = await criar({
          fetchClientSecret: async () => clientSecret,
          onComplete: () => { if (vivo) setFase("confirmando"); },
        });
        if (!vivo) { checkout.destroy(); return; }
        checkout.mount(alvo.current);
        setFase("pronto");
      })
      .catch(() => {
        if (!vivo) return;
        setFase("erro");
        aoErro?.("Não foi possível carregar o pagamento. Verifique a conexão e tente de novo.");
      });
    return () => { vivo = false; try { checkout?.destroy(); } catch { /* já desmontado */ } };
  }, [chavePublica, clientSecret]);

  // Pago no Stripe: espera o webhook liberar o plano (normalmente segundos).
  useEffect(() => {
    if (fase !== "confirmando") return undefined;
    let tentativas = 0;
    const t = setInterval(async () => {
      tentativas += 1;
      const r = await api("/subscription");
      const a = r?.assinatura;
      if (a?.id === subscriptionId && ["ativa", "trial"].includes(a.status)) { clearInterval(t); aoConcluir?.(a); }
      else if (tentativas >= 40) { clearInterval(t); aoConcluir?.(null); }
    }, 2500);
    return () => clearInterval(t);
  }, [fase]);

  return (
    <div>
      {fase === "carregando" && (
        <div className="vx-mut" role="status" style={{ padding: "24px 0", textAlign: "center" }}>
          <Loader size={16} style={{ verticalAlign: "middle", marginRight: 6 }} /> Carregando o pagamento seguro…
        </div>
      )}
      {fase === "confirmando" && (
        <div className="vx-mut" role="status" style={{ padding: "24px 0", textAlign: "center" }}>
          <Loader size={16} style={{ verticalAlign: "middle", marginRight: 6 }} /> Pagamento recebido. Liberando seu plano…
        </div>
      )}
      <div ref={alvo} style={{ display: fase === "confirmando" ? "none" : "block", minHeight: fase === "pronto" ? 400 : 0 }} />
    </div>
  );
}
