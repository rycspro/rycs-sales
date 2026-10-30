import { obterOnboarding, serializar } from "../services/onboarding.js";

// Bloqueia ações de escrita principais para empresas no caminho "livre"
// que ainda não concluíram o onboarding.
//
// Ações bloqueadas (métodos não-GET nas rotas configuradas):
//   - criar/publicar campanha
//   - criar lead
//   - enviar mensagem
//   - configurar (webhook, integrações)
//
// Retorna 409 com { error: "ONBOARDING_PENDENTE", redirect } para que o
// frontend (api.js) redirecione automaticamente para a etapa atual.

const ROTAS_BLOQUEADAS = [
  /^\/api\/campaigns(\/|$)/,
  /^\/api\/leads(\/|$)/,
  /^\/api\/messages(\/|$)/,
  /^\/api\/configuracoes(\/|$)/,
  /^\/api\/webhooks(\/|$)/,
];

const METODOS_ESCRITA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function onboardingGuard(req, res, next) {
  // Só empresas no caminho livre.
  if (req.user?.role !== "empresa" || !req.user.entityId) return next();
  if (!METODOS_ESCRITA.has(req.method)) return next();
  if (!ROTAS_BLOQUEADAS.some((re) => re.test(req.path))) return next();

  const linha = obterOnboarding(req.user.entityId);
  if (!linha) return next();
  const onb = serializar(linha);
  if (onb.concluido || onb.bloqueia || onb.caminho !== "livre") return next();

  const etapa = onb.atual || "";
  const redirect = `/onboarding${etapa ? `/${etapa}` : ""}`;
  return res.status(409).json({ error: "ONBOARDING_PENDENTE", redirect });
}
