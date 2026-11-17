// Guarda contra a classe de bug "SQL referencia coluna/tabela que não existe"
// (o que fez o checkout de cartão devolver 502 em vez de 400: o código fazia
// `SELECT telefone FROM users`, coluna inexistente). Esse tipo de erro passa no
// build e só estoura em runtime, no fluxo específico — então nenhum teste de
// feature garante cobertura. Aqui subimos o schema real (o servidor cria todas
// as tabelas no boot) e validamos TODO SQL estático do servidor com prepare():
// o SQLite recusa nomes de coluna/tabela inexistentes já no prepare.
//
// Cobre apenas SQL estático; consultas com interpolação `${}` são ignoradas
// (não dá para validar sem os valores). As que interpolam identificadores no
// projeto usam listas fixas internas, não entrada do usuário.

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { subirServidor } from "./apoio/servidor.js";

const SERVER = join(dirname(fileURLToPath(import.meta.url)), "..", "server");

function arquivosJs(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    return statSync(p).isDirectory() ? arquivosJs(p) : p.endsWith(".js") ? [p] : [];
  });
}

// Captura o literal passado a .prepare( "..." / '...' / `...` ), sem interpolação.
const RE_PREPARE = /\.prepare\(\s*(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*[,)]/g;

test("todo SQL estático referencia colunas e tabelas que existem no schema", async (t) => {
  const { dbPath } = await subirServidor(t);
  const db = new Database(dbPath, { readonly: true });
  t.after(() => db.close());

  const falhas = [];
  let validados = 0;
  for (const arquivo of arquivosJs(SERVER)) {
    const src = readFileSync(arquivo, "utf8");
    for (const m of src.matchAll(RE_PREPARE)) {
      let sql = m[1].slice(1, -1);
      if (sql.includes("${")) continue; // interpolado: sem valores não dá para validar
      sql = sql.replace(/\\`/g, "`").replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, "\n");
      validados++;
      try {
        db.prepare(sql);
      } catch (e) {
        if (/no such (table|column)|has no column named/i.test(e.message)) {
          const linha = src.slice(0, m.index).split("\n").length;
          falhas.push(`${arquivo.replace(SERVER, "server")}:${linha} — ${e.message}\n    ${sql.replace(/\s+/g, " ").slice(0, 120)}`);
        }
      }
    }
  }

  assert.ok(validados > 500, `esperava validar centenas de SQL, validei ${validados} (regex quebrou?)`);
  assert.deepEqual(falhas, [], `SQL referenciando schema inexistente:\n\n${falhas.join("\n\n")}`);
});
