import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";

// RYCS Club — prêmios, elegibilidade por marco, resgate idempotente e
// autorização admin. Não toca em finanças; só valida a camada do Club.
test("Club: prêmios, elegibilidade, resgate e autorização", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const db = new Database(dbPath);
  db.pragma("foreign_keys = OFF"); // seed livre nesta conexão; o engine só conta linhas
  t.after(() => db.close());

  // Um profissional com 1 tarefa aprovada (liberado) e outro sem nenhuma.
  const seller = (id, email) => {
    db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES (?, ?, ?, ?, ?)")
      .run(id, "Prof " + id, email, "11999999999", Date.now());
    db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, ?)")
      .run("u-" + id, email, id, Date.now());
  };
  seller("s1", "s1@club.invalid");
  seller("s2", "s2@club.invalid");
  db.prepare("INSERT INTO submissions (id, sellerId, companyId, tipo, status, valor, criadoEm) VALUES (?, ?, 'c1', 'venda', 'liberado', 100, ?)")
    .run("sub1", "s1", Date.now());

  const tokS1 = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  const tokS2 = assinar({ id: "u-s2", role: "vendedor", entityId: "s2" });
  const tokAdmin = assinar({ id: "u-admin", role: "admin", entityId: "admin" });

  const req = async (path, { body, cookie, method } = {}) => {
    const r = await fetch(base + path, {
      method: method || (body !== undefined ? "POST" : "GET"),
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  };

  // Profissional não acessa a administração do Club.
  assert.equal((await req("/admin/club", { cookie: tokS1 })).status, 403);

  // Admin cria um prêmio PUBLICADO: 1 tarefa aprovada o desbloqueia.
  const criado = await req("/admin/club/premios", {
    cookie: tokAdmin,
    body: { nome: "Placa RYCS", descricao: "Placa de conquista", tipo: "digital", metrica: "tarefasAprovadas", alvo: 1, status: "publicado" },
  });
  assert.equal(criado.status, 200);
  const prizeId = criado.corpo.premio.id;
  assert.ok(prizeId);

  // Admin cria um prêmio em RASCUNHO — não deve aparecer para o profissional.
  await req("/admin/club/premios", { cookie: tokAdmin, body: { nome: "Secreto", metrica: "tarefasAprovadas", alvo: 1, status: "rascunho" } });

  // s1 (tem 1 tarefa) vê o prêmio publicado e está elegível; não vê o rascunho.
  const clubS1 = await req("/club", { cookie: tokS1 });
  assert.equal(clubS1.status, 200);
  assert.equal(clubS1.corpo.premios.length, 1, "só o publicado aparece");
  assert.equal(clubS1.corpo.premios[0].elegivel, true);

  // s2 (sem tarefas) vê o prêmio, porém NÃO elegível.
  const clubS2 = await req("/club", { cookie: tokS2 });
  assert.equal(clubS2.corpo.premios[0].elegivel, false);

  // s2 não pode resgatar (não atingiu o requisito).
  assert.equal((await req(`/club/premios/${prizeId}/resgatar`, { cookie: tokS2, body: {} })).status, 400);

  // s1 resgata (digital, sem endereço) — ok.
  const r1 = await req(`/club/premios/${prizeId}/resgatar`, { cookie: tokS1, body: {} });
  assert.equal(r1.status, 200);
  assert.equal(r1.corpo.ok, true);

  // Resgate é idempotente por (seller, prêmio): segunda vez falha.
  assert.equal((await req(`/club/premios/${prizeId}/resgatar`, { cookie: tokS1, body: {} })).status, 400);

  // Há exatamente um resgate registrado.
  assert.equal(db.prepare("SELECT COUNT(*) c FROM club_redemptions WHERE sellerId='s1'").get().c, 1);

  // Admin vê o resgate e muda o estado; estado inválido é rejeitado.
  const adminView = await req("/admin/club", { cookie: tokAdmin });
  assert.equal(adminView.corpo.resgates.length, 1);
  const resgateId = adminView.corpo.resgates[0].id;
  assert.equal((await req(`/admin/club/resgates/${resgateId}`, { cookie: tokAdmin, method: "PATCH", body: { estado: "invalido" } })).status, 400);
  assert.equal((await req(`/admin/club/resgates/${resgateId}`, { cookie: tokAdmin, method: "PATCH", body: { estado: "aprovado" } })).status, 200);
  assert.equal(db.prepare("SELECT estado FROM club_redemptions WHERE id=?").get(resgateId).estado, "aprovado");

  // Imagem de slot: admin define, profissional recebe no /club.
  await req("/admin/club/imagem", { cookie: tokAdmin, body: { chave: "banner", url: "https://x/banner.png" } });
  const clubComImg = await req("/club", { cookie: tokS1 });
  assert.equal(clubComImg.corpo.imagens.banner, "https://x/banner.png");
});
