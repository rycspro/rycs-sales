import { useEffect, useId, useRef, useState } from "react";
import { Check, Keyboard, Mic, Pause, RotateCcw, Send, Volume2, VolumeX } from "lucide-react";
import ThinkingOrb from "../ThinkingOrb.jsx";
import { API_URL } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { montarCampanha } from "../../../shared/objetivosCampanha.js";
import {
  interpretarResposta, proximoCampo, perguntar, pedirDeNovo, reagir, saudacao, resumo,
  calcularTarefasJarvas, rotuloObjetivo, FECHAMENTO, confirmaMontagem, paraFala, pareceEco,
} from "../../../shared/jarvas.js";

// Conversa assistida por voz com o Jarvas, sem botão de falar.
//
// Um toque no orb abre a conversa (o navegador exige um gesto para liberar o
// som e o microfone). Daí em diante é mãos livres, como numa ligação:
// - o microfone fica aberto o tempo todo;
// - a pessoa pode falar por cima do Jarvas: ele para na hora e escuta;
// - quando a pessoa faz uma pausa curta, o Jarvas responde, sem esperar
//   clique nenhum;
// - o que o microfone capta da própria voz do Jarvas é descartado (eco).
// Um novo toque no orb pausa e retoma. Sem microfone, a mesma conversa segue
// digitando.
//
// Voz: ElevenLabs pelo servidor (masculina); sem ela, a melhor voz masculina
// do navegador. O que a pessoa diz é entendido por shared/jarvas.js.

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const PAUSA_FIM_FALA = 800;      // silêncio que encerra a vez da pessoa
const PAUSA_FIM_PARCIAL = 1300;  // idem, quando a última parte ainda não é final

const ESTADO_ORB = { parado: "idle", conectando: "connecting", falando: "speaking", ouvindo: "listening", pensando: "thinking", pausado: "idle", montando: "thinking" };
const STATUS = {
  parado: "Toque no orbe para conversar com o Jarvas",
  conectando: "Conectando…",
  falando: "Jarvas falando · pode interromper",
  ouvindo: "Ouvindo…",
  pensando: "Pensando…",
  pausado: "Pausado · toque no orbe para continuar",
  montando: "Montando a campanha…",
};

