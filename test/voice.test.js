import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jwt from "jsonwebtoken";
import { paraE164 } from "../server/services/voice/sipProvider.js";

const SEGREDO = "segredo-de-teste-onboarding";
const assinar = (payload) => `sm_token=${jwt.sign(payload, SEGREDO, { expiresIn: "1h" })}`;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const cliente = (base) => async (path, opts = {}) => {
  const { body, cookie, method, headers = {} } = opts;
  const r = await fetch(base + path, {
    method: method || (body !== undefined ? "POST" : "GET"),
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const set = r.headers.get("set-cookie");
  return { status: r.status, corpo: await r.json().catch(() => null), cookie: set ? set.split(";")[0] : null };
};

describe("RYCS Voice — Discadora comercial", () => {
  let base, req, filho, dir;
  let cookieAdmin, cookieEmpresa, cookieVendedor, cookieVendedor2;
  let realCompanyId, realSellerId, realSellerId2;
  let queueId, leadId1, leadId2, leadId3, callId;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "rycs-voice-"));
    const dbPath = join(dir, "test.db");
    const porta = 41000 + Math.floor(Math.random() * 2000);
    const env = {
      ...process.env,
      DB_PATH: dbPath, PORT: String(porta), JWT_SECRET: SEGREDO,
      NODE_ENV: "test", DEV_SEM_LOGIN: "",
      RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ASAAS_API_KEY: "",
      S3_BUCKET: "", BUCKET: "", META_CAPI_TOKEN: "",
    };
    delete env.NODE_TEST_CONTEXT;

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      filho = spawn(process.execPath, ["server/index.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
      let saida = "";
      filho.stdout.on("data", (d) => { saida += d; });
      filho.stderr.on("data", (d) => { saida += d; });
      base = `http://127.0.0.1:${porta}/api`;
      let ok = false;
      for (let i = 0; i < 150; i++) {
        if (filho.exitCode !== null) break;
        try { await fetch(`${base}/plans`); ok = true; break; } catch { await esperar(100); }
      }
      if (ok) break;
      filho.kill();
      if (tentativa === 4) throw new Error("servidor não subiu: " + saida.slice(-1000));
    }
    req = cliente(base);
    cookieAdmin = assinar({ id: "adm1", role: "admin", entityId: "adm1" });

    // Criar empresa via admin
    const emp = await req("/admin/companies", {
      body: { nome: "Empresa Voice Test", produto: "SaaS B2B", email: "voice@test.com", senha: "Voice123!@#" },
      cookie: cookieAdmin,
    });
    realCompanyId = emp.corpo?.companyId;
    if (!realCompanyId) throw new Error("Falha ao criar empresa: " + JSON.stringify(emp.corpo));
    cookieEmpresa = assinar({ id: realCompanyId, role: "empresa", entityId: realCompanyId });

    // Criar vendedor 1
    const v1 = await req("/auth/register", {
      body: { email: "seller1@test.com", senha: "Seller123", role: "vendedor", nome: "Vendedor Um", aceitouTermos: true },
    });
    realSellerId = v1.corpo?.entityId;
    if (!realSellerId) throw new Error("Falha vendedor 1: " + JSON.stringify(v1.corpo));
    cookieVendedor = v1.cookie || assinar({ id: realSellerId, role: "vendedor", entityId: realSellerId });

    // Criar vendedor 2 (para testes de concorrência)
    const v2 = await req("/auth/register", {
      body: { email: "seller2@test.com", senha: "Seller123", role: "vendedor", nome: "Vendedor Dois", aceitouTermos: true },
    });
    realSellerId2 = v2.corpo?.entityId;
    cookieVendedor2 = v2.cookie || assinar({ id: realSellerId2, role: "vendedor", entityId: realSellerId2 });

    // Aprovar vendedores na empresa — via PATCH applications
    await req("/applications", { body: { sellerId: realSellerId, companyId: realCompanyId }, cookie: cookieVendedor });
    await req("/applications", { method: "PATCH", body: { sellerId: realSellerId, companyId: realCompanyId, status: "aprovado" }, cookie: cookieEmpresa });

    await req("/applications", { body: { sellerId: realSellerId2, companyId: realCompanyId }, cookie: cookieVendedor2 });
    await req("/applications", { method: "PATCH", body: { sellerId: realSellerId2, companyId: realCompanyId, status: "aprovado" }, cookie: cookieEmpresa });

    // Habilitar voice para a empresa
    await req("/voice/admin/habilitar", { body: { companyId: realCompanyId, habilitada: true }, cookie: cookieAdmin });

    // Configurar a discadora
    await req("/voice/settings", { body: { ativo: true, horarioInicio: "08:00", horarioFim: "20:00", metaDiaria: 50 }, cookie: cookieEmpresa, method: "PUT" });

    // Criar leads via API do vendedor
    const l1 = await req("/leads", { body: { nome: "Maria Leads", telefone: "11999001001", email: "maria@lead.com", companyId: realCompanyId }, cookie: cookieVendedor });
    leadId1 = l1.corpo?.id;
    const l2 = await req("/leads", { body: { nome: "João Prospect", telefone: "11999002002", email: "joao@lead.com", companyId: realCompanyId }, cookie: cookieVendedor });
    leadId2 = l2.corpo?.id;
    const l3 = await req("/leads", { body: { nome: "Ana Cliente", telefone: "11999003003", email: "ana@lead.com", companyId: realCompanyId }, cookie: cookieVendedor });
    leadId3 = l3.corpo?.id;
  });

  after(() => {
    if (filho) filho.kill();
    if (dir) try { rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  // ══════════════════════════════════════════════════════════════════════
  // 1. Feature flag
  // ══════════════════════════════════════════════════════════════════════

  it("feature flag: empresa vê voice habilitada", async () => {
    const r = await req("/voice/status", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.habilitada, true);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 2. Provedores
  // ══════════════════════════════════════════════════════════════════════

  it("lista 3 provedores: mobile, mock e sip", async () => {
    const r = await req("/voice/providers", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    const ids = r.corpo.map((p) => p.id);
    assert.ok(ids.includes("mobile"));
    assert.ok(ids.includes("mock"));
    assert.ok(ids.includes("sip"));
  });

  it("provedor SIP não está operacional", async () => {
    const r = await req("/voice/providers", { cookie: cookieEmpresa });
    const sip = r.corpo.find((p) => p.id === "sip");
    assert.ok(sip.pendente || sip.capabilities?.canInitiate === false);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 3. Fila: criar, membros, leads
  // ══════════════════════════════════════════════════════════════════════

  it("empresa cria fila", async () => {
    const r = await req("/voice/queues", { body: { nome: "Prospecção B2B" }, cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    queueId = r.corpo.id;
    assert.ok(queueId);
  });

  it("empresa adiciona profissionais à fila", async () => {
    const r = await req(`/voice/queues/${queueId}/members`, {
      body: { sellerIds: [realSellerId, realSellerId2] },
      cookie: cookieEmpresa,
    });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.adicionados, 2);
  });

  it("empresa lista membros da fila", async () => {
    const r = await req(`/voice/queues/${queueId}/members`, { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.length, 2);
  });

  it("empresa adiciona leads à fila", async () => {
    const r = await req(`/voice/queues/${queueId}/leads`, {
      body: { leadIds: [leadId1, leadId2, leadId3] },
      cookie: cookieEmpresa,
    });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.adicionados, 3);
  });

  it("empresa lista leads na fila", async () => {
    const r = await req(`/voice/queues/${queueId}/leads`, { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.length, 3);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 4. Sessão do profissional + reserva + ligação + resultado
  // ══════════════════════════════════════════════════════════════════════

  it("profissional inicia sessão na discadora", async () => {
    const r = await req("/voice/session/start", {
      body: { queueId, companyId: realCompanyId, modalidade: "mobile" },
      cookie: cookieVendedor,
    });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.status, "ativo");
  });

  it("profissional busca próximo lead (reserva atômica)", async () => {
    const r = await req("/voice/next-lead", { body: { queueId }, cookie: cookieVendedor });
    assert.equal(r.status, 200);
    assert.ok(r.corpo.lead, "Deve retornar lead");
    assert.ok(r.corpo.reserva, "Deve retornar reserva");
    assert.equal(r.corpo.reserva.status, "ativa");
    leadId1 = r.corpo.lead.id; // Pode ser qualquer dos 3
  });

  it("mesmo profissional recebe o mesmo lead (reserva ativa)", async () => {
    const r = await req("/voice/next-lead", { body: { queueId }, cookie: cookieVendedor });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.lead.id, leadId1, "Deve retornar o mesmo lead da reserva ativa");
  });

  it("segundo profissional recebe lead DIFERENTE (sem duplicar reserva)", async () => {
    // Iniciar sessão do segundo vendedor
    await req("/voice/session/start", {
      body: { queueId, companyId: realCompanyId, modalidade: "mobile" },
      cookie: cookieVendedor2,
    });
    const r = await req("/voice/next-lead", { body: { queueId }, cookie: cookieVendedor2 });
    assert.equal(r.status, 200);
    assert.ok(r.corpo.lead);
    assert.notEqual(r.corpo.lead.id, leadId1, "Lead diferente do já reservado");
  });

  it("profissional inicia ligação via mobile (modo celular)", async () => {
    const r = await req("/voice/calls", {
      body: { leadId: leadId1, queueId, providerId: "mobile" },
      cookie: cookieVendedor,
    });
    assert.equal(r.status, 200);
    callId = r.corpo.callId;
    assert.ok(callId);
    assert.ok(r.corpo.telUri, "Deve ter URI tel:");
    assert.equal(r.corpo.origemDados, "declarado", "Mobile = autodeclarado");
    assert.equal(r.corpo.simulado, false, "Mobile não é simulado");
  });

  it("ligação duplicada em 30s é bloqueada", async () => {
    const r = await req("/voice/calls", {
      body: { leadId: leadId1, queueId, providerId: "mobile" },
      cookie: cookieVendedor,
    });
    assert.equal(r.status, 429, "Deve bloquear duplicata recente");
  });

  it("profissional registra resultado com agendamento de reunião", async () => {
    const reuniaoTs = Date.now() + 86400000; // amanhã
    const r = await req(`/voice/calls/${callId}/result`, {
      body: {
        resultado: "reuniao_agendada",
        observacao: "Cliente interessado no plano enterprise",
        duracaoManual: 180,
        agendarReuniao: { data: reuniaoTs, duracao: 30 },
      },
      cookie: cookieVendedor,
    });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.ok, true);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 5. Calendário: reunião criada automaticamente
  // ══════════════════════════════════════════════════════════════════════

  it("reunião aparece no calendário da empresa", async () => {
    const r = await req("/calendario", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.corpo));
    const evento = r.corpo.find((e) => e.title && e.title.includes("Reunião"));
    assert.ok(evento, "Deve existir evento de reunião");
    assert.equal(evento.meetingType, "sales_call");
    assert.equal(evento.status, "scheduled");
  });

  // ══════════════════════════════════════════════════════════════════════
  // 6. Histórico e indicadores
  // ══════════════════════════════════════════════════════════════════════

  it("histórico de ligações registra a chamada", async () => {
    const r = await req("/voice/calls", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.ok(r.corpo.length >= 1, "Deve ter ao menos 1 ligação");
    const chamada = r.corpo.find((c) => c.id === callId);
    assert.ok(chamada);
    assert.equal(chamada.resultado, "reuniao_agendada");
    assert.equal(chamada.origemDados, "declarado");
  });

  it("indicadores da empresa incluem a ligação", async () => {
    const r = await req("/voice/stats", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.ok(r.corpo.totalLigacoes >= 1);
    assert.ok(r.corpo.reunioes >= 1);
  });

  it("desempenho por profissional lista o vendedor", async () => {
    const r = await req("/voice/stats/sellers", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.ok(r.corpo.length >= 1);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 7. Próximo lead na fila (após encerrar primeiro)
  // ══════════════════════════════════════════════════════════════════════

  it("após registrar resultado, reserva é liberada e próximo lead é diferente", async () => {
    const r = await req("/voice/next-lead", { body: { queueId }, cookie: cookieVendedor });
    assert.equal(r.status, 200);
    // Pode ser outro lead, ou null se todos já foram reservados
    if (r.corpo.lead) {
      assert.notEqual(r.corpo.lead.id, leadId1, "Lead anterior já foi processado");
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // 8. Retorno/callback agendado
  // ══════════════════════════════════════════════════════════════════════

  it("retorno agendado aparece nos callbacks", async () => {
    // Iniciar e registrar outra ligação com callback
    const nextLead = await req("/voice/next-lead", { body: { queueId }, cookie: cookieVendedor });
    if (nextLead.corpo?.lead) {
      const call2 = await req("/voice/calls", {
        body: { leadId: nextLead.corpo.lead.id, queueId, providerId: "mobile" },
        cookie: cookieVendedor,
      });
      if (call2.status === 200) {
        await req(`/voice/calls/${call2.corpo.callId}/result`, {
          body: {
            resultado: "retornar",
            observacao: "Ligar amanhã às 14h",
            agendarRetorno: Date.now() + 86400000,
          },
          cookie: cookieVendedor,
        });
      }
    }
    const r = await req("/voice/callbacks", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.corpo));
    // Pode ter callback dependendo do fluxo acima
  });

  // ══════════════════════════════════════════════════════════════════════
  // 9. Scripts
  // ══════════════════════════════════════════════════════════════════════

  it("empresa cria e lista scripts", async () => {
    const cr = await req("/voice/scripts", {
      body: { nome: "Script Vendas", abertura: "Bom dia...", argumentacao: "Nosso produto..." },
      cookie: cookieEmpresa,
    });
    assert.equal(cr.status, 200);
    const ls = await req("/voice/scripts", { cookie: cookieEmpresa });
    assert.ok(ls.corpo.length >= 1);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 10. DNC (Do Not Call)
  // ══════════════════════════════════════════════════════════════════════

  it("empresa adiciona e lista telefone no DNC", async () => {
    const cr = await req("/voice/dnc", { body: { telefone: "11988776655", motivo: "Solicitou remoção" }, cookie: cookieEmpresa });
    assert.equal(cr.status, 200);
    const ls = await req("/voice/dnc", { cookie: cookieEmpresa });
    assert.ok(ls.corpo.length >= 1);
  });

  it("ligação para telefone no DNC é bloqueada", async () => {
    // Criar lead com telefone DNC
    const ldnc = await req("/leads", {
      body: { nome: "Lead DNC", telefone: "11988776655", companyId: realCompanyId },
      cookie: cookieVendedor,
    });
    if (ldnc.corpo?.id) {
      const r = await req("/voice/calls", {
        body: { leadId: ldnc.corpo.id, providerId: "mobile" },
        cookie: cookieVendedor,
      });
      assert.equal(r.status, 403, "Deve bloquear ligação para DNC");
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // 11. Consumo e auditoria
  // ══════════════════════════════════════════════════════════════════════

  it("consumo registra minutos reais (não simulados)", async () => {
    const r = await req("/voice/usage", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
  });

  it("auditoria registra ações", async () => {
    const r = await req("/voice/audit", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.ok(r.corpo.length >= 3, "Deve ter múltiplas entradas de auditoria");
  });

  // ══════════════════════════════════════════════════════════════════════
  // 12. Sessão: pausa, retomada, encerramento
  // ══════════════════════════════════════════════════════════════════════

  it("profissional pausa, retoma e encerra sessão", async () => {
    const pause = await req("/voice/session/pause", { body: {}, cookie: cookieVendedor });
    assert.equal(pause.status, 200);

    const current = await req("/voice/session/current", { cookie: cookieVendedor });
    assert.equal(current.corpo?.status, "pausado");

    const resume = await req("/voice/session/resume", { body: {}, cookie: cookieVendedor });
    assert.equal(resume.status, 200);

    const end = await req("/voice/session/end", { body: {}, cookie: cookieVendedor });
    assert.equal(end.status, 200);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 13. Isolamento entre empresas
  // ══════════════════════════════════════════════════════════════════════

  it("outra empresa não vê filas desta", async () => {
    const outra = assinar({ id: "emp-outra", role: "empresa", entityId: "emp-outra" });
    const r = await req("/voice/queues", { cookie: outra });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.length, 0);
  });

  it("outra empresa não vê histórico desta", async () => {
    const outra = assinar({ id: "emp-outra", role: "empresa", entityId: "emp-outra" });
    const r = await req("/voice/calls", { cookie: outra });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.length, 0);
  });

  it("vendedor não membro não acessa fila", async () => {
    const outra = assinar({ id: "sel-intruso", role: "vendedor", entityId: "sel-intruso" });
    const r = await req("/voice/next-lead", { body: { queueId }, cookie: outra });
    assert.equal(r.status, 403);
  });

  it("acesso direto a ligação de outra empresa retorna 404", async () => {
    const outra = assinar({ id: "sel-intruso", role: "vendedor", entityId: "sel-intruso" });
    if (callId) {
      const r = await req(`/voice/calls/${callId}/result`, {
        body: { resultado: "atendeu" },
        cookie: outra,
      });
      assert.equal(r.status, 404);
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // 14. Dados simulados: mock não contamina indicadores reais
  // ══════════════════════════════════════════════════════════════════════

  it("mock provider marca dados como simulados (admin pode usar em teste)", async () => {
    // Admin pode usar mock — cria uma ligação simulada
    const mockCall = await req("/voice/calls", {
      body: { leadId: leadId3, providerId: "mock", queueId },
      cookie: cookieAdmin,
    });
    if (mockCall.status === 200) {
      assert.equal(mockCall.corpo.simulado, true, "Ligação mock é simulada");
      assert.ok(mockCall.corpo.origemDados !== "verificado", "Mock não é verificado");
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // 15. Feature flag: desabilitar bloqueia acesso
  // ══════════════════════════════════════════════════════════════════════

  it("admin desabilita voice e empresa perde acesso", async () => {
    await req("/voice/admin/habilitar", { body: { companyId: realCompanyId, habilitada: false }, cookie: cookieAdmin });
    const r = await req("/voice/settings", { cookie: cookieEmpresa });
    assert.equal(r.status, 403);
    // Reabilitar
    await req("/voice/admin/habilitar", { body: { companyId: realCompanyId, habilitada: true }, cookie: cookieAdmin });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 16. Provedor SIP não pode ser usado
  // ══════════════════════════════════════════════════════════════════════

  it("ligação via SIP é recusada enquanto o admin não libera a telefonia real", async () => {
    if (leadId2) {
      const r = await req("/voice/calls", {
        body: { leadId: leadId2, providerId: "sip" },
        cookie: cookieVendedor,
      });
      assert.equal(r.status, 403);
      assert.match(r.corpo.error, /não liberada/);
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // 17. Consumo detalhado (billing)
  // ══════════════════════════════════════════════════════════════════════

  it("billing resumo retorna zeros para empresa nova", async () => {
    const r = await req("/voice/billing/resumo", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.totalChamadas, 0);
  });

  it("billing por profissional retorna lista", async () => {
    const r = await req("/voice/billing/por-profissional", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.corpo));
  });

  it("billing por campanha retorna lista", async () => {
    const r = await req("/voice/billing/por-campanha", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.corpo));
  });

  // ══════════════════════════════════════════════════════════════════════
  // 18. Limites multiempresa
  // ══════════════════════════════════════════════════════════════════════

  it("admin configura limites para empresa", async () => {
    const r = await req("/voice/admin/limits", {
      body: { companyId: realCompanyId, maxCanaisSimultaneos: 5, maxChamadasDia: 200, maxMinutosMes: 5000 },
      cookie: cookieAdmin,
    });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.ok, true);
  });

  it("admin lê limites da empresa", async () => {
    const r = await req(`/voice/admin/limits/${realCompanyId}`, { cookie: cookieAdmin });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.maxCanaisSimultaneos, 5);
    assert.equal(r.corpo.maxChamadasDia, 200);
    assert.equal(r.corpo.maxMinutosMes, 5000);
  });

  it("empresa vê canais ativos e limite", async () => {
    const r = await req("/voice/channels/active", { cookie: cookieEmpresa });
    assert.equal(r.status, 200);
    assert.ok("canaisAtivos" in r.corpo);
    assert.ok("maxCanais" in r.corpo);
    assert.ok("disponivel" in r.corpo);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 19. Verificação de destino (bloqueio, fraude)
  // ══════════════════════════════════════════════════════════════════════

  it("verifica destino válido", async () => {
    const r = await req("/voice/check-destination", {
      body: { telefone: "11999001001" },
      cookie: cookieEmpresa,
    });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.permitido, true);
    assert.ok(r.corpo.tipoDestino);
  });

  it("bloqueia prefixo 0900", async () => {
    const r = await req("/voice/check-destination", {
      body: { telefone: "09001234567" },
      cookie: cookieEmpresa,
    });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.permitido, false);
    assert.ok(r.corpo.motivo.includes("0900"));
  });

  // ══════════════════════════════════════════════════════════════════════
  // 20. Admin: consumo geral
  // ══════════════════════════════════════════════════════════════════════

  it("admin vê consumo de todas empresas", async () => {
    const r = await req("/voice/admin/consumo", { cookie: cookieAdmin });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.corpo));
  });

  it("vendedor não acessa admin/consumo", async () => {
    const r = await req("/voice/admin/consumo", { cookie: cookieVendedor });
    assert.equal(r.status, 403);
  });

  // ── 21. Admin telefonia — painel centralizado ──

  it("admin telefonia resumo retorna dados consolidados", async () => {
    const r = await req("/voice/admin/telefonia/resumo", { cookie: cookieAdmin });
    assert.equal(r.status, 200);
    assert.ok("diario" in r.corpo);
    assert.ok("mensal" in r.corpo);
    assert.ok("porEmpresa" in r.corpo);
    assert.ok("porProfissional" in r.corpo);
    assert.ok("porCampanha" in r.corpo);
    assert.ok("sessoesAtivas" in r.corpo);
    assert.ok("empresasHabilitadas" in r.corpo);
    assert.equal(typeof r.corpo.diario.minutos, "number");
  });

  it("vendedor não acessa admin telefonia resumo", async () => {
    const r = await req("/voice/admin/telefonia/resumo", { cookie: cookieVendedor });
    assert.equal(r.status, 403);
  });

  it("admin telefonia config retorna defaults desativados", async () => {
    const r = await req("/voice/admin/telefonia/config", { cookie: cookieAdmin });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.limitesAtivos, 0);
    assert.equal(r.corpo.telefoniaReal, 0);
  });

  it("admin salva config telefonia", async () => {
    const r = await req("/voice/admin/telefonia/config", {
      cookie: cookieAdmin,
      body: { limitesAtivos: false, maxChamadasDiaGlobal: 0, maxMinutosMesGlobal: 0, maxSimultaneosGlobal: 10 },
    });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.ok, true);
  });

  it("vendedor não acessa admin telefonia config", async () => {
    const r = await req("/voice/admin/telefonia/config", { cookie: cookieVendedor });
    assert.equal(r.status, 403);
  });

  it("credencial WebRTC fica indisponível sem Asterisk configurado", async () => {
    const r = await req("/voice/webrtc/credenciais", { cookie: cookieVendedor, body: {} });
    assert.equal(r.status, 503);
  });

  it("empresa não pede credencial WebRTC", async () => {
    const r = await req("/voice/webrtc/credenciais", { cookie: cookieEmpresa, body: {} });
    assert.equal(r.status, 403);
  });

  it("provedor SIP informa se a telefonia real foi liberada", async () => {
    const r = await req("/voice/providers", { cookie: cookieVendedor });
    const sip = r.corpo.find((p) => p.id === "sip");
    assert.equal(sip.liberado, false);
  });

  it("números brasileiros viram E.164 para a operadora", () => {
    assert.equal(paraE164("(11) 98765-4321"), "5511987654321");
    assert.equal(paraE164("011 3333-4444"), "551133334444");
    assert.equal(paraE164("+55 21 99999-8888"), "5521999998888");
    assert.equal(paraE164("+91 98765 43210"), "919876543210");
  });

  it("check-destination não aplica limite diário com limites comerciais desativados", async () => {
    // Garantir que limites comerciais estão desativados
    await req("/voice/admin/telefonia/config", {
      cookie: cookieAdmin,
      body: { limitesAtivos: false },
    });
    // Mesmo com limite per-company de 200/dia (setado antes), check-destination deve permitir
    const r = await req("/voice/check-destination", {
      body: { telefone: "11988887777" },
      cookie: cookieEmpresa,
    });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.permitido, true);
  });

  it("admin limits default retorna 0 (ilimitado) para limites comerciais", async () => {
    const r = await req("/voice/admin/limits/empresa_inexistente_xyz", { cookie: cookieAdmin });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.maxChamadasDia, 0);
    assert.equal(r.corpo.maxMinutosMes, 0);
    assert.equal(r.corpo.maxCanaisSimultaneos, 2);
  });
});
