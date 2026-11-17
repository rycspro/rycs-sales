import { Router } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db, { uid, agora } from "../db.js";
import { signToken, usuarioDev, authMiddleware } from "../middleware/auth.js";
import { emailBoasVindas, emailResetSenha } from "../services/email.js";
import { vincularIndicacao } from "../services/indicacoes.js";
import { vincularVisitante } from "../services/jornada.js";
import { validarSenhaEmpresa, normalizarWhatsapp, conviteServeParaEmail, MOTIVOS_CONVITE_ONBOARDING, podeReenviarReset, avaliarLogo } from "../../shared/onboarding.js";
import { normalizarTelefoneIntl, PAISES } from "../../shared/localidades.js";
import { avaliarFoto } from "../../shared/fotoPerfil.js";
import { criarOnboarding, hashToken, novoToken } from "../services/onboarding.js";
import { auditarSeguranca } from "../services/securityAudit.js";

const router = Router();
const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

router.post("/auth/login", (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: "E-mail e senha são obrigatórios" });

  const emailNorm = email.toLowerCase().trim();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(emailNorm);
  if (!user) {
    console.warn(`[auth] login falhou: e-mail não encontrado (${emailNorm})`);
    return res.status(401).json({ error: "E-mail ou senha incorretos" });
  }
  if (!bcrypt.compareSync(senha, user.senha)) {
    console.warn(`[auth] login falhou: senha incorreta para ${emailNorm} (role=${user.role}, hash=${user.senha?.slice(0, 7)}…)`);
    return res.status(401).json({ error: "E-mail ou senha incorretos" });
  }

  // A plataforma tem entrada própria, com chave de segurança. Aceitar admin
  // aqui deixaria o painel que aprova saques atrás de senha apenas.
  if (user.role === "admin") {
    return res.status(403).json({ error: "Esta conta acessa pela entrada da plataforma." });
  }

  const token = signToken({ id: user.id, role: user.role, entityId: user.entityId });
  res.cookie("sm_token", token, COOKIE_OPTS);
  res.json({ id: user.id, email: user.email, role: user.role, entityId: user.entityId });
});

// Entrada exclusiva da plataforma: além da senha, exige a chave de segurança
// que só existe nas variáveis de ambiente. Senha vazada, sozinha, não abre.
router.post("/auth/admin/login", (req, res) => {
  const { email, senha, chave } = req.body;
  const esperada = process.env.ADMIN_SECURITY_KEY;

  if (!esperada) {
    console.error("[auth] ADMIN_SECURITY_KEY não configurada — entrada da plataforma bloqueada.");
    return res.status(503).json({ error: "Entrada da plataforma indisponível." });
  }
  if (!email || !senha || !chave)
    return res.status(400).json({ error: "E-mail, senha e chave de segurança são obrigatórios" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase().trim());
  const senhaOk = user ? bcrypt.compareSync(senha, user.senha) : false;
  const chaveOk = comparaSegura(String(chave), esperada);

  // Resposta única para qualquer combinação errada: dizer qual fator falhou
  // entregaria ao atacante se já tem a senha ou já tem a chave.
  if (!user || user.role !== "admin" || !senhaOk || !chaveOk) {
    console.warn(`[auth] tentativa de acesso à plataforma recusada (${String(email).slice(0, 40)})`);
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  const token = signToken({ id: user.id, role: user.role, entityId: user.entityId });
  res.cookie("sm_token", token, COOKIE_OPTS);
  res.json({ id: user.id, email: user.email, role: user.role, entityId: user.entityId });
});

// Comparação de tempo constante: comparar com === vazaria, pelo tempo de
// resposta, quantos caracteres iniciais da chave estão certos.
function comparaSegura(a, b) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(bb, bb); // gasta o mesmo tempo mesmo com tamanho diferente
    return false;
  }
  return timingSafeEqual(ba, bb);
}

