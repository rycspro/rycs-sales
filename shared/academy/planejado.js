import { readFileSync } from "node:fs";

// Nova edição em preparação: não substitui cursos nem progresso existentes.
const catalogo = JSON.parse(readFileSync(new URL("../../content/academy/catalogo-134h.json", import.meta.url), "utf8"));

export const CATALOGO_PLANEJADO = catalogo.courses.map((curso) => ({
  slug: `sales-academy-134h-${String(curso.id).padStart(2, "0")}`,
  titulo: curso.name,
  subtitulo: `Edição em preparação · ${curso.hours}h previstas · ${curso.level}`,
  descricao: `Rascunho curricular. Carga horária prevista: ${curso.hours} horas, incluindo estudo e avaliações. Certificação prevista: ${curso.certification}. Material didático, avaliações, localização EUA/Índia e revisões editorial e jurídica pendentes. Não disponível para estudo ou certificação.`,
  nivel: curso.level.includes("Avançado") || curso.level.includes("avançado") ? "avancado"
    : curso.level.includes("Iniciante") || curso.level === "Todos" ? "fundamentos" : "intermediario",
  categoria: "Vendas consultivas",
  professor: "RYCS Academy",
  status: "rascunho",
  gratuito: curso.id === 1,
  preco: 0,
  notaMinima: 80,
  modulos: [],
  prova: [],
}));
