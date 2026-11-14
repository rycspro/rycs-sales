// Geração de treinamentos da Academy a partir do conhecimento da empresa
// (Materiais). Usa a IA quando a chave está disponível; caso contrário, compõe
// os treinos de forma determinística a partir das MESMAS fontes reais. Em
// nenhum caso inventa preços, benefícios, políticas ou características: todo
// conteúdo vem das fontes cadastradas pela empresa.

import Anthropic from "@anthropic-ai/sdk";
import db, { uid, agora } from "../db.js";
import { criarCurso } from "./academy.js";

const MODELO = "claude-sonnet-5";
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
export const iaDisponivel = () => !!client;

const parse = (v, p) => { try { return JSON.parse(v || ""); } catch { return p; } };
const txt = (v) => String(v || "").trim();

// Extrai o primeiro bloco JSON de um texto livre devolvido pelo modelo.
function extrairJson(texto) {
  const i = texto.indexOf("{"); const ia = texto.indexOf("[");
  const inicio = ia >= 0 && (ia < i || i < 0) ? ia : i;
  if (inicio < 0) throw new Error("sem JSON");
  const abre = texto[inicio], fecha = abre === "[" ? "]" : "}";
  let nivel = 0;
  for (let k = inicio; k < texto.length; k++) {
    if (texto[k] === abre) nivel++;
    else if (texto[k] === fecha && --nivel === 0) return JSON.parse(texto.slice(inicio, k + 1));
  }
  throw new Error("JSON incompleto");
}

const SEC = { sobre: "Sobre a empresa", produtos: "Produtos e serviços", abordagens: "Abordagens e orientações", processos: "Processos e procedimentos" };

// Reúne as fontes reais da empresa: Informações da empresa (Materiais), base de
// conhecimento e arquivos já indexados.
export function coletarFontes(companyId) {
  const fontes = [];
  const infos = db.prepare("SELECT id, secao, titulo, descricao, conteudo, dados FROM company_info_entries WHERE companyId = ? ORDER BY secao, ordem").all(companyId);
  for (const e of infos) {
    const d = parse(e.dados, {});
    const partes = [e.descricao, e.conteudo, d.caracteristicas, d.beneficios, d.diferenciais, d.publico, d.preco, d.complementos, d.objetivo, d.observacoes,
      Array.isArray(d.etapas) ? d.etapas.filter(Boolean).map((p, i) => `${i + 1}. ${p}`).join("\n") : ""].map(txt).filter(Boolean);
    const conteudo = partes.join("\n");
    if (conteudo) fontes.push({ id: `info-${e.id}`, tipo: "informacao", grupo: SEC[e.secao] || e.secao, secao: e.secao, titulo: e.titulo || SEC[e.secao], texto: conteudo });
  }
  const docs = db.prepare("SELECT id, titulo, conteudo FROM knowledge_documents WHERE companyId = ? AND status = 'disponível'").all(companyId);
  for (const d of docs) if (txt(d.conteudo)) fontes.push({ id: `doc-${d.id}`, tipo: "documento", grupo: "Base de conhecimento", titulo: d.titulo, texto: txt(d.conteudo).slice(0, 4000) });
  const mats = db.prepare("SELECT id, nome, textoExtraido FROM academy_materiais WHERE companyId = ? AND statusIndexacao = 'indexado'").all(companyId);
  for (const m of mats) if (txt(m.textoExtraido)) fontes.push({ id: `mat-${m.id}`, tipo: "arquivo", grupo: "Biblioteca de arquivos", titulo: m.nome, texto: txt(m.textoExtraido).slice(0, 4000) });
  return fontes;
}

const filtrarFontes = (fontes, ids) => (Array.isArray(ids) && ids.length ? fontes.filter((f) => ids.includes(f.id)) : fontes);

