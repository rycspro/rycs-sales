import { Router } from "express";
import db, { agora } from "../db.js";
import { avaliarFoto } from "../../shared/fotoPerfil.js";
import { calcularDisc, PERGUNTAS_DISC, PERGUNTAS_EXPERIENCIA, perguntasDiscPublicas, perguntasXpPublicas } from "../../shared/discQuiz.js";
import { calcular } from "../services/triagem.js";
import { perguntasPublicas, CATEGORIAS, FAIXAS, TOTAL_PERGUNTAS } from "../../shared/triagem.js";

const router = Router();

const ETAPAS_ONBOARDING = ["perfil", "quiz", "concluido"];

export function calcularScoreOnboarding(xp, disc) {
  let score = 0;

  // Experiência em vendas (xp1): 0-4 → 0-30 pontos
  const anos = Number(xp?.xp1) || 0;
  score += Math.min(anos, 4) * 7.5;

  // Canais de venda (xp2): cada canal = 3pt, max 18pt
  const canais = Array.isArray(xp?.xp2) ? xp.xp2.filter((c) => c !== "Ainda não tenho canal definido") : [];
  score += Math.min(canais.length, 6) * 3;

  // Tipo de venda (xp3): ambos=12, b2b=10, b2c=8, nenhuma=2
  const tipoVenda = { ambos: 12, b2b: 10, b2c: 8, nenhuma: 2 };
  score += tipoVenda[xp?.xp3] || 2;

  // Dedicação (xp4): integral=20, meio=15, parcial=10, pontual=5
  const dedicacao = { integral: 20, meio: 15, parcial: 10, pontual: 5 };
  score += dedicacao[xp?.xp4] || 5;

  // DISC: perfil predominante definido = 10pt, secundário diferente = 5pt
  if (disc?.predominante) score += 10;
  if (disc?.secundario && disc.secundario !== disc.predominante) score += 5;

  // Completou o quiz inteiro = 5pt base
  score += 5;

  return Math.min(Math.floor(score * 100) / 100, 100);
}

function etapaIndex(etapa) {
  return ETAPAS_ONBOARDING.indexOf(etapa);
}

function sanitizarTexto(txt, maxLen = 1500) {
  if (!txt || typeof txt !== "string") return "";
  return txt
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
    .slice(0, maxLen)
    .trim();
}

function validarUrl(url) {
  if (!url || typeof url !== "string") return "";
  const u = url.trim();
  if (!u) return "";
  if (/^javascript:/i.test(u) || /^data:/i.test(u) || /^vbscript:/i.test(u)) return "";
  try {
    const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB
const VIDEO_TYPES = ["video/mp4", "video/webm"];

router.get("/onboarding-pro", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const seller = db.prepare(`
    SELECT onboardingEtapa, nome, sobrenome, foto, bio, whats, linkedin, disc, email,
           cidadeBase, estadoBase, pais, perfilComercial, apresentacaoData, videoApresentacao
    FROM sellers WHERE id = ?
  `).get(req.user.entityId);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });

  let perfilComercial = {};
  try { perfilComercial = JSON.parse(seller.perfilComercial || "{}"); } catch {}

  let apresentacao = {};
  try { apresentacao = JSON.parse(seller.apresentacaoData || "{}"); } catch {}

  res.json({
    etapa: seller.onboardingEtapa || "perfil",
    concluido: seller.onboardingEtapa === "concluido",
    perfil: {
      nome: seller.nome,
      sobrenome: seller.sobrenome || "",
      foto: seller.foto || "",
      bio: seller.bio || "",
      whats: seller.whats || "",
      linkedin: seller.linkedin || "",
      email: seller.email || "",
      cidade: seller.cidadeBase || "",
      estado: seller.estadoBase || "",
      pais: seller.pais || "",
      areaAtuacao: perfilComercial?.experiencia?.xp3 || "",
    },
    apresentacao,
    videoApresentacao: seller.videoApresentacao || "",
    disc: JSON.parse(seller.disc || "{}"),
  });
});

