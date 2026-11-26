import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "../../lib/api.js";

export function useVoice() {
  const [sessao, setSessao] = useState(null);
  const [leadAtual, setLeadAtual] = useState(null);
  const [reservaAtual, setReservaAtual] = useState(null);
  const [ligacaoAtual, setLigacaoAtual] = useState(null);
  const [scriptAtual, setScriptAtual] = useState(null);
  const [eventosLead, setEventosLead] = useState([]);
  const [callsAnteriores, setCallsAnteriores] = useState([]);
  const [callbackPendente, setCallbackPendente] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [stats, setStats] = useState(null);
  const renovarTimer = useRef(null);

  const limpar = useCallback(() => {
    setLeadAtual(null);
    setReservaAtual(null);
    setLigacaoAtual(null);
    setScriptAtual(null);
    setEventosLead([]);
    setCallsAnteriores([]);
    setCallbackPendente(null);
    if (renovarTimer.current) clearInterval(renovarTimer.current);
  }, []);

  const iniciarSessao = useCallback(async (queueId, companyId, modalidade) => {
    try {
      setCarregando(true);
      const r = await api.post("/voice/session/start", { queueId, companyId, modalidade });
      setSessao(r);
      setErro(null);
      return r;
    } catch (e) {
      setErro(e.message || "Erro ao iniciar sessão");
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  const pausarSessao = useCallback(async () => {
    try {
      await api.post("/voice/session/pause");
      setSessao((s) => s ? { ...s, status: "pausado" } : null);
    } catch (e) { setErro(e.message); }
  }, []);

  const retomarSessao = useCallback(async () => {
    try {
      await api.post("/voice/session/resume");
      setSessao((s) => s ? { ...s, status: "ativo" } : null);
    } catch (e) { setErro(e.message); }
  }, []);

  const encerrarSessao = useCallback(async () => {
    try {
      await api.post("/voice/session/end");
      setSessao(null);
      limpar();
    } catch (e) { setErro(e.message); }
  }, [limpar]);

  const buscarProximo = useCallback(async (queueId) => {
    try {
      setCarregando(true);
      setErro(null);
      const r = await api.post("/voice/next-lead", { queueId });
      if (r.lead) {
        setLeadAtual(r.lead);
        setReservaAtual(r.reserva);
        setScriptAtual(r.script);
        setEventosLead(r.eventos || []);
        setCallsAnteriores(r.callsAnteriores || []);
        setCallbackPendente(r.callback);
        setLigacaoAtual(null);

        // Auto-renovar reserva a cada 5min
        if (renovarTimer.current) clearInterval(renovarTimer.current);
        if (r.reserva) {
          renovarTimer.current = setInterval(async () => {
            try { await api.post("/voice/reservations/renew", { reservaId: r.reserva.id }); } catch {}
          }, 5 * 60 * 1000);
        }
      } else {
        limpar();
      }
      return r;
    } catch (e) {
      setErro(e.message);
      return null;
    } finally {
      setCarregando(false);
    }
  }, [limpar]);

  const iniciarLigacao = useCallback(async (leadId, queueId, providerId) => {
    try {
      setCarregando(true);
      setErro(null);
      const r = await api.post("/voice/calls", {
        leadId,
        queueId,
        providerId,
        reservaId: reservaAtual?.id,
      });
      setLigacaoAtual(r);

      // Se mobile, abrir app de telefone via tel: URI
      if (r.telUri) {
        window.open(r.telUri, "_self");
      }
      return r;
    } catch (e) {
      setErro(e.message);
      return null;
    } finally {
      setCarregando(false);
    }
  }, [reservaAtual]);

  const registrarResultado = useCallback(async (callId, dados) => {
    try {
      setCarregando(true);
      setErro(null);
      const r = await api.post(`/voice/calls/${callId}/result`, dados);
      setLigacaoAtual(null);
      return r;
    } catch (e) {
      setErro(e.message);
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarStats = useCallback(async (params = {}) => {
    try {
      const r = await api.get("/voice/stats", params);
      setStats(r);
      return r;
    } catch {}
    return null;
  }, []);

  // Carregar sessão atual ao montar
  const carregarSessaoAtual = useCallback(async () => {
    try {
      const r = await api.get("/voice/session/current");
      if (r) setSessao(r);
    } catch {}
  }, []);

  useEffect(() => {
    return () => { if (renovarTimer.current) clearInterval(renovarTimer.current); };
  }, []);

  return {
    sessao, leadAtual, reservaAtual, ligacaoAtual, scriptAtual,
    eventosLead, callsAnteriores, callbackPendente,
    carregando, erro, stats, setErro,
    iniciarSessao, pausarSessao, retomarSessao, encerrarSessao,
    buscarProximo, iniciarLigacao, registrarResultado,
    carregarStats, carregarSessaoAtual, limpar,
  };
}