// ---------------------------------------------------------------- SUGESTÕES ----
export async function sugerirTreinamentos(companyId, fonteIds) {
  const fontes = filtrarFontes(coletarFontes(companyId), fonteIds);
  if (!fontes.length) return { sugestoes: [], fontesUsadas: 0, motor: "nenhum" };

  if (client) {
    try {
      const contexto = fontes.map((f) => `### [${f.id}] ${f.grupo} — ${f.titulo}\n${f.texto.slice(0, 1500)}`).join("\n\n");
      const resp = await client.messages.create({
        model: MODELO, max_tokens: 2000,
        system: "Você ajuda uma empresa a planejar treinamentos para sua equipe a partir APENAS do conhecimento fornecido. Nunca invente preços, benefícios, garantias, políticas ou características ausentes das fontes. Se faltar informação, liste em 'ausencias'. Responda SOMENTE com JSON.",
        messages: [{ role: "user", content: `Fontes da empresa:\n\n${contexto}\n\nProponha de 2 a 5 treinamentos relevantes ao modelo de negócio desta empresa. A quantidade depende do volume e da qualidade das fontes — não force um número fixo nem crie treinamentos vazios. Responda em JSON: {"sugestoes":[{"titulo":"","objetivo":"","resumo":"","estrutura":["Módulo 1: ...","Módulo 2: ..."],"fontes":["info-..","doc-.."],"ausencias":[".."]}]}` }],
      });
      const bruto = resp?.content?.map((c) => c.text || "").join("") || "";
      const json = extrairJson(bruto);
      const sugestoes = (json.sugestoes || []).filter((s) => txt(s.titulo)).slice(0, 6).map((s) => ({
        titulo: txt(s.titulo), objetivo: txt(s.objetivo), resumo: txt(s.resumo),
        estrutura: (Array.isArray(s.estrutura) ? s.estrutura : []).map(txt).filter(Boolean).slice(0, 8),
        fontes: (Array.isArray(s.fontes) ? s.fontes : []).filter((id) => fontes.some((f) => f.id === id)),
        ausencias: (Array.isArray(s.ausencias) ? s.ausencias : []).map(txt).filter(Boolean).slice(0, 5),
      }));
      if (sugestoes.length) return { sugestoes, fontesUsadas: fontes.length, motor: "ia" };
    } catch { /* cai no determinístico */ }
  }
  return { ...sugerirDeterministico(fontes), fontesUsadas: fontes.length };
}

// Sugestões sem IA: agrupa as fontes por área e propõe um treino por grupo.
function sugerirDeterministico(fontes) {
  const grupos = {};
  for (const f of fontes) (grupos[f.grupo] = grupos[f.grupo] || []).push(f);
  const TITULOS = {
    "Produtos e serviços": { titulo: "Conhecendo nossos produtos e serviços", objetivo: "Dominar o que a empresa oferece para apresentar com clareza." },
    "Abordagens e orientações": { titulo: "Abordagem e comunicação com o cliente", objetivo: "Aplicar o tom e os argumentos certos no atendimento." },
    "Processos e procedimentos": { titulo: "Processos e procedimentos operacionais", objetivo: "Executar as atividades seguindo o padrão da empresa." },
    "Sobre a empresa": { titulo: "Quem somos: identidade e posicionamento", objetivo: "Representar a empresa com a mensagem correta." },
    "Base de conhecimento": { titulo: "Base de conhecimento da empresa", objetivo: "Consultar as informações essenciais da operação." },
    "Biblioteca de arquivos": { titulo: "Materiais de apoio da empresa", objetivo: "Usar os materiais oficiais no dia a dia." },
  };
  const sugestoes = Object.entries(grupos).map(([grupo, fs]) => {
    const meta = TITULOS[grupo] || { titulo: grupo, objetivo: `Aprender sobre ${grupo.toLowerCase()}.` };
    return {
      titulo: meta.titulo, objetivo: meta.objetivo,
      resumo: `Treinamento baseado em ${fs.length} fonte(s) de "${grupo}" cadastradas pela empresa.`,
      estrutura: fs.slice(0, 8).map((f, i) => `Módulo ${i + 1}: ${f.titulo}`),
      fontes: fs.map((f) => f.id), ausencias: [],
    };
  });
  return { sugestoes, motor: "deterministico" };
}

