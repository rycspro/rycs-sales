// Provider Layer do RYCS Audit Engine.
//
// O motor não conhece fornecedor. Ele pede uma capacidade — ver uma imagem,
// transcrever um áudio, avaliar critérios sobre um texto — e recebe de volta
// uma estrutura fixa. Trocar de fornecedor amanhã é registrar outro adapter
// aqui; o Policy, o Scoring e o Decision Engine não mudam.
//
// Regra que não se negocia: quando não há provedor configurado, a capacidade
// responde INDISPONÍVEL. Nunca um resultado inventado, nunca um número
// aleatório. Um score falso contamina a decisão e destrói a confiança na
// auditoria inteira — que é o ativo que este motor existe para construir.

import { registrarExecucao } from "../observabilidade.js";

export const CAPACIDADES = ["visao", "transcricao", "semantica"];

export const STATUS = {
  ok: "ok",
  indisponivel: "indisponivel",
  erro: "erro",
  timeout: "timeout",
};

const registro = new Map();

// Um adapter declara qual capacidade atende, se está configurado e como
// executar. `disponivel()` é consultado a cada chamada: uma chave pode ser
// adicionada em runtime sem reiniciar o processo.
export function registrarProvider(adapter) {
  if (!CAPACIDADES.includes(adapter?.capacidade))
    throw new Error(`Capacidade desconhecida: ${adapter?.capacidade}`);
  if (!adapter.nome) throw new Error("Adapter precisa de nome");
  if (typeof adapter.executar !== "function") throw new Error("Adapter precisa de executar()");

  const lista = registro.get(adapter.capacidade) || [];
  lista.push({ prioridade: 50, disponivel: () => false, ...adapter });
  lista.sort((a, b) => a.prioridade - b.prioridade);
  registro.set(adapter.capacidade, lista);
}

export function providersDe(capacidade) {
  return registro.get(capacidade) || [];
}

// O primeiro adapter configurado da capacidade. A ordem é a prioridade, e é
// por aqui que entra o roteamento por custo: um adapter econômico com
// prioridade baixa atende primeiro, e o caro fica de reserva.
export function providerAtivo(capacidade) {
  return providersDe(capacidade).find((p) => {
    try { return p.disponivel(); } catch { return false; }
  }) || null;
}

export function capacidadesDisponiveis() {
  return Object.fromEntries(CAPACIDADES.map((c) => {
    const ativo = providerAtivo(c);
    return [c, {
      disponivel: !!ativo,
      provider: ativo?.nome || null,
      modelo: ativo?.modelo || null,
      registrados: providersDe(c).map((p) => ({ nome: p.nome, configurado: (() => { try { return p.disponivel(); } catch { return false; } })() })),
    }];
  }));
}

const TIMEOUT_PADRAO = Number(process.env.AUDIT_PROVIDER_TIMEOUT_MS) || 30000;

function comTimeout(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((_, rejeitar) => setTimeout(() => rejeitar(Object.assign(new Error("timeout"), { timeout: true })), ms)),
  ]);
}

// Executa uma capacidade e registra a corrida: provider, modelo, operação,
// latência, custo e erro. É esse registro que permite responder depois
// "quanto custou auditar esta ação" e "qual provedor está falhando".
export async function executar({ capacidade, operacao, entrada, auditRequestId = null, timeoutMs = TIMEOUT_PADRAO }) {
  const provider = providerAtivo(capacidade);
  const inicio = Date.now();

  if (!provider) {
    const saida = {
      status: STATUS.indisponivel,
      provider: null,
      resultado: null,
      mensagem: `Capacidade "${capacidade}" não tem provedor configurado. Os critérios que dependem dela ficam inconclusivos e a ação vai para revisão humana.`,
    };
    registrarExecucao({ auditRequestId, capacidade, operacao, provider: null, modelo: null, status: STATUS.indisponivel, latenciaMs: 0, erro: saida.mensagem });
    return saida;
  }

  try {
    const resultado = await comTimeout(provider.executar({ operacao, entrada }), timeoutMs);
    const latenciaMs = Date.now() - inicio;
    registrarExecucao({
      auditRequestId, capacidade, operacao,
      provider: provider.nome, modelo: resultado?.modelo || provider.modelo || null,
      status: STATUS.ok, latenciaMs,
      custoEstimado: resultado?.custoEstimado ?? null,
      tokens: resultado?.tokens ?? null,
    });
    return { status: STATUS.ok, provider: provider.nome, modelo: resultado?.modelo || provider.modelo || null, resultado: resultado?.dados ?? resultado, latenciaMs };
  } catch (err) {
    const latenciaMs = Date.now() - inicio;
    const status = err?.timeout ? STATUS.timeout : STATUS.erro;
    // A mensagem do provedor pode trazer trecho de payload; nada dela vai para
    // o log estruturado além do texto curto do erro.
    const mensagem = String(err?.message || "falha desconhecida").slice(0, 300);
    registrarExecucao({ auditRequestId, capacidade, operacao, provider: provider.nome, modelo: provider.modelo || null, status, latenciaMs, erro: mensagem });
    return { status, provider: provider.nome, resultado: null, mensagem, latenciaMs };
  }
}

// Usado pelos testes para isolar o registro entre casos.
export function limparRegistro() {
  registro.clear();
}
