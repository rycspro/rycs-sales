import { useEffect, useId, useState, useRef } from "react";
import { ShieldCheck, Smartphone, Unplug, RefreshCw, QrCode, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";

// Conexão do WhatsApp pessoal via Evolution API (QR Code).
// Só para profissionais (vendedores). A empresa não conecta por aqui.

const TEXTOS = {
  aviso: "Esta integração usa uma tecnologia não oficial do WhatsApp. A conexão pode sofrer interrupções ou restrições a qualquer momento. Use exclusivamente para comunicações comerciais autorizadas com seus leads.",
  vendedor: "Só as conversas com os leads das suas empresas são guardadas na RYCS. Conversas particulares não são importadas nem vistas por ninguém. Você pode desconectar quando quiser.",
};

const STATUS_COR = {
  ativa: "var(--green)",
  aguardando_qr: "var(--amber)",
  reconectando: "var(--amber)",
  desconectada: "var(--red)",
};

const STATUS_TEXTO = {
  ativa: "Conectado",
  aguardando_qr: "Aguardando QR Code",
  reconectando: "Reconectando…",
  desconectada: "Desconectado",
};

export default function ConectarEvolution({ aviso, recarregarInfo }) {
  const id = useId();
  const [info, setInfo] = useState(null);
  const [aceite, setAceite] = useState(false);
  const [empresaId, setEmpresaId] = useState("");
  const [empresas, setEmpresas] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [modalQr, setModalQr] = useState(false);
  const pollRef = useRef(null);

  const carregar = () =>
    api("/evolution/info").then((r) => {
      if (r && !r.error) setInfo(r);
      return r;
    });
  const carregarEmpresas = () =>
    api("/canais").then((r) => { if (r?.empresas) setEmpresas(r.empresas); });

  useEffect(() => {
    carregar();
    carregarEmpresas();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling quando aguardando QR Code.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (info?.status === "aguardando_qr" || info?.status === "reconectando") {
      pollRef.current = setInterval(async () => {
        const r = await carregar();
        if (r?.status === "ativa") {
          setModalQr(false);
          setQrCode("");
          aviso?.("WhatsApp conectado com sucesso!");
          recarregarInfo?.();
        }
      }, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [info?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Atualiza o QR Code do backend (que vem via webhook da Evolution).
  useEffect(() => {
    if (info?.qrCode && info.status === "aguardando_qr") setQrCode(info.qrCode);
  }, [info?.qrCode, info?.status]);

  const conectar = async () => {
    setOcupado(true);
    try {
      const r = await api("/evolution/conectar", { consentimento: aceite, companyId: empresaId || undefined });
      if (!r || r.error) throw new Error(r?.error || "Não foi possível conectar.");
      if (r.qrCode) setQrCode(r.qrCode);
      setModalQr(true);
      await carregar();
    } catch (e) { aviso?.(e.message); }
    finally { setOcupado(false); }
  };

  const reconectar = async () => {
    setOcupado(true);
    try {
      const r = await api("/evolution/reconectar", {});
      if (!r || r.error) throw new Error(r?.error || "Não foi possível reconectar.");
      if (r.qrCode) setQrCode(r.qrCode);
      setModalQr(true);
      await carregar();
    } catch (e) { aviso?.(e.message); }
    finally { setOcupado(false); }
  };

  const atualizarQr = async () => {
    try {
      const r = await api("/evolution/qrcode");
      if (r?.base64) setQrCode(r.base64);
    } catch (e) { aviso?.(e.message); }
  };

  const desconectar = async () => {
    if (!window.confirm("Desconectar o WhatsApp pessoal? As novas mensagens deixam de chegar. O histórico fica guardado.")) return;
    try {
      const r = await api("/evolution/desconectar", {});
      if (!r || r.error) throw new Error(r?.error || "Não foi possível desconectar.");
      aviso?.("WhatsApp desconectado.");
      setQrCode("");
      setModalQr(false);
      await carregar();
      recarregarInfo?.();
    } catch (e) { aviso?.(e.message); }
  };

  const configurada = info?.configurada !== false;
  const conectada = info?.status === "ativa";

  return (
    <section className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
      {/* Conexão existente */}
      {info?.id && (
        <div className="vx-row" style={{ flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>{info.numero ? `+${info.numero}` : "WhatsApp Pessoal"}</b>
            {info.nome && <div className="vx-mut" style={{ fontSize: 12 }}>{info.nome}</div>}
            <div style={{ fontSize: 12, color: STATUS_COR[info.status] || "var(--muted-2)" }}>
              {STATUS_TEXTO[info.status] || info.status}
              {info.ultimoErro ? ` · ${info.ultimoErro}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!conectada && info.status !== "desconectada" && (
              <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={reconectar} disabled={ocupado}>
                <RefreshCw size={14} aria-hidden="true" /> Reconectar
              </button>
            )}
            {conectada && (
              <button type="button" className="vx-btn vx-btn-sm vx-btn-danger" style={{ minHeight: 44 }} onClick={desconectar}>
                <Unplug size={14} aria-hidden="true" /> Desconectar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Formulário de nova conexão */}
      {!info?.id && (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--brand-50)", color: "var(--brand)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Smartphone size={20} aria-hidden="true" />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Conecte o seu WhatsApp Pessoal</h2>
              <p className="vx-mut" style={{ fontSize: 13, lineHeight: 1.55, margin: "4px 0 0" }}>
                Escaneie o QR Code com o WhatsApp do seu celular para atender leads diretamente pela RYCS.
              </p>
            </div>
          </div>

          {!configurada ? (
            <div className="vx-notice vx-notice-amber" style={{ marginTop: 14 }}>
              A integração WhatsApp pessoal ainda não foi ativada neste ambiente. Aguarde a configuração.
            </div>
          ) : (
            <>
              {/* Aviso sobre tecnologia não oficial */}
              <div className="vx-notice vx-notice-amber" style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.5 }}>
                <AlertTriangle size={14} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 6 }} />
                {TEXTOS.aviso}
              </div>

              <div style={{ marginTop: 14 }}>
                <label className="vx-label" htmlFor={`${id}-e`}>Empresa que você atende</label>
                <select id={`${id}-e`} className="vx-input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={{ minHeight: 44 }}>
                  <option value="">Escolha a empresa</option>
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                {empresas.length === 0 && <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>Você ainda não está aprovado em nenhuma empresa.</div>}
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, fontSize: 13, lineHeight: 1.5, cursor: "pointer" }}>
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} style={{ marginTop: 3 }} />
                <span>
                  <ShieldCheck size={14} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 4, color: "var(--brand)" }} />
                  {TEXTOS.vendedor} <b>Li e concordo.</b>
                </span>
              </label>

              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={conectar}
                  disabled={ocupado || !aceite || !empresaId}>
                  {ocupado ? <RefreshCw size={15} className="vx-spin" aria-hidden="true" /> : <QrCode size={15} aria-hidden="true" />}
                  {ocupado ? " Conectando…" : " Conectar com QR Code"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal de QR Code */}
      {modalQr && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget && info?.status !== "aguardando_qr") setModalQr(false); }}>
          <div className="vx-card" style={{ maxWidth: 420, width: "100%", padding: 24, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="vx-disp" style={{ fontSize: 18, margin: "0 0 4px" }}>Escaneie o QR Code</h3>
            <p className="vx-mut" style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 16px" }}>
              Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho → Escaneie o código abaixo.
            </p>

            <div style={{ background: "#fff", borderRadius: 12, padding: 16, display: "inline-block", minWidth: 260, minHeight: 260 }}>
              {qrCode ? (
                <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code do WhatsApp" style={{ width: 228, height: 228, imageRendering: "pixelated" }} />
              ) : (
                <div style={{ width: 228, height: 228, display: "grid", placeItems: "center", color: "var(--muted-2)" }}>
                  <div><RefreshCw size={24} className="vx-spin" /><div style={{ marginTop: 8, fontSize: 13 }}>Gerando QR Code…</div></div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted-2)" }}>
              {info?.status === "ativa" ? (
                <span style={{ color: "var(--green)" }}><Wifi size={14} style={{ verticalAlign: -2 }} /> Conectado!</span>
              ) : (
                <span>O QR Code expira em ~45 segundos.</span>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={atualizarQr}>
                <RefreshCw size={14} aria-hidden="true" /> Novo QR Code
              </button>
              <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={() => setModalQr(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