// ----------------------------------------------------------------- GERAÇÃO ----
// Gera um treinamento completo (persistido como 'aguardando revisão', origem IA)
// a partir de uma sugestão e das fontes indicadas.
export async function gerarCurso(companyId, sugestao, criadoPor) {
  const todas = coletarFontes(companyId);
  const usadas = filtrarFontes(todas, sugestao?.fontes);
  const base = usadas.length ? usadas : todas;
  if (!base.length) throw new Error("Sem fontes para gerar o treinamento.");

  let modulos = null;
  if (client) {
    try {
      const contexto = base.map((f) => `### [${f.id}] ${f.titulo}\n${f.texto.slice(0, 2000)}`).join("\n\n");
      const resp = await client.messages.create({
        model: MODELO, max_tokens: 4000,
        system: "Você cria o conteúdo de um treinamento corporativo usando APENAS as fontes fornecidas. Não invente fatos, preços, benefícios ou procedimentos. Escreva didático e objetivo, em português do Brasil. Responda SOMENTE com JSON.",
        messages: [{ role: "user", content: `Treinamento: "${txt(sugestao?.titulo)}"\nObjetivo: ${txt(sugestao?.objetivo)}\n\nFontes:\n\n${contexto}\n\nProduza o conteúdo em JSON: {"modulos":[{"titulo":"","aulas":[{"titulo":"","conteudo":"texto explicativo em parágrafos"}]}]}. Use de 1 a 4 módulos conforme o conteúdo disponível. Não crie aulas vazias.` }],
      });
      const bruto = resp?.content?.map((c) => c.text || "").join("") || "";
      const json = extrairJson(bruto);
      modulos = (json.modulos || []).filter((m) => txt(m.titulo)).slice(0, 6).map((m) => ({
        titulo: txt(m.titulo).slice(0, 160), resumo: "",
        aulas: (Array.isArray(m.aulas) ? m.aulas : []).filter((a) => txt(a.titulo) && txt(a.conteudo)).slice(0, 10)
          .map((a) => ({ titulo: txt(a.titulo).slice(0, 160), tipo: "texto", conteudo: txt(a.conteudo).slice(0, 8000), duracaoMin: 5 })),
      })).filter((m) => m.aulas.length);
      if (!modulos.length) modulos = null;
    } catch { modulos = null; }
  }

  // Determinístico: cada fonte vira uma aula com o próprio texto cadastrado.
  if (!modulos) {
    const grupos = {};
    for (const f of base) (grupos[f.grupo] = grupos[f.grupo] || []).push(f);
    modulos = Object.entries(grupos).map(([grupo, fs]) => ({
      titulo: grupo, resumo: "",
      aulas: fs.map((f) => ({ titulo: f.titulo, tipo: "texto", conteudo: f.texto.slice(0, 8000), duracaoMin: 5 })),
    }));
  }

  const emp = db.prepare("SELECT nome FROM companies WHERE id = ?").get(companyId);
  const courseId = criarCurso({
    titulo: txt(sugestao?.titulo).slice(0, 160) || "Treinamento",
    descricao: txt(sugestao?.resumo).slice(0, 2000),
    companyId, professor: emp?.nome || "", status: "revisao", criadoPor,
    modulos,
  });
  db.prepare("UPDATE courses SET origem = 'ia' WHERE id = ?").run(courseId);

  // Rastreabilidade das fontes utilizadas.
  registrarFontes(courseId, companyId, base);
  return courseId;
}

