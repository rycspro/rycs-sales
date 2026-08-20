import { useState } from "react";
import { api } from "../../lib/api.js";
import { uid, agora, money } from "../../lib/utils.js";
import { QUIZ } from "../../lib/constants.js";
import { Campo } from "../ui.jsx";

export default function Cadastro({ db, setDb, aviso }) {
  const [etapa, setEtapa] = useState(0);
  const [f, setF] = useState({ nome: "", email: "", whats: "", cidade: "", perfil: "sdr", experiencia: "", pix: "" });
  const [resp, setResp] = useState({});
  const [video, setVideo] = useState("");

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dadosOk = f.nome.trim() && f.email.trim() && f.whats.trim();
  const quizOk = QUIZ.every((_, i) => resp[i] !== undefined);

  const enviar = () => {
    const nota = Math.round(QUIZ.reduce((a, _, i) => a + (resp[i] ?? 0), 0));
    const respostas = QUIZ.map((q, i) => q.ops.find((o) => o[1] === resp[i])?.[0] || "—");
    const novo = {
      id: uid(), ...f, status: "triagem", nota,
      disponivel: 0, pendente: 0, sacado: 0, aplicacoes: {}, curso: {},
      criadoEm: agora(), video, respostas,
    };
    api("/sellers", { ...f, nota, video, respostas }).then((r) => {
      if (r?.id) novo.id = r.id;
    });
    setDb((d) => ({ ...d, sellers: [...d.sellers, novo], sellerId: novo.id }));
    aviso("Cadastro enviado. A triagem responde em até 48h.");
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 560 }}>
      <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Cadastro de vendedor</div>
      <h1 className="vx-disp" style={{ fontSize: 30, margin: "0 0 8px" }}>
        Você é pago por ação comprovada
      </h1>
      <p className="vx-mut" style={{ marginTop: 0, fontSize: 14 }}>
        Reunião agendada, call conectada, venda fechada. Cada ação tem um preço fixo e é conferida por IA
        antes de virar saldo. Sem salário, sem meta imposta: fez, comprovou, recebe.
      </p>

      <div className="vx-card" style={{ padding: 16, margin: "18px 0 22px" }}>
        <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Tabela base — Nexo CRM</div>
        {[["Reunião agendada", 5], ["Call conectada", 10], ["Reunião realizada", 8], ["Follow-up", 0.5], ["Venda fechada", 250]].map(([n, v]) => (
          <div key={n} className="vx-row" style={{ borderBottom: "1px solid var(--border)", padding: "8px 0", fontSize: 13.5 }}>
            <span>{n}</span><b className="vx-mono">{money(v)}</b>
          </div>
        ))}
        <div className="vx-mut" style={{ fontSize: 12, marginTop: 10 }}>Cada empresa define a própria tabela.</div>
      </div>

      <div className="vx-card" style={{ padding: 20 }}>
        <div className="vx-row" style={{ marginBottom: 16 }}>
          <div className="vx-disp" style={{ fontSize: 17 }}>
            {etapa === 0 ? "Seus dados" : etapa === 1 ? "Triagem" : "Pitch de 60 segundos"}
          </div>
          <span className="vx-chip vx-mono">{etapa + 1}/3</span>
        </div>

        {etapa === 0 && (
          <>
            <Campo label="Nome completo"><input className="vx-input" value={f.nome} onChange={set("nome")} placeholder="Como aparece no PIX" /></Campo>
            <Campo label="E-mail"><input className="vx-input" value={f.email} onChange={set("email")} placeholder="voce@email.com" /></Campo>
            <Campo label="WhatsApp"><input className="vx-input" value={f.whats} onChange={set("whats")} placeholder="(00) 9 0000-0000" /></Campo>
            <Campo label="Cidade"><input className="vx-input" value={f.cidade} onChange={set("cidade")} placeholder="Cidade, UF" /></Campo>
            <Campo label="Que tipo de vendedor você é">
              <div className="vx-grid">
                {[["sdr", "SDR — eu agendo reuniões"], ["closer", "Closer — eu fecho contrato"], ["sem-exp", "Nunca vendi, quero começar"]].map(([k, t]) => (
                  <button key={k} className="vx-btn" style={{ justifyContent: "flex-start", borderColor: f.perfil === k ? "var(--brand)" : undefined, background: f.perfil === k ? "var(--brand-50)" : undefined, color: f.perfil === k ? "var(--brand)" : undefined }}
                    onClick={() => setF({ ...f, perfil: k })}>{t}</button>
                ))}
              </div>
            </Campo>
            <Campo label="Sua experiência em uma linha">
              <input className="vx-input" value={f.experiencia} onChange={set("experiencia")} placeholder="Ex.: 1 ano vendendo plano de saúde por telefone" />
            </Campo>
            <Campo label="Chave PIX para receber"><input className="vx-input" value={f.pix} onChange={set("pix")} placeholder="CPF, e-mail ou telefone" /></Campo>
            <button className="vx-btn vx-btn-primary vx-btn-block" disabled={!dadosOk} onClick={() => setEtapa(1)}>Continuar</button>
          </>
        )}

        {etapa === 1 && (
          <>
            <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
              Cinco perguntas. Não existe resposta certa para agradar — existe a sua.
            </p>
            {QUIZ.map((q, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13.5 }}>{q.q}</div>
                <div className="vx-grid">
                  {q.ops.map(([t, v]) => (
                    <button key={t} className="vx-btn vx-btn-sm" style={{
                      justifyContent: "flex-start",
                      borderColor: resp[i] === v ? "var(--brand)" : undefined,
                      background: resp[i] === v ? "var(--brand-50)" : undefined,
                      color: resp[i] === v ? "var(--brand)" : undefined,
                    }} onClick={() => setResp({ ...resp, [i]: v })}>{t}</button>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="vx-btn" onClick={() => setEtapa(0)}>Voltar</button>
              <button className="vx-btn vx-btn-primary" style={{ flex: 1 }} disabled={!quizOk} onClick={() => setEtapa(2)}>Continuar</button>
            </div>
          </>
        )}

        {etapa === 2 && (
          <>
            <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
              Grave um vídeo de até 60 segundos vendendo qualquer coisa perto de você. Suba no Drive ou YouTube não listado e cole o link.
            </p>
            <Campo label="Link do vídeo"><input className="vx-input" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://..." /></Campo>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="vx-btn" onClick={() => setEtapa(1)}>Voltar</button>
              <button className="vx-btn vx-btn-primary" style={{ flex: 1 }} disabled={!video.trim()} onClick={enviar}>Enviar para triagem</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
