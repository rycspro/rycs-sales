import { useMemo, useState } from "react";
import {
  Award, CalendarCheck, CheckCircle2, Clock3, Handshake, Presentation,
  ShieldCheck, Target, TrendingUp, Wallet, XCircle, Zap,
} from "lucide-react";
import { money } from "../../lib/utils.js";
import { Stat, Medidor, Donut } from "../ui.jsx";
import { desempenhoVendedor, potencialDeGanhos } from "../../../shared/desempenhoVendedor.js";
import { ler as lerArmazenamento, gravar as gravarArmazenamento } from "../../lib/armazenamento.js";

const NIVEIS = { starter: "Starter", pro: "Pro", elite: "Elite" };

export default function PainelVendedor({ eu, db, abrirEmpresas }) {
  const [meta, setMeta] = useState(() => {
    return Number(lerArmazenamento("rycs:meta", 0)) || 0;
  });

  const d = useMemo(() => desempenhoVendedor({
    submissions: db.submissions || [], leads: db.leads || [],
    sellerId: eu.id, seller: eu, metaMensal: meta,
  }), [db, eu, meta]);

  const potencial = useMemo(() => potencialDeGanhos({
    companies: db.companies || [], campaigns: db.campaigns || [],
    seller: eu, aplicacoes: eu.aplicacoes || {},
  }), [db, eu]);

  const salvarMeta = (v) => {
    const valor = Math.max(0, Number(String(v).replace(",", ".")) || 0);
    setMeta(valor);
    gravarArmazenamento("rycs:meta", valor);
  };

  const { financeiro: f, performance: p, comercial: c, rycs: r } = d;

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Seu desempenho</div>
          <h1 className="vx-disp">Olá, {String(eu.nome || "").split(" ")[0]}</h1>
          <p>Todos os números vêm das suas ações registradas na plataforma.</p>
        </div>
        <span className="vx-chip vx-mono"><Award size={13} /> {NIVEIS[r.nivel] || r.nivel} · score {r.score}</span>
      </div>

      {/* Potencial de ganhos: a primeira pergunta de quem abre o app é
          "quanto dá para ganhar agora", não "quanto tenho em saldo". */}
      <div className="vx-card" style={{ padding: 20, marginTop: 4, borderLeft: "3px solid var(--brand)" }}>
        <div className="vx-eyebrow"><Zap size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Potencial de ganhos disponível</div>
        <div className="vx-disp vx-mono" style={{ fontSize: 34, color: "var(--brand)", margin: "6px 0 2px" }}>
          {money(potencial.total)}
        </div>
        {potencial.motivo ? (
          <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>{potencial.motivo}</p>
        ) : (
          <>
            <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 10px" }}>
              em caixa nas {potencial.empresas.length} empresa(s) onde você está aprovado, pronto para virar tarefa sua.
            </p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {potencial.empresas.slice(0, 4).map((e) => (
                <span key={e.companyId} className="vx-chip">
                  {e.empresa} · até {money(e.maiorTarefa)}/ação
                </span>
              ))}
            </div>
            {abrirEmpresas && (
              <button className="vx-btn vx-btn-primary" style={{ marginTop: 14 }} onClick={abrirEmpresas}>
                Ver oportunidades
              </button>
            )}
          </>
        )}
        <div className="vx-chart-source">
          Considera apenas empresas em que você foi aprovado e que têm caixa disponível agora.
        </div>
      </div>

      {/* ---------------------------------------------------- GANHOS ---- */}
      <h2 className="vx-disp" style={{ fontSize: 17, margin: "22px 0 10px" }}>Ganhos</h2>
      <div className="vx-grid vx-g4">
        <Stat label="Hoje" value={money(f.hoje)} Icon={TrendingUp} tone="brand" />
        <Stat label="Últimos 7 dias" value={money(f.semana)} Icon={TrendingUp} tone="brand" />
        <Stat label="Este mês" value={money(f.mes)} Icon={TrendingUp} tone="brand" />
        <Stat label="Total em ações aprovadas" value={money(f.historico)} Icon={Award} tone="muted" />
      </div>
      <div className="vx-grid vx-g4" style={{ marginTop: 12 }}>
        <Stat label="Disponível para saque" value={money(f.disponivel)} Icon={Wallet} tone="brand" />
        <Stat label="Em auditoria" value={money(f.emAuditoria)} Icon={ShieldCheck} tone="amber" />
        <Stat label="Pendente" value={money(f.pendente)} Icon={Clock3} tone="amber" />
        <Stat label="Total sacado" value={money(f.sacado)} Icon={Wallet} tone="muted" />
      </div>
      <div className="vx-chart-source">
        Ganhos por período somam as ações aprovadas no recorte. Saldo, pendente e sacado vêm do motor
        financeiro — por isso podem incluir movimentações anteriores ao histórico de ações listado aqui.
      </div>

      {/* ----------------------------------------------- PERFORMANCE ---- */}
      <h2 className="vx-disp" style={{ fontSize: 17, margin: "22px 0 10px" }}>Performance</h2>
      <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-row" style={{ flexWrap: "wrap", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="vx-eyebrow"><Target size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Meta do mês</div>
            <div className="vx-disp vx-mono" style={{ fontSize: 22, marginTop: 3 }}>
              {money(f.mes)}{p.metaMensal > 0 && <span className="vx-mut" style={{ fontSize: 14 }}> / {money(p.metaMensal)}</span>}
            </div>
          </div>
          <label style={{ width: 160 }}>
            <div className="vx-label">Definir meta (R$)</div>
            <input className="vx-input vx-mono" inputMode="decimal" value={p.metaMensal || ""}
              placeholder="0" onChange={(e) => salvarMeta(e.target.value)} />
          </label>
        </div>
        {p.progressoMeta !== null ? (
          <div style={{ marginTop: 12 }}>
            <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 4 }}>
              <span className="vx-mut">Progresso</span><b>{p.progressoMeta}%</b>
            </div>
            <Medidor value={p.progressoMeta} tone={p.progressoMeta >= 80 ? "brand" : p.progressoMeta >= 40 ? "amber" : "red"} />
          </div>
        ) : (
          <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
            Defina uma meta para acompanhar o progresso. Ela fica só no seu aparelho.
          </p>
        )}
      </div>

      <div className="vx-grid vx-g4" style={{ marginTop: 12 }}>
        <Stat label="Ações enviadas" value={p.executadas} Icon={Presentation} tone="muted" mono />
        <Stat label="Aprovadas" value={p.aprovadas} Icon={CheckCircle2} tone="brand" mono />
        <Stat label="Em auditoria" value={p.emAuditoria} Icon={ShieldCheck} tone="amber" mono />
        <Stat label="Não aprovadas" value={p.recusadas} Icon={XCircle} tone="red" mono />
      </div>

      {p.taxaAprovacao !== null && (
        <div className="vx-card" style={{ padding: 16, marginTop: 12 }}>
          <div className="vx-row" style={{ fontSize: 13, marginBottom: 5 }}>
            <span className="vx-mut">Taxa de aprovação</span>
            <b className="vx-mono">{p.taxaAprovacao}%</b>
          </div>
          <Medidor value={p.taxaAprovacao} tone={p.taxaAprovacao >= 70 ? "brand" : p.taxaAprovacao >= 50 ? "amber" : "red"} />
          <div className="vx-chart-source">
            Calculada só sobre ações já decididas. O que está em auditoria não entra na conta.
          </div>
        </div>
      )}

      {/* ------------------------------------------------- COMERCIAL ---- */}
      <h2 className="vx-disp" style={{ fontSize: 17, margin: "22px 0 10px" }}>Comercial</h2>
      <div className="vx-grid vx-g2">
        <Donut
          titulo="Funil das suas ações aprovadas"
          itens={[
            { nome: "Reuniões agendadas", valor: c.agendadas },
            { nome: "Reuniões realizadas", valor: c.realizadas },
            { nome: "Vendas", valor: c.vendas },
          ]}
        />
        <div className="vx-card" style={{ padding: 18 }}>
          <div className="vx-grid vx-g2" style={{ fontSize: 12.5 }}>
            <div><span className="vx-mut">Leads na sua carteira</span><div className="vx-disp vx-mono" style={{ fontSize: 20 }}>{c.leadsTotais}</div></div>
            <div><span className="vx-mut">Leads trabalhados</span><div className="vx-disp vx-mono" style={{ fontSize: 20 }}>{c.leadsTrabalhados}</div></div>
          </div>
          <hr className="vx-sep" />
          <div className="vx-grid vx-g2" style={{ fontSize: 12.5 }}>
            <div>
              <span className="vx-mut">Comparecimento</span>
              <div className="vx-disp vx-mono" style={{ fontSize: 20 }}>{c.comparecimento === null ? "—" : `${c.comparecimento}%`}</div>
            </div>
            <div>
              <span className="vx-mut">Conversão até a venda</span>
              <div className="vx-disp vx-mono" style={{ fontSize: 20, color: "var(--brand)" }}>{c.conversao === null ? "—" : `${c.conversao}%`}</div>
            </div>
          </div>
          <div className="vx-chart-source">
            Sem reunião agendada aprovada ainda não há taxa para calcular — por isso o traço em vez de zero.
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------ RYCS ---- */}
      <h2 className="vx-disp" style={{ fontSize: 17, margin: "22px 0 10px" }}>RYCS</h2>
      <div className="vx-grid vx-g3">
        <Stat label="RYCS Score" value={r.score} Icon={Award} tone={r.score >= 70 ? "brand" : r.score >= 50 ? "amber" : "red"} mono />
        <Stat label="Nível" value={NIVEIS[r.nivel] || r.nivel} Icon={TrendingUp} tone="indigo" mono={false} />
        <Stat label="Score da triagem" value={r.scoreTriagem ? `${r.scoreTriagem}%` : "—"} Icon={CalendarCheck} tone="muted" />
      </div>

      <div className="vx-card" style={{ padding: 16, marginTop: 12 }}>
        <div className="vx-eyebrow"><Handshake size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Próximas ações</div>
        <ul className="vx-mut" style={{ fontSize: 13, paddingLeft: 18, margin: "8px 0 0" }}>
          {p.emAuditoria > 0 && <li>{p.emAuditoria} ação(ões) em auditoria — acompanhe o resultado em Meus envios.</li>}
          {c.leadsTotais > c.leadsTrabalhados && <li>{c.leadsTotais - c.leadsTrabalhados} lead(s) ainda sem primeiro contato.</li>}
          {potencial.total > 0 && <li>{money(potencial.total)} disponíveis em empresas onde você já está aprovado.</li>}
          {r.score < 70 && <li>Complete trilhas da Academy para elevar seu RYCS Score.</li>}
          {!p.executadas && <li>Envie sua primeira ação para começar a construir seu histórico.</li>}
        </ul>
      </div>
    </div>
  );
}
