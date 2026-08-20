const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "RYCS <noreply@rycs.com.br>";

export async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) {
    console.log(`[EMAIL] Para: ${to} | Assunto: ${subject}`);
    console.log(`[EMAIL] (Resend não configurado — e-mail não enviado)`);
    return { ok: true, method: "log" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Erro Resend");
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("[EMAIL] Erro:", err.message);
    return { ok: false, error: err.message };
  }
}

export function emailBoasVindas(nome, email, role) {
  const roleLabel = role === "vendedor" ? "Profissional" : "Empresa";
  return sendEmail(email, `Bem-vindo à RYCS, ${nome}!`, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#1a2744;padding:16px 24px;border-radius:12px 12px 0 0;text-align:center">
        <span style="color:#2563EB;font-size:28px;font-weight:800">R</span>
        <span style="color:#fff;font-size:20px;font-weight:700;margin-left:4px">RYCS</span>
      </div>
      <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 12px;font-size:18px">Olá, ${nome}!</h2>
        <p style="color:#4b5563;line-height:1.6">
          Sua conta ${roleLabel} foi criada com sucesso na RYCS Sales Solutions.
          ${role === "vendedor" ? "Seu cadastro está em triagem e será analisado em breve." : "Agora você pode criar campanhas e encontrar profissionais."}
        </p>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">
          Equipe RYCS Sales Solutions
        </p>
      </div>
    </div>
  `);
}

export function emailResetSenha(nome, email, token, frontendUrl) {
  const link = `${frontendUrl}/reset?token=${token}`;
  return sendEmail(email, "Redefinir senha — RYCS", `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#1a2744;padding:16px 24px;border-radius:12px 12px 0 0;text-align:center">
        <span style="color:#2563EB;font-size:28px;font-weight:800">R</span>
        <span style="color:#fff;font-size:20px;font-weight:700;margin-left:4px">RYCS</span>
      </div>
      <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 12px;font-size:18px">Olá, ${nome}!</h2>
        <p style="color:#4b5563;line-height:1.6">
          Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo (válido por 1 hora):
        </p>
        <div style="text-align:center;margin:20px 0">
          <a href="${link}" style="background:#2563EB;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
            Redefinir senha
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px">Se você não solicitou, ignore este e-mail.</p>
      </div>
    </div>
  `);
}

export function emailStatusAcao(nome, email, acao, status) {
  const labels = { liberado: "aprovada", recusado: "recusada", revisao: "em revisão" };
  return sendEmail(email, `Ação ${labels[status] || status} — RYCS`, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#1a2744;padding:16px 24px;border-radius:12px 12px 0 0;text-align:center">
        <span style="color:#2563EB;font-size:28px;font-weight:800">R</span>
        <span style="color:#fff;font-size:20px;font-weight:700;margin-left:4px">RYCS</span>
      </div>
      <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 12px;font-size:18px">${nome}, sua ação foi ${labels[status] || status}</h2>
        <p style="color:#4b5563;line-height:1.6">
          Tipo: <strong>${acao}</strong><br/>
          Status: <strong>${labels[status] || status}</strong>
        </p>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">Equipe RYCS</p>
      </div>
    </div>
  `);
}

export function emailSaquePago(nome, email, valor) {
  return sendEmail(email, `Saque de R$ ${valor.toFixed(2)} pago — RYCS`, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#1a2744;padding:16px 24px;border-radius:12px 12px 0 0;text-align:center">
        <span style="color:#2563EB;font-size:28px;font-weight:800">R</span>
        <span style="color:#fff;font-size:20px;font-weight:700;margin-left:4px">RYCS</span>
      </div>
      <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 12px;font-size:18px">${nome}, seu saque foi pago!</h2>
        <p style="color:#4b5563;line-height:1.6">
          O valor de <strong>R$ ${valor.toFixed(2)}</strong> foi transferido para sua chave Pix.
        </p>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">Equipe RYCS</p>
      </div>
    </div>
  `);
}
