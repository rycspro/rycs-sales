import { useState, useEffect, useRef, useCallback } from "react";

// Escuta ao vivo para o roteiro guiado. Dois modos:
// - "navegador": reconhecimento de fala do próprio navegador (tempo real, só o
//   microfone). Entrega frases prontas em onTrecho(texto).
// - "servidor": grava o microfone misturado ao áudio remoto (ligação pelo
//   navegador ou aba da reunião) em trechos curtos e entrega cada trecho em
//   onAudio(blob, formato) para o servidor transcrever. Trecho em silêncio não
//   é enviado.
// Nada é gravado em disco no navegador.

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const navegadorTranscreve = () => !!SR;
export const servidorPodeGravar = () => typeof window !== "undefined" && !!window.MediaRecorder && !!navigator.mediaDevices?.getUserMedia;

const DURACAO_TRECHO_MS = 5000;
const LIMIAR_SILENCIO = 0.015; // RMS

export function useTranscricaoAoVivo({ ativo, modo, onTrecho, onAudio, fontesExtras = [] }) {
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState("");
  const [erro, setErro] = useState("");
  const cb = useRef({ onTrecho, onAudio });
  cb.current = { onTrecho, onAudio };
  const ativoRef = useRef(false);
  const chaveFontes = fontesExtras.map((s) => s?.id || "").join(",");
  const fontesRef = useRef(fontesExtras);
  fontesRef.current = fontesExtras;

  const iniciarNavegador = useCallback(() => {
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let p = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) { const t = r[0].transcript.trim(); if (t) cb.current.onTrecho?.(t); } else p += r[0].transcript;
      }
      setParcial(p);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { setErro("Microfone bloqueado. Libere o acesso no navegador para a IA acompanhar."); ativoRef.current = false; }
      else if (e.error === "audio-capture") setErro("Nenhum microfone encontrado.");
    };
    rec.onend = () => { if (ativoRef.current) { try { rec.start(); } catch { /* reinício já em curso */ } } else setOuvindo(false); };
    rec.start();
    setOuvindo(true);
    return () => { try { rec.onend = null; rec.stop(); } catch { /* já parado */ } };
  }, []);

  const iniciarServidor = useCallback(async () => {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const destino = ctx.createMediaStreamDestination();
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 1024;
    const conectar = (stream) => {
      if (!stream?.getAudioTracks?.().length) return;
      const src = ctx.createMediaStreamSource(stream);
      src.connect(destino);
      src.connect(analisador);
    };
    conectar(mic);
    for (const s of fontesRef.current) conectar(s);
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"].find((m) => window.MediaRecorder.isTypeSupported?.(m)) || "";
    const formato = mime.includes("ogg") ? "ogg" : "webm";
    const amostras = new Float32Array(analisador.fftSize);
    let pico = 0;
    const medidor = setInterval(() => {
      analisador.getFloatTimeDomainData(amostras);
      let soma = 0;
      for (const v of amostras) soma += v * v;
      pico = Math.max(pico, Math.sqrt(soma / amostras.length));
    }, 150);
    let gravador = null;
    let timer = null;
    const gravarTrecho = () => {
      if (!ativoRef.current) return;
      pico = 0;
      const partes = [];
      gravador = new MediaRecorder(destino.stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      gravador.ondataavailable = (e) => { if (e.data?.size) partes.push(e.data); };
      gravador.onstop = () => {
        if (pico >= LIMIAR_SILENCIO && partes.length) cb.current.onAudio?.(new Blob(partes, { type: mime || "audio/webm" }), formato);
        gravarTrecho();
      };
      gravador.start();
      timer = setTimeout(() => { if (gravador?.state === "recording") gravador.stop(); }, DURACAO_TRECHO_MS);
    };
    gravarTrecho();
    setOuvindo(true);
    return () => {
      clearTimeout(timer);
      clearInterval(medidor);
      if (gravador) { gravador.onstop = null; if (gravador.state === "recording") gravador.stop(); }
      mic.getTracks().forEach((t) => t.stop()); // só o microfone aberto aqui; o áudio remoto é de quem o abriu
      ctx.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    ativoRef.current = !!(ativo && modo);
    if (!ativo || !modo) { setOuvindo(false); setParcial(""); return undefined; }
    setErro("");
    let parar = null;
    let cancelado = false;
    (async () => {
      try {
        const p = modo === "navegador" ? iniciarNavegador() : await iniciarServidor();
        if (cancelado) p?.(); else parar = p;
      } catch (e) {
        setErro(e?.name === "NotAllowedError" ? "Microfone bloqueado. Libere o acesso no navegador para a IA acompanhar." : "Não foi possível acessar o microfone.");
        setOuvindo(false);
      }
    })();
    return () => { cancelado = true; ativoRef.current = false; parar?.(); setOuvindo(false); setParcial(""); };
  }, [ativo, modo, chaveFontes, iniciarNavegador, iniciarServidor]);

  return { ouvindo, parcial, erro };
}
