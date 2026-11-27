import { useEffect, useState } from "react";
import { Phone, Building2, Users, BarChart3, Clock, PhoneCall, PhoneOff, Settings, Shield } from "lucide-react";
import { api } from "../../lib/api.js";
import { Vazio } from "../ui.jsx";

function fmt(seg) {
  if (!seg) return "0min";
  const m = Math.round(seg / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

function Card({ label, valor, sub, Icon }) {
  return (
    <div className="vx-card" style={{ padding: 16 }}>
      <div className="vx-row" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="vx-mut" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
          <div className="vx-disp vx-mono" style={{ fontSize: 22 }}>{valor}</div>
          {sub && <div className="vx-mut" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
        </div>
        {Icon && <Icon size={20} className="vx-mut" />}
      </div>
    </div>
  );
}

export default function TelefoniaAdmin({ aviso }) {
  const [dados, setDados] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [aba, setAba] = useState("resumo");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api("/voice/admin/telefonia/resumo").then(setDados);
    api("/voice/admin/telefonia/config").then(setCfg);
  }, []);

  const salvarConfig = async () => {
    setSalvando(true);
    const r = await api("/voice/admin/telefonia/config", cfg);
    setSalvando(false);
    if (r?.ok) aviso("Configuração salva.");
    else aviso(r?.error || "Erro ao salvar.");
  };

  if (!dados) return <div className="vx-spinner" />;

  const abas = [
    { key: "resumo", label: "Resumo" },
    { key: "empresas", label: "Por empresa" },
    { key: "profissionais", label: "Por profissional" },
    { key: "campanhas", label: "Por campanha" },
    { key: "config", label: "Configurações" },
  ];

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        {abas.map((a) => (
          <button key={a.key} className={`vx-btn vx-btn-sm ${aba === a.key ? "vx-btn-primary" : ""}`} onClick={() => setAba(a.key)}>{a.label}</button>
        ))}
      </div>

      {aba === "resumo" && (
        <>
          <h3 className="vx-disp" style={{ fontSize: 15, marginBottom: 12 }}>Hoje</h3>
          <div className="vx-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
            <Card label="Ligações" valor={dados.diario.ligacoes} Icon={PhoneCall} />
            <Card label="Atendidas" valor={dados.diario.atendidas || 0} sub={dados.diario.ligacoes ? `${Math.round(((dados.diario.atendidas || 0) / dados.diario.ligacoes) * 100)}%` : "—"} Icon={Phone} />
            <Card label="Minutos" valor={dados.diario.minutos} Icon={Clock} />
            <Card label="Sessões ativas" valor={dados.sessoesAtivas} Icon={Users} />
          </div>

          <h3 className="vx-disp" style={{ fontSize: 15, marginBottom: 12 }}>Mês atual</h3>
          <div className="vx-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
            <Card label="Ligações" valor={dados.mensal.ligacoes} Icon={PhoneCall} />
            <Card label="Atendidas" valor={dados.mensal.atendidas || 0} sub={dados.mensal.ligacoes ? `${Math.round(((dados.mensal.atendidas || 0) / dados.mensal.ligacoes) * 100)}%` : "—"} Icon={Phone} />
            <Card label="Minutos" valor={dados.mensal.minutos} Icon={Clock} />
            <Card label="Empresas habilitadas" valor={dados.empresasHabilitadas} Icon={Building2} />
          </div>

          {dados.custoMensal.custo > 0 && (
            <div className="vx-card" style={{ padding: 16, marginBottom: 20 }}>
              <div className="vx-mut" style={{ fontSize: 12, marginBottom: 4 }}>Custo operadora (mês)</div>
              <div className="vx-disp vx-mono" style={{ fontSize: 20 }}>R$ {(dados.custoMensal.custo || 0).toFixed(2)}</div>
            </div>
          )}

          <div className="vx-card" style={{ padding: 16 }}>
            <div className="vx-row" style={{ marginBottom: 8 }}>
              <Shield size={16} className="vx-mut" />
              <span className="vx-mut" style={{ fontSize: 13 }}>Status da telefonia</span>
            </div>
            <div style={{ fontSize: 14 }}>
              <span style={{ color: "var(--amber)" }}>Desabilitada</span> — aguardando infraestrutura e operadora SIP.
              Proteções técnicas contra fraude e abuso estão ativas (bloqueio de prefixos 0900/0300, DNC, anti-duplicação, limite de canais simultâneos).
            </div>
          </div>
        </>
      )}

      {aba === "empresas" && (
        !dados.porEmpresa.length
          ? <Vazio titulo="Sem dados" texto="Nenhuma ligação registrada neste mês." />
          : (
            <div className="vx-card" style={{ overflow: "auto" }}>
              <table className="vx-table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Empresa</th>
                    <th>Ligações</th>
                    <th>Atendidas</th>
                    <th>Minutos</th>
                    <th>Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porEmpresa.map((e) => (
                    <tr key={e.companyId}>
                      <td>{e.empresa || e.companyId}</td>
                      <td style={{ textAlign: "center" }}>{e.ligacoes}</td>
                      <td style={{ textAlign: "center" }}>{e.atendidas || 0}</td>
                      <td style={{ textAlign: "center" }}>{fmt(e.segundos)}</td>
                      <td style={{ textAlign: "center" }}>{e.ligacoes ? `${Math.round(((e.atendidas || 0) / e.ligacoes) * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}

      {aba === "profissionais" && (
        !dados.porProfissional.length
          ? <Vazio titulo="Sem dados" texto="Nenhuma ligação registrada neste mês." />
          : (
            <div className="vx-card" style={{ overflow: "auto" }}>
              <table className="vx-table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Profissional</th>
                    <th style={{ textAlign: "left" }}>Empresa</th>
                    <th>Ligações</th>
                    <th>Atendidas</th>
                    <th>Minutos</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porProfissional.map((p) => (
                    <tr key={p.sellerId}>
                      <td>{p.profissional || p.sellerId}</td>
                      <td>{p.empresa || "—"}</td>
                      <td style={{ textAlign: "center" }}>{p.ligacoes}</td>
                      <td style={{ textAlign: "center" }}>{p.atendidas || 0}</td>
                      <td style={{ textAlign: "center" }}>{fmt(p.segundos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}

      {aba === "campanhas" && (
        !dados.porCampanha.length
          ? <Vazio titulo="Sem dados" texto="Nenhuma ligação vinculada a campanha neste mês." />
          : (
            <div className="vx-card" style={{ overflow: "auto" }}>
              <table className="vx-table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Campanha</th>
                    <th style={{ textAlign: "left" }}>Empresa</th>
                    <th>Ligações</th>
                    <th>Atendidas</th>
                    <th>Minutos</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porCampanha.map((c) => (
                    <tr key={c.campaignId}>
                      <td>{c.campanha || c.campaignId}</td>
                      <td>{c.empresa || "—"}</td>
                      <td style={{ textAlign: "center" }}>{c.ligacoes}</td>
                      <td style={{ textAlign: "center" }}>{c.atendidas || 0}</td>
                      <td style={{ textAlign: "center" }}>{fmt(c.segundos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}

      {aba === "config" && cfg && (
        <div className="vx-card" style={{ padding: 20, maxWidth: 500 }}>
          <h3 className="vx-disp" style={{ fontSize: 15, marginBottom: 16 }}>Configurações globais</h3>

          <label className="vx-row" style={{ marginBottom: 8, gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={!!cfg.telefoniaReal} onChange={(e) => setCfg({ ...cfg, telefoniaReal: e.target.checked ? 1 : 0 })} />
            <span style={{ fontSize: 14 }}>Liberar telefonia real (operadora SIP)</span>
          </label>
          <div className="vx-mut" style={{ fontSize: 12, marginBottom: 16 }}>
            Só ative depois de testar a operadora. Desativada, ligações pelo provedor SIP são recusadas.
          </div>

          <label className="vx-row" style={{ marginBottom: 16, gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={!!cfg.limitesAtivos} onChange={(e) => setCfg({ ...cfg, limitesAtivos: e.target.checked ? 1 : 0 })} />
            <span style={{ fontSize: 14 }}>Ativar limites comerciais</span>
          </label>

          <div className="vx-mut" style={{ fontSize: 12, marginBottom: 12 }}>
            Limites desativados = sem restrição de minutos ou ligações por empresa/profissional. Proteções técnicas (fraude, abuso, prefixos bloqueados) permanecem sempre ativas.
          </div>

          {!!cfg.limitesAtivos && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: 13 }}>
                Max ligações/dia (global, 0 = ilimitado)
                <input className="vx-input" type="number" min="0" value={cfg.maxChamadasDiaGlobal || 0} onChange={(e) => setCfg({ ...cfg, maxChamadasDiaGlobal: parseInt(e.target.value) || 0 })} style={{ marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 13 }}>
                Max minutos/mês (global, 0 = ilimitado)
                <input className="vx-input" type="number" min="0" value={cfg.maxMinutosMesGlobal || 0} onChange={(e) => setCfg({ ...cfg, maxMinutosMesGlobal: parseInt(e.target.value) || 0 })} style={{ marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 13 }}>
                Max canais simultâneos (global)
                <input className="vx-input" type="number" min="1" value={cfg.maxSimultaneosGlobal || 10} onChange={(e) => setCfg({ ...cfg, maxSimultaneosGlobal: parseInt(e.target.value) || 10 })} style={{ marginTop: 4 }} />
              </label>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div className="vx-row" style={{ gap: 8 }}>
              <Shield size={14} className="vx-mut" />
              <span className="vx-mut" style={{ fontSize: 12 }}>Proteções técnicas sempre ativas</span>
            </div>
            <ul className="vx-mut" style={{ fontSize: 12, paddingLeft: 18, margin: "4px 0 16px" }}>
              <li>Bloqueio de prefixos 0900/0300</li>
              <li>Lista DNC (não ligar)</li>
              <li>Anti-duplicação (30s entre ligações)</li>
              <li>Limite de canais simultâneos por empresa</li>
            </ul>
          </div>

          <button className="vx-btn vx-btn-primary" onClick={salvarConfig} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      )}
    </div>
  );
}
