import { useEffect, useId, useRef, useState } from "react";
import { Check, Keyboard, Mic, RotateCcw, Send, Volume2, VolumeX } from "lucide-react";
import ThinkingOrb from "../ThinkingOrb.jsx";
import { API_URL } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { montarCampanha } from "../../../shared/objetivosCampanha.js";
import {
  interpretar, interpretarAjuste, proximoCampo, perguntar, pedirDeNovo, reagir, saudacao, resumo,
  calcularTarefasJarvas, rotuloObjetivo, FECHAMENTO, confirmaMontagem, paraFala,
} from "../../../shared/jarvas.js";

// Conversa assistida por voz com o Jarvas.
//
// O dono da empresa toca no orb e conversa. O Jarvas fala (voz humana do
// ElevenLabs, pelo servidor; sem ela, a melhor voz do navegador), abre o
// microfone sozinho, ouve, faz uma pausa curta de quem pensa e responde.
// Tocar no orb enquanto ele fala interrompe e passa a vez; enquanto ouve,
// encerra a fala da pessoa. A legenda acompanha a voz palavra por palavra.
// Sem microfone (ou sem permissão), a mesma conversa segue digitando.
//
// O que a pessoa diz é entendido por shared/jarvas.js, dentro da RYCS.

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const ESTADO_ORB = { parado: "idle", conectando: "connecting", falando: "speaking", ouvindo: "listening", pensando: "thinking", aguardando: "idle", montando: "thinking" };
const STATUS = {
  parado: "Toque no orbe para conversar com o Jarvas",
  conectando: "Conectando…",
  falando: "Jarvas falando · toque para responder",
  ouvindo: "Ouvindo você · toque quando terminar",
  pensando: "Pensando…",
  aguardando: "Toque no orbe e fale",
  montando: "Montando a campanha…",
};
const ROTULO_ORB = {
  parado: "Começar a conversa com o Jarvas",
  falando: "Interromper o Jarvas e responder",
  ouvindo: "Terminar de falar",
  aguardando: "Falar com o Jarvas",
};

// Melhor voz do navegador para quando o ElevenLabs não estiver disponível:
// as "naturais"/neurais primeiro.
function vozDoNavegador() {
  const vozes = window.speechSynthesis?.getVoices() || [];
  const pt = vozes.filter((v) => /^pt(-|_)?BR/i.test(v.lang));
  return pt.find((v) => /natural|neural|online/i.test(v.name))
    || pt.find((v) => /google/i.test(v.name))
    || pt.find((v) => /luciana|francisca|thalita|felipe/i.test(v.name))
    || pt[0] || vozes.find((v) => v.lang?.startsWith("pt")) || null;
}

