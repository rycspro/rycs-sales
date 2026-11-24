// Janela oficial da Meta para conectar o WhatsApp (Cadastro Incorporado). A
// pessoa lê o QR code no aplicativo WhatsApp Business e autoriza a RYCS.

let carregando = null;

// Precisa estar carregado antes do clique: se a janela abrir depois de uma
// espera, o navegador bloqueia como pop-up.
export function carregarSdkMeta({ appId, versaoGraph }) {
  carregando ||= new Promise((ok, falha) => {
    const iniciar = () => { window.FB.init({ appId, autoLogAppEvents: false, xfbml: false, version: versaoGraph }); ok(window.FB); };
    if (window.FB) return iniciar();
    window.fbAsyncInit = iniciar;
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/pt_BR/sdk.js";
    s.async = true; s.defer = true; s.crossOrigin = "anonymous";
    s.onerror = () => { carregando = null; falha(new Error("Não foi possível abrir a janela da Meta. Desative o bloqueador de anúncios e tente de novo.")); };
    document.head.appendChild(s);
  });
  return carregando;
}

const daMeta = (origem) => { try { return /(^|\.)facebook\.com$/.test(new URL(origem).hostname); } catch { return false; } };

// Devolve { code, wabaId, phoneNumberId }. Rejeita com mensagem se cancelar.
export function abrirCadastroWhatsapp(FB, { configId, versaoFluxo }) {
  return new Promise((ok, falha) => {
    let code = "", ids = null, encerrado = false;
    const fim = (f, v) => { if (encerrado) return; encerrado = true; window.removeEventListener("message", ouvir); f(v); };
    const tentar = () => { if (code && ids) fim(ok, { code, ...ids }); };
    const ouvir = (e) => {
      if (!daMeta(e.origin)) return;
      let d;
      try { d = JSON.parse(e.data); } catch { return; }
      if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (d.event === "ERROR") return fim(falha, new Error(d.data?.error_message || "A Meta não concluiu a conexão."));
      if (!String(d.event || "").startsWith("FINISH")) return;
      const conta = d.data?.waba_id || [d.data?.messaging_account_ids].flat().filter(Boolean)[0];
      if (conta) { ids = { wabaId: String(conta), phoneNumberId: d.data?.phone_number_id ? String(d.data.phone_number_id) : "" }; tentar(); }
    };
    window.addEventListener("message", ouvir);
    FB.login((r) => {
      code = r?.authResponse?.code || "";
      if (!code) return fim(falha, new Error("Conexão cancelada."));
      tentar();
      setTimeout(() => fim(falha, new Error("A Meta não informou o número. Conecte de novo e conclua até o fim.")), 8000);
    }, {
      config_id: configId, response_type: "code", override_default_response_type: true,
      extras: versaoFluxo === "v4" ? { setup: {}, featureType: "whatsapp_business_app_onboarding" } : { setup: {}, version: versaoFluxo },
    });
  });
}
