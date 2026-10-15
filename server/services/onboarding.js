import { createHash, randomBytes } from "crypto";
import db, { agora } from "../db.js";
import { normalizarEtapas, etapaAtual, concluirEtapa, onboardingConcluido } from "../../shared/onboarding.js";

// Progresso do onboarding no servidor. A tela pergunta aqui em vez de decidir
// sozinha — o mesmo princípio do portão de assinatura.

export const hashToken = (t) => createHash("sha256").update(String(t)).digest("hex");
export const novoToken = () => randomBytes(32).toString("hex");

const lerLinha = (companyId) => db.prepare("SELECT * FROM onboarding WHERE companyId = ?").get(companyId);

export function criarOnboarding({ companyId, origem = "site", conviteId = null, trialDias = 0, acessoConcluido = false }) {
  const t = agora();
  const etapas = normalizarEtapas(acessoConcluido ? { acesso: "concluida" } : {});
  db.prepare(`INSERT OR IGNORE INTO onboarding (companyId, etapas, origem, conviteId, trialDias, criadoEm, atualizadoEm)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(companyId, JSON.stringify(etapas), origem, conviteId, trialDias, t, t);
  return lerLinha(companyId);
}

// Empresas que já existiam antes do onboarding entram na primeira vez que
// consultam. O acesso só conta como concluído se o WhatsApp, obrigatório,
// já estiver cadastrado.
export function obterOnboarding(companyId) {
  const linha = lerLinha(companyId);
  if (linha) return linha;
  const empresa = db.prepare("SELECT whatsapp FROM companies WHERE id = ?").get(companyId);
  if (!empresa) return null;
  return criarOnboarding({ companyId, origem: "existente", acessoConcluido: !!empresa.whatsapp });
}

export function concluir(companyId, chave) {
  const linha = obterOnboarding(companyId);
  if (!linha) return null;
  const novas = concluirEtapa(JSON.parse(linha.etapas || "{}"), chave);
  if (!novas) return null;
  const t = agora();
  db.prepare("UPDATE onboarding SET etapas = ?, concluidoEm = ?, atualizadoEm = ? WHERE companyId = ?")
    .run(JSON.stringify(novas), onboardingConcluido(novas) ? (linha.concluidoEm || t) : null, t, companyId);
  return lerLinha(companyId);
}

export function serializar(linha) {
  const etapas = normalizarEtapas(JSON.parse(linha.etapas || "{}"));
  const atual = etapaAtual(etapas);
  const empresa = db.prepare("SELECT whatsapp FROM companies WHERE id = ?").get(linha.companyId);
  return {
    etapas,
    atual: atual?.chave || null,
    concluido: !atual,
    trialDias: linha.trialDias || 0,
    origem: linha.origem,
    whatsapp: empresa?.whatsapp || "",
  };
}
