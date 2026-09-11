import { takeRateDoPlano } from "./planos.js";

export function calcularValorTarefa(valorBruto, plano) {
  const bruto = Math.max(0, Math.round((Number(valorBruto) || 0) * 100) / 100);
  const percentual = takeRateDoPlano(plano);
  const taxa = Math.round(bruto * percentual * 100) / 100;
  const liquido = Math.round((bruto - taxa) * 100) / 100;
  return { bruto, percentual, taxa, liquido };
}