router.post("/auth/register", async (req, res) => {
  const { email, senha, role, nome, whats, pais, estado, cidade, dataNascimento, genero, perfil, cargosExp, idiomas, perfilComercial, produto, ticket, icp, aceitouTermos, indicacao, convite, logo, foto, curriculo } = req.body;
  if (!email || !senha || !role) return res.status(400).json({ error: "email, senha e role são obrigatórios" });
  if (!["vendedor", "empresa"].includes(role)) return res.status(400).json({ error: "role deve ser vendedor ou empresa" });
  if (role === "empresa") {
    const erroSenha = validarSenhaEmpresa(senha);
    if (erroSenha) return res.status(400).json({ error: erroSenha, campo: "senha" });
  } else if (senha.length < 6) return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
  if (!aceitouTermos) return res.status(400).json({ error: "Você deve aceitar os termos de uso" });

  const emailNorm = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm))
    return res.status(400).json({ error: "E-mail inválido", campo: "email" });

  // Empresa: WhatsApp é obrigatório desde o acesso (etapa 1 do onboarding).
  // WhatsApp da empresa: coerente com o país informado (DDI + número nacional).
  // Mantém o fallback BR para contas antigas que não enviam país.
  const whatsEmpresa = role === "empresa"
    ? (normalizarTelefoneIntl(pais || "BR", whats) || normalizarWhatsapp(whats))
    : null;
  if (role === "empresa" && !whatsEmpresa)
    return res.status(400).json({ error: "Informe um WhatsApp válido para o país selecionado.", campo: "whatsapp" });

  // Empresa: nome e logo também são pedidos já no acesso (etapa 1).
  let logoEmpresa = "";
  if (role === "empresa") {
    if (String(nome || "").trim().length < 2)
      return res.status(400).json({ error: "Informe o nome da empresa.", campo: "nome" });
    const mimetype = String(logo?.mimetype || "");
    const buffer = Buffer.from(String(logo?.base64 || ""), "base64");
    const erroLogo = avaliarLogo({
      mimetype, tamanhoBytes: buffer.length,
      svgTexto: mimetype === "image/svg+xml" ? buffer.toString("utf8") : "",
    });
    if (erroLogo) return res.status(400).json({ error: buffer.length ? erroLogo : "Envie o logo da empresa.", campo: "logo" });
    logoEmpresa = `data:${mimetype};base64,${buffer.toString("base64")}`;
  }

  // Convite de onboarding: preso ao e-mail para o qual foi gerado.
  const conviteRow = role === "empresa" && convite
    ? db.prepare("SELECT * FROM onboarding_convites WHERE tokenHash = ?").get(hashToken(convite))
    : null;
  if (role === "empresa" && convite) {
    const estado = conviteServeParaEmail(conviteRow, emailNorm);
    if (!estado.ok) return res.status(409).json({ error: MOTIVOS_CONVITE_ONBOARDING[estado.motivo], motivo: estado.motivo });
  }

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(emailNorm);
  if (exists) return res.status(409).json({ error: "E-mail já cadastrado", campo: "email" });

  const hash = bcrypt.hashSync(senha, 10);
  const userId = uid();
  let entityId = null;
  const nomeClean = (String(nome || "").trim() || emailNorm.split("@")[0]).slice(0, 100);

  if (role === "vendedor") {
    entityId = uid();
    // O cadastro envia o país como código ("BR"); guardamos o nome ("Brasil")
    // para o perfil exibir legível. Default: Brasil.
    const paisNome = PAISES.find((p) => p.code === pais || p.nome === pais)?.nome || (pais ? String(pais) : "Brasil");
    let fotoDataUri = "";
    let fotoScore = 0;
    if (foto?.base64 && foto?.mimetype) {
      const tamanhoBytes = Math.round((String(foto.base64).length * 3) / 4);
      const avaliacao = avaliarFoto({ mimetype: foto.mimetype, tamanhoBytes, largura: Number(foto.largura), altura: Number(foto.altura) });
      if (!avaliacao.aprovada) return res.status(422).json({ error: "A foto não passou na verificação.", campo: "foto" });
      fotoDataUri = `data:${foto.mimetype};base64,${foto.base64}`;
      fotoScore = avaliacao.score;
    }
    // Currículo é opcional. Aceita PDF e documentos do Word, até ~8MB.
    let curriculoDataUri = "";
    let curriculoNome = "";
    if (curriculo?.base64 && curriculo?.mimetype) {
      const tiposOk = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (!tiposOk.includes(curriculo.mimetype))
        return res.status(422).json({ error: "Envie o currículo em PDF ou Word.", campo: "curriculo" });
      const bytes = Math.round((String(curriculo.base64).length * 3) / 4);
      if (bytes > 8 * 1024 * 1024)
        return res.status(422).json({ error: "O currículo deve ter no máximo 8MB.", campo: "curriculo" });
      curriculoDataUri = `data:${curriculo.mimetype};base64,${curriculo.base64}`;
      curriculoNome = String(curriculo.nome || "curriculo").slice(0, 160);
    }
    // Idiomas não têm coluna própria: ficam dentro de perfilComercial, junto do
    // resto do currículo comercial (editável depois em "Meu Perfil").
    const idiomasLimpos = Array.isArray(idiomas)
      ? idiomas.filter((i) => i && i.idioma).map((i) => ({ idioma: String(i.idioma).slice(0, 40), nivel: String(i.nivel || "").slice(0, 40) })).slice(0, 20)
      : [];
    const perfilJSON = JSON.stringify({
      ...(perfilComercial || {}),
      cargosExp: Array.isArray(cargosExp) ? cargosExp : [],
      idiomas: idiomasLimpos,
    });
    // O quiz deixou de ser obrigatório: ao concluir o cadastro, o profissional
    // já entra com a plataforma liberada (onboarding concluído). As avaliações
    // (DISC, etc.) passam a ser voluntárias, pela página "Testes e Avaliações".
    db.prepare(`
      INSERT INTO sellers (id, nome, email, whats, pais, estado, cidade, dataNascimento, genero, perfil, experiencia, status, nota, nivel, pix, disponivel, pendente, sacado, respostas, video, foto, fotoScore, curriculo, curriculoNome, perfilComercial, onboardingEtapa, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'aprovado', 100, 'starter', '', 0, 0, 0, '[]', '', ?, ?, ?, ?, ?, 'concluido', ?)
    `).run(entityId, nomeClean, emailNorm, whats || "", paisNome, estado || "", cidade || "", dataNascimento || "", genero || "", perfil || "sdr", fotoDataUri, fotoScore, curriculoDataUri, curriculoNome, perfilJSON, agora());
    db.prepare("INSERT INTO users (id, email, senha, role, entityId, aceitouTermos, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      userId, emailNorm, hash, role, entityId, 1, agora()
    );
  } else if (role === "empresa") {
    entityId = uid();
    let conviteOk = true;
    // Empresa, usuário, onboarding e consumo do convite na mesma transação:
    // dois cadastros simultâneos com o mesmo link, só um passa.
    db.transaction(() => {
      if (conviteRow) {
        const marca = db.prepare("UPDATE onboarding_convites SET usadoEm = ?, usadoPor = ? WHERE id = ? AND usadoEm IS NULL AND revogadoEm IS NULL")
          .run(agora(), entityId, conviteRow.id);
        if (!marca.changes) { conviteOk = false; return; }
      }
      db.prepare(`
        INSERT INTO companies (id, nome, produto, ticket, icp, plano, destaque, saldo, vagas, cor, totalAportado, criadoEm, comissoes, curso, aportes, whatsapp, logo)
        VALUES (?, ?, ?, ?, ?, 'saldo', 0, 0, 10, '#2563EB', 0, ?, '{}', '[]', '[]', ?, ?)
      `).run(entityId, nomeClean, produto || "", ticket || "", icp || "", agora(), whatsEmpresa, logoEmpresa);
      db.prepare("INSERT INTO users (id, email, senha, role, entityId, aceitouTermos, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        userId, emailNorm, hash, role, entityId, 1, agora()
      );
      criarOnboarding({
        companyId: entityId,
        origem: conviteRow ? "convite" : "site",
        conviteId: conviteRow?.id || null,
        trialDias: conviteRow?.trialDias || 0,
        acessoConcluido: true,
      });
    })();
    if (!conviteOk) return res.status(409).json({ error: MOTIVOS_CONVITE_ONBOARDING.usado, motivo: "usado" });
  }

  // Confirmação de cadastro em segundo plano: a conta já está criada acima, e
  // esperar o provedor de e-mail responder deixava a tela "carregando sem sair"
  // quando o envio demora — levando a pessoa a reenviar e cair em "já cadastrado".
  emailBoasVindas(nomeClean, emailNorm, role).catch((e) =>
    console.error(`[auth] falha ao enviar boas-vindas para ${emailNorm}:`, e?.message || e)
  );
  // Vínculo de indicação: nada é creditado agora, só registrado.
  if (indicacao) vincularIndicacao(indicacao, userId, role);
  vincularVisitante(userId, req.body);

  const token = signToken({ id: userId, role, entityId });
  res.cookie("sm_token", token, COOKIE_OPTS);
  res.json({ id: userId, email: emailNorm, role, entityId });
});

