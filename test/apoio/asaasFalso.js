// Gateway Asaas FALSO para testes — um servidor HTTP real local. Não é um mock
// de resposta: o servidor da RYCS faz uma chamada HTTP de verdade a ele
// (apontado por ASAAS_BASE_URL_TESTE), exercitando o cliente `asaas()` real.
//
// Responde GET /payments/:id com o pagamento configurado, ou 404 quando não
// existe. Pode ser "derrubado" (close) para simular indisponibilidade.

import { createServer } from "node:http";

export async function subirAsaasFalso() {
  const pagamentos = new Map(); // id -> objeto do pagamento
  let derrubado = false;
  const servidor = createServer((req, res) => {
    if (derrubado) { res.writeHead(503, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ errors: [{ description: "indisponível" }] })); }
    const m = req.url.match(/^\/payments\/([^/?]+)/);
    if (req.method === "GET" && m) {
      const id = decodeURIComponent(m[1]);
      const p = pagamentos.get(id);
      if (!p) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ errors: [{ description: "not found" }] })); }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(p));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
  });
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  const porta = servidor.address().port;
  return {
    baseUrl: `http://127.0.0.1:${porta}`,
    definir: (id, obj) => pagamentos.set(id, { id, ...obj }),
    derrubar: () => { derrubado = true; },
    levantar: () => { derrubado = false; },
    fechar: () => new Promise((ok) => servidor.close(ok)),
  };
}