export default function ConversaJarvas({ emp, onCampanha }) {
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
  const nivel = useRef(0);
  const fonte = useRef(null); // analisador lido para o orb pulsar
  const ctx = useRef(null);
  const audioEl = useRef(null);
  const analisadorVoz = useRef(null);
  const analisadorMic = useRef(null);
  const micStream = useRef(null);
  const rec = useRef(null);
  const interromper = useRef(null);
  const cacheAudio = useRef(new Map());
  const vozHumana = useRef(null); // null = não sei ainda; false = usar a do navegador
  const mudoRef = useRef(false);
  const modoTextoRef = useRef(modoTexto);
  const entrada = useRef(null);
  mudoRef.current = mudo;
  modoTextoRef.current = modoTexto;

  useEffect(() => {
    const ajustar = () => setTamanho(window.innerWidth < 480 ? 148 : 184);
    window.addEventListener("resize", ajustar);
    // Já deixa a saudação pronta: a primeira fala sai sem espera.
    fetch(`${API_URL}/api/jarvas/voz`, { credentials: "include" }).then((r) => r.json()).then((r) => {
      vozHumana.current = !!r?.disponivel;
      if (r?.disponivel) obterAudio(primeiraFala());
    }).catch(() => { vozHumana.current = false; });
    return () => {
      window.removeEventListener("resize", ajustar);
      geracao.current++;
      pararTudo();
      micStream.current?.getTracks().forEach((t) => t.stop());
      ctx.current?.close?.();
      for (const p of cacheAudio.current.values()) p.then((u) => u && URL.revokeObjectURL(u));
    };
  }, []);

  // Volume → orb, a cada quadro.
  useEffect(() => {
    let q;
    const buf = new Uint8Array(512);
    const passo = () => {
      const a = fonte.current;
      if (a) {
        a.getByteTimeDomainData(buf);
        let soma = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; soma += v * v; }
        nivel.current = Math.min(1, Math.sqrt(soma / buf.length) * 4.5);
      } else nivel.current = 0;
      q = requestAnimationFrame(passo);
    };
    q = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(q);
  }, []);

  const primeiraFala = () => `${saudacao(emp)} ${perguntar("objetivo", {}, emp).texto}`;

  // ---- áudio -----------------------------------------------------------

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

  const obterAudio = (t) => {
    const chave = paraFala(t);
    if (!cacheAudio.current.has(chave)) {
      const p = vozHumana.current === false ? Promise.resolve(null) : fetch(`${API_URL}/api/jarvas/voz`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: t }),
      }).then(async (r) => {
        if (!r.ok) {
          // Sem voz humana configurada: não pergunta de novo nesta conversa.
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

  const pararTudo = () => {
    interromper.current?.();
    interromper.current = null;
    window.speechSynthesis?.cancel();
    if (rec.current) { rec.current.onend = null; rec.current.abort?.(); rec.current = null; }
    fonte.current = null;
  };

  // Fala e acompanha a legenda palavra por palavra. Resolve true ao terminar
  // (ou ao ser interrompida pela pessoa) e false se a conversa recomeçou.
  const falar = async (t) => {
    const g = geracao.current;
    const palavras = t.split(/\s+/).filter(Boolean);
    setLegenda({ palavras, ate: 0 });
    setAnuncio(t);
    if (mudoRef.current) {
      setLegenda({ palavras, ate: palavras.length });
      setFase("falando");
      await esperar(500);
      return g === geracao.current;
    }
    const url = await obterAudio(t);
    if (g !== geracao.current) return false;
    setFase("falando");

    await new Promise((fim) => {
      let acabou = false;
      const terminar = () => { if (!acabou) { acabou = true; fonte.current = null; setLegenda({ palavras, ate: palavras.length }); fim(); } };
      if (url && audioEl.current) {
        const el = audioEl.current;
        el.src = url;
        fonte.current = analisadorVoz.current;
        let q;
        const acompanhar = () => {
          if (el.duration) setLegenda({ palavras, ate: Math.ceil(palavras.length * Math.min(1, (el.currentTime + 0.15) / el.duration)) });
          if (!acabou) q = requestAnimationFrame(acompanhar);
        };
        el.onended = () => { cancelAnimationFrame(q); terminar(); };
        el.onerror = () => { cancelAnimationFrame(q); terminar(); };
        interromper.current = () => { el.pause(); cancelAnimationFrame(q); terminar(); };
        el.play().then(() => { q = requestAnimationFrame(acompanhar); }).catch(terminar);
      } else if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(paraFala(t));
        u.lang = "pt-BR"; u.rate = 1.03; u.pitch = 1;
        u.voice = vozDoNavegador();
        let contadas = 0;
        u.onboundary = (e) => { if (e.name === "word" || e.charIndex != null) setLegenda({ palavras, ate: Math.min(palavras.length, ++contadas) }); };
        u.onend = terminar;
        u.onerror = terminar;
        interromper.current = () => { window.speechSynthesis.cancel(); terminar(); };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } else terminar();
    });
    interromper.current = null;
    return g === geracao.current;
  };

  // ---- microfone -------------------------------------------------------

  const prepararMic = async () => {
    if (micStream.current || !navigator.mediaDevices?.getUserMedia || !ctx.current) return;
    try {
      micStream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const an = ctx.current.createAnalyser();
      an.fftSize = 512;
      ctx.current.createMediaStreamSource(micStream.current).connect(an);
      analisadorMic.current = an;
    } catch { /* sem nível do microfone: o orb oscila sozinho */ }
  };

  const passarParaTexto = (msg) => {
    setAviso(msg);
    setModoTexto(true);
    setFase("aguardando");
    setTimeout(() => entrada.current?.focus(), 50);
  };

  const ouvir = async () => {
    if (!SR) return passarParaTexto("");
    const g = geracao.current;
    setOuvido("");
    setFase("ouvindo");
    await prepararMic();
    if (g !== geracao.current) return;
    fonte.current = analisadorMic.current;
    const r = new SR();
    r.lang = "pt-BR"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let final = "", parcial = "";
    r.onresult = (e) => {
      final = ""; parcial = "";
      for (const res of e.results) { if (res.isFinal) final += res[0].transcript; else parcial += res[0].transcript; }
      setOuvido(`${final} ${parcial}`.trim());
    };
    r.onerror = (e) => {
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(e.error))
        passarParaTexto("Não consegui acessar o microfone. Libere o microfone no navegador ou continue digitando.");
    };
    r.onend = () => {
      rec.current = null;
      fonte.current = null;
      if (g !== geracao.current) return;
      const dito = `${final} ${parcial}`.trim();
      if (dito) responder(dito);
      else setFase((f) => (f === "ouvindo" ? "aguardando" : f));
    };
    rec.current = r;
    try { r.start(); } catch { setFase("aguardando"); }
  };

  // ---- conversa --------------------------------------------------------

  const proximaVez = () => {
    if (modoTextoRef.current) { setFase("aguardando"); setTimeout(() => entrada.current?.focus(), 50); }
    else ouvir();
  };

  const comecar = async () => {
    prepararAudio();
    const g = ++geracao.current;
    respostas.current = {};
    campo.current = "objetivo";
    setLinhasResumo(null);
    setOuvido("");
    setAviso("");
    setFase("conectando");
    setChips(perguntar("objetivo", {}, emp).chips);
    if (!(await falar(primeiraFala())) || g !== geracao.current) return;
    proximaVez();
  };

  const responder = async (dito, patchDireto = null) => {
    const g = geracao.current;
    if (rec.current) { rec.current.onend = null; rec.current.abort?.(); rec.current = null; fonte.current = null; }
    setOuvido(dito);
    setChips([]);
    setFase("pensando");
    const atual = campo.current;
    if (atual === "ajuste" && !patchDireto && confirmaMontagem(dito)) return montar();

    const patch = patchDireto || (atual === "ajuste" ? interpretarAjuste(dito) : interpretar(dito, atual));
    const novas = { ...respostas.current, ...patch };
    respostas.current = novas;
    let fala, proximo = atual, novosChips = [];
    if (!Object.keys(patch).length) {
      fala = atual === "ajuste"
        ? "Não entendi o que mudar. Pode dizer, por exemplo, \"muda para 3 profissionais\", ou \"pode montar\" se estiver tudo certo."
        : pedirDeNovo(atual);
      if (atual !== "ajuste") novosChips = perguntar(atual, novas, emp).chips;
    } else {
      const reacao = reagir(patch, novas, emp);
      const prox = proximoCampo(novas);
      if (!prox) { proximo = "ajuste"; fala = `${atual === "ajuste" ? "Feito! " : ""}${reacao} ${FECHAMENTO}`; }
      else { proximo = prox; const q = perguntar(prox, novas, emp); fala = `${reacao} ${q.texto}`; novosChips = q.chips; }
    }
    // Pausa de quem pensa, enquanto a voz da resposta já é preparada.
    obterAudio(fala);
    await esperar(450 + Math.min(fala.length, 300));
    if (g !== geracao.current) return;
    campo.current = proximo;
    setLinhasResumo(proximo === "ajuste" ? resumo(novas) : null);
    setChips(novosChips);
    if (!(await falar(fala.trim()))) return;
    proximaVez();
  };

  const montar = async () => {
    const g = geracao.current;
    if (rec.current) { rec.current.onend = null; rec.current.abort?.(); rec.current = null; }
    setChips([]);
    campo.current = "fim";
    setFase("montando");
    const r = respostas.current;
    const objetivo = r.objetivo || "reunioes";
    const campanha = montarCampanha(objetivo, emp);
    const { tarefas, orcamento } = calcularTarefasJarvas(r);
    Object.assign(campanha, { objetivoChave: objetivo, regiao: r.regiao || "", vagas: Number(r.vagas) || 1, tarefas });
    if (r.publico) campanha.publico = r.publico;
    if (orcamento > 0) campanha.orcamento = orcamento;
    campanha.titulo = [rotuloObjetivo(objetivo), r.regiao, `${campanha.vagas} prof.`, orcamento > 0 ? money(orcamento) : ""].filter(Boolean).join(" — ");
    await falar("Perfeito! Montando a sua campanha agora.");
    if (g !== geracao.current) return;
    setFase("montando");
    onCampanha(objetivo, campanha);
  };

  const recomecar = () => {
    geracao.current++;
    pararTudo();
    respostas.current = {};
    campo.current = null;
    setFase("parado");
    setLegenda({ palavras: [], ate: 0 });
    setOuvido(""); setChips([]); setLinhasResumo(null); setTexto(""); setAviso("");
  };

  const tocarOrb = () => {
    if (fase === "parado") return comecar();
    if (fase === "falando") return interromper.current?.();
    if (fase === "ouvindo") return rec.current?.stop();
    if (fase === "aguardando") { prepararAudio(); return modoTexto ? entrada.current?.focus() : ouvir(); }
  };

  const enviarTexto = (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || !["aguardando", "ouvindo", "falando"].includes(fase)) return;
    if (fase === "falando") interromper.current?.();
    setTexto("");
    responder(t);
  };

  const escolherChip = (c) => {
    if (fase === "falando") { interromper.current?.(); }
    if (c.patch) return responder(c.rotulo, c.patch);
    // Chip que só pede mais detalhe: o Jarvas pergunta e espera.
    setChips([]);
    setOuvido(c.rotulo);
    (async () => { if (await falar(c.seguir || "Pode falar.")) proximaVez(); })();
  };

  const podeInteragir = ["falando", "ouvindo", "aguardando"].includes(fase);

  return (
    <div className="cj">
      <style>{`
        .cj{display:flex;flex-direction:column;align-items:center;text-align:center;padding:8px 0 4px;gap:14px}
        .cj-orb{border:0;background:transparent;padding:10px;border-radius:50%;cursor:pointer;line-height:0;transition:transform .2s}
        .cj-orb:hover{transform:scale(1.02)}
        .cj-orb:focus-visible{outline:3px solid var(--ring,var(--brand));outline-offset:4px}
        .cj-orb:disabled{cursor:default;transform:none}
        .cj-status{font-size:12.5px;color:var(--muted);margin:0;min-height:18px;letter-spacing:.01em}
        .cj-legenda{font-size:clamp(17px,2.4vw,21px);line-height:1.5;font-weight:600;color:var(--ink);max-width:640px;margin:0;min-height:64px}
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

      <button type="button" className="cj-orb" onClick={tocarOrb} disabled={!ROTULO_ORB[fase]}
        aria-label={ROTULO_ORB[fase] || STATUS[fase]}>
        <ThinkingOrb state={ESTADO_ORB[fase]} size={tamanho} nivel={nivel} decorativo />
      </button>
      <p className="cj-status" aria-hidden="true">{STATUS[fase]}</p>

      {legenda.palavras.length > 0 && (
        <p className="cj-legenda" aria-hidden="true">
          {legenda.palavras.map((p, i) => <span key={i} data-dita={i < legenda.ate ? "1" : "0"}>{p} </span>)}
        </p>
      )}
      <div className="vx-sr" aria-live="polite">{anuncio}</div>
      {ouvido && <p className="cj-voce"><span className="vx-sr">Você disse: </span>“{ouvido}”</p>}

      {chips.length > 0 && podeInteragir && (
        <div className="cj-chips" role="group" aria-label="Respostas rápidas">
          {chips.map((c) => <button key={c.rotulo} type="button" className="vx-btn vx-btn-sm" onClick={() => escolherChip(c)}>{c.rotulo}</button>)}
        </div>
      )}

      {linhasResumo && (
        <div className="cj-resumo">
          <dl>{linhasResumo.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <button type="button" className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 48, marginTop: 14 }}
            onClick={montar} disabled={fase === "montando" || fase === "pensando"}>
            <Check size={15} /> Montar campanha
          </button>
        </div>
      )}

      {aviso && <p className="vx-onb-dica" role="status" style={{ margin: 0 }}>{aviso}</p>}

      {modoTexto && fase !== "parado" && fase !== "montando" && (
        <form className="cj-texto" onSubmit={enviarTexto}>
          <label htmlFor={`${id}-txt`} className="vx-sr">Responder ao Jarvas por escrito</label>
          <input id={`${id}-txt`} ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off"
            placeholder={campo.current === "ajuste" ? "Peça um ajuste ou diga \"pode montar\"" : "Escreva sua resposta…"} />
          <button type="submit" className="cj-enviar" aria-label="Enviar" disabled={!texto.trim() || !podeInteragir}><Send size={17} /></button>
        </form>
      )}

      {fase !== "parado" && (
        <div className="cj-rodape">
          {SR && (
            <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => { setModoTexto((m) => !m); setAviso(""); }}>
              {modoTexto ? <><Mic size={14} /> Falar</> : <><Keyboard size={14} /> Prefiro digitar</>}
            </button>
          )}
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" aria-pressed={mudo}
            onClick={() => { setMudo((m) => !m); if (!mudo) interromper.current?.(); }}>
            {mudo ? <><VolumeX size={14} /> Som desligado</> : <><Volume2 size={14} /> Som ligado</>}
          </button>
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={recomecar} disabled={fase === "montando"}>
            <RotateCcw size={13} /> Recomeçar
          </button>
        </div>
      )}
    </div>
  );
}
