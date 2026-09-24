import bcrypt from "bcryptjs";
import db, { agora } from "../db.js";
import { semearCatalogo } from "./academy.js";

// Este módulo é deliberadamente conservador: BETA só existe quando a variável
// explícita está presente. Um deploy de produção nunca ganha comportamento de
// testes por engano.
export const isBetaEnvironment = () => process.env.RYCS_ENVIRONMENT === "beta";
export const BETA_DEMO_PASSWORD = "Demo@RYCS2026";
export const BETA_DEMO_COMPANY_EMAIL = "demo@rycs.pro";
export const BETA_DEMO_SELLER_EMAIL = "profissional.demo@rycs.pro";
export const BETA_DEFAULT_BALANCE = 100000;

export function assertBetaEnvironment() {
  if (!isBetaEnvironment()) {
    const erro = new Error("Esta operação existe somente no ambiente Beta.");
    erro.status = 403;
    throw erro;
  }
  if (process.env.NODE_ENV !== "production") {
    const erro = new Error("O Beta precisa executar em modo production.");
    erro.status = 409;
    throw erro;
  }
}

function limparDadosDeTeste() {
  // A lista vem do próprio SQLite; assim tabelas novas também entram no reset.
  // A tabela de controle fica fora para manter a prova de que o banco é Beta.
  const tabelas = db.prepare(`SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'beta_environment'`).all();
  db.pragma("foreign_keys = OFF");
  try {
    db.exec("DROP TRIGGER IF EXISTS no_delete_campaign_events");
    for (const { name } of tabelas) db.prepare(`DELETE FROM "${name.replace(/"/g, "\"\"")}"`).run();
    // O trigger é uma proteção de auditoria normal; o reset Beta é a única
    // exceção e só acontece dentro desta transação protegida.
    db.exec(`CREATE TRIGGER IF NOT EXISTS no_delete_campaign_events
      BEFORE DELETE ON campaign_events BEGIN
        SELECT RAISE(ABORT, 'Eventos de campanha são imutáveis');
      END`);
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

function inserirDadosIniciais() {
  const ts = agora();
  const senha = BETA_DEMO_PASSWORD;

  const adminId = "beta-admin";
  const companyId = "beta-empresa";
  const hash = bcrypt.hashSync(senha, 10);
  const sellers = [
    ["beta-profissional-demo", "Profissional Demo RYCS", BETA_DEMO_SELLER_EMAIL, "São Paulo, SP", "sdr", "SDR consultivo B2B com rotina completa de QA.", 94, "elite", 1250, 180, 320, "EMAIL"],
    ["beta-profissional-bdr", "Bruno BDR Enterprise", "bruno.bdr@rycs.pro", "Curitiba, PR", "bdr", "BDR outbound para contas médias e enterprise.", 87, "pro", 420, 60, 180, "CPF"],
    ["beta-profissional-closer", "Carla Closer SaaS", "carla.closer@rycs.pro", "Belo Horizonte, MG", "closer", "Closer para vendas consultivas e demonstrações.", 91, "elite", 980, 220, 900, "EMAIL"],
    ["beta-profissional-pap", "Diego Porta a Porta", "diego.pap@rycs.pro", "Campinas, SP", "pap", "PAP com experiência em visitas presenciais e varejo.", 78, "pro", 300, 40, 120, "PHONE"],
    ["beta-profissional-norte", "Eva Norte SDR", "eva.norte@rycs.pro", "Belém, PA", "sdr", "Prospecção regional Norte e Nordeste.", 73, "starter", 80, 30, 0, "EMAIL"],
    ["beta-profissional-sul", "Felipe Sul BDR", "felipe.sul@rycs.pro", "Porto Alegre, RS", "bdr", "BDR híbrido para tecnologia e serviços.", 84, "pro", 560, 75, 240, "EVP"],
    ["beta-profissional-rj", "Gabi Closer RJ", "gabi.closer@rycs.pro", "Rio de Janeiro, RJ", "closer", "Closer com histórico em vendas presenciais.", 69, "starter", 120, 25, 80, "EMAIL"],
    ["beta-profissional-campo", "Henrique Campo", "henrique.campo@rycs.pro", "Goiânia, GO", "pap", "Operação de campo, visitas e demonstrações locais.", 82, "pro", 260, 0, 140, "CPF"],
    ["beta-profissional-tech", "Iara Tech SDR", "iara.tech@rycs.pro", "Florianópolis, SC", "sdr", "SDR técnico para software e integração.", 96, "elite", 1400, 310, 1100, "EMAIL"],
    ["beta-profissional-jr", "João Júnior", "joao.jr@rycs.pro", "Recife, PE", "bdr", "Perfil em evolução para testar triagem e Academy.", 58, "starter", 0, 15, 0, "PHONE"],
  ];

  db.prepare("INSERT INTO users (id,email,senha,role,entityId,aceitouTermos,criadoEm) VALUES (?,?,?,?,?,?,?)")
    .run(adminId, process.env.ADMIN_EMAIL || "admin.beta@rycs.pro", hash, "admin", null, 1, ts);
  db.prepare("INSERT INTO users (id,email,senha,role,entityId,aceitouTermos,criadoEm) VALUES (?,?,?,?,?,?,?)")
    .run("beta-user-empresa", BETA_DEMO_COMPANY_EMAIL, hash, "empresa", companyId, 1, ts);
  sellers.forEach(([id, , email]) => {
    db.prepare("INSERT INTO users (id,email,senha,role,entityId,aceitouTermos,criadoEm) VALUES (?,?,?,?,?,?,?)")
      .run(`user-${id}`, email, hash, "vendedor", id, 1, ts);
  });

  const curso = JSON.stringify([
    { id: "produto", titulo: "Produto e promessa", min: 8, conteudo: "A RYCS Demo vende uma operação terceirizada de geração de demanda, reuniões e visitas com pagamento por execução validada." },
    { id: "icp", titulo: "ICP e dor", min: 10, conteudo: "Priorize empresas B2B com ticket acima de R$ 1.500, ciclo comercial ativo e liderança que precisa acelerar prospecção sem inflar folha." },
    { id: "objeccoes", titulo: "Objeções", min: 7, conteudo: "Sem orçamento, já tenho time interno, preciso pensar e mande por e-mail. Responda sempre ligando risco baixo, teste controlado e evidência." },
    { id: "evidencias", titulo: "Evidências aceitas", min: 6, conteudo: "Toda tarefa precisa de contato, resumo, resultado e evidência coerente. Reuniões exigem lead selecionado e dados iguais ao CRM." },
  ]);
  const qualificacao = JSON.stringify({
    criterios: { perfis: ["sdr", "bdr", "closer", "pap"], notaMinima: 60, exigeVideo: false },
    notaMinimaQuiz: 70,
    questoes: [
      { pergunta: "Qual cliente deve ser priorizado?", opcoes: ["B2B com dor comercial clara", "Pessoa física sem empresa", "Conta sem decisor"], correta: 0 },
      { pergunta: "O que libera pagamento?", opcoes: ["Declaração sem prova", "Evidência validada", "Mensagem apagada"], correta: 1 },
      { pergunta: "Como tratar objeção de orçamento?", opcoes: ["Forçar fechamento", "Propor teste controlado", "Encerrar sem diagnóstico"], correta: 1 },
    ],
  });
  const materiais = JSON.stringify([
    { id: "deck-demo", nome: "Deck comercial Beta", url: "https://rycs.pro/beta/deck-demo.pdf" },
    { id: "script-whatsapp", nome: "Script WhatsApp", url: "https://rycs.pro/beta/script-whatsapp.txt" },
    { id: "matriz-icp", nome: "Matriz ICP", url: "https://rycs.pro/beta/matriz-icp.xlsx" },
  ]);
  db.prepare(`INSERT INTO companies (id,nome,produto,ticket,icp,plano,saldo,vagas,cor,totalAportado,criadoEm,comissoes,curso,qualificacao,aportes,assinatura,statusCadastro,razaoSocial,documento,endereco,segmento,regiao,diferenciais,objecoes,representanteLegal,contatoFinanceiro,contatoComercial,materiais,regrasAprovacao)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(companyId, "RYCS Demo Sandbox", "Operação comercial sob demanda com SDR, BDR, Closer e PAP", "R$ 2.400/mês + sucesso", "Empresas B2B com ticket médio acima de R$ 1.500, vendas consultivas e meta agressiva de reuniões", "saldo", BETA_DEFAULT_BALANCE, 10, "#2563EB", BETA_DEFAULT_BALANCE, ts, '{"contato":25,"lead_qualificado":60,"follow":35,"agendamento":120,"realizada":220,"visita":180,"ligacao":40,"venda":900}', curso, qualificacao, JSON.stringify([{ valor: BETA_DEFAULT_BALANCE, ts, beta: true, simulacao: true }]), "growth", "aprovada", "RYCS Demo Sandbox Ltda.", "00.000.000/0001-00", "Av. Paulista, 1000 - São Paulo, SP", "Tecnologia e Serviços B2B", "Brasil", "Pagamento por tarefa validada, auditoria de evidências, Academy integrada e profissionais segmentados por função.", "Já tenho equipe interna; medo de baixa qualidade; orçamento limitado; necessidade de previsibilidade.", "Marina Demo", "financeiro.demo@rycs.pro", "comercial.demo@rycs.pro", materiais, '{"agendamento":{"acao":"aprovar","confiancaMinima":70},"realizada":{"acao":"revisar","confiancaMinima":85},"venda":{"acao":"revisar","confiancaMinima":90}}');

  const sellerStmt = db.prepare(`INSERT INTO sellers (id,nome,email,whats,cidade,perfil,experiencia,status,nota,nivel,pix,pixTipo,disponivel,pendente,sacado,respostas,segmentos,modalidades,regioes,skills,disponibilidade,criadoEm)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  sellers.forEach(([id, nome, email, cidade, perfil, experiencia, nota, nivel, disponivel, pendente, sacado, pixTipo], i) => {
    sellerStmt.run(id, nome, email, `+55119${String(10000000 + i)}`, cidade, perfil, experiencia, "aprovado", nota, nivel, `${id}@pix.test`, pixTipo, disponivel, pendente, sacado,
      JSON.stringify([{ pergunta: "Disponibilidade", resposta: i % 3 === 0 ? "Integral" : i % 3 === 1 ? "Noites" : "Meio período" }]),
      JSON.stringify(["SaaS", "Serviços", i % 2 ? "Varejo" : "Indústria"]),
      JSON.stringify(i % 2 ? ["remoto", "hibrido"] : ["campo", "presencial"]),
      JSON.stringify([cidade.split(",").pop().trim(), "Brasil"]),
      JSON.stringify([perfil, "prospeccao", i % 2 ? "whatsapp" : "telefone"]),
      i % 4 === 0 ? "Alta" : i % 4 === 1 ? "Média" : i % 4 === 2 ? "Baixa" : "Sob demanda", ts);
    db.prepare("INSERT INTO applications (sellerId,companyId,status,criterios,quizScore) VALUES (?,?,?,?,?)")
      .run(id, companyId, i === 9 ? "pendente" : "aprovado", JSON.stringify(["perfil", "academy", "disponibilidade"]), Math.max(55, nota));
    db.prepare("INSERT INTO score_dimensions (sellerId,dimension,valor,role,atualizadoEm) VALUES (?,?,?,?,?)")
      .run(id, "execucao", nota, perfil, ts);
    db.prepare("INSERT INTO academy_progress (sellerId,funcao,modulosVistos,atualizadoEm) VALUES (?,?,?,?)")
      .run(id, perfil, JSON.stringify(["fundamentos", i % 2 ? "objeccoes" : "produto"]), ts);
    if (nota >= 70) db.prepare("INSERT INTO certifications (sellerId,funcao,nivel,percentual,criadoEm) VALUES (?,?,?,?,?)")
      .run(id, perfil, nota >= 90 ? "expert" : "certified", nota, ts);
  });

  const campaigns = [
    ["beta-campanha-rascunho", "Rascunho — SaaS outbound", "rascunho", "sdr", 12000, 0],
    ["beta-campanha-publicada", "Publicada — Reuniões B2B", "ativa", "sdr", 30000, 1800],
    ["beta-campanha-pausada", "Pausada — PAP regional", "pausada", "pap", 18000, 600],
    ["beta-campanha-concluida", "Concluída — Closer consultivo", "concluida", "closer", 22000, 0],
  ];
  const campaignStmt = db.prepare(`INSERT INTO campaigns (id,companyId,titulo,descricao,produto,publico,status,vagas,comissoes,treinamento,requisitos,objetivo,regiao,funcao,orcamento,reservado,tarefas,evidencias,criteriosAprovacao,modelosVerificacao,aceitaLeadProprio,exigeCertificacao,criadoEm)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  campaigns.forEach(([id, titulo, status, funcao, orcamento, reservado]) => {
    campaignStmt.run(id, companyId, titulo, "Campanha Beta com treinamento, tarefas, contatos e modelos de verificação fictícios.", "Operação comercial sob demanda", "Líderes comerciais B2B", status, 5, '{"agendamento":120,"realizada":220,"visita":180,"venda":900}', curso, "Completar Academy e seguir roteiro de evidências.", "Validar funil completo no ambiente Beta", "Brasil", funcao, orcamento, reservado, '{"contato":25,"lead_qualificado":60,"follow":35,"agendamento":120,"realizada":220,"visita":180,"ligacao":40,"venda":900}', '{"contato":["print","resumo"],"lead_qualificado":["resumo","dor","proximo_passo"],"follow":["mensagem","resposta"],"agendamento":["lead","data","telefone"],"realizada":["gravacao","ata"],"visita":["geo","foto"],"ligacao":["gravacao","duracao"],"venda":["contrato","valor"]}', '{"agendamento":{"campos":["nome","telefone","data"]},"venda":{"campos":["contrato","valor"]}}', '{"contato":"registro_contato","lead_qualificado":"lead_qualificado","follow":"follow_up_respondido","agendamento":"reuniao_confirmada","realizada":"reuniao_realizada","visita":"presenca_local","ligacao":"cold_call_conectada","venda":"contrato_assinado"}', 1, 1, ts);
  });
  sellers.slice(0, 8).forEach(([sellerId], i) => {
    campaigns.slice(1).forEach(([campaignId]) => {
      db.prepare("INSERT INTO campaign_applications (id,campaignId,sellerId,status,criadoEm) VALUES (?,?,?,?,?)")
        .run(`beta-cand-${campaignId}-${sellerId}`, campaignId, sellerId, sellerId === "beta-profissional-demo" || i % 7 !== 0 ? "aprovado" : "pendente", ts);
    });
  });

  const leadEtapas = ["novo", "contato", "qualificado", "perdido", "ganho"];
  leadEtapas.forEach((etapa, i) => {
    const sellerId = sellers[i][0];
    const leadId = `beta-lead-${etapa}`;
    db.prepare("INSERT INTO leads (id,sellerId,companyId,campaignId,nome,empresa,cargo,telefone,email,origem,etapa,valorEstimado,motivoPerda,proximaAcao,proximaAcaoEm,criadoEm,atualizadoEm) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(leadId, sellerId, companyId, "beta-campanha-publicada", `Lead ${etapa}`, `Conta ${i + 1} Demo`, i % 2 ? "CEO" : "Diretora Comercial", `+55119888800${i}`, `lead.${etapa}@example.test`, "beta", etapa, 12000 + i * 3000, etapa === "perdido" ? "Sem fit no momento" : "", etapa === "ganho" ? "Acompanhar onboarding" : "Próximo contato de teste", ts + i * 3600000, ts - i * 86400000, ts - i * 3600000);
    db.prepare("INSERT INTO lead_events (id,leadId,sellerId,tipo,resultado,duracao,valor,observacao,etapaAntes,etapaDepois,criadoEm) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .run(`beta-lead-event-${etapa}`, leadId, sellerId, etapa === "novo" ? "criado" : "contato", etapa, 15 + i * 3, 0, `Evento fictício para lead ${etapa}`, i ? leadEtapas[i - 1] : "", etapa, ts - i * 1800000);
  });

  // Provas Beta com a nova estrutura de evidências (evidencias:[])
  const betaProvas = {
    contato: {
      cliente: "Marina Souza", empresa: "Conta Demo S/A", telefone: "+5511988880001",
      canal: "WhatsApp", resultado: "Primeiro contato realizado; lead demonstrou interesse inicial.",
      evidencias: [
        { slot: "contact_proof", valor: "https://drive.google.com/file/d/beta-print-contato-demo" },
      ],
    },
    lead_qualificado: {
      cliente: "Rafael Costa", empresa: "Tech Demo Ltda.", telefone: "+5511988880002",
      canal: "Telefone", interesse: "Automatizar prospecção B2B", necessidade: "Falta de SDRs dedicados",
      fit: "Alto — ticket médio de R$ 2.400, time comercial ativo", objecoes: "Orçamento travado no Q4",
      proximo_passo: "Reunião de discovery com CEO na próxima segunda",
      evidencias: [
        { slot: "contact_proof", valor: "https://drive.google.com/file/d/beta-print-lq-demo" },
        { slot: "qualification_summary", valor: "Lead qualificado com dor declarada (falta SDR), fit alto, ticket adequado. Objeção de orçamento tratada com proposta de piloto. Próximo passo: reunião de discovery." },
      ],
    },
    follow: {
      cliente: "Juliana Melo", empresa: "Demo Corp", telefone: "+5511988880003",
      canal: "E-mail + WhatsApp", resultado: "Cliente respondeu confirmando interesse em agenda.",
      proximo_follow: "Quinta-feira 14h se não confirmar reunião antes",
      evidencias: [
        { slot: "follow_proof", valor: "https://drive.google.com/file/d/beta-print-follow-demo" },
      ],
    },
    agendamento: {
      cliente: "Pedro Alves", empresa: "B2B Demo S/A", telefone: "+5511988880004",
      datahora: "25/09/2026 às 10h00", modalidade: "Remota — Google Meet",
      link_reuniao: "https://meet.google.com/beta-demo-meeting",
      evidencias: [
        { slot: "scheduling_confirmation", valor: "https://drive.google.com/file/d/beta-print-agend-demo" },
        { slot: "meeting_data", valor: "Pedro Alves · B2B Demo S/A · 25/09/2026 10h · Remota · https://meet.google.com/beta-demo-meeting" },
      ],
    },
    realizada: {
      cliente: "Ana Lima", empresa: "Enterprise Demo", telefone: "+5511988880005",
      duracao: "47", necessidade: "Reduzir custo de prospecção e aumentar taxa de reunião",
      interesse: "Alto — quer escalar sem contratar CLT", objecoes: "Quer referências de outros clientes",
      resultado: "Demo completa apresentada; cliente solicitou proposta formal",
      proximo_passo: "Enviar proposta até sexta; call de fechamento na próxima semana",
      evidencias: [
        { slot: "video_or_recording", valor: "https://drive.google.com/file/d/beta-gravacao-reuniao-demo" },
        { slot: "meeting_summary", valor: "Participante: Ana Lima (CEO) · Empresa: Enterprise Demo · Duração: 47min · Necessidade: reduzir custo de prospecção B2B · Interesse: alto, quer escalar sem CLT · Objeções: quer referências · Resultado: demo completa, solicitou proposta · Próximo passo: proposta até sexta + call de fechamento semana que vem." },
      ],
    },
    ligacao: {
      cliente: "Carlos Braga", empresa: "Call Demo Ltda.", telefone: "+5511988880006",
      duracao: "8", resultado: "Decisor atendeu; demonstrou interesse inicial em reunião de produto.",
      evidencias: [
        { slot: "call_log", valor: "Ligação com Carlos Braga (CEO Call Demo) · Duração 8min · Atendeu direto · Resultado: agendamento em negociação." },
      ],
    },
    visita: {
      cliente: "Fernanda Rocha", empresa: "Varejo Demo SP", telefone: "+5511988880007",
      endereco: "Av. Paulista, 1000 - São Paulo, SP", resultado: "Contato presencial com decisora; demonstrou produto e deixou material.",
      proximo_passo: "Retornar em 3 dias para negociar proposta",
      evidencias: [
        { slot: "visit_proof", valor: "https://drive.google.com/file/d/beta-foto-visita-demo" },
        { slot: "visit_result", valor: "Empresa: Varejo Demo SP · Endereço: Av. Paulista, 1000 · Contato: Fernanda Rocha (Diretora) · Resultado: material entregue, interesse confirmado · Próximo passo: retorno em 3 dias." },
      ],
    },
    venda: {
      cliente: "Roberto Santos", empresa: "Fechamento Demo S/A", telefone: "+5511988880008",
      documento: "12.345.678/0001-90", valorContrato: "4800", produto: "Plano Growth Anual",
      evidencias: [
        { slot: "closing_proof", valor: "https://drive.google.com/file/d/beta-contrato-venda-demo" },
        { slot: "sale_data", valor: "Cliente: Roberto Santos · Empresa: Fechamento Demo S/A · Produto: Plano Growth Anual · Valor: R$ 4.800 · Data: 24/09/2026 · Status: contrato assinado." },
      ],
    },
    // Agendamento recusado (falta evidência) — para testar bloqueio
    agendamento_recusado: {
      cliente: "Teste Recusa", empresa: "Empresa Teste", telefone: "+5511000000000",
      datahora: "01/01/2026 às 00h", modalidade: "remota",
      evidencias: [],
    },
  };

  const taskTypes = [
    ["disponivel", "contato", "revisao", sellers[0][0], "beta-lead-novo", 25, betaProvas.contato],
    ["aceita", "lead_qualificado", "conferido", sellers[0][0], "beta-lead-contato", 60, betaProvas.lead_qualificado],
    ["follow", "follow", "revisao", sellers[0][0], "beta-lead-contato", 35, betaProvas.follow],
    ["em_execucao", "agendamento", "analisando", sellers[0][0], "beta-lead-qualificado", 120, betaProvas.agendamento],
    ["enviada_para_aprovacao", "realizada", "ia_aprovado", sellers[0][0], "beta-lead-qualificado", 220, betaProvas.realizada],
    ["aprovada", "visita", "conferido", sellers[0][0], "beta-lead-contato", 180, betaProvas.visita],
    ["cold_call", "ligacao", "revisao", sellers[0][0], "beta-lead-novo", 40, betaProvas.ligacao],
    ["recusada", "agendamento", "recusado", sellers[5][0], "beta-lead-perdido", 120, betaProvas.agendamento_recusado],
    ["paga", "venda", "liberado", sellers[0][0], "beta-lead-ganho", 900, betaProvas.venda],
  ];
  taskTypes.forEach(([label, tipo, status, sellerId, leadId, valor, prova]) => {
    const liquido = +(valor * 0.9).toFixed(2);
    db.prepare("INSERT INTO submissions (id,sellerId,companyId,campaignId,leadId,tipo,valor,liquido,prova,arquivos,status,confianca,motivo,fonte,criadoEm) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(`beta-tarefa-${label}`, sellerId, companyId, "beta-campanha-publicada", leadId, tipo, valor, liquido, JSON.stringify(prova || {}), "[]", status, status === "recusado" ? 35 : 88, status === "recusado" ? "Evidência obrigatória ausente: confirmação do agendamento." : "Registro Beta para QA.", "BETA_SEED", ts);
  });
  db.prepare("INSERT INTO withdrawals (id,sellerId,valor,pix,status,criadoEm) VALUES (?,?,?,?,?,?)").run("beta-saque-pendente", sellers[0][0], 100, "beta-profissional-demo@pix.test", "solicitado", ts);
  db.prepare("INSERT INTO withdrawals (id,sellerId,valor,pix,status,criadoEm) VALUES (?,?,?,?,?,?)").run("beta-saque-pago", sellers[2][0], 250, "carla.closer@pix.test", "pago", ts);
  db.prepare("INSERT INTO deposit_requests (id,companyId,valor,status,referencia,observacao,confirmadoPor,criadoEm,confirmadoEm) VALUES (?,?,?,?,?,?,?,?,?)").run("beta-deposito-simulado", companyId, BETA_DEFAULT_BALANCE, "confirmado", "BETA-SIMULADO", "SIMULAÇÃO — saldo fictício sem valor real", adminId, ts, ts);
  db.prepare("INSERT INTO subscriptions (id,companyId,plano,status,valor,inicio,criadoEm) VALUES (?,?,?,?,?,?,?)").run("beta-plano-growth", companyId, "growth", "ativa", 499, ts, ts);
  db.prepare("INSERT INTO company_reports (id,companyId,titulo,periodo,status,origem,dados,criadoEm) VALUES (?,?,?,?,?,?,?,?)").run("beta-relatorio-semanal", companyId, "Relatório Beta completo", "Semana atual", "concluido", "beta", '{"financeiro":{"saldo":100000,"takeRate":98},"tarefas":7,"reunioes":{"agendada":1,"realizada":1,"noShow":1,"cancelada":1,"reagendada":1},"visitas":1,"profissionais":10,"conversao":0.22}', ts);
  ["Playbook comercial", "ICP e público-alvo", "Scripts e objeções", "Materiais e Academy"].forEach((titulo, i) => {
    db.prepare("INSERT INTO knowledge_documents (id,companyId,campaignId,titulo,categoria,status,conteudo,atualizadoEm,criadoEm) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(`beta-cerebro-${i}`, companyId, "beta-campanha-publicada", titulo, i === 0 ? "comercial" : "treinamento", "pronto", `${titulo} fictício para testar o Cérebro da Operação no Beta.`, ts, ts);
  });
  db.prepare("INSERT INTO financial_ledger (id,companyId,sellerId,submissionId,tipo,valor,saldoEmpresa,reservadoEmpresa,saldoProfissional,idempotencyKey,dados,criadoEm) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run("beta-ledger-saldo-inicial", companyId, null, null, "beta_saldo_inicial", BETA_DEFAULT_BALANCE, BETA_DEFAULT_BALANCE, 0, null, "beta-saldo-inicial", '{"simulacao":true,"semValorReal":true}', ts);
  db.prepare("INSERT INTO financial_ledger (id,companyId,sellerId,submissionId,tipo,valor,saldoEmpresa,reservadoEmpresa,saldoProfissional,idempotencyKey,dados,criadoEm) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run("beta-ledger-liberacao", companyId, sellers[0][0], "beta-tarefa-paga", "liberacao", 900, BETA_DEFAULT_BALANCE - 900, 0, 1250, "beta-inicial-liberacao", '{"ambiente":"beta","simulacao":true}', ts);
  db.prepare("INSERT INTO platform_earnings (id,submissionId,companyId,sellerId,bruto,taxa,liquido,criadoEm) VALUES (?,?,?,?,?,?,?,?)").run("beta-take-rate", "beta-tarefa-paga", companyId, sellers[0][0], 900, 90, 810, ts);
  ["MEETING_SCHEDULED", "MEETING_COMPLETED", "TASK_APPROVED", "PAYMENT_RELEASED", "VISIT_COMPLETED", "SALE_RECORDED"].forEach((tipo, i) => {
    db.prepare("INSERT INTO campaign_events (id,companyId,campaignId,tipo,actorRole,sellerId,leadId,source,dados,criadoEm) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(`beta-evento-${i}`, companyId, "beta-campanha-publicada", tipo, i % 2 ? "profissional" : "sistema", sellers[i % sellers.length][0], `beta-lead-${leadEtapas[i % leadEtapas.length]}`, "BETA_SEED", '{"simulacao":true}', ts + i);
  });
  ["confiabilidade", "clareza", "pagamento", "suporte"].forEach((dimension, i) => {
    db.prepare("INSERT INTO company_score_dimensions (companyId,dimension,valor,atualizadoEm) VALUES (?,?,?,?)").run(companyId, dimension, 88 + i * 2, ts);
  });
}

export function ajustarSaldoBeta({ valor, modo, actorId }) {
  assertBetaEnvironment();
  const companyId = "beta-empresa";
  const atual = db.prepare("SELECT saldo FROM companies WHERE id = ?").get(companyId);
  if (!atual) {
    resetBetaEnvironment();
  }
  const saldo = modo === "set" ? Number(valor) : Number(atual?.saldo || 0) + Number(valor || 0);
  db.transaction(() => {
    db.prepare("UPDATE companies SET saldo = ?, totalAportado = MAX(totalAportado, ?) WHERE id = ?")
      .run(saldo, saldo, companyId);
    db.prepare("INSERT INTO financial_ledger (id,companyId,tipo,valor,saldoEmpresa,idempotencyKey,dados,criadoEm) VALUES (?,?,?,?,?,?,?,?)")
      .run(`beta-ledger-${Date.now()}`, companyId, "beta_ajuste_saldo", Number(valor || 0), saldo, `beta-ajuste-${Date.now()}`, JSON.stringify({ simulacao: true, semValorReal: true, actorId: actorId || null, modo }), agora());
  })();
  return { saldo };
}

export function resetBetaEnvironment() {
  assertBetaEnvironment();
  db.pragma("foreign_keys = OFF");
  try {
  db.transaction(() => {
    limparDadosDeTeste();
    inserirDadosIniciais();
    semearCatalogo();
    db.prepare("INSERT OR REPLACE INTO beta_environment (id,resetAt) VALUES (1,?)").run(agora());
  })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

export function garantirDadosCriticosProfissionalBeta() {
  if (!isBetaEnvironment()) return;
  const companyId = "beta-empresa";
  const sellerId = "beta-profissional-demo";
  const campaignId = "beta-campanha-publicada";
  const ts = agora();
  const tarefas = {
    contato: 25,
    lead_qualificado: 60,
    follow: 35,
    agendamento: 120,
    realizada: 220,
    visita: 180,
    ligacao: 40,
    venda: 900,
  };
  const mergeJson = (table, idCol, id, field, patch) => {
    const row = db.prepare(`SELECT ${field} v FROM ${table} WHERE ${idCol} = ?`).get(id);
    if (!row) return;
    let atual = {};
    try { atual = JSON.parse(row.v || "{}"); } catch {}
    db.prepare(`UPDATE ${table} SET ${field} = ? WHERE ${idCol} = ?`)
      .run(JSON.stringify({ ...atual, ...patch }), id);
  };

  db.transaction(() => {
    mergeJson("companies", "id", companyId, "comissoes", tarefas);
    mergeJson("campaigns", "id", campaignId, "tarefas", tarefas);
    mergeJson("campaigns", "id", campaignId, "evidencias", {
      contato: ["print", "resumo"],
      lead_qualificado: ["resumo", "dor", "proximo_passo"],
      follow: ["mensagem", "resposta"],
      agendamento: ["lead", "data", "telefone"],
      realizada: ["gravacao", "ata"],
      visita: ["geo", "foto"],
      ligacao: ["gravacao", "duracao"],
      venda: ["contrato", "valor"],
    });
    mergeJson("campaigns", "id", campaignId, "modelosVerificacao", {
      contato: "registro_contato",
      lead_qualificado: "lead_qualificado",
      follow: "follow_up_respondido",
      agendamento: "reuniao_confirmada",
      realizada: "reuniao_realizada",
      visita: "presenca_local",
      ligacao: "cold_call_conectada",
      venda: "contrato_assinado",
    });
    db.prepare("UPDATE campaign_applications SET status = 'aprovado' WHERE campaignId = ? AND sellerId = ?")
      .run(campaignId, sellerId);

    // Quiz de certificação da campanha
    const quiz = [
      {
        pergunta: "Qual é o ticket médio mínimo do ICP desta campanha?",
        opcoes: ["R$ 500,00", "R$ 1.500,00", "R$ 5.000,00", "Não há ticket mínimo"],
        correta: 1,
        modulo: "ICP e dor",
      },
      {
        pergunta: "O cliente diz que já tem um fornecedor. Qual abordagem está mais alinhada à estratégia desta campanha?",
        opcoes: [
          "Encerrar a conversa imediatamente",
          "Oferecer desconto sem entender a situação",
          "Reconhecer e perguntar sobre lacunas no processo atual",
          "Enviar proposta por e-mail sem mais perguntas",
        ],
        correta: 2,
        modulo: "Objeções",
      },
      {
        pergunta: "Qual evidência é obrigatória para uma reunião realizada (call)?",
        opcoes: [
          "Apenas o nome do cliente",
          "Vídeo ou gravação + resumo estruturado da reunião",
          "Somente o print da agenda",
          "Nenhuma — basta registrar o resultado",
        ],
        correta: 1,
        modulo: "Evidências",
      },
      {
        pergunta: "Qual é o modelo de operação desta campanha?",
        opcoes: ["Inbound", "SDR outbound + BDR enterprise", "Closer puro", "Somente PAP"],
        correta: 1,
        modulo: "Operação",
      },
      {
        pergunta: "Uma tarefa enviada mas ainda não aprovada pela empresa...",
        opcoes: [
          "Já é debitada do orçamento definitivamente",
          "Fica pendente e pode ser aprovada ou recusada",
          "É aprovada automaticamente em 24h",
          "Não aparece em Meus Envios",
        ],
        correta: 1,
        modulo: "Processo",
      },
    ];
    db.prepare("UPDATE campaigns SET quiz = ?, notaMinimaQuiz = ?, produto = ?, icp = ?, modeloOperacao = ? WHERE id = ?")
      .run(JSON.stringify(quiz), 60, "Operação comercial B2B terceirizada", "Empresas B2B com ticket acima de R$ 1.500 e time comercial enxuto", "SDR outbound + BDR enterprise", campaignId);

    // Treinamento rico
    const treinamento = [
      { id: "tr-1", titulo: "Produto e proposta de valor", conteudo: "A RYCS Demo oferece operação comercial B2B terceirizada: prospecção, qualificação, agendamento e fechamento sob demanda, com pagamento por resultado validado.\n\nDiferenciais:\n• Sem custo fixo de equipe\n• Auditoria automática de evidências\n• Pagamento somente por tarefas aprovadas\n\nProposta: escalar geração de demanda sem inflar folha ou depender de contratação tradicional." },
      { id: "tr-2", titulo: "ICP — Perfil do cliente ideal", conteudo: "Cliente ideal:\n• Empresa B2B com ticket > R$ 1.500\n• Ciclo comercial ativo (não startup pré-receita)\n• Liderança que precisa acelerar prospecção\n• Time comercial enxuto (< 5 pessoas)\n• Setores: tecnologia, serviços, indústria, saúde corporativa, RH\n\nNÃO priorizar:\n• B2C, varejo físico\n• Empresas sem histórico de vendas recorrentes\n• Startups sem produto validado" },
      { id: "tr-3", titulo: "Script de abordagem e objeções", conteudo: "Abertura:\n\"Olá [nome], sou [seu nome], parceiro de operações comerciais. Atendemos empresas B2B que precisam escalar prospecção sem ampliar a folha — posso mostrar como em 2 minutos?\"\n\nObjeções comuns:\n• 'Já temos equipe' → Pergunte: 'E conseguem suprir a demanda atual de prospecção?'\n• 'Não temos budget' → 'Aqui você só paga por resultados aprovados. Não há custo fixo.'\n• 'Já tentamos terceirizar' → 'O que não funcionou antes? Posso mostrar como a metodologia é diferente.'\n\nNunca: pressionar, interromper, ou mencionar concorrentes negativamente." },
      { id: "tr-4", titulo: "Regras e evidências", conteudo: "Regras desta campanha:\n• Prazo: enviar evidência em até 48h após a ação\n• Leads devem ser vinculados à campanha\n• Cold call: mínimo 2 minutos com decisor\n• Reunião realizada: gravação obrigatória\n• PAP/visita: foto do local + registro do resultado\n• Venda: contrato ou comprovante + CNPJ\n\nO que NÃO é aceito:\n• Evidência genérica sem dados do cliente\n• Gravação editada ou com cortes suspeitos\n• Leads sem CNPJ/CPF na venda\n• Submit duplicado do mesmo contato no mesmo dia" },
    ];
    const cursoJson = JSON.stringify(treinamento);
    db.prepare("UPDATE campaigns SET treinamento = ? WHERE id = ?").run(cursoJson, campaignId);

    const demoProvas = {
      lead_qualificado: { cliente: "Demo Lead", empresa: "Demo Corp", telefone: "+5511988880009", canal: "WhatsApp", interesse: "Escalar prospecção", necessidade: "Sem SDR dedicado", fit: "Alto", objecoes: "Timing no Q4", proximo_passo: "Reunião de discovery", evidencias: [{ slot: "contact_proof", valor: "https://example.test/print-lq-demo" }, { slot: "qualification_summary", valor: "Lead qualificado com fit alto. Demo para QA do Beta." }] },
      follow: { cliente: "Demo Follow", empresa: "Demo Corp", telefone: "+5511988880009", canal: "E-mail", resultado: "Cliente respondeu positivamente.", proximo_follow: "Próxima segunda-feira", evidencias: [{ slot: "follow_proof", valor: "https://example.test/print-follow-demo" }] },
      agendamento: { cliente: "Demo Agend", empresa: "Demo Corp", telefone: "+5511988880009", datahora: "25/09/2026 às 10h", modalidade: "Remota", link_reuniao: "https://meet.google.com/demo-beta", evidencias: [{ slot: "scheduling_confirmation", valor: "https://example.test/print-agend-demo" }, { slot: "meeting_data", valor: "Demo · Demo Corp · 25/09/2026 10h · Remota · https://meet.google.com/demo-beta" }] },
      realizada: { cliente: "Demo Realizada", empresa: "Demo Corp", telefone: "+5511988880009", duracao: "32", necessidade: "Demo para QA", interesse: "Alto", objecoes: "Nenhuma", resultado: "Call realizada com sucesso no Beta.", proximo_passo: "Proposta até sexta", evidencias: [{ slot: "video_or_recording", valor: "https://example.test/gravacao-reuniao-demo" }, { slot: "meeting_summary", valor: "Participante: Demo · Empresa: Demo Corp · Duração: 32min · Necessidade: QA Beta · Interesse: alto · Resultado: demo concluída." }] },
      visita: { cliente: "Demo Visita", empresa: "Demo Corp", telefone: "+5511988880009", endereco: "Av. Paulista, 1000 - SP", resultado: "Visita realizada com sucesso.", proximo_passo: "Retorno em 3 dias", evidencias: [{ slot: "visit_proof", valor: "https://example.test/foto-visita-demo" }, { slot: "visit_result", valor: "Empresa: Demo Corp · Endereço: Av. Paulista 1000 · Resultado: material entregue." }] },
      ligacao: { cliente: "Demo Call", empresa: "Demo Corp", telefone: "+5511988880009", duracao: "5", resultado: "Decisor atendeu, demonstrou interesse.", evidencias: [{ slot: "call_log", valor: "Ligação com Demo (CEO) · 5min · Atendeu · Interesse em reunião." }] },
    };
    const rows = [
      ["lead_qualificado", "conferido", 60, "beta-lead-contato"],
      ["follow", "revisao", 35, "beta-lead-contato"],
      ["agendamento", "revisao", 120, "beta-lead-qualificado"],
      ["realizada", "ia_aprovado", 220, "beta-lead-qualificado"],
      ["visita", "conferido", 180, "beta-lead-contato"],
      ["ligacao", "revisao", 40, "beta-lead-novo"],
    ];
    const insert = db.prepare(`INSERT OR IGNORE INTO submissions
      (id,sellerId,companyId,campaignId,leadId,tipo,valor,liquido,prova,arquivos,status,confianca,motivo,fonte,criadoEm)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const [tipo, status, valor, leadId] of rows) {
      insert.run(
        `beta-tarefa-demo-${tipo}`, sellerId, companyId, campaignId, leadId, tipo, valor,
        +(valor * 0.9).toFixed(2),
        JSON.stringify(demoProvas[tipo] || { simulacao: true }),
        "[]", status, 88, "Registro Beta para QA.", "BETA_FIX", ts
      );
    }
  })();
}
