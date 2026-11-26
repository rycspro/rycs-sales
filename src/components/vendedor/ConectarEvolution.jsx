import { useEffect, useState, useRef } from "react";
import { ShieldCheck, Smartphone, Unplug, RefreshCw, QrCode, Wifi, WifiOff, AlertTriangle, Pencil, Check, Plus } from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";

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
  const [info, setInfo] = useState(null);
  const [aceite, setAceite] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [modalQr, setModalQr] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const pollRef = useRef(null);

  const conexoes = info?.conexoes || [];
  const temAtiva = conexoes.some((c) => c.status !== "desconectada");

  const carregar = () =>
    api("/evolution/info").then((r) => {
      if (r && !r.error) setInfo(r);
      return r;
    });

  useEffect(() => {
    carregar();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (info?.status === "aguardando_qr" || info?.status === "reconectando") {
      pollRef.current = setInterval(async () => {
        const r = await carregar();
        if (r?.status === "ativa") {
          setModalQr(false);
          setQrCode("");
          setMostrarForm(false);
          aviso?.("WhatsApp conectado com sucesso!");
          recarregarInfo?.();
        }
      }, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [info?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (info?.qrCode && info.status === "aguardando_qr") setQrCode(info.qrCode);
  }, [info?.qrCode, info?.status]);

  const conectar = async () => {
    setOcupado(true);
    try {
      const r = await api("/evolution/conectar", { consentimento: aceite });
      if (!r || r.error) throw new Error(r?.error || "Não foi possível conectar.");
      if (r.qrCode) setQrCode(r.qrCode);
      setModalQr(true);
      await carregar();
    } catch (e) { aviso?.(e.message); }
    finally { setOcupado(false); }
  };

  const reconectar = async (conexaoId) => {
    setOcupado(true);
    try {
      const r = await api("/evolution/reconectar", { conexaoId });
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

  const desconectar = async (conexaoId) => {
    if (!window.confirm("Desconectar este WhatsApp? As novas mensagens deixam de chegar. O histórico fica guardado.")) return;
    try {
      const r = await api("/evolution/desconectar", { conexaoId });
      if (!r || r.error) throw new Error(r?.error || "Não foi possível desconectar.");
      aviso?.("WhatsApp desconectado.");
      setQrCode("");
      setModalQr(false);
      await carregar();
      recarregarInfo?.();
    } catch (e) { aviso?.(e.message); }
  };

  const configurada = info?.configurada !== false;
  const autorizado = info?.autorizado !== false;

  if (configurada && !autorizado && conexoes.length === 0 && !info?.id) {
    return (
      <section className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--muted-50)", color: "var(--muted)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <WifiOff size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>WhatsApp Pessoal</h2>
            <p className="vx-mut" style={{ fontSize: 13, lineHeight: 1.55, margin: "4px 0 0" }}>
              Você ainda não foi autorizado para o piloto do WhatsApp pessoal. O administrador pode liberar seu acesso.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const exibirForm = conexoes.length === 0 || mostrarForm;

  return (
    <section className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
      {/* Lista de conexões existentes */}
      {conexoes.length > 0 && (
        <div>
          <div className="vx-row" style={{ marginBottom: 12 }}>
            <h3 className="vx-disp" style={{ fontSize: 16, margin: 0 }}>Contas conectadas</h3>
          </div>
          {conexoes.map((c) => (
            <ConexaoCard key={c.id} conexao={c} onReconectar={reconectar} onDesconectar={desconectar} onRenomear={carregar} aviso={aviso} ocupado={ocupado} />
          ))}
          {!mostrarForm && conexoes.filter((c) => c.status !== "desconectada").length < 5 && (
            <button type="button" className="vx-btn vx-btn-sm" style={{ marginTop: 12, minHeight: 44 }} onClick={() => { setMostrarForm(true); setAceite(false); }}>
              <Plus size={14} aria-hidden="true" /> Conectar outro WhatsApp
            </button>
          )}
        </div>
      )}

      {/* Formulário de nova conexão */}
      {exibirForm && (
        <div style={{ marginTop: conexoes.length > 0 ? 16 : 0, paddingTop: conexoes.length > 0 ? 16 : 0, borderTop: conexoes.length > 0 ? "1px solid var(--border)" : "none" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--brand-50)", color: "var(--brand)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Smartphone size={20} aria-hidden="true" />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>
                {conexoes.length > 0 ? "Conectar outro WhatsApp" : "Conecte o seu WhatsApp Pessoal"}
              </h2>
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
              <div className="vx-notice vx-notice-amber" style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.5 }}>
                <AlertTriangle size={14} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 6 }} />
                {TEXTOS.aviso}
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
                  disabled={ocupado || !aceite}>
                  {ocupado ? <RefreshCw size={15} className="vx-spin" aria-hidden="true" /> : <QrCode size={15} aria-hidden="true" />}
                  {ocupado ? " Conectando…" : " Conectar com QR Code"}
                </button>
                {conexoes.length > 0 && (
                  <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={() => setMostrarForm(false)}>
                    Cancelar
                  </button>
                )}
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

function ConexaoCard({ conexao: c, onReconectar, onDesconectar, onRenomear, aviso, ocupado }) {
  const [editando, setEditando] = useState(false);
  const [apelido, setApelido] = useState(c.apelido || "");
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (editando) inputRef.current?.focus(); }, [editando]);

  const salvarApelido = async () => {
    setSalvando(true);
    try {
      const r = await api.put("/evolution/renomear", { conexaoId: c.id, apelido: apelido.trim() });
      if (!r || r.error) throw new Error(r?.error || "Erro ao salvar.");
      setEditando(false);
      onRenomear?.();
    } catch (e) { aviso?.(e.message); }
    finally { setSalvando(false); }
  };

  const conectada = c.status === "ativa";
  const label = c.apelido || (c.numero ? `+${c.numero}` : "WhatsApp Pessoal");

  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <div className="vx-row" style={{ flexWrap: "wrap", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {!editando ? (
              <>
                <b style={{ fontSize: 14 }}>{label}</b>
                <button type="button" className="vx-btn-icon" style={{ padding: 2, background: "none", border: "none", cursor: "pointer", color: "var(--muted-2)" }}
                  onClick={() => { setApelido(c.apelido || ""); setEditando(true); }} title="Renomear" aria-label="Renomear conexão">
                  <Pencil size={13} />
                </button>
              </>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); salvarApelido(); }} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input ref={inputRef} className="vx-input" value={apelido} onChange={(e) => setApelido(e.target.value)}
                  placeholder="Nome do WhatsApp" maxLength={60} style={{ fontSize: 13, padding: "4px 8px", width: 180 }} />
                <button type="submit" className="vx-btn-icon" style={{ padding: 2, background: "none", border: "none", cursor: "pointer", color: "var(--brand)" }}
                  disabled={salvando} aria-label="Salvar nome">
                  <Check size={15} />
                </button>
              </form>
            )}
          </div>
          {c.apelido && c.numero && <div className="vx-mut" style={{ fontSize: 12 }}>+{c.numero}</div>}
          {c.nome && <div className="vx-mut" style={{ fontSize: 12 }}>{c.nome}</div>}
          <div style={{ fontSize: 12, color: STATUS_COR[c.status] || "var(--muted-2)" }}>
            {STATUS_TEXTO[c.status] || c.status}
            {c.ultimoErro ? ` · ${c.ultimoErro}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!conectada && c.status !== "desconectada" && (
            <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={() => onReconectar(c.id)} disabled={ocupado}>
              <RefreshCw size={14} aria-hidden="true" /> Reconectar
            </button>
          )}
          {conectada && (
            <button type="button" className="vx-btn vx-btn-sm vx-btn-danger" style={{ minHeight: 44 }} onClick={() => onDesconectar(c.id)}>
              <Unplug size={14} aria-hidden="true" /> Desconectar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
