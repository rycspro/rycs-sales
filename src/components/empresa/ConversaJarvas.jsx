import { useEffect, useId, useRef, useState } from "react";
import { Check, Keyboard, Mic, Pause, RotateCcw, Send, Volume2, VolumeX } from "lucide-react";
import ThinkingOrb from "../ThinkingOrb.jsx";
import { API_URL } from "../../lib/api.js";
import { montarCampanha } from "../../../shared/objetivosCampanha.js";
import { useI18n } from "../../lib/i18n.jsx";
import {
  interpretarResposta, proximoCampo, perguntar, pedirDeNovo, reagir, saudacao, resumo,
  calcularTarefasJarvas, FECHAMENTO, confirmaMontagem, paraFala, pareceEco, segmentosDeFala, fraseIncompleta,
  aplicar, tituloPadrao, respostaCompleta, semEco,
} from "../../../shared/jarvas.js";

// Conversa assistida por voz com o Jarvas, sem botão de falar.
//
// Um toque no orb abre a conversa (o navegador exige um gesto para liberar o
// som e o microfone). Daí em diante é mãos livres, como numa ligação:
// - o microfone fica aberto o tempo todo, sem pausa, nos dois sentidos;
// - a pessoa começa a falar por cima e o Jarvas para na hora: um detector de
//   fala simultânea compara, a cada quadro, o volume do microfone com o da
//   voz dele (e aprende quanto da voz dele vaza de volta para o microfone);
// - se o Jarvas já ia responder e a pessoa continua falando, ele desiste da
//   resposta e junta tudo o que ela disse numa vez só;
// - quando a pessoa termina, o Jarvas responde sem esperar clique nenhum;
// - o que o reconhecimento transcreve da própria voz dele é descartado (eco).
// Um novo toque no orb pausa e retoma. Sem microfone, a mesma conversa segue
// digitando.
//
// Voz: só a voz humana do ElevenLabs, pelo servidor, nunca a voz robótica do
// navegador. A fala é tocada frase por frase (as fixas já vêm gravadas); se
// alguma frase não tiver áudio (crédito do mês no teto ou falha do
// ElevenLabs), ela aparece só na legenda e o resto segue falado.
// O que a pessoa diz é entendido por shared/jarvas.js.

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
// Ritmo da conversa. Calibrado para não atropelar ninguém: a pessoa termina
// a frase, e o Jarvas só para de falar quando alguém realmente fala por cima.
const PAUSA_FIM_FALA = 600;         // buffer fim: 600ms silêncio encerra a vez da pessoa
const PAUSA_FIM_PARCIAL = 900;      // idem, quando a última parte ainda não é final
const PAUSA_EXTRA_INCOMPLETA = 600; // frase parada em "e…", "para…": espera mais
const PAUSA_RESPOSTA_COMPLETA = 180;  // buffer início: 180ms após resposta curta
const PALAVRAS_PARA_INTERROMPER = 3; // precisa de 3 palavras transcritas para interromper
const FALA_SIMULTANEA_MS = 150;    // 150ms de voz real para interromper (rápido, mas não noise)
const APRENDE_ECO_MS = 450;        // 450ms para calibrar eco antes de comparar
const ECO_FALANDO = 0.45;          // 45% de pares = eco (menos agressivo para preservar input real)
const CARENCIA_POS_FALA = 0;       // sem carência pós-fala: usuário pode falar imediatamente

const ESTADO_ORB = { parado: "idle", conectando: "connecting", falando: "speaking", ouvindo: "listening", pensando: "thinking", pausado: "idle", montando: "thinking" };
const STATUS_KEYS = {
  parado: "jarvas.tapToTalk",
  conectando: "jarvas.connecting",
  falando: "jarvas.speaking",
  ouvindo: "jarvas.listening",
  pensando: "jarvas.thinking",
  pausado: "jarvas.paused",
  montando: "jarvas.building",
};

