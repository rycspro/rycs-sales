import { useState } from "react";
import { Loader, Lock, QrCode, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { mascararDocumento } from "../../../shared/documentoConta.js";

const SO_DIGITOS = (v) => String(v).replace(/\D/g, "");

// Caixa de compra de um curso pago da Academy: Pix único, acesso sem prazo.
// O curso é liberado pelo webhook do pagamento; aqui só se gera o Pix.
export default function CompraCurso({ curso, compraPendente, aviso, aoConfirmar }) {
  const [processando, setProcessando] = useState(false);
  const [precisaCpf, setPrecisaCpf] = useState(false);
  const [cpf, setCpf] = useState("");
  const [pix, setPix] = useState(null);
  const [conferindo, setConferindo] = useState(false);

  const pagar = async () => {
    if (precisaCpf && SO_DIGITOS(cpf).length !== 11) return aviso?.("Informe o seu CPF com 11 números.");
    setProcessando(true);
    const r = await api(`/courses/${curso.id}/comprar`, precisaCpf ? { cpf: SO_DIGITOS(cpf) } : {});
    setProcessando(false);
    if (r?.codigo === "FALTA_DOCUMENTO") { setPrecisaCpf(true); return aviso?.("Informe o seu CPF para gerar o Pix."); }
    if (r?.error) return aviso?.(r.error);
    if (r?.pix?.qrCode || r?.pix?.copiaECola) setPix(r.pix);
    else aviso?.("Não foi possível exibir o Pix agora. Tente de novo em instantes.");
  };

  const conferir = async () => {
    setConferindo(true);
    const liberado = await aoConfirmar?.();
    setConferindo(false);
    if (liberado) { setPix(null); aviso?.("Pagamento confirmado. Bom curso!"); }
    else aviso?.("Ainda não recebemos a confirmação do pagamento. Pode levar alguns instantes.");
  };

  return (
    <div className="vx-notice" style={{ marginTop: 14 }}>
      <div className="vx-row" style={{ gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <b><Lock size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Curso pago</b>
        <b className="vx-mono" style={{ fontSize: 18, color: "var(--brand)" }}>{money(curso.preco, "BRL")}</b>
      </div>
      <p className="vx-mut" style={{ fontSize: 12.5, margin: "6px 0 12px", lineHeight: 1.6 }}>
        Pagamento único por Pix. Acesso a todas as aulas, sem prazo para terminar. O sumário fica aberto para você conferir antes de comprar.
      </p>

      {precisaCpf && (
        <label style={{ display: "block", marginBottom: 12 }}>
          <span className="vx-label">Seu CPF</span>
          <input className="vx-input vx-mono" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
            value={mascararDocumento(cpf)} onChange={(e) => setCpf(SO_DIGITOS(e.target.value).slice(0, 11))} />
          <span className="vx-mut" style={{ display: "block", fontSize: 12, marginTop: 6 }}>Pedimos uma vez só: o meio de pagamento exige o CPF de quem paga.</span>
        </label>
      )}

      <button className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 44 }}
        disabled={processando || (precisaCpf && SO_DIGITOS(cpf).length !== 11)} onClick={pagar}>
        {processando ? <><Loader size={15} /> Gerando Pix…</> : <><QrCode size={15} /> {compraPendente ? "Ver o Pix gerado" : `Comprar por ${money(curso.preco, "BRL")}`}</>}
      </button>
      <div className="vx-mut" style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
        <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        Nenhuma cobrança é feita sem o seu Pix. O curso é liberado assim que o pagamento for confirmado.
      </div>

      {pix && (
        <div className="vx-overlay" style={{ zIndex: 1100 }}>
          <div className="vx-sheet" style={{ maxWidth: 420, textAlign: "center", padding: "32px 28px" }}>
            <QrCode size={30} color="var(--brand)" />
            <h2 style={{ margin: "12px 0 4px", fontSize: 20 }}>Pague com Pix para liberar o curso</h2>
            <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 16px" }}>
              {curso.titulo} · {money(pix.valor ?? curso.preco, "BRL")}
            </p>
            {pix.qrCode && (
              <img src={`data:image/png;base64,${pix.qrCode}`} alt="QR Code Pix do curso"
                style={{ width: 200, height: 200, margin: "0 auto 16px", display: "block", borderRadius: 10 }} />
            )}
            {pix.copiaECola && (
              <button className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 44 }}
                onClick={() => { navigator.clipboard?.writeText(pix.copiaECola); aviso?.("Código Pix copiado!"); }}>
                Copiar código Pix
              </button>
            )}
            <button className="vx-btn vx-btn-block" style={{ marginTop: 8, minHeight: 44 }} disabled={conferindo} onClick={conferir}>
              {conferindo ? "Conferindo…" : "Já paguei"}
            </button>
            <button className="vx-btn vx-btn-block" style={{ marginTop: 8, minHeight: 44 }} onClick={() => setPix(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
