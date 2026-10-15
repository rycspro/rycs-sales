import { useState, useEffect } from "react";
import { ArrowRight, Sparkles, Building2, Target, DollarSign } from "lucide-react";
import { api } from "../../lib/api.js";
import { DIMENSOES } from "../../../shared/discQuiz.js";
import { money } from "../../lib/utils.js";

const OBJETIVO_LABEL = {
  leads: "Leads",
  reunioes: "Reuniões",
  visitas: "Porta a porta",
  vendas: "Vendas",
  completa: "Operação completa",
};

const TAREFA_LABEL = {
  agendamento: "Agendamento",
  venda: "Venda",
  visita: "Visita",
  lead: "Lead",
};

function valorPrincipalTarefa(tarefas) {
  if (!tarefas || typeof tarefas !== "object") return null;
  const entries = Object.entries(tarefas).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return null;
  const [tipo, valor] = entries[0];
  return { tipo, valor: Number(valor), label: TAREFA_LABEL[tipo] || tipo };
}

function CardCampanha({ c, empresaNome, empresaLogo, empresaCor }) {
  const tarefa = valorPrincipalTarefa(c.tarefas);

  return (
    <div className="vx-onb-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          {empresaLogo ? (
            <img src={empresaLogo} alt="" style={{
              width: 44, height: 44, borderRadius: 10, objectFit: "cover", flex: "none",
              border: "1px solid var(--border)",
            }} />
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: 10, flex: "none",
              background: empresaCor || "var(--brand)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Building2 size={20} color="#fff" />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{empresaNome}</div>
            {c.titulo && (
              <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.titulo}
              </div>
            )}
          </div>
        </div>

        {c.orcamento > 0 && (
          <div style={{ textAlign: "right", flex: "none" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--brand)", fontFamily: "var(--mono, monospace)" }}>
              {money(c.orcamento)}
            </div>
            <div className="vx-mut" style={{ fontSize: 11, marginTop: 2 }}>valor da campanha</div>
          </div>
        )}
      </div>

      {c.descricao && (
        <div style={{ padding: "0 20px 14px", fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-secondary, var(--muted))" }}>
          {c.descricao.length > 160 ? c.descricao.slice(0, 160) + "…" : c.descricao}
        </div>
      )}

      <div style={{
        padding: "12px 20px", borderTop: "1px solid var(--border-light, var(--border))",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        background: "var(--surface-1, var(--bg-secondary, #f8fafc))",
      }}>
        {c.objetivo && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 12px", borderRadius: 20,
            background: "var(--brand-50, rgba(59,130,246,.1))",
            color: "var(--brand)", fontSize: 12.5, fontWeight: 600,
          }}>
            <Target size={13} />
            {OBJETIVO_LABEL[c.objetivo] || c.objetivo}
          </span>
        )}
        {tarefa && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 12px", borderRadius: 20,
            background: "var(--green-50, rgba(34,197,94,.1))",
            color: "var(--green, #16a34a)", fontSize: 12.5, fontWeight: 600,
          }}>
            <DollarSign size={13} />
            {money(tarefa.valor)} / {tarefa.label.toLowerCase()}
          </span>
        )}
        {c.vagas > 0 && (
          <span className="vx-mut" style={{ fontSize: 12, marginLeft: "auto" }}>
            {c.vagas} vaga{c.vagas > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export default function OnbOportunidades({ aviso, disc, aoConcluir }) {
  const [empresas, setEmpresas] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/onboarding-pro/oportunidades").then((r) => {
      if (r && !r.error) setEmpresas(r.empresas || []);
      else aviso?.(r?.error || "Erro ao carregar oportunidades");
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="vx-onb-estado">Carregando oportunidades…</div>;

  const totalCampanhas = empresas?.reduce((a, e) => a + e.campanhas.length, 0) || 0;

  return (
    <div className="vx-fade" style={{ maxWidth: 720, margin: "0 auto" }}>
      {disc?.predominante && (
        <div className="vx-onb-card" style={{ padding: 20, marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", flex: "none",
            background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={20} color="var(--brand)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: DIMENSOES[disc.predominante]?.cor }}>
              {disc.label}
            </div>
            <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2 }}>
              Perfil comercial definido. Veja as campanhas que combinam com você.
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div className="vx-onb-eyebrow">Passo 3 de 3</div>
        <h1 className="vx-disp" style={{ fontSize: 26, marginTop: 8 }}>Oportunidades disponíveis</h1>
        <p className="vx-mut" style={{ fontSize: 14, marginTop: 6 }}>
          {totalCampanhas
            ? `${totalCampanhas} campanha${totalCampanhas > 1 ? "s" : ""} ativa${totalCampanhas > 1 ? "s" : ""} para você.`
            : "Nenhuma campanha ativa no momento. Novas oportunidades aparecerão aqui."}
        </p>
      </div>

      {empresas?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {empresas.flatMap((emp) =>
            emp.campanhas.map((c) => (
              <CardCampanha
                key={c.id}
                c={c}
                empresaNome={emp.nome}
                empresaLogo={emp.logo}
                empresaCor={emp.cor}
              />
            ))
          )}
        </div>
      )}

      <button className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" style={{ marginTop: 24 }}
        onClick={() => aoConcluir?.()}>
        Entrar na plataforma <ArrowRight size={16} />
      </button>
    </div>
  );
}
