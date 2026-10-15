import { Router } from "express";
import { createHash } from "crypto";
import { paraFala } from "../../shared/jarvas.js";

// Voz do Jarvas (ElevenLabs).
//
// A chave fica só aqui (ELEVENLABS_API_KEY); a tela manda o texto e recebe o
// áudio. Sem chave, ou se o ElevenLabs falhar, a resposta diz `fallback` e a
// tela usa a voz do navegador: a conversa nunca trava por causa da voz.
//
// Custo: o ElevenLabs cobra por caractere. Frases repetidas (saudação,
// perguntas) ficam em cache na memória, e cada empresa tem um teto diário.
//
// Variáveis: ELEVENLABS_API_KEY; ELEVENLABS_VOICE_ID (sem ela, usa a primeira
// voz masculina em português da conta, ou uma voz padrão masculina);
// ELEVENLABS_MODELO (padrão eleven_multilingual_v2, a mais natural);
// JARVAS_VOZ_LIMITE_DIA (caracteres por empresa por dia, padrão 20000).

const router = Router();

const BASE = (process.env.NODE_ENV === "test" && process.env.ELEVENLABS_BASE_URL) || "https://api.elevenlabs.io";
const MODELO = process.env.ELEVENLABS_MODELO || "eleven_multilingual_v2";
// Voz padrão masculina e multilíngue ("Adam", da biblioteca padrão).
const VOZ_PADRAO = "pNInz6obpgDQGcFmaJgB";
const LIMITE_DIA = Number(process.env.JARVAS_VOZ_LIMITE_DIA) || 20000;
const MAX_TEXTO = 700;
const MAX_CACHE = 300;

const vozDisponivel = () => !!process.env.ELEVENLABS_API_KEY;

let vozEscolhida = null;
async function vozId() {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  if (vozEscolhida) return vozEscolhida;
  try {
    const r = await fetch(`${BASE}/v1/voices`, { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY }, signal: AbortSignal.timeout(8000) });
    const { voices = [] } = r.ok ? await r.json() : {};
    // O Jarvas é masculino: primeiro voz masculina em português, depois
    // qualquer voz masculina da conta.
    const pt = (v) => /portugu|brazil|brasil|pt-br/i.test(JSON.stringify(v.labels || {}) + (v.name || ""));
    const masculina = (v) => /\bmale\b|masculin/i.test(v.labels?.gender || "");
    const escolhida = voices.find((v) => pt(v) && masculina(v)) || voices.find((v) => masculina(v) && v.category !== "premade");
    vozEscolhida = escolhida?.voice_id || VOZ_PADRAO;
  } catch {
    vozEscolhida = VOZ_PADRAO;
  }
  return vozEscolhida;
}

// Cache LRU simples: Map mantém a ordem de inserção.
const cache = new Map();
const lembrar = (chave, audio) => {
  cache.delete(chave);
  cache.set(chave, audio);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
};

const uso = new Map(); // companyId → { dia, caracteres }
function consumir(dono, caracteres) {
  const dia = new Date().toISOString().slice(0, 10);
  const atual = uso.get(dono);
  const usado = atual?.dia === dia ? atual.caracteres : 0;
  if (usado + caracteres > LIMITE_DIA) return false;
  uso.set(dono, { dia, caracteres: usado + caracteres });
  return true;
}

router.get("/jarvas/voz", (req, res) => {
  res.json({ disponivel: vozDisponivel() });
});

router.post("/jarvas/voz", async (req, res) => {
  if (!["empresa", "admin"].includes(req.user.role)) return res.status(403).json({ error: "Apenas empresas" });
  const texto = paraFala(String(req.body?.texto || "")).slice(0, MAX_TEXTO);
  if (!texto) return res.status(400).json({ error: "Texto vazio." });
  if (!vozDisponivel()) return res.status(503).json({ error: "Voz humana não configurada.", fallback: true });

  const voz = await vozId();
  const chave = createHash("sha256").update(`${voz}|${MODELO}|${texto}`).digest("hex");
  const guardado = cache.get(chave);
  if (guardado) {
    lembrar(chave, guardado);
    res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" });
    return res.send(guardado);
  }
  if (!consumir(req.user.entityId || req.user.id, texto.length))
    return res.status(429).json({ error: "Limite diário de voz atingido.", fallback: true });

  try {
    const r = await fetch(`${BASE}/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: texto,
        model_id: MODELO,
        // Menos estabilidade e um pouco de estilo: entonação mais viva, de conversa.
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 1.0 },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      console.warn(`[jarvas] ElevenLabs recusou (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`);
      return res.status(502).json({ error: "A voz não respondeu agora.", fallback: true });
    }
    const audio = Buffer.from(await r.arrayBuffer());
    lembrar(chave, audio);
    res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" });
    res.send(audio);
  } catch (e) {
    console.warn("[jarvas] ElevenLabs:", e.message);
    res.status(502).json({ error: "A voz não respondeu agora.", fallback: true });
  }
});

export default router;