router.post("/onboarding-pro/perfil", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const sellerId = req.user.entityId;

  const seller = db.prepare("SELECT onboardingEtapa, nome, bio FROM sellers WHERE id = ?").get(sellerId);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });

  const { bio, linkedin, redesSociais, interesses, jeitoTrabalhar, portfolio, privacidade } = req.body;

  const bioLimpa = sanitizarTexto(bio, 1500);

  let redesLimpas = {};
  if (redesSociais && typeof redesSociais === "object") {
    for (const [rede, url] of Object.entries(redesSociais)) {
      const urlLimpa = validarUrl(url);
      if (urlLimpa) redesLimpas[rede] = urlLimpa;
    }
  }

  let interessesLimpos = [];
  if (Array.isArray(interesses)) {
    interessesLimpos = interesses.filter(i => typeof i === "string").slice(0, 20);
  }

  let jeitoLimpo = {};
  if (jeitoTrabalhar && typeof jeitoTrabalhar === "object") {
    if (typeof jeitoTrabalhar.formaTrabalho === "string") jeitoLimpo.formaTrabalho = jeitoTrabalhar.formaTrabalho;
    if (Array.isArray(jeitoTrabalhar.atividades)) jeitoLimpo.atividades = jeitoTrabalhar.atividades.filter(a => typeof a === "string").slice(0, 10);
    if (typeof jeitoTrabalhar.motivacao === "string") jeitoLimpo.motivacao = jeitoTrabalhar.motivacao;
    if (typeof jeitoTrabalhar.orientacao === "string") jeitoLimpo.orientacao = jeitoTrabalhar.orientacao;
  }

  let portfolioLimpo = [];
  if (Array.isArray(portfolio)) {
    portfolioLimpo = portfolio.slice(0, 10).map(item => ({
      titulo: sanitizarTexto(item.titulo || "", 100),
      descricao: sanitizarTexto(item.descricao || "", 300),
      link: validarUrl(item.link || ""),
    })).filter(p => p.titulo);
  }

  let privacidadeLimpa = {};
  if (privacidade && typeof privacidade === "object") {
    for (const [campo, visivel] of Object.entries(privacidade)) {
      if (typeof visivel === "boolean") privacidadeLimpa[campo] = visivel;
    }
  }

  const apresentacaoData = JSON.stringify({
    redesSociais: redesLimpas,
    interesses: interessesLimpos,
    jeitoTrabalhar: jeitoLimpo,
    portfolio: portfolioLimpo,
    privacidade: privacidadeLimpa,
  });

  const linkedinLimpo = validarUrl(linkedin || "");

  db.prepare(`UPDATE sellers SET
    bio = CASE WHEN ? != '' THEN ? ELSE bio END,
    linkedin = CASE WHEN ? != '' THEN ? ELSE linkedin END,
    apresentacaoData = ?,
    onboardingEtapa = 'quiz'
    WHERE id = ?`)
    .run(
      bioLimpa, bioLimpa,
      linkedinLimpo, linkedinLimpo,
      apresentacaoData,
      sellerId
    );

  res.json({ ok: true, etapa: "quiz" });
});

router.post("/onboarding-pro/foto", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const sellerId = req.user.entityId;

  const { base64, mimetype, largura, altura } = req.body || {};
  if (!base64) return res.status(400).json({ error: "Envie a imagem" });

  const tamanhoBytes = Math.round((String(base64).length * 3) / 4);
  const avaliacao = avaliarFoto({ mimetype, tamanhoBytes, largura: Number(largura), altura: Number(altura) });

  if (!avaliacao.aprovada) {
    return res.status(422).json({ error: "A foto não passou na verificação.", avaliacao });
  }

  const dataUri = `data:${mimetype};base64,${base64}`;
  db.prepare("UPDATE sellers SET foto = ?, fotoScore = ? WHERE id = ?")
    .run(dataUri, avaliacao.score, sellerId);

  res.json({ ok: true, avaliacao, foto: dataUri });
});

router.post("/onboarding-pro/video", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const sellerId = req.user.entityId;

  const { base64, mimetype } = req.body || {};
  if (!base64) return res.status(400).json({ error: "Envie o vídeo" });
  if (!VIDEO_TYPES.includes(mimetype)) return res.status(400).json({ error: "Formato não suportado. Use MP4 ou WebM." });

  const tamanhoBytes = Math.round((String(base64).length * 3) / 4);
  if (tamanhoBytes > MAX_VIDEO_SIZE) return res.status(400).json({ error: "Vídeo muito grande. Máximo de 30MB." });

  const dataUri = `data:${mimetype};base64,${base64}`;
  db.prepare("UPDATE sellers SET videoApresentacao = ? WHERE id = ?").run(dataUri, sellerId);

  res.json({ ok: true });
});

