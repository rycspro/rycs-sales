import { useState, useEffect } from "react";
import { Gift, Copy, Clock, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api.js";
import { money, dataCurta } from "../lib/utils.js";
import { ROTAS } from "../lib/rotas.js";

const PAPEL = { empresa: "Empresa", vendedor: "Profissional" };

export default function Indicacoes({ aviso }) {
  const [dados, setDados] = useState(null);

  useEffect(() => { api("/referrals").then((r) => { if (r && !r.error) setDados(r); }); }, []);

  if (!dados) return <div className="vx-mut" style={{ padding: 20 }}>Carregando…</div>;

  // O convite leva direto ao cadastro de profissional: quem recebe um código
  // de indicação vem criar conta, e a raiz é a tela de quem já tem uma.
  const link = `${window.location.origin}${ROTAS.cadastroVendedor}?ref=${dados.codigo}`;
  // Empresas entram pelo cadastro da empresa, que lê o mesmo código.
  const linkEmpresa = `${window.location.origin}${ROTAS.onboarding}?ref=${dados.codigo}`;
  const indicaEmpresa = !!dados.recompensas?.empresa;
  const prof = dados.profissionais;

  const copiar = async (texto, oque) => {
    try { await navigator.clipboard.writeText(texto); aviso(`${oque} copiado.`); }
    catch { aviso("Não foi possível copiar. Selecione e copie manualmente."); }
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 620 }}>
      <div className="vx-card" style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 13, alignItems: "flex-start", marginBottom: 18 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flex: "none",
            background: "var(--brand-50)", border: "1px solid var(--brand-100)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Gift size={21} color="var(--brand)" strokeWidth={2.1} />
          </div>
          <div>
            <div className="vx-eyebrow">Indique e ganhe</div>
            <div className="vx-disp" style={{ fontSize: 19, marginTop: 2 }}>Seu código</div>
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          padding: "14px 16px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)",
        }}>
          <span className="vx-mono vx-disp" style={{ fontSize: 23, letterSpacing: ".12em", color: "var(--brand)" }}>
            {dados.codigo}
          </span>
          <button className="vx-btn vx-btn-sm" onClick={() => copiar(dados.codigo, "Código")}>
            <Copy size={13} /> Copiar
          </button>
        </div>

        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 10, minHeight: 44 }}
          onClick={() => copiar(link, "Link de convite")}>
          {dados.recompensas?.vendedor ? "Copiar link para profissionais" : "Copiar link de convite"}
        </button>
        {indicaEmpresa && dados.recompensas?.vendedor && (
          <button className="vx-btn vx-btn-block" style={{ marginTop: 8, minHeight: 44 }}
            onClick={() => copiar(linkEmpresa, "Link para empresas")}>
            Copiar link para empresas
          </button>
        )}
        {prof && dados.recompensas?.vendedor && (
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
            {prof.qualificados} {prof.qualificados === 1 ? "profissional indicado completou" : "profissionais indicados completaram"} o perfil.
            Faltam {prof.faltam} para o próximo bônus.
          </p>
        )}

        <hr className="vx-sep" />
        <div className="vx-grid vx-g2">
          <div>
            <div className="vx-eyebrow">Já recebido</div>
            <div className="vx-disp vx-mono" style={{ fontSize: 22, color: "var(--brand)" }}>{money(dados.totalGanho)}</div>
          </div>
          <div>
            <div className="vx-eyebrow">Aguardando liberação</div>
            <div className="vx-disp vx-mono" style={{ fontSize: 22, color: "var(--amber)" }}>{money(dados.totalPendente)}</div>
          </div>
        </div>
      </div>

      <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 16, marginBottom: 10 }}>Quanto vale cada indicação</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(dados.recompensas).map(([papel, r]) => (
            <div key={papel} className="vx-row" style={{ fontSize: 13.5 }}>
              <div>
                <b>{PAPEL[papel] || papel}</b>
                <div className="vx-mut" style={{ fontSize: 12 }}>
                  {r.descricao || `Liberado após ${dados.gatilhos[papel]}`}
                </div>
              </div>
              <b className="vx-mono" style={{ color: "var(--brand)" }}>{money(r.valor)}{r.percentual ? ` + ${Math.round(r.percentual * 100)}%` : ""}</b>
            </div>
          ))}
        </div>
        <p className="vx-mut" style={{ fontSize: 12, marginTop: 14 }}>
          {dados.recompensas?.vendedor
            ? "Cadastro sozinho não gera recompensa: a empresa precisa ter o cadastro aprovado, e o profissional precisa completar o perfil. Cada recompensa é paga uma única vez."
            : "A recompensa não é paga por cadastro. Ela entra quando quem você indicou contrata um plano elegível e o pagamento é confirmado. Cadastro sem pagamento não gera comissão."}
        </p>
      </div>

      <h3 className="vx-disp" style={{ fontSize: 16, margin: "0 0 10px" }}>
        Suas indicações {dados.indicacoes.length > 0 && `(${dados.indicacoes.length})`}
      </h3>

      {dados.indicacoes.length === 0 ? (
        <div className="vx-card vx-mut" style={{ padding: 20, fontSize: 13.5, textAlign: "center" }}>
          Ninguém se cadastrou com seu código ainda.
        </div>
      ) : (
        <div className="vx-grid">
          {dados.indicacoes.map((i, idx) => {
            const pago = i.status === "pago" || i.status === "qualificada";
            return (
              <div key={idx} className="vx-card vx-row" style={{ padding: 14 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  {pago
                    ? <CheckCircle2 size={17} color="var(--brand)" style={{ flex: "none" }} />
                    : <Clock size={17} color="var(--amber)" style={{ flex: "none" }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{i.contato}</div>
                    <div className="vx-mut" style={{ fontSize: 11.5 }}>
                      {PAPEL[i.papel] || i.papel} · {dataCurta(i.criadoEm)}
                    </div>
                  </div>
                </div>
                <span className={"vx-badge " + (pago ? "vx-badge-brand" : "vx-badge-amber")}>
                  {i.status === "qualificada" ? "Perfil completo" : pago ? money(i.valor) : "Pendente"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
