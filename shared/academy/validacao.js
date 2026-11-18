export function validarEdicaoCurso(atual, dados = {}) {
  if (Object.hasOwn(dados, "titulo") && !String(dados.titulo || "").trim()) return "O curso precisa de um título";
  if (Object.hasOwn(dados, "gratuito") && typeof dados.gratuito !== "boolean") return "Acesso inválido";
  if (Object.hasOwn(dados, "preco") && (typeof dados.preco !== "number" || !Number.isFinite(dados.preco) || dados.preco < 0)) return "Preço inválido";
  if (Object.hasOwn(dados, "notaMinima") && (typeof dados.notaMinima !== "number" || !Number.isFinite(dados.notaMinima) || dados.notaMinima < 1 || dados.notaMinima > 100)) return "A nota mínima deve estar entre 1 e 100";
  if (Object.hasOwn(dados, "gratuito") || Object.hasOwn(dados, "preco")) {
    const gratuito = dados.gratuito ?? !!atual.gratuito;
    const preco = dados.preco ?? atual.preco;
    if (!gratuito && preco <= 0) return "Informe um preço maior que zero para o curso pago";
  }
  return null;
}
