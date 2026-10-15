import { Router } from "express";
import db, { agora } from "../db.js";
import { avaliarFoto } from "../../shared/fotoPerfil.js";
import { calcularDisc, PERGUNTAS_DISC, PERGUNTAS_EXPERIENCIA, perguntasDiscPublicas, perguntasXpPublicas } from "../../shared/discQuiz.js";
import { calcular } from "../services/triagem.js";
import { perguntasPublicas, CATEGORIAS, FAIXAS, TOTAL_PERGUNTAS } from "../../shared/triagem.js";

const router = Router();

const ETAPAS_ONBOARDING = ["perfil", "quiz", "concluido"];

function etapaIndex(etapa) {
  return ETAPAS_ONBOARDING.indexOf(etapa);
}

router.get("/onboarding-pro", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const seller = db.prepare("SELECT onboardingEtapa, nome, foto, bio, whats, linkedin, disc, email FROM sellers WHERE id = ?").get(req.user.entityId);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });

  res.json({
    etapa: seller.onboardingEtapa || "perfil",
    concluido: seller.onboardingEtapa === "concluido",
    perfil: {
      nome: seller.nome,
      foto: !!seller.foto,
      bio: seller.bio || "",
      whats: seller.whats || "",
      linkedin: seller.linkedin || "",
      email: seller.email || "",
    },
    disc: JSON.parse(seller.disc || "{}"),
  });
});

// Step 1: Salvar perfil (nome, foto, bio, whatsapp, linkedin)
router.post("/onboarding-pro/perfil", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const { nome, bio, whatsapp, linkedin } = req.body;
  const sellerId = req.user.entityId;

  const seller = db.prepare("SELECT foto, onboardingEtapa FROM sellers WHERE id = ?").get(sellerId);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });

  if (!nome?.trim()) return res.status(400).json({ error: "Nome é obrigatório", campo: "nome" });
  if (!whatsapp?.trim()) return res.status(400).json({ error: "WhatsApp é obrigatório", campo: "whatsapp" });
  if (!seller.foto) return res.status(400).json({ error: "Foto de perfil é obrigatória", campo: "foto" });
  if (!bio?.trim()) return res.status(400).json({ error: "Biografia é obrigatória", campo: "bio" });

  db.prepare("UPDATE sellers SET nome = ?, bio = ?, whats = ?, linkedin = ?, onboardingEtapa = 'quiz' WHERE id = ?")
    .run(nome.trim(), bio.trim(), whatsapp.trim(), (linkedin || "").trim(), sellerId);

  res.json({ ok: true, etapa: "quiz" });
});

// Step 1: Upload de foto (reutiliza a lógica existente)
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

  db.prepare(`UPDATE sellers SET
    disc = ?, discRespostas = ?, xpRespostas = ?,
    onboardingEtapa = 'concluido', status = 'aprovado',
    perfilComercial = ?
    WHERE id = ?`)
    .run(
      JSON.stringify(resultado),
      JSON.stringify(respostaDisc),
      JSON.stringify(respostaXp),
      JSON.stringify({ disc: resultado, experiencia: respostaXp }),
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
    });
  }

  res.json({ empresas: [...porEmpresa.values()] });
});

export default router;