router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "E-mail é obrigatório" });

  // A resposta é a mesma em todos os casos: dizer que o e-mail não existe, ou
  // que o reenvio foi barrado, entregaria quem tem conta na RYCS.
  const resposta = { ok: true, message: "Se o e-mail existir, enviaremos um link." };
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase().trim());
  if (!user) return res.json(resposta);
  if (!podeReenviarReset(user.resetEnviadoEm)) return res.json(resposta);

  const resetToken = randomBytes(32).toString("hex");
  const resetExpira = agora() + 3600000; // 1 hora

  // O banco guarda o hash: link de redefinição é credencial. Um novo envio
  // substitui o anterior, que deixa de valer.
  db.prepare("UPDATE users SET resetToken = ?, resetExpira = ?, resetEnviadoEm = ? WHERE id = ?")
    .run(hashToken(resetToken), resetExpira, agora(), user.id);

  const nome = user.role === "vendedor"
    ? db.prepare("SELECT nome FROM sellers WHERE id = ?").get(user.entityId)?.nome
    : user.role === "empresa"
    ? db.prepare("SELECT nome FROM companies WHERE id = ?").get(user.entityId)?.nome
    : "Admin";

  const resultado = await emailResetSenha(nome || "Usuário", user.email, resetToken, FRONTEND);
  if (!resultado?.ok) console.error(`[auth] falha ao enviar reset para ${user.email}:`, resultado?.error);

  res.json(resposta);
});

