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
        <p style="color:#6b7280;font-size:13px;margin:0">Equipe RYCS Sales Machine</p>
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
    console.log(`[EMAIL] enviado | ${to} | ${subject}`);
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
          Sua conta ${roleLabel} foi criada com sucesso na RYCS Sales Machine.
          ${role === "vendedor" ? "Complete a avaliação inicial para enviar seu perfil à análise da plataforma." : "Complete o cadastro empresarial e envie os dados para aprovação antes de publicar campanhas."}
        </p>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">
          Equipe RYCS Sales Machine
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

export function emailConfirmacaoConta(nome, email, token, frontendUrl) {
  const link = `${frontendUrl}/confirmar-email/${token}`;
  return sendEmail(email, "Confirme seu e-mail — RYCS", `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#1a2744;padding:16px 24px;border-radius:12px 12px 0 0;text-align:center">
        <span style="color:#2563EB;font-size:28px;font-weight:800">R</span>
        <span style="color:#fff;font-size:20px;font-weight:700;margin-left:4px">RYCS</span>
      </div>
      <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 12px;font-size:18px">Olá, ${nome}!</h2>
        <p style="color:#4b5563;line-height:1.6">
          Sua conta foi criada com sucesso. Clique no botão abaixo para confirmar seu e-mail e acessar a plataforma (válido por 24 horas):
        </p>
        <div style="text-align:center;margin:20px 0">
          <a href="${link}" style="background:#2563EB;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
            Confirmar e-mail e entrar
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px">Se você não criou essa conta, ignore este e-mail.</p>
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

// Modelo genérico de atualização. Recebe o mesmo título e corpo que foram para
// o sino, então os dois canais nunca contam histórias diferentes.
const ROTULOS = {
  submissao: "Suas ações",
  triagem: "Avaliação",
  academy: "RYCS Academy",
  parceria: "Parcerias",
  candidatura: "Candidaturas",
  deposito: "Financeiro",
  pagamento: "Financeiro",
  saque: "Saques",
  assinatura: "Assinatura",
  indicacao: "Indicações",
  relatorio: "Relatórios",
  importacao: "Importações",
};

export function emailAtualizacao({ nome, titulo, corpo, tipo }) {
  return emailCadastro({
    titulo,
    nome: nome || "tudo bem",
    mensagem: corpo || "Há uma atualização na sua conta RYCS.",
    botao: `Abrir ${ROTULOS[tipo] || "a RYCS"}`,
  });
}

export function emailFotoPendente({ nome, email, camposPendentes }) {
  const listaPendentes = camposPendentes.map((c) => `<li style="margin-bottom:6px">• ${seguro(c)}</li>`).join("");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;color:#1f2937">
      <div style="background:#1a2744;padding:16px 24px;border-radius:12px 12px 0 0;text-align:center">
        <span style="color:#60a5fa;font-size:26px;font-weight:800">R</span>
        <span style="color:#fff;font-size:18px;font-weight:700;margin-left:4px">RYCS</span>
      </div>
      <div style="background:#f9fafb;padding:28px 24px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 16px;font-size:19px;color:#0b1220">Seu cadastro está incompleto</h2>
        <p style="color:#4b5563;line-height:1.7;font-size:14px">Olá, ${seguro(nome)}!</p>
        <p style="color:#4b5563;line-height:1.7;font-size:14px">
          Identificamos que seu perfil na RYCS ainda não está 100% completo.
          Um perfil completo aumenta suas chances de ser selecionado por empresas e receber novas oportunidades.
        </p>
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:14px 16px;border-radius:4px;margin:18px 0">
          <p style="margin:0 0 8px;font-weight:600;color:#92400e;font-size:14px">Itens pendentes para concluir seu cadastro:</p>
          <ul style="margin:0;padding:0;list-style:none;color:#78350f;font-size:13px">${listaPendentes}</ul>
        </div>
        <p style="color:#4b5563;line-height:1.7;font-size:14px">
          Acesse a plataforma agora e complete as informações pendentes para liberar seu perfil completo.
        </p>
        <div style="text-align:center;margin:24px 0 16px">
          <a href="${seguro(APP_URL)}/perfil" style="background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Completar meu cadastro</a>
        </div>
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0"/>
        <p style="color:#9ca3af;font-size:12px;margin:0">Equipe RYCS Sales Machine · <a href="${seguro(APP_URL)}" style="color:#6b7280">${seguro(APP_URL)}</a></p>
      </div>
    </div>`;
  return sendEmail(email, "Seu cadastro na RYCS está incompleto — foto e dados pendentes", html);
}

export function emailCadastroCompletadoAdmin({ nomeProfissional, emailProfissional, adminEmail }) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;color:#1f2937">
      <div style="background:#1a2744;padding:16px 24px;border-radius:12px 12px 0 0;text-align:center">
        <span style="color:#60a5fa;font-size:26px;font-weight:800">R</span>
        <span style="color:#fff;font-size:18px;font-weight:700;margin-left:4px">RYCS</span>
      </div>
      <div style="background:#f9fafb;padding:28px 24px;border-radius:0 0 12px 12px">
        <div style="background:#d1fae5;border-left:4px solid #10b981;padding:14px 16px;border-radius:4px;margin-bottom:18px">
          <p style="margin:0;font-weight:600;color:#065f46;font-size:15px">✅ Cadastro 100% concluído</p>
        </div>
        <h2 style="margin:0 0 16px;font-size:18px;color:#0b1220">Novo perfil completo na plataforma</h2>
        <p style="color:#4b5563;line-height:1.7;font-size:14px">
          O profissional abaixo acabou de concluir o cadastro completo na RYCS:
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;width:40%;border-radius:4px 0 0 4px">Nome</td><td style="padding:8px 12px;background:#f9fafb;border-radius:0 4px 4px 0">${seguro(nomeProfissional)}</td></tr>
          <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600;margin-top:4px;border-radius:4px 0 0 4px">E-mail</td><td style="padding:8px 12px;background:#f9fafb;border-radius:0 4px 4px 0">${seguro(emailProfissional)}</td></tr>
        </table>
        <div style="text-align:center;margin:24px 0 16px">
          <a href="${seguro(APP_URL)}/admin/profissionais" style="background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Ver profissional no painel</a>
        </div>
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0"/>
        <p style="color:#9ca3af;font-size:12px;margin:0">RYCS Sales Machine · Notificação automática</p>
      </div>
    </div>`;
  return sendEmail(adminEmail, `[RYCS] Cadastro completo: ${nomeProfissional}`, html);
}
