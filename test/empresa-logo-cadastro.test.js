import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor } from "./apoio/servidor.js";

// A criação da conta empresarial passa a exigir o logo da empresa e guarda-o já
// na criação (identidade na vitrine). Rota pública, sem autenticação.
test("Cadastro da empresa: logo obrigatório e armazenado na criação da conta", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const db = new Database(dbPath);
  t.after(() => db.close());

  const req = async (body) => {
    const r = await fetch(base + "/onboarding/criar-conta", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  };

  const dadosBase = { email: "empresa@logo.invalid", senha: "senhaForte1", nomeEmpresa: "Empresa Teste", pais: "BR" };

  // Sem logo → recusado, apontando o campo.
  const semLogo = await req(dadosBase);
  assert.equal(semLogo.status, 400);
  assert.equal(semLogo.corpo.campo, "logo");

  // Com logo válido → conta criada e logo gravado na empresa.
  const comLogo = await req({ ...dadosBase, logo: { base64: "QUFBQQ==", mimetype: "image/png" } });
  assert.equal(comLogo.status, 200);
  assert.equal(comLogo.corpo.role, "empresa");
  const empresa = db.prepare("SELECT logo FROM companies WHERE id = ?").get(comLogo.corpo.entityId);
  assert.equal(empresa.logo, "data:image/png;base64,QUFBQQ==");
});
