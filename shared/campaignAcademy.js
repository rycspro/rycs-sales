export function atendeCertificacaoDaCampanha(campanha, certificacoes = []) {
  if (!campanha?.exigeCertificacao) return true;
  if (!campanha.funcao) return false;
  return certificacoes.some((c) => c.funcao === campanha.funcao);
}
