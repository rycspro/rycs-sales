import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "../../lib/api.js";

// Telefone do profissional no navegador. O Asterisk liga para cá e a
// discadora atende sozinha; o ramal não consegue discar para fora.
export function useSipPhone(ativo) {
  const [estado, setEstado] = useState("desligado");
  const [erro, setErro] = useState(null);
  const [mudo, setMudo] = useState(false);
  const uaRef = useRef(null);
  const sessaoRef = useRef(null);
  const credRef = useRef(null);
  const audioRef = useRef(null);

  const opcoesMidia = () => ({
    mediaConstraints: { audio: true, video: false },
    pcConfig: { iceServers: (credRef.current?.stunServers || []).map((urls) => ({ urls })) },
  });

  useEffect(() => {
    if (!ativo) return undefined;
    let cancelado = false;

    (async () => {
      setEstado("conectando");
      setErro(null);
      try {
        const cred = await api.post("/voice/webrtc/credenciais");
        const { default: JsSIP } = await import("jssip");
        if (cancelado) return;
        credRef.current = cred;

        const ua = new JsSIP.UA({
          sockets: [new JsSIP.WebSocketInterface(cred.wssUrl)],
          uri: `sip:${cred.usuario}@${cred.dominio}`,
          password: cred.senha,
          register: true,
          session_timers: false,
        });

        ua.on("registered", () => setEstado((e) => (e === "em_chamada" ? e : "pronto")));
        ua.on("registrationFailed", () => {
          setEstado("erro");
          setErro("Não foi possível conectar o áudio do navegador.");
        });
        ua.on("disconnected", () => setEstado((e) => (e === "desligado" ? e : "conectando")));

        ua.on("newRTCSession", ({ session, originator }) => {
          sessaoRef.current = session;
          session.on("peerconnection", ({ peerconnection }) => {
            peerconnection.addEventListener("track", (ev) => {
              if (!audioRef.current) return;
              audioRef.current.srcObject = ev.streams[0];
              audioRef.current.play().catch(() => {});
            });
          });
          session.on("confirmed", () => setEstado("em_chamada"));
          const fim = () => {
            sessaoRef.current = null;
            setMudo(false);
            setEstado("pronto");
          };
          session.on("ended", fim);
          session.on("failed", fim);
          if (originator === "remote") session.answer(opcoesMidia());
        });

        ua.start();
        uaRef.current = ua;
      } catch (e) {
        if (cancelado) return;
        setEstado("erro");
        setErro(e.message || "Erro ao conectar o áudio do navegador.");
      }
    })();

    return () => {
      cancelado = true;
      sessaoRef.current?.terminate?.();
      uaRef.current?.stop();
      uaRef.current = null;
      sessaoRef.current = null;
      setEstado("desligado");
    };
  }, [ativo]);

  const testarAudio = useCallback(() => {
    const ua = uaRef.current;
    if (!ua || !credRef.current) return;
    ua.call(`sip:teste-audio@${credRef.current.dominio}`, opcoesMidia());
  }, []);

  const desligar = useCallback(() => {
    sessaoRef.current?.terminate();
  }, []);

  const alternarMudo = useCallback(() => {
    const s = sessaoRef.current;
    if (!s) return;
    if (s.isMuted().audio) { s.unmute({ audio: true }); setMudo(false); } else { s.mute({ audio: true }); setMudo(true); }
  }, []);

  return { estado, erro, mudo, audioRef, testarAudio, desligar, alternarMudo };
}