export default function ConversaJarvas({ emp, onCampanha }) {
  const { t } = useI18n();
  const id = useId();
  const [fase, setFase] = useState("parado");
  const [legenda, setLegenda] = useState({ palavras: [], ate: 0 });
  const [anuncio, setAnuncio] = useState("");
  const [ouvido, setOuvido] = useState("");
  const [chips, setChips] = useState([]);
  const [linhasResumo, setLinhasResumo] = useState(null);
  const [modoTexto, setModoTexto] = useState(!SR);
  const [texto, setTexto] = useState("");
  const [mudo, setMudo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [tamanho, setTamanho] = useState(() => (window.innerWidth < 480 ? 148 : 184));

  const respostas = useRef({});
  const campo = useRef(null);
  const geracao = useRef(0);
  const faseRef = useRef("parado");
  const nivel = useRef(0);
  const ctx = useRef(null);
  const audioEl = useRef(null);
  const analisadorVoz = useRef(null);
  const analisadorMic = useRef(null);
  const micStream = useRef(null);
  const rec = useRef(null);
  const escutando = useRef(false);  // a escuta contínua deve ficar ligada
  const interromper = useRef(null);
  const falaAtual = useRef("");     // o que o Jarvas está dizendo (para filtrar eco)
  const fimDaFala = useRef(0);      // quando o Jarvas terminou de falar
  const duplex = useRef({ vazamento: 0.6, piso: 0.01, acima: 0, inicio: 0 }); // detector de fala simultânea
  const respostaId = useRef(0);     // resposta em preparo (cancelada se a pessoa continuar falando)
  const ultimoDito = useRef("");    // o que a pessoa disse na última vez
  const vez = useRef({ final: "", parcial: "", timer: null });
  const ocupado = useRef(false);    // processando uma resposta
  const cacheAudio = useRef(new Map());
  const vozHumana = useRef(null);
  const mudoRef = useRef(false);
  const modoTextoRef = useRef(modoTexto);
  const entrada = useRef(null);
  mudoRef.current = mudo;
  modoTextoRef.current = modoTexto;

  const mudarFase = (f) => { faseRef.current = f; setFase(f); };

  useEffect(() => {
    const ajustar = () => setTamanho(window.innerWidth < 480 ? 148 : 184);
    window.addEventListener("resize", ajustar);
    fetch(`${API_URL}/api/jarvas/voz`, { credentials: "include" }).then((r) => r.json()).then((r) => {
      vozHumana.current = !!r?.disponivel;
      if (r?.disponivel) obterAudio(primeiraFala());
    }).catch(() => { vozHumana.current = false; });
    return () => {
      window.removeEventListener("resize", ajustar);
      geracao.current++;
      escutando.current = false;
      pararFala();
      pararEscuta();
      micStream.current?.getTracks().forEach((t) => t.stop());
      ctx.current?.close?.();
      for (const p of cacheAudio.current.values()) p.then((u) => u && URL.revokeObjectURL(u));
    };
  }, []);

  // A cada quadro: volume para o orb e detector de fala simultânea.
  // Enquanto o Jarvas fala, o microfone capta um pouco da voz dele (vazamento
  // da caixa de som). O detector aprende essa proporção e, quando o microfone
  // fica acima dela por FALA_SIMULTANEA_MS, é a pessoa falando: ele para.
  useEffect(() => {
    let q, ultimo = performance.now();
    const bufMic = new Uint8Array(512), bufVoz = new Uint8Array(512);
    const rms = (an, buf) => {
      an.getByteTimeDomainData(buf);
      let soma = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; soma += v * v; }
      return Math.sqrt(soma / buf.length);
    };
    const passo = (t) => {
      const dt = Math.min(100, t - ultimo);
      ultimo = t;
      const mic = analisadorMic.current ? rms(analisadorMic.current, bufMic) : 0;
      const voz = analisadorVoz.current ? rms(analisadorVoz.current, bufVoz) : 0;
      const f = faseRef.current;
      const d = duplex.current;
      if (f === "falando" && analisadorMic.current && !mudoRef.current) {
        const desde = t - d.inicio;
        const esperado = d.vazamento * voz + d.piso;
        if (voz > 0.015 && (desde < APRENDE_ECO_MS || mic < esperado * 1.4))
          d.vazamento = d.vazamento * 0.92 + Math.min(2, Math.max(0, mic - d.piso) / voz) * 0.08;
        const limite = d.vazamento * voz * 1.8 + d.piso * 2.5 + 0.02;
        if (desde > APRENDE_ECO_MS && mic > limite) d.acima += dt; else d.acima = Math.max(0, d.acima - dt);
        if (d.acima > FALA_SIMULTANEA_MS) { d.acima = 0; interromperPorFala(); }
      } else {
        d.acima = 0;
        // Ruído de fundo: desce rápido, sobe devagar (fala não vira "ruído").
        d.piso = mic < d.piso ? d.piso * 0.9 + mic * 0.1 : d.piso * 0.999 + Math.min(mic, 0.05) * 0.001;
      }
      nivel.current = f === "falando" ? Math.min(1, voz * 4.5) : f === "ouvindo" ? Math.min(1, mic * 4.5) : 0;
      q = requestAnimationFrame(passo);
    };
    q = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(q);
  }, []);

  // A pessoa começou a falar: o Jarvas para de falar ou desiste da resposta
  // que estava preparando (e o que ela disse antes se junta ao que vem agora).
  const interromperPorFala = () => {
    const f = faseRef.current;
    if (f === "falando") { pararFala(); mudarFase("ouvindo"); }
    else if (f === "pensando") {
      respostaId.current++;
      ocupado.current = false;
      vez.current.final = `${ultimoDito.current} ${vez.current.final}`.trim();
      mudarFase("ouvindo");
    }
  };

  const primeiraFala = () => `${saudacao(emp)} ${perguntar("objetivo", {}, emp).texto}`;

  // ---- som ---------------------------------------------------------------

  const prepararAudio = () => {
    if (ctx.current) { ctx.current.resume?.(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const el = new Audio();
    audioEl.current = el;
    if (!Ctx) return;
    const c = new Ctx();
    const an = c.createAnalyser();
    an.fftSize = 512;
    c.createMediaElementSource(el).connect(an);
    an.connect(c.destination);
    ctx.current = c;
    analisadorVoz.current = an;
  };

  // Áudio frase por frase: as frases fixas vêm gravadas do servidor e só as
  // frases com números próprios gastam crédito. Resolve com uma URL por frase
  // (null na frase que ficou sem áudio).
  const obterAudio = (t) => Promise.all(segmentosDeFala(t).map(obterFrase));

  const obterFrase = (t) => {
    const chave = paraFala(t);
    if (!cacheAudio.current.has(chave)) {
      const p = vozHumana.current === false ? Promise.resolve(null) : fetch(`${API_URL}/api/jarvas/voz`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: t }),
      }).then(async (r) => {
        if (!r.ok) {
          if (r.status === 503) vozHumana.current = false;
          cacheAudio.current.delete(chave);
          return null;
        }
        return URL.createObjectURL(await r.blob());
      }).catch(() => { cacheAudio.current.delete(chave); return null; });
      cacheAudio.current.set(chave, p);
    }
    return cacheAudio.current.get(chave);
  };

  const pararFala = () => {
    interromper.current?.();
    interromper.current = null;
  };

  // Fala com legenda palavra por palavra. Resolve ao terminar ou ao ser
  // interrompida (pela pessoa falando por cima, ou por um toque).
  // `valida`: a resposta ainda vale? (a pessoa pode ter voltado a falar
  // enquanto a voz era preparada).
  const falar = async (t, valida = null) => {
    const g = geracao.current;
    const palavras = t.split(/\s+/).filter(Boolean);
    falaAtual.current = t;
    // O que ficou no ouvido antes desta fala é velho (ou eco): começa limpo.
    clearTimeout(vez.current.timer);
    vez.current = { final: "", parcial: "", timer: null };
    setLegenda({ palavras, ate: 0 });
    setAnuncio(t);
    if (mudoRef.current) {
      setLegenda({ palavras, ate: palavras.length });
      return g === geracao.current;
    }
    const urls = await obterAudio(t);
    if (g !== geracao.current || (valida && !valida())) return false;
    duplex.current.inicio = performance.now();
    duplex.current.acima = 0;
    mudarFase("falando");

    await new Promise((fim) => {
      let acabou = false;
      const terminar = () => { if (!acabou) { acabou = true; fimDaFala.current = Date.now(); setLegenda((l) => ({ ...l, ate: l.palavras.length })); fim(); } };
      // Frases em sequência; a legenda avança pelas palavras de cada uma. Frase
      // sem áudio aparece na legenda, no tempo de leitura, sem voz.
      const el = audioEl.current;
      const frases = segmentosDeFala(t).map((f) => f.split(/\s+/).filter(Boolean).length);
      let i = 0, antes = 0, q, espera;
      const acompanhar = () => {
        if (el?.duration) setLegenda({ palavras, ate: antes + Math.ceil(frases[i] * Math.min(1, (el.currentTime + 0.15) / el.duration)) });
        if (!acabou) q = requestAnimationFrame(acompanhar);
      };
      const proxima = () => {
        cancelAnimationFrame(q);
        antes += frases[i] || 0;
        i += 1;
        if (i < frases.length && !acabou) tocar(); else terminar();
      };
      const tocar = () => {
        if (urls[i] && el) {
          el.src = urls[i];
          el.play().then(() => { q = requestAnimationFrame(acompanhar); }).catch(proxima);
        } else {
          setLegenda({ palavras, ate: antes + frases[i] });
          espera = setTimeout(proxima, Math.min(600 + frases[i] * 220, 3500));
        }
      };
      if (el) { el.onended = proxima; el.onerror = proxima; }
      interromper.current = () => { el?.pause(); clearTimeout(espera); cancelAnimationFrame(q); terminar(); };
      if (frases.length) tocar(); else terminar();
    });
    interromper.current = null;
    return g === geracao.current;
  };

  // ---- microfone: escuta contínua ------------------------------------------

  const prepararMic = async () => {
    if (micStream.current || !navigator.mediaDevices?.getUserMedia || !ctx.current) return;
    try {
      micStream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const an = ctx.current.createAnalyser();
      an.fftSize = 512;
      ctx.current.createMediaStreamSource(micStream.current).connect(an);
      analisadorMic.current = an;
    } catch { /* sem nível do microfone: o orb oscila sozinho */ }
  };

  const passarParaTexto = (msg) => {
    setAviso(msg);
    setModoTexto(true);
    escutando.current = false;
    pararEscuta();
    if (["ouvindo", "pausado"].includes(faseRef.current)) mudarFase("ouvindo");
    setTimeout(() => entrada.current?.focus(), 50);
  };

  const pararEscuta = () => {
    clearTimeout(vez.current.timer);
    vez.current = { final: "", parcial: "", timer: null };
    if (rec.current) { rec.current.onend = null; rec.current.abort?.(); rec.current = null; }
  };

  // Fim da vez da pessoa: entrega o que ela disse.
  const encerrarVez = () => {
    const dito = semEco(`${vez.current.final} ${vez.current.parcial}`.trim(), falaAtual.current);
    vez.current = { final: "", parcial: "", timer: null };
    if (dito) responder(dito);
  };

  const iniciarEscuta = () => {
    if (!SR || !escutando.current || rec.current || modoTextoRef.current) return;
    const r = new SR();
    r.lang = "pt-BR"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = (e) => {
      let final = "", parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript; else parcial += e.results[i][0].transcript;
      }
      const v = vez.current;
      v.final = `${v.final} ${final}`.trim();
      v.parcial = parcial.trim();
      let dito = `${v.final} ${v.parcial}`.trim();
      if (!dito) return;

      const f = faseRef.current;
      const recente = Date.now() - fimDaFala.current < CARENCIA_POS_FALA;
      let palavras = (dito.match(/\S+/g) || []).length;

      // O microfone ouviu o próprio Jarvas (enquanto ele fala ou logo depois).
      // Se o SR capturou eco + resposta juntos ("quantos profissionais três"),
      // semEco preserva o que é da pessoa ("três") em vez de descartar tudo.
      if ((f === "falando" || recente) && pareceEco(dito, falaAtual.current, ECO_FALANDO)) {
        const restante = semEco(dito, falaAtual.current);
        if (restante && restante !== dito) {
          v.final = restante;
          v.parcial = "";
          dito = restante;
          palavras = (dito.match(/\S+/g) || []).length;
        } else {
          clearTimeout(v.timer);
          vez.current = { final: "", parcial: "", timer: null };
          return;
        }
      }
      if (f === "pausado" || f === "montando") return;
      // Pelo texto também: palavras que não são eco, enquanto ele fala, param o
      // Jarvas (o detector de volume costuma chegar antes).
      if (f === "falando") { if (palavras < PALAVRAS_PARA_INTERROMPER) return; interromperPorFala(); }
      // Ele ia responder e a pessoa continuou falando: junta e segue ouvindo.
      if (f === "pensando") interromperPorFala();
      if (faseRef.current !== "ouvindo") mudarFase("ouvindo");
      setOuvido(`${vez.current.final} ${vez.current.parcial}`.trim());
      clearTimeout(v.timer);
      // Resposta completa ("3", "sim", "Sorocaba"): o Jarvas responde logo.
      // Frase longa ou parada no meio: espera a pessoa terminar.
      const espera = !v.parcial && respostaCompleta(dito, campo.current, respostas.current, emp)
        ? PAUSA_RESPOSTA_COMPLETA
        : (v.parcial ? PAUSA_FIM_PARCIAL : PAUSA_FIM_FALA) + (fraseIncompleta(dito) ? PAUSA_EXTRA_INCOMPLETA : 0);
      v.timer = setTimeout(encerrarVez, espera);
    };
    r.onerror = (e) => {
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(e.error))
        passarParaTexto(t("jarvas.micError"));
    };
    // O navegador encerra a escuta de tempos em tempos: reabre na hora.
    r.onend = () => { rec.current = null; if (escutando.current) setTimeout(iniciarEscuta, 120); };
    rec.current = r;
    try { r.start(); } catch { rec.current = null; }
  };

  // ---- conversa ----------------------------------------------------------

  const depoisDeFalar = () => {
    if (faseRef.current === "falando" || faseRef.current === "conectando") mudarFase("ouvindo");
    if (modoTextoRef.current) setTimeout(() => entrada.current?.focus(), 50);
  };

  const comecar = async () => {
    prepararAudio();
    const g = ++geracao.current;
    respostas.current = {};
    campo.current = "objetivo";
    setLinhasResumo(null); setOuvido(""); setAviso("");
    mudarFase("conectando");
    setChips(perguntar("objetivo", {}, emp).chips);
    escutando.current = !!SR && !modoTextoRef.current;
    await prepararMic();
    iniciarEscuta();
    if (!(await falar(primeiraFala())) || g !== geracao.current) return;
    depoisDeFalar();
  };

  const responder = async (dito, patchDireto = null) => {
    if (ocupado.current || faseRef.current === "montando") return;
    ocupado.current = true;
    const g = geracao.current;
    const id = ++respostaId.current;
    ultimoDito.current = dito;
    pararFala();
    setOuvido(dito);
    setChips([]);
    mudarFase("pensando");
    const atual = campo.current;
    const anteriores = respostas.current;
    const patch = patchDireto || interpretarResposta(dito, atual, anteriores, emp);

    // No resumo: pedido de mudança vale antes do "pode montar".
    if (atual === "ajuste" && !patchDireto && !Object.keys(patch).length && confirmaMontagem(dito)) {
      ocupado.current = false;
      return montar();
    }
    const novas = aplicar(anteriores, patch);
    let fala, proximo = atual, novosChips = [];
    if (!Object.keys(patch).length) {
      fala = atual === "ajuste" ? t("jarvas.didNotUnderstand") : pedirDeNovo(atual, novas, emp);
      if (atual !== "ajuste") novosChips = perguntar(atual, novas, emp).chips;
    } else {
      const reacao = reagir(patch, novas, emp, anteriores);
      const prox = proximoCampo(novas);
      // Depois de uma mudança no resumo, só a pergunta final (sem repetir o "Pronto.").
      if (!prox) { proximo = "ajuste"; fala = `${reacao} ${atual === "ajuste" ? "Posso montar?" : FECHAMENTO}`; }
      else { proximo = prox; const q = perguntar(prox, novas, emp); fala = `${reacao} ${q.texto}`; novosChips = q.chips; }
    }
    fala = fala.trim();
    obterAudio(fala);
    await esperar(50);
    // Recomeçou, ou a pessoa continuou falando: esta resposta não vale mais.
    if (g !== geracao.current || id !== respostaId.current) { if (id === respostaId.current) ocupado.current = false; return; }
    respostas.current = novas;
    campo.current = proximo;
    setLinhasResumo(proximo === "ajuste" ? resumo(novas) : null);
    setChips(novosChips);
    ocupado.current = false;
    if (!(await falar(fala, () => id === respostaId.current))) return;
    depoisDeFalar();
  };

  const montar = async () => {
    const g = geracao.current;
    setChips([]);
    campo.current = "fim";
    mudarFase("montando");
    escutando.current = false;
    pararEscuta();
    const r = respostas.current;
    const objetivo = r.objetivo || "reunioes";
    const campanha = montarCampanha(objetivo, emp);
    const { tarefas, orcamento } = calcularTarefasJarvas(r);
    Object.assign(campanha, { objetivoChave: objetivo, regiao: r.regiao || "", vagas: Number(r.vagas) || 1, tarefas });
    if (r.publico) campanha.publico = r.publico;
    if (orcamento > 0) campanha.orcamento = orcamento;
    if (r.prazoHoras) campanha.prazoHoras = r.prazoHoras;
    // Tudo o que foi mudado no resumo (nome, valores, orçamento, prazo) vai
    // para a campanha montada.
    campanha.titulo = tituloPadrao(r);
    await falar(t("jarvas.buildingYourCampaign"));
    if (g !== geracao.current) return;
    mudarFase("montando");
    onCampanha(objetivo, campanha);
  };

  const recomecar = () => {
    geracao.current++;
    escutando.current = false;
    ocupado.current = false;
    pararFala();
    pararEscuta();
    respostas.current = {};
    campo.current = null;
    mudarFase("parado");
    setLegenda({ palavras: [], ate: 0 });
    setOuvido(""); setChips([]); setLinhasResumo(null); setTexto(""); setAviso("");
  };

  // O orb abre a conversa e, depois, pausa e retoma.
  const tocarOrb = () => {
    const f = faseRef.current;
    if (f === "parado") return comecar();
    if (f === "pausado") {
      prepararAudio();
      escutando.current = !!SR && !modoTextoRef.current;
      mudarFase("ouvindo");
      iniciarEscuta();
      return;
    }
    if (f === "montando") return;
    pararFala();
    escutando.current = false;
    pararEscuta();
    mudarFase("pausado");
  };

  const enviarTexto = (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || ["parado", "montando"].includes(faseRef.current)) return;
    setTexto("");
    responder(t);
  };

  const escolherChip = (c) => {
    if (c.patch) return responder(c.rotulo, c.patch);
    pararFala();
    setChips([]);
    setOuvido(c.rotulo);
    (async () => { if (await falar(c.seguir || "Pode falar.")) depoisDeFalar(); })();
  };

  const alternarTexto = () => {
    const vaiDigitar = !modoTexto;
    setModoTexto(vaiDigitar);
    modoTextoRef.current = vaiDigitar;
    setAviso("");
    if (vaiDigitar) { escutando.current = false; pararEscuta(); setTimeout(() => entrada.current?.focus(), 50); }
    else if (!["parado", "pausado", "montando"].includes(faseRef.current)) { escutando.current = true; iniciarEscuta(); }
  };

  const ativo = !["parado", "montando"].includes(fase);

  return (
    <div className="cj">
      <style>{`
        .cj{display:flex;flex-direction:column;align-items:center;text-align:center;padding:8px 0 4px;gap:14px}
        .cj-orb{border:0;background:transparent;padding:10px;border-radius:50%;cursor:pointer;line-height:0;transition:transform .2s}
        .cj-orb:hover{transform:scale(1.02)}
        .cj-orb:focus-visible{outline:3px solid var(--ring,var(--brand));outline-offset:4px}
        .cj-status{font-size:12.5px;color:var(--muted);margin:0;min-height:18px;letter-spacing:.01em}
        .cj-legenda{font-size:clamp(18px,2.6vw,23px);line-height:1.45;font-weight:600;color:var(--ink);max-width:640px;margin:0;min-height:34px}
        .cj-legenda span{transition:opacity .18s}
        .cj-legenda span[data-dita="0"]{opacity:.28}
        .cj-voce{font-size:15px;color:var(--brand);font-weight:500;margin:0;max-width:560px;min-height:22px}
        .cj-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:640px}
        .cj-chips .vx-btn{min-height:44px;border-radius:var(--radius-pill,999px);font-size:13px}
        .cj-resumo{width:100%;max-width:520px;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:14px 16px}
        .cj-resumo dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:14px}
        .cj-resumo dt{color:var(--muted)}.cj-resumo dd{margin:0;font-weight:600;color:var(--ink)}
        .cj-texto{display:flex;gap:8px;width:100%;max-width:520px;padding:6px;border:1px solid var(--border);border-radius:var(--radius-pill,999px);background:var(--surface)}
        .cj-texto:focus-within{box-shadow:0 0 0 3px var(--ring)}
        .cj-texto input{flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:15px;padding:0 12px;min-height:44px;color:var(--ink)}
        .cj-enviar{flex:none;width:44px;height:44px;border-radius:50%;border:0;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
        .cj-enviar:disabled{opacity:.4;cursor:default}
        .cj-rodape{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
        .cj-rodape .vx-btn{min-height:44px}
      `}</style>

      <button type="button" className="cj-orb" onClick={tocarOrb} disabled={fase === "montando"}
        aria-label={fase === "parado" ? t("jarvas.startConversation") : fase === "pausado" ? t("jarvas.continueConversation") : t("jarvas.pauseConversation")}>
        <ThinkingOrb state={ESTADO_ORB[fase]} size={tamanho} nivel={nivel} decorativo />
      </button>
      <p className="cj-status" aria-hidden="true">{modoTexto && fase === "ouvindo" ? t("jarvas.yourTurnType") : t(STATUS_KEYS[fase])}</p>

      {/* Indicador visual de microfone — aparece quando o Jarvas está ouvindo */}
      {fase === "ouvindo" && !modoTexto && (
        <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--brand)" }}>
          <Mic size={12} />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{t("jarvas.micActive")}</span>
          <span style={{ display: "inline-flex", gap: 2, alignItems: "flex-end", height: 14 }}>
            {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
              <span key={i} style={{
                width: 3, borderRadius: 2, background: "var(--brand)", opacity: 0.7 + i * 0.06,
                height: `${h * 14}px`, animation: `micBar${i % 3} 0.8s ease-in-out ${i * 0.1}s infinite alternate`
              }} />
            ))}
          </span>
          <style>{`
            @keyframes micBar0{from{transform:scaleY(.4)}to{transform:scaleY(1)}}
            @keyframes micBar1{from{transform:scaleY(.6)}to{transform:scaleY(1)}}
            @keyframes micBar2{from{transform:scaleY(.5)}to{transform:scaleY(.9)}}
          `}</style>
        </div>
      )}

      {legenda.palavras.length > 0 && (
        <p className="cj-legenda" aria-hidden="true">
          {legenda.palavras.map((p, i) => <span key={i} data-dita={i < legenda.ate ? "1" : "0"}>{p} </span>)}
        </p>
      )}
      <div className="vx-sr" aria-live="polite">{anuncio}</div>
      {ouvido && <p className="cj-voce"><span className="vx-sr">{t("jarvas.youSaid")} </span>{'"'}{ouvido}{'"'}</p>}

      {chips.length > 0 && ativo && (
        <div className="cj-chips" role="group" aria-label={t("jarvas.quickReplies")}>
          {chips.map((c) => <button key={c.rotulo} type="button" className="vx-btn vx-btn-sm" onClick={() => escolherChip(c)}>{c.rotulo}</button>)}
        </div>
      )}

      {linhasResumo && (
        <div className="cj-resumo">
          <dl>{linhasResumo.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <button type="button" className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 48, marginTop: 14 }}
            onClick={montar} disabled={fase === "montando"}>
            <Check size={15} /> {t("jarvas.buildCampaign")}
          </button>
        </div>
      )}

      {aviso && <p className="vx-onb-dica" role="status" style={{ margin: 0 }}>{aviso}</p>}

      {modoTexto && ativo && (
        <form className="cj-texto" onSubmit={enviarTexto}>
          <label htmlFor={`${id}-txt`} className="vx-sr">{t("jarvas.replyByText")}</label>
          <input id={`${id}-txt`} ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off"
            placeholder={campo.current === "ajuste" ? t("jarvas.adjustPlaceholder") : t("jarvas.typePlaceholder")} />
          <button type="submit" className="cj-enviar" aria-label={t("app.send")} disabled={!texto.trim()}><Send size={17} /></button>
        </form>
      )}

      {fase !== "parado" && (
        <div className="cj-rodape">
          {SR && (
            <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={alternarTexto}>
              {modoTexto ? <><Mic size={14} /> {t("jarvas.speak")}</> : <><Keyboard size={14} /> {t("jarvas.preferTyping")}</>}
            </button>
          )}
          {ativo && (
            <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={tocarOrb}>
              {fase === "pausado" ? <><Mic size={14} /> {t("app.continue")}</> : <><Pause size={14} /> {t("jarvas.pause")}</>}
            </button>
          )}
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" aria-pressed={mudo}
            onClick={() => { setMudo((m) => !m); if (!mudo) pararFala(); }}>
            {mudo ? <><VolumeX size={14} /> {t("jarvas.soundOff")}</> : <><Volume2 size={14} /> {t("jarvas.soundOn")}</>}
          </button>
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={recomecar} disabled={fase === "montando"}>
            <RotateCcw size={13} /> {t("jarvas.restart")}
          </button>
        </div>
      )}
    </div>
  );
}
