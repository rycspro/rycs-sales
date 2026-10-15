import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { subirServidor, assinar } from "./apoio/servidor.js";

// Voz do Jarvas (server/routes/jarvas.js) contra um ElevenLabs falso local
// (ELEVENLABS_BASE_URL só vale com NODE_ENV=test).

const empresa = assinar({ id: "u-voz", role: "empresa", entityId: "emp-voz" });
const pedir = (base, texto, cookie = empresa) => fetch(`${base}/jarvas/voz`, {
  method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ texto }),
});

test("sem chave do ElevenLabs a tela recebe fallback para a voz do navegador", async (t) => {
  const { base } = await subirServidor(t, { ELEVENLABS_API_KEY: "" });
  const status = await fetch(`${base}/jarvas/voz`, { headers: { Cookie: empresa } }).then((r) => r.json());
  assert.equal(status.disponivel, false);
  const r = await pedir(base, "Oi!");
  assert.equal(r.status, 503);
  assert.equal((await r.json()).fallback, true);
});

test("com chave: áudio do ElevenLabs, texto preparado para a fala, cache e limite diário", async (t) => {
  const pedidos = [];
  const falso = http.createServer((req, res) => {
    let corpo = "";
    req.on("data", (d) => { corpo += d; });
    req.on("end", () => {
      pedidos.push({ url: req.url, chave: req.headers["xi-api-key"], corpo: corpo ? JSON.parse(corpo) : null });
      res.writeHead(200, { "Content-Type": "audio/mpeg" });
      res.end(Buffer.from("ID3-audio-falso"));
    });
  });
  falso.listen(0);
  t.after(() => falso.close());

  const { base } = await subirServidor(t, {
    ELEVENLABS_API_KEY: "chave-falsa", ELEVENLABS_BASE_URL: `http://127.0.0.1:${falso.address().port}`,
    ELEVENLABS_VOICE_ID: "voz-br", JARVAS_VOZ_LIMITE_DIA: "100",
  });

  let r = await pedir(base, "Com R$ 2.500 por profissional, cada visita sai por R$ 19.");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "audio/mpeg");
  assert.equal(Buffer.from(await r.arrayBuffer()).toString(), "ID3-audio-falso");
  assert.equal(pedidos[0].url, "/v1/text-to-speech/voz-br?output_format=mp3_44100_128");
  assert.equal(pedidos[0].chave, "chave-falsa");
  assert.equal(pedidos[0].corpo.text, "Com 2.500 reais por profissional, cada visita sai por 19 reais.");

  // Mesma frase de novo: vem do cache, sem nova chamada (e sem gastar o limite).
  r = await pedir(base, "Com R$ 2.500 por profissional, cada visita sai por R$ 19.");
  assert.equal(r.status, 200);
  assert.equal(pedidos.length, 1);

  // Passou do limite diário de caracteres: fallback, sem chamar o ElevenLabs.
  r = await pedir(base, "Uma frase nova e comprida o bastante para estourar o limite de teste.");
  assert.equal(r.status, 429);
  assert.equal((await r.json()).fallback, true);
  assert.equal(pedidos.length, 1);

  // Só empresa (ou admin) usa a voz.
  r = await pedir(base, "Oi", assinar({ id: "v", role: "vendedor", entityId: "s1" }));
  assert.equal(r.status, 403);
});
