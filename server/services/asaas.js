// Cliente HTTP do Asaas.
//
// A versão anterior fazia `res.json()` sem olhar o status, então um 400 do
// gateway virava "sucesso" com campos undefined e o erro só aparecia depois,
// como saldo que nunca creditou. Aqui todo erro vira exceção.

const AMBIENTES = {
  production: "https://api.asaas.com/v3",
  sandbox: "https://sandbox.asaas.com/api/v3",
};

// A chave carrega o ambiente no próprio prefixo: $aact_prod_ é dinheiro real.
const chaveEhProducao = () => String(process.env.ASAAS_API_KEY || "").includes("_prod_");

// Confere ambiente e chave antes de qualquer chamada. Um ASAAS_ENV digitado
// errado não pode ser a diferença entre testar e movimentar dinheiro real:
// na dúvida o gateway fica desligado, e o depósito é recusado com clareza.
function resolverAmbiente() {
  // Só nos testes automatizados: aponta o cliente para um gateway falso local.
  if (process.env.NODE_ENV === "test" && process.env.ASAAS_BASE_URL_TESTE && process.env.ASAAS_API_KEY)
    return { ok: true, base: process.env.ASAAS_BASE_URL_TESTE, ambiente: "teste" };
  const declarado = String(process.env.ASAAS_ENV || "").trim().toLowerCase();
  if (!process.env.ASAAS_API_KEY) return { ok: false, motivo: "ASAAS_API_KEY não configurada" };

  if (!AMBIENTES[declarado])
    return { ok: false, motivo: `ASAAS_ENV inválido ("${process.env.ASAAS_ENV}"). Use "sandbox" ou "production".` };

  if ((declarado === "production") !== chaveEhProducao())
    return {
      ok: false,
      motivo: `ASAAS_ENV="${declarado}" não corresponde à chave (${chaveEhProducao() ? "produção" : "sandbox"}).`,
    };

  return { ok: true, base: AMBIENTES[declarado], ambiente: declarado };
}

const ambiente = resolverAmbiente();
if (!ambiente.ok) console.warn(`[asaas] desligado — ${ambiente.motivo}`);
else console.log(`[asaas] ${ambiente.ambiente}${ambiente.ambiente === "production" ? " — DINHEIRO REAL" : ""}`);

export const asaasAtivo = () => ambiente.ok;
export const asaasMotivoDesligado = () => ambiente.motivo;

export class AsaasError extends Error {
  constructor(mensagem, status, corpo) {
    super(mensagem);
    this.name = "AsaasError";
    this.status = status;
    this.corpo = corpo;
  }
}

export async function asaas(caminho, { method = "GET", body } = {}) {
  if (!ambiente.ok) throw new AsaasError(ambiente.motivo, 0, null);

  const res = await fetch(`${ambiente.base}${caminho}`, {
    method,
    headers: { "Content-Type": "application/json", access_token: process.env.ASAAS_API_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });

  const texto = await res.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { /* resposta não-JSON */ }

  if (!res.ok) {
    // O Asaas devolve os detalhes em errors[].description.
    const detalhe = dados?.errors?.map((e) => e.description).join("; ") || texto?.slice(0, 200) || res.statusText;
    throw new AsaasError(detalhe, res.status, dados);
  }
  return dados;
}

// ---------------------------------------------------------------------------
// Cliente da empresa no gateway
//
// Estava dentro de routes/payments.js, privado, e só nascia quando a empresa
// fazia um depósito. A assinatura precisa da mesma coisa e não pode exigir
// depósito antes — ninguém deposita caixa de campanha para poder assinar.
// Mora aqui para os dois caminhos usarem um só.

export async function garantirCliente(db, empresa) {
  if (empresa.asaasCustomerId) return empresa.asaasCustomerId;

  if (!empresa.documento) {
    const e = new Error("Cadastre o CNPJ ou CPF da empresa antes de continuar.");
    e.faltaDocumento = true;
    throw e;
  }

  const usuario = db.prepare("SELECT email FROM users WHERE entityId = ? AND role = 'empresa'").get(empresa.id);
  const cliente = await asaas("/customers", {
    method: "POST",
    body: {
      name: empresa.nome,
      cpfCnpj: String(empresa.documento).replace(/\D/g, ""),
      email: usuario?.email || undefined,
      externalReference: empresa.id,
    },
  });

  db.prepare("UPDATE companies SET asaasCustomerId = ? WHERE id = ?").run(cliente.id, empresa.id);
  return cliente.id;
}