router.delete("/onboarding-pro/video", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  db.prepare("UPDATE sellers SET videoApresentacao = '' WHERE id = ?").run(req.user.entityId);
  res.json({ ok: true });
});

// Step 2: Quiz DISC + experiência
router.get("/onboarding-pro/quiz", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  res.json({
    disc: perguntasDiscPublicas(),
    experiencia: perguntasXpPublicas(),
    totalDisc: PERGUNTAS_DISC.length,
    totalXp: PERGUNTAS_EXPERIENCIA.length,
  });
});

router.post("/onboarding-pro/quiz", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const sellerId = req.user.entityId;
  const { disc: respostaDisc, experiencia: respostaXp } = req.body || {};

  if (!respostaDisc || typeof respostaDisc !== "object")
    return res.status(400).json({ error: "Envie as respostas do quiz DISC" });

  const faltandoDisc = PERGUNTAS_DISC.filter((p) => !respostaDisc[p.id]?.mais);
  if (faltandoDisc.length)
    return res.status(400).json({ error: `Faltam ${faltandoDisc.length} respostas do quiz de personalidade.` });

  if (!respostaXp || typeof respostaXp !== "object")
    return res.status(400).json({ error: "Envie as respostas do quiz de experiência" });

  const faltandoXp = PERGUNTAS_EXPERIENCIA.filter((p) => {
    const r = respostaXp[p.id];
    if (p.tipo === "multipla") return !Array.isArray(r) || r.length === 0;
    return r === undefined || r === null || r === "";
  });
  if (faltandoXp.length)
    return res.status(400).json({ error: `Faltam ${faltandoXp.length} respostas do quiz de experiência.` });

  const resultado = calcularDisc(respostaDisc);

  const scoreTriagem = calcularScoreOnboarding(respostaXp, resultado);

  db.prepare(`UPDATE sellers SET
    disc = ?, discRespostas = ?, xpRespostas = ?,
    onboardingEtapa = 'concluido', status = 'aprovado',
    perfilComercial = ?, scoreTriagem = ?
    WHERE id = ?`)
    .run(
      JSON.stringify(resultado),
      JSON.stringify(respostaDisc),
      JSON.stringify(respostaXp),
      JSON.stringify({ disc: resultado, experiencia: respostaXp }),
      scoreTriagem,
      sellerId
    );

  res.json({ ok: true, etapa: "concluido", disc: resultado });
});

// Step 3: Oportunidades — empresas com campanhas ativas
router.get("/onboarding-pro/oportunidades", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });

  const campanhas = db.prepare(`
    SELECT c.id, c.titulo, c.descricao, c.produto, c.publico, c.objetivo,
      c.regiao, c.funcao, c.vagas, c.status, c.companyId,
      c.orcamento, c.tarefas,
      co.nome AS empresaNome, co.cor AS empresaCor, co.logo AS empresaLogo,
      co.produto AS empresaProduto, co.icp AS empresaIcp
    FROM campaigns c
    JOIN companies co ON co.id = c.companyId
    WHERE c.status = 'ativa'
    ORDER BY c.criadoEm DESC
    LIMIT 50
  `).all();

  const porEmpresa = new Map();
  for (const c of campanhas) {
    if (!porEmpresa.has(c.companyId)) {
      porEmpresa.set(c.companyId, {
        id: c.companyId,
        nome: c.empresaNome,
        cor: c.empresaCor || "#2563EB",
        logo: c.empresaLogo || "",
        produto: c.empresaProduto,
        icp: c.empresaIcp,
        campanhas: [],
      });
    }
    const tarefas = JSON.parse(c.tarefas || "{}");
    porEmpresa.get(c.companyId).campanhas.push({
      id: c.id,
      titulo: c.titulo,
      descricao: c.descricao,
      produto: c.produto,
      publico: c.publico,
      objetivo: c.objetivo,
      regiao: c.regiao,
      funcao: c.funcao,
      vagas: c.vagas,
      orcamento: c.orcamento || 0,
      tarefas,
    });
  }

  res.json({ empresas: [...porEmpresa.values()] });
});

export default router;
