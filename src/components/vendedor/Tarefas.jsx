import { useState } from "react";
import { api, apiPatch } from "../../lib/api.js";
import { uid, agora, money } from "../../lib/utils.js";
import { ACOES, CAMPOS, ORDEM_ACOES, TAXA } from "../../lib/constants.js";
import { analisarComIA } from "../../lib/analise.js";
import { Campo, Vazio } from "../ui.jsx";

export default function Tarefas({ empresa, eu, db, setDb, aviso, liberado, irCurso }) {
  const [tipo, setTipo] = useState(null);
  const [prova, setProva] = useState({});
  const [enviando, setEnviando] = useState(false);

  if (!liberado)
    return (
      <Vazio
        titulo="Tarefas bloqueadas"
        texto="Conclua o curso preparatório desta empresa para registrar ações. São poucos minutos e evita comprovação recusada."
        acao={<button className="vx-btn vx-btn-primary" onClick={irCurso}>Ir para o curso</button>}
      />
    );

  const enviar = async () => {
    const campos = ACOES[tipo].prova;
    if (campos.some((c) => !String(prova[c] || "").trim())) return aviso("Preencha todos os campos da comprovação.");
    if (!/^https?:\/\/\S+/i.test(String(prova.video || "").trim()))
      return aviso("Cole um link de vídeo válido, começando com http:// ou https://.");

    const valor = empresa.comissoes[tipo];
    const liquido = +(valor * (1 - TAXA)).toFixed(2);
    const id = uid();
    setEnviando(true);

    const backendSub = await api("/submissions", { sellerId: eu.id, companyId: empresa.id, tipo, valor, prova });
    const realId = backendSub?.id || id;

    setDb((d) => ({
      ...d,
      submissions: [{ id: realId, sellerId: eu.id, companyId: empresa.id, tipo, valor, prova, status: "analisando", criadoEm: agora() }, ...d.submissions],
      sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, pendente: +(s.pendente + liquido).toFixed(2) } : s),
    }));
    apiPatch(`/sellers/${eu.id}`, { pendente: +(eu.pendente + liquido).toFixed(2) });
    setTipo(null); setProva({}); setEnviando(false);
    aviso("Comprovação enviada. A IA já está analisando o vídeo e os dados.");

    const r = await analisarComIA({ tipo, prova });
    const status = r.veredito === "aprovado" ? "ia_aprovado" : r.veredito === "recusado" ? "ia_recusado" : "revisao";
    apiPatch(`/submissions/${realId}`, { status, confianca: r.confianca, motivo: r.motivo, fonte: r.fonte });
    if (status === "ia_recusado") {
      apiPatch(`/sellers/${eu.id}`, { pendente: +Math.max(0, eu.pendente).toFixed(2) });
    }
    setDb((d) => ({
      ...d,
      submissions: d.submissions.map((s) => s.id === realId ? { ...s, status, confianca: r.confianca, motivo: r.motivo, fonte: r.fonte } : s),
      sellers: status === "ia_recusado"
        ? d.sellers.map((s) => s.id === eu.id ? { ...s, pendente: +Math.max(0, s.pendente - liquido).toFixed(2) } : s)
        : d.sellers,
    }));
  };

  return (
    <>
      <div className="vx-grid vx-g2">
        {ORDEM_ACOES.filter((k) => empresa.comissoes[k]).map((k) => {
          const Icon = ACOES[k].Icon;
          return (
            <div key={k} className="vx-card" style={{ padding: 16 }}>
              <div className="vx-row" style={{ alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <Icon size={14} color="var(--brand)" strokeWidth={2.3} />
                  </span>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{ACOES[k].nome}</div>
                </div>
                <div className="vx-disp vx-mono" style={{ fontSize: 18, color: "var(--brand)" }}>{money(empresa.comissoes[k])}</div>
              </div>
              <p className="vx-mut" style={{ fontSize: 12.5, margin: "10px 0 12px" }}>{ACOES[k].regra}</p>
              <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => { setTipo(k); setProva({}); }}>Registrar ação</button>
            </div>
          );
        })}
      </div>

      <p className="vx-mut" style={{ fontSize: 12, marginTop: 18 }}>
        Toda ação é analisada automaticamente por IA assim que enviada. Aprovada, segue direto para a liberação
        da plataforma; em caso de dúvida, vai para conferência humana da empresa. Descontamos {Math.round(TAXA * 100)}%
        de taxa de serviço no repasse.
      </p>

      {tipo && (
        <div className="vx-overlay" onClick={() => setTipo(null)}>
          <div className="vx-sheet vx-fade" onClick={(e) => e.stopPropagation()}>
            <div className="vx-row" style={{ marginBottom: 4 }}>
              <div className="vx-disp" style={{ fontSize: 19 }}>{ACOES[tipo].nome}</div>
              <div className="vx-disp vx-mono" style={{ fontSize: 19, color: "var(--brand)" }}>{money(empresa.comissoes[tipo])}</div>
            </div>
            <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>{ACOES[tipo].regra}</p>
            <hr className="vx-sep" />
            {ACOES[tipo].prova.map((c) => (
              <Campo key={c} label={CAMPOS[c].label}>
                <input className="vx-input" placeholder={CAMPOS[c].ph} value={prova[c] || ""} onChange={(e) => setProva({ ...prova, [c]: e.target.value })} />
              </Campo>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="vx-btn" onClick={() => setTipo(null)}>Cancelar</button>
              <button className="vx-btn vx-btn-primary" style={{ flex: 1 }} disabled={enviando} onClick={enviar}>
                {enviando ? "Enviando…" : "Enviar comprovação"}
              </button>
            </div>
            <p className="vx-mut" style={{ fontSize: 11.5, marginBottom: 0, marginTop: 10 }}>
              A IA analisa o link do vídeo e os dados na hora. Dado inventado derruba a ação e pode suspender seu acesso.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