// Melhor voz masculina do navegador, para quando o ElevenLabs não responder.
function vozDoNavegador() {
  const vozes = window.speechSynthesis?.getVoices() || [];
  const pt = vozes.filter((v) => /^pt(-|_)?BR/i.test(v.lang));
  const masculina = (v) => /felipe|daniel|antonio|ant[oô]nio|male|masculin|fabio|ricardo|humberto/i.test(v.name);
  return pt.find((v) => masculina(v) && /natural|neural|online/i.test(v.name))
    || pt.find(masculina)
    || pt.find((v) => /natural|neural|online/i.test(v.name))
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

  // Volume → orb, a cada quadro: a voz do Jarvas enquanto ele fala, o
  // microfone no resto do tempo.
  useEffect(() => {
    let q;
    const buf = new Uint8Array(512);
    const passo = () => {
      const a = faseRef.current === "falando" ? analisadorVoz.current : faseRef.current === "ouvindo" ? analisadorMic.current : null;
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

  const obterAudio = (t) => {
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
    window.speechSynthesis?.cancel();
  };

  // Fala com legenda palavra por palavra. Resolve ao terminar ou ao ser
  // interrompida (pela pessoa falando por cima, ou por um toque).
  const falar = async (t) => {
    const g = geracao.current;
    const palavras = t.split(/\s+/).filter(Boolean);
    falaAtual.current = t;
    setLegenda({ palavras, ate: 0 });
    setAnuncio(t);
    if (mudoRef.current) {
      setLegenda({ palavras, ate: palavras.length });
      return g === geracao.current;
    }
    const url = await obterAudio(t);
    if (g !== geracao.current) return false;
    mudarFase("falando");

    await new Promise((fim) => {
      let acabou = false;
      const terminar = () => { if (!acabou) { acabou = true; setLegenda((l) => ({ ...l, ate: l.palavras.length })); fim(); } };
      if (url && audioEl.current) {
        const el = audioEl.current;
        el.src = url;
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
        u.lang = "pt-BR"; u.rate = 1.08; u.pitch = 0.95;
        u.voice = vozDoNavegador();
        let contadas = 0;
        u.onboundary = () => setLegenda({ palavras, ate: Math.min(palavras.length, ++contadas) });
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
    const dito = `${vez.current.final} ${vez.current.parcial}`.trim();
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
      const dito = `${v.final} ${v.parcial}`.trim();
      if (!dito) return;

      // O microfone ouviu o próprio Jarvas: descarta.
      if (pareceEco(dito, falaAtual.current)) { vez.current = { final: "", parcial: "", timer: null }; return; }
      const f = faseRef.current;
      if (f === "falando") {
        // A pessoa começou a falar por cima: o Jarvas para e escuta.
        if ((dito.match(/\S+/g) || []).length < 2) return;
        pararFala();
      }
      if (f === "pausado" || f === "montando") return;
      if (f !== "pensando") mudarFase("ouvindo");
      setOuvido(dito);
      clearTimeout(v.timer);
      v.timer = setTimeout(encerrarVez, v.parcial ? PAUSA_FIM_PARCIAL : PAUSA_FIM_FALA);
    };
    r.onerror = (e) => {
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(e.error))
        passarParaTexto("Não consegui acessar o microfone. Libere o microfone no navegador ou continue digitando.");
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
    const novas = { ...anteriores, ...patch };
    respostas.current = novas;
    let fala, proximo = atual, novosChips = [];
    if (!Object.keys(patch).length) {
      fala = atual === "ajuste" ? "Não entendi. O que mudo?" : pedirDeNovo(atual, novas, emp);
      if (atual !== "ajuste") novosChips = perguntar(atual, novas, emp).chips;
    } else {
      const reacao = reagir(patch, novas, emp, anteriores);
      const prox = proximoCampo(novas);
      if (!prox) { proximo = "ajuste"; fala = `${reacao} ${FECHAMENTO}`; }
      else { proximo = prox; const q = perguntar(prox, novas, emp); fala = `${reacao} ${q.texto}`; novosChips = q.chips; }
    }
    fala = fala.trim();
    obterAudio(fala);
    await esperar(220);
    if (g !== geracao.current) { ocupado.current = false; return; }
    campo.current = proximo;
    setLinhasResumo(proximo === "ajuste" ? resumo(novas) : null);
    setChips(novosChips);
    ocupado.current = false;
    if (!(await falar(fala))) return;
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
    campanha.titulo = [rotuloObjetivo(objetivo), r.regiao, `${campanha.vagas} prof.`, orcamento > 0 ? money(orcamento) : ""].filter(Boolean).join(" — ");
    await falar("Montando sua campanha.");
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
        aria-label={fase === "parado" ? "Começar a conversa com o Jarvas" : fase === "pausado" ? "Continuar a conversa" : "Pausar a conversa"}>
        <ThinkingOrb state={ESTADO_ORB[fase]} size={tamanho} nivel={nivel} decorativo />
      </button>
      <p className="cj-status" aria-hidden="true">{modoTexto && fase === "ouvindo" ? "Sua vez · escreva abaixo" : STATUS[fase]}</p>

      {legenda.palavras.length > 0 && (
        <p className="cj-legenda" aria-hidden="true">
          {legenda.palavras.map((p, i) => <span key={i} data-dita={i < legenda.ate ? "1" : "0"}>{p} </span>)}
        </p>
      )}
      <div className="vx-sr" aria-live="polite">{anuncio}</div>
      {ouvido && <p className="cj-voce"><span className="vx-sr">Você disse: </span>“{ouvido}”</p>}

      {chips.length > 0 && ativo && (
        <div className="cj-chips" role="group" aria-label="Respostas rápidas">
          {chips.map((c) => <button key={c.rotulo} type="button" className="vx-btn vx-btn-sm" onClick={() => escolherChip(c)}>{c.rotulo}</button>)}
        </div>
      )}

      {linhasResumo && (
        <div className="cj-resumo">
          <dl>{linhasResumo.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <button type="button" className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 48, marginTop: 14 }}
            onClick={montar} disabled={fase === "montando"}>
            <Check size={15} /> Montar campanha
          </button>
        </div>
      )}

      {aviso && <p className="vx-onb-dica" role="status" style={{ margin: 0 }}>{aviso}</p>}

      {modoTexto && ativo && (
        <form className="cj-texto" onSubmit={enviarTexto}>
          <label htmlFor={`${id}-txt`} className="vx-sr">Responder ao Jarvas por escrito</label>
          <input id={`${id}-txt`} ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off"
            placeholder={campo.current === "ajuste" ? "Peça uma mudança ou diga \"pode montar\"" : "Escreva sua resposta…"} />
          <button type="submit" className="cj-enviar" aria-label="Enviar" disabled={!texto.trim()}><Send size={17} /></button>
        </form>
      )}

      {fase !== "parado" && (
        <div className="cj-rodape">
          {SR && (
            <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={alternarTexto}>
              {modoTexto ? <><Mic size={14} /> Falar</> : <><Keyboard size={14} /> Prefiro digitar</>}
            </button>
          )}
          {ativo && (
            <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={tocarOrb}>
              {fase === "pausado" ? <><Mic size={14} /> Continuar</> : <><Pause size={14} /> Pausar</>}
            </button>
          )}
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" aria-pressed={mudo}
            onClick={() => { setMudo((m) => !m); if (!mudo) pararFala(); }}>
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