router.post("/auth/reset-password", (req, res) => {
  const { token, senha } = req.body;
  if (!token || !senha) return res.status(400).json({ error: "Token e senha são obrigatórios" });
  // Só o hash é comparado. Aceitar também o valor cru deixaria o próprio hash
  // do banco funcionar como link.
  const user = db.prepare("SELECT * FROM users WHERE resetToken = ?").get(hashToken(token));
  if (!user || !user.resetExpira || user.resetExpira < agora()) {
    return res.status(400).json({ error: "Link expirado ou inválido. Solicite novamente." });
  }
  if (user.role === "empresa") {
    const erroSenha = validarSenhaEmpresa(senha);
    if (erroSenha) return res.status(400).json({ error: erroSenha });
  } else if (senha.length < 6) return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });

  const hash = bcrypt.hashSync(senha, 10);
  // Redefinir a senha invalida todas as sessões ativas (todos os dispositivos):
  // incrementa a versão, que não bate mais com os tokens já emitidos.
  db.prepare("UPDATE users SET senha = ?, resetToken = NULL, resetExpira = NULL, tokenVersion = tokenVersion + 1 WHERE id = ?").run(hash, user.id);
  auditarSeguranca({ req, ator: user.id, papel: user.role, acao: "senha_redefinida", alvo: user.id, resultado: "ok", critico: true });

  res.json({ ok: true, message: "Senha redefinida com sucesso." });
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie("sm_token", { path: "/" });
  res.json({ ok: true });
});