function registrarFontes(courseId, companyId, fontes) {
  const ins = db.prepare("INSERT INTO course_sources (id, courseId, companyId, fonteTipo, fonteId, rotulo, versao, criadoEm) VALUES (?, ?, ?, ?, ?, ?, 1, ?)");
  const ts = agora();
  db.transaction(() => {
    db.prepare("DELETE FROM course_sources WHERE courseId = ? AND companyId = ?").run(courseId, companyId);
    for (const f of fontes) ins.run(uid(), courseId, companyId, f.tipo, f.id, `${f.grupo} — ${f.titulo}`.slice(0, 200), ts);
  })();
}

// Gera aulas para um módulo (curso) existente, respeitando seu tema. Insere as
// aulas num módulo interno e mantém o curso em revisão (nunca publica).
export async function gerarAulasParaCurso(companyId, courseId) {
  const curso = db.prepare("SELECT * FROM courses WHERE id = ? AND companyId = ?").get(courseId, companyId);
  if (!curso) throw new Error("Módulo não encontrado.");
  const base = coletarFontes(companyId);
  if (!base.length) throw new Error("Sem fontes em Materiais para gerar aulas.");

  let aulas = null;
  if (client) {
    try {
      const contexto = base.map((f) => `### ${f.titulo}\n${f.texto.slice(0, 1500)}`).join("\n\n");
      const resp = await client.messages.create({
        model: MODELO, max_tokens: 3000,
        system: "Você cria aulas para um módulo de treinamento usando APENAS as fontes fornecidas. Não invente fatos, preços, benefícios ou procedimentos. Português do Brasil. Responda SOMENTE com JSON.",
        messages: [{ role: "user", content: `Módulo: "${txt(curso.titulo)}"\n${txt(curso.descricao)}\n\nFontes da empresa:\n\n${contexto}\n\nProduza as aulas em JSON: {"aulas":[{"titulo":"","conteudo":"texto explicativo"}]}. De 2 a 6 aulas conforme o conteúdo. Não crie aulas vazias.` }],
      });
      const json = extrairJson(resp?.content?.map((c) => c.text || "").join("") || "");
      aulas = (json.aulas || []).filter((a) => txt(a.titulo) && txt(a.conteudo)).slice(0, 10)
        .map((a) => ({ titulo: txt(a.titulo).slice(0, 160), tipo: "texto", conteudo: txt(a.conteudo).slice(0, 8000), duracaoMin: 5 }));
      if (!aulas.length) aulas = null;
    } catch { aulas = null; }
  }
  if (!aulas) aulas = base.slice(0, 8).map((f) => ({ titulo: f.titulo.slice(0, 160), tipo: "texto", conteudo: f.texto.slice(0, 8000), duracaoMin: 5 }));

  // Insere as aulas num módulo do curso (cria um se não houver).
  let moduleRow = db.prepare("SELECT * FROM course_modules WHERE courseId = ? ORDER BY ordem ASC LIMIT 1").get(courseId);
  const ts = agora();
  db.transaction(() => {
    let moduleId = moduleRow?.id;
    if (!moduleId) { moduleId = uid(); db.prepare("INSERT INTO course_modules (id, courseId, titulo, resumo, ordem) VALUES (?, ?, ?, '', 0)").run(moduleId, courseId, curso.titulo || "Módulo 01"); }
    const base2 = db.prepare("SELECT COALESCE(MAX(ordem), -1) + 1 m FROM course_lessons WHERE moduleId = ?").get(moduleId).m;
    const ins = db.prepare(`INSERT INTO course_lessons (id, courseId, moduleId, titulo, tipo, conteudo, videoUrl, materiais, duracaoMin, ordem) VALUES (?, ?, ?, ?, ?, ?, '', '[]', ?, ?)`);
    aulas.forEach((a, i) => ins.run(uid(), courseId, moduleId, a.titulo, a.tipo, a.conteudo, a.duracaoMin, base2 + i));
    db.prepare("UPDATE courses SET origem = 'ia', status = CASE WHEN status = 'publicado' THEN status ELSE 'revisao' END, atualizadoEm = ? WHERE id = ?").run(ts, courseId);
  })();
  registrarFontes(courseId, companyId, base);
  return { aulas: aulas.length };
}
