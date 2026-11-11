// Documento do titular da conta (CPF ou CNPJ). Utilitários de formatação e
// validação usados na edição inline dos dados da empresa.
//
// A validação segue o padrão do resto do app (ver normalizarDocumento em
// shared/onboarding.js): "completo" é ter o número de dígitos de um CPF (11)
// ou de um CNPJ (14). A máscara é progressiva — aplicada a cada tecla — e
// decide o formato pelo tamanho: até 11 dígitos formata como CPF, acima
// disso como CNPJ.

const soDigitos = (valor) => String(valor || "").replace(/\D/g, "").slice(0, 14);

export function chavePixValida(chave, tipo) {
  if (!chave || !tipo) return false;
  const v = chave.trim();
  if (tipo === "cpf") return /^\d{11}$/.test(soDigitos(v));
  if (tipo === "cnpj") return /^\d{14}$/.test(soDigitos(v));
  if (tipo === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (tipo === "telefone") return /^\+?\d{10,13}$/.test(v.replace(/\D/g, ""));
  if (tipo === "aleatoria") return /^[a-f0-9-]{32,36}$/i.test(v);
  return v.length > 0;
}

export function documentoValido(valor) {
  const d = soDigitos(valor);
  return d.length === 11 || d.length === 14;
}

export function mascararDocumento(valor) {
  const d = soDigitos(valor);
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  // CNPJ: 00.000.000/0000-00
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}
