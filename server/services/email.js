const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "RYCS <noreply@rycs.com.br>";
const APP_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const seguro = (valor) => String(valor || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

function emailCadastro({ titulo, nome, mensagem, botao = "Acessar a RYCS" }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">
      <div style="background:#1a2744;padding:16px 24px;border-radius:12px 12px 0 0;text-align:center">
        <span style="color:#60a5fa;font-size:28px;font-weight:800">R</span>
        <span style="color:#fff;font-size:20px;font-weight:700;margin-left:4px">RYCS</span>
      </div>
      <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 12px;font-size:19px">${seguro(titulo)}</h2>
        <p style="color:#4b5563;line-height:1.6">Olá, ${seguro(nome)}.</p>
        <p style="color:#4b5563;line-height:1.6">${seguro(mensagem)}</p>
        <div style="text-align:center;margin:24px 0 18px">
          <a href="${seguro(APP_URL)}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${seguro(botao)}</a>
        </div>
        <p style="color:#6b7280;font-size:13px;margin:0">Equipe RYCS Sales Solutions</p>
      </div>
    </div>`;
}

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
      signal: AbortSignal.timeout(8000),
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
        <h2 style="margin:0 0 12px;font-size:18px">Olá, ${seguro(nome)}!</h2>
        <p style="color:#4b5563;line-height:1.6">
          Sua conta ${roleLabel} foi criada com sucesso na RYCS Sales Solutions.
          ${role === "vendedor" ? "Complete a avaliação inicial para enviar seu perfil à análise da plataforma." : "Complete o cadastro empresarial e envie os dados para aprovação antes de publicar campanhas."}
        </p>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">
          Equipe RYCS Sales Solutions
        </p>
      </div>
    </div>
  `);
}

export function emailEmpresaEmAnalise(nome, email) {
  return sendEmail(email, "Cadastro empresarial recebido — RYCS", emailCadastro({
    titulo: "Recebemos o cadastro da sua empresa",
    nome,
    mensagem: "Os dados foram enviados para análise da plataforma. Você receberá outro e-mail assim que a decisão for registrada.",
    botao: "Acompanhar cadastro",
  }));
}

export function emailStatusEmpresa(nome, email, status) {
  const conteudo = {
    aprovada: {
      assunto: "Empresa aprovada — RYCS",
      titulo: "Sua empresa foi aprovada",
      mensagem: "O cadastro empresarial está aprovado. Agora você pode contratar um plano, abastecer o caixa e publicar campanhas elegíveis.",
      botao: "Configurar operação",
    },
    suspensa: {
      assunto: "Cadastro empresarial suspenso — RYCS",
      titulo: "Seu cadastro empresarial foi suspenso",
      mensagem: "A operação da empresa está temporariamente suspensa. Acesse a plataforma para revisar o cadastro e falar com a equipe RYCS.",
      botao: "Revisar cadastro",
    },
  }[status];
  if (!conteudo) return Promise.resolve({ ok: true, method: "ignorado" });
  return sendEmail(email, conteudo.assunto, emailCadastro({ nome, ...conteudo }));
}

export function emailProfissionalEmAnalise(nome, email) {
  return sendEmail(email, "Avaliação recebida — RYCS", emailCadastro({
    titulo: "Sua avaliação foi enviada para análise",
    nome,
    mensagem: "Recebemos suas respostas. A plataforma analisará seu perfil comercial e avisará por e-mail quando a decisão estiver disponível.",
    botao: "Acessar a Academy",
  }));
}

export function emailStatusProfissional(nome, email, status, nota = "") {
  const conteudo = {
    aprovado: {
      assunto: "Perfil profissional aprovado — RYCS",
      titulo: "Seu perfil foi aprovado",
      mensagem: "Seu acesso às oportunidades comerciais foi liberado.",
      botao: "Ver oportunidades",
    },
    parcial: {
      assunto: "Perfil profissional aprovado parcialmente — RYCS",
      titulo: "Seu perfil foi aprovado parcialmente",
      mensagem: "Você já pode acessar oportunidades compatíveis e usar a Academy para ampliar sua classificação.",
      botao: "Continuar na Academy",
    },
    recusado: {
      assunto: "Atualização do cadastro profissional — RYCS",
      titulo: "Seu perfil ainda não foi aprovado",
      mensagem: "Complete sua preparação na Academy e refaça a avaliação quando estiver pronto.",
      botao: "Revisar preparação",
    },
  }[status];
  if (!conteudo) return Promise.resolve({ ok: true, method: "ignorado" });
  const mensagem = nota ? `${conteudo.mensagem} Observação da análise: ${nota}` : conteudo.mensagem;
  return sendEmail(email, conteudo.assunto, emailCadastro({ nome, ...conteudo, mensagem }));
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
