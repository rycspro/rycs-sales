// Sobe o servidor de verdade num processo à parte, com banco temporário
// (nunca o server/data.db).
//
// No Node 24 local, o better-sqlite3 11 às vezes aborta o processo no coletor
// de lixo logo na subida ("Assertion failed: (env) != nullptr"); dentro do
// executor de testes isso acontece quase sempre. Por isso o servidor sobe à
// parte e, se abortar ao subir, sobe de novo. Produção roda Node 20.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jwt from "jsonwebtoken";

export const SEGREDO = "segredo-de-teste-onboarding";
export const assinar = (payload) => `sm_token=${jwt.sign(payload, SEGREDO, { expiresIn: "1h" })}`;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function tentarSubir(dbPath, envExtra) {
  const porta = 41000 + Math.floor(Math.random() * 2000);
  const env = { ...process.env, DB_PATH: dbPath, PORT: String(porta), JWT_SECRET: SEGREDO, NODE_ENV: "test", DEV_SEM_LOGIN: "" };
  // Vazias, não apagadas: o servidor carrega o .env local com dotenv, que só
  // preenche o que não existe. Apagar faria o teste mandar e-mail de verdade.
  Object.assign(env, { RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ASAAS_API_KEY: "", S3_BUCKET: "", BUCKET: "" });
  delete env.NODE_TEST_CONTEXT; // senão o servidor se comporta como processo de teste
  Object.assign(env, envExtra);
  const filho = spawn(process.execPath, ["server/index.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let saida = "";
  filho.stdout.on("data", (d) => { saida += d; });
  filho.stderr.on("data", (d) => { saida += d; });
  const base = `http://127.0.0.1:${porta}/api`;
  for (let i = 0; i < 150; i++) {
    if (filho.exitCode !== null || filho.signalCode) return { filho, saida, base: null };
    try { await fetch(`${base}/plans`); return { filho, saida, base }; } catch { await esperar(100); }
  }
  filho.kill();
  return { filho, saida, base: null };
}

export async function subirServidor(t, envExtra = {}) {
  const dir = mkdtempSync(join(tmpdir(), "rycs-onb-"));
  const dbPath = join(dir, "test.db");
  let ultimo;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    ultimo = await tentarSubir(dbPath, envExtra);
    if (ultimo.base) {
      t.after(() => { ultimo.filho.kill(); rmSync(dir, { recursive: true, force: true }); });
      return { base: ultimo.base, dbPath };
    }
  }
  rmSync(dir, { recursive: true, force: true });
  throw new Error(`servidor não subiu (sinal=${ultimo.filho.signalCode}, saída=${ultimo.filho.exitCode}):\n${ultimo.saida.slice(-2000)}`);
}


// Cliente HTTP dos testes: devolve status, corpo e o cookie de sessão.
export const cliente = (base) => async (path, { body, cookie, method, headers = {}, bruto } = {}) => {
  const r = await fetch(base + path, {
    method: method || (body !== undefined || bruto !== undefined ? "POST" : "GET"),
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: bruto !== undefined ? bruto : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const set = r.headers.get("set-cookie");
  return { status: r.status, corpo: await r.json().catch(() => null), cookie: set ? set.split(";")[0] : null };
};
