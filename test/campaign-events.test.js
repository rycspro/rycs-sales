import test from "node:test";
import assert from "node:assert/strict";
import { listarEventosCampanha, registrarEventoCampanha, TIPOS_EVENTO_CAMPANHA } from "../server/services/campaignEvents.js";

test("linha do tempo reconhece todos os eventos operacionais previstos", () => {
  const obrigatorios = [
    "CAMPAIGN_CREATED", "CAMPAIGN_PUBLISHED", "CAMPAIGN_PAUSED",
    "PROFESSIONAL_APPLIED", "PROFESSIONAL_APPROVED", "PROFESSIONAL_JOINED",
    "TASK_STARTED", "TASK_COMPLETED", "TASK_APPROVED", "TASK_REJECTED",
    "LEAD_CREATED", "MEETING_SCHEDULED", "MEETING_COMPLETED", "SALE_RECORDED",
    "EVIDENCE_SUBMITTED", "PAYMENT_RELEASED",
  ];
  assert.equal(obrigatorios.every((tipo) => TIPOS_EVENTO_CAMPANHA.has(tipo)), true);
});

test("evento inválido não é gravado e consulta permanece isolada", () => {
  assert.equal(registrarEventoCampanha({ companyId: "x", campaignId: "y", tipo: "INVENTADO" }), null);
  assert.deepEqual(listarEventosCampanha("empresa-inexistente", "campanha-inexistente"), []);
});