// Sair de todos os dispositivos: incrementa a versão da sessão, invalidando
// todos os tokens já emitidos (inclusive o atual). Requer sessão válida.
router.post("/auth/logout-all", authMiddleware, (req, res) => {
  db.prepare("UPDATE users SET tokenVersion = tokenVersion + 1 WHERE id = ?").run(req.user.id);
  auditarSeguranca({ req, ator: req.user.id, papel: req.user.role, acao: "logout_todos", alvo: req.user.id, resultado: "ok" });
  res.clearCookie("sm_token", { path: "/" });
  res.json({ ok: true });
});

// Consulta da trilha de auditoria — restrita ao admin.
router.get("/admin/security-audit", authMiddleware, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  const limite = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const filtros = [];
  const vals = [];
  if (req.query.acao) { filtros.push("acao = ?"); vals.push(String(req.query.acao)); }
  if (req.query.ator) { filtros.push("ator = ?"); vals.push(String(req.query.ator)); }
  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM security_audit ${where} ORDER BY criadoEm DESC LIMIT ?`).all(...vals, limite);
  res.json(rows.map((r) => ({ ...r, contexto: JSON.parse(r.contexto || "{}") })));
});

router.get("/auth/me", (req, res) => {
  // Modo sem login (só fora de produção): responde já autenticado.
  const dev = usuarioDev();
  if (dev) return res.json(dev);

  const token = req.cookies?.sm_token;
  if (!token) return res.status(401).json({ error: "Não autenticado" });

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "salesmachine-dev-secret-change-in-production"
    );
    const user = db.prepare("SELECT id, email, role, entityId, tokenVersion FROM users WHERE id = ?").get(payload.id);
    if (!user) {
      res.clearCookie("sm_token", { path: "/" });
      return res.status(401).json({ error: "Usuário não encontrado" });
    }
    // Respeita a revogação global de sessões (V7).
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      res.clearCookie("sm_token", { path: "/" });
      return res.status(401).json({ error: "Sessão expirada" });
    }
    res.json({ id: user.id, email: user.email, role: user.role, entityId: user.entityId });
  } catch {
    res.clearCookie("sm_token", { path: "/" });
    return res.status(401).json({ error: "Sessão expirada" });
  }
});

// Confirmação de e-mail para empresas criadas pelo caminho "livre".
// O link chega via e-mail; valida o token, faz login automático.
router.get("/auth/confirmar-email/:token", (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: "Token inválido." });

  const tokenHash = hashToken(token);
  const user = db.prepare(`SELECT id, email, role, entityId, emailVerificado, emailConfirmExpira FROM users WHERE emailConfirmToken = ?`).get(tokenHash);

  if (!user) return res.status(404).json({ error: "Link inválido ou já utilizado." });
  if (user.emailVerificado) return res.status(409).json({ error: "E-mail já confirmado." });
  if (user.emailConfirmExpira && user.emailConfirmExpira < agora())
    return res.status(410).json({ error: "Link expirado. Solicite um novo link." });

  db.prepare("UPDATE users SET emailVerificado = 1, emailConfirmToken = NULL, emailConfirmExpira = NULL WHERE id = ?").run(user.id);

  const jwtToken = signToken({ id: user.id, role: user.role, entityId: user.entityId });
  res.cookie("sm_token", jwtToken, COOKIE_OPTS);
  res.json({ ok: true, id: user.id, email: user.email, role: user.role, entityId: user.entityId });
});

export default router;
