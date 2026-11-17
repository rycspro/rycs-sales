import { useEffect, useId, useState } from "react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";

const NOMES_PASSO = {
  "onboarding:boas_vindas": "Dia 0 · Bem-vindo",
  "onboarding:perfil_falta": "Dia 1 · Falta pouco pro perfil",
  "onboarding:oportunidade": "Dia 2 · Primeira oportunidade",
  "onboarding:aviso_inativacao": "Dia 3 · Aviso de desativação",
  "indicacoes:indique": "Dia 4 · Indique 10 profissionais",
  "indicacoes:codigo_nao_usado": "Dia 5 · Código não usado",
  "graduacao:academy": "Dia 6 · Sales Academy",
  "graduacao:planos": "Dia 7 · Pro x Premium",
  "repescagem:precisa": "Parado 5 dias · Precisamos de você",
  "repescagem:novas": "+3 dias · Empresas novas",
  "repescagem:ultima": "+4 dias · Última chamada",
};
const nomePasso = (k) => NOMES_PASSO[k] || (k.startsWith("empresas_offline:d") ? `Empresa parada · dia ${k.split(":d")[1]}` : k);

// Sequências automáticas do funil: números, prévia de cada e-mail e teste
// enviado para o e-mail do próprio admin.
export default function SequenciasFunil({ aviso }) {
  const id = useId();
  const [dados, setDados] = useState(null);
  const [chaves, setChaves] = useState([]);
  const [chave, setChave] = useState("onboarding:boas_vindas");
  const [idioma, setIdioma] = useState("pt");
  const [previa, setPrevia] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = () => api("/admin/sequencias-email").then((r) => { if (r && !r.error) setDados(r); });
  useEffect(() => {
    carregar();
    api("/admin/sequencias-email/modelos").then((r) => { if (r?.chaves) setChaves(r.chaves); });
  }, []);
  useEffect(() => {
    api("/admin/sequencias-email/previa", { chave, idioma }).then((r) => setPrevia(r && !r.error ? r : null));
  }, [chave, idioma]);

  const testar = async () => {
    setOcupado(true);
    const r = await api("/admin/sequencias-email/teste", { chave, idioma });
    setOcupado(false);
    aviso(r?.ok ? `Teste enviado para ${r.para}.` : r?.error || "Falha no envio.");
  };
  const rodarAgora = async () => {
    setOcupado(true);
    const r = await api("/admin/sequencias-email/rodar", {});
    setOcupado(false);
    if (r?.error) return aviso(r.error);
    aviso(r?.tetoAtingido ? "Teto de hoje já atingido." : `${r?.enviados || 0} e-mail(s) enviado(s).`);
    carregar();
  };

  if (!dados) return <div className="vx-card" style={{ padding: 20, marginBottom: 20 }}>Carregando sequências automáticas…</div>;

  return (
    <div style={{ marginBottom: 28 }}>
      <div className="vx-card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div className="vx-eyebrow">Funil automático</div>
            <div className="vx-disp" style={{ fontSize: 17, marginTop: 2 }}>
              {dados.ligado ? "Ligado" : "Desligado"} · {dados.enviadosHoje} de {dados.tetoHoje} enviados hoje
            </div>
            <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
              Na fila agora: {dados.naFila} · Descadastrados: {dados.descadastros} · Contas inativas por perfil incompleto: {dados.inativos}<br />
              Envia das 9h às 20h (Brasília), no máximo 1 por pessoa por dia. O teto diário sobe 50 por dia para aquecer o domínio.
            </div>
          </div>
          <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={rodarAgora} disabled={ocupado || !dados.ligado}>Rodar agora</button>
        </div>

        <div className="vx-grid vx-g2" style={{ marginTop: 14, gap: 10 }}>
          {dados.sequencias.map((s) => (
            <div key={s.chave} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <b style={{ fontSize: 13.5 }}>{s.nome}</b>
              {s.passos.length === 0
                ? <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>Nenhum envio ainda.</div>
                : s.passos.map((p) => (
                  <div key={p.passo} className="vx-row" style={{ fontSize: 12, marginTop: 4 }}>
                    <span>{nomePasso(p.passo)}</span>
                    <span className="vx-mono">{p.enviados}{p.falhas ? ` · ${p.falhas} falha(s)` : ""}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      <div className="vx-card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="vx-disp" style={{ fontSize: 15, marginBottom: 10 }}>Prévia dos e-mails</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 260px" }}>
            <span className="vx-label" id={`${id}-k`}>E-mail</span>
            <select className="vx-input" aria-labelledby={`${id}-k`} value={chave} onChange={(e) => setChave(e.target.value)} style={{ minHeight: 44 }}>
              {chaves.map((k) => <option key={k} value={k}>{nomePasso(k)}</option>)}
            </select>
          </label>
          <label style={{ flex: "0 1 160px" }}>
            <span className="vx-label" id={`${id}-i`}>Idioma</span>
            <select className="vx-input" aria-labelledby={`${id}-i`} value={idioma} onChange={(e) => setIdioma(e.target.value)} style={{ minHeight: 44 }}>
              <option value="pt">Português</option>
              <option value="en">Inglês</option>
            </select>
          </label>
          <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={testar} disabled={ocupado}>Enviar teste para mim</button>
        </div>
        {previa && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13 }}><span className="vx-mut">Assunto:</span> <b>{previa.assunto}</b></div>
            <iframe title="Prévia do e-mail" srcDoc={previa.html} sandbox=""
              style={{ width: "100%", height: 640, border: "1px solid var(--border)", borderRadius: 10, marginTop: 8, background: "#fff" }} />
          </div>
        )}
      </div>

      {dados.ultimos.length > 0 && (
        <div className="vx-card" style={{ padding: 18 }}>
          <div className="vx-disp" style={{ fontSize: 15, marginBottom: 8 }}>Últimos envios</div>
          {dados.ultimos.map((u, i) => (
            <div key={i} className="vx-row" style={{ fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid var(--border)", gap: 10 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email} · {u.assunto}</span>
              <span style={{ color: u.status === "enviado" ? "var(--green)" : "var(--red)", whiteSpace: "nowrap" }} title={u.erro || ""}>
                {u.status === "enviado" ? "Enviado" : "Falhou"} · {dataCurta(u.enviadoEm)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
