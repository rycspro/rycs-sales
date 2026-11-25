import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search, MapPin, Phone, Globe, Star, Plus, Loader2, ChevronRight,
  Building2, FolderOpen, List, Pencil, Trash2,
  ListPlus, X, Clock, FileText, Store,
  Megaphone, Link2, Unlink, RefreshCw,
  Wallet, Users,
  Utensils, HeartPulse, Dumbbell,
  Building, Scissors, ShoppingBag, Cpu,
} from "lucide-react";
import { api } from "../../lib/api.js";

/* ── helpers ────────────────────────────────────────────────────────────── */
async function apiPatch(path, body) {
  const res = await fetch(`/api${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
  return res.json();
}
async function apiDelete(path) {
  const res = await fetch(`/api${path}`, { method: "DELETE", credentials: "include" });
  return res.json();
}
async function carregarTodasListas() {
  const r = await api("/loja-leads/pastas");
  const pastas = r?.pastas || [];
  const todas = [];
  for (const p of pastas) {
    const lr = await api(`/loja-leads/listas/${p.id}`);
    for (const l of (lr?.listas || [])) todas.push({ ...l, pastaNome: p.nome, pastaId: p.id });
  }
  return todas;
}
const money = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ── Categorias (8) ─────────────────────────────────────────────────────── */
const CATEGORIAS = [
  { key: "restaurantes", label: "Restaurantes", Icon: Utensils },
  { key: "clinicas", label: "Clínicas odontológicas", Icon: HeartPulse },
  { key: "imobiliarias", label: "Imobiliárias", Icon: Building2 },
  { key: "academias", label: "Academias", Icon: Dumbbell },
  { key: "escritorios", label: "Escritórios", Icon: Building },
  { key: "saloes", label: "Salões de beleza", Icon: Scissors },
  { key: "comercios", label: "Comércios", Icon: ShoppingBag },
  { key: "tecnologia", label: "Tecnologia", Icon: Cpu },
];

/* ── 5 grupos de informações (27 campos) ──────────────────────────────── */
const GRUPOS = [
  { key: "empresariais", label: "Dados empresariais", Icon: Building2,
    campos: ["Nome da empresa", "Razão social", "Nome fantasia", "CNPJ", "Segmento / CNAE", "Porte da empresa"] },
  { key: "contatos", label: "Contatos", Icon: Users,
    campos: ["Telefone fixo", "Celular", "WhatsApp", "E-mail comercial", "Nome do responsável", "Cargo do responsável"] },
  { key: "localizacao", label: "Localização", Icon: MapPin,
    campos: ["Endereço completo", "Cidade e estado", "CEP", "Geolocalização"] },
  { key: "digital", label: "Presença digital", Icon: Globe,
    campos: ["Website", "Instagram", "Facebook", "LinkedIn", "Google Maps"] },
  { key: "complementares", label: "Informações complementares", Icon: FileText,
    campos: ["Avaliação no Google", "Quantidade de avaliações", "Horário de funcionamento", "Data de abertura", "Situação cadastral", "Capital social"] },
];
const ALL_CAMPOS = GRUPOS.flatMap((g) => g.campos);
const QTDS = [25, 50, 100, 250, 500, 1000];

const SEGMENTOS = [
  "Restaurantes", "Clínicas odontológicas", "Imobiliárias", "Academias",
  "Escritórios", "Salões de beleza", "Comércios", "Tecnologia",
  "Clínicas médicas", "Consultórios", "Farmácias", "Pet shops",
  "Escolas e cursos", "Contabilidade", "Advocacia", "Arquitetura e engenharia",
  "Agências de marketing", "Agências de viagens", "Hotéis e pousadas",
  "Oficinas mecânicas", "Autopeças", "Construtoras", "Supermercados",
  "Padarias e confeitarias", "Óticas", "Floriculturas", "Estúdios de fotografia",
  "Academias de artes marciais", "Estúdios de pilates", "Clínicas veterinárias",
];

const ESTADOS_BR = [
  "São Paulo, SP", "Rio de Janeiro, RJ", "Minas Gerais, MG", "Bahia, BA",
  "Paraná, PR", "Rio Grande do Sul, RS", "Santa Catarina, SC", "Pernambuco, PE",
  "Ceará, CE", "Goiás, GO", "Pará, PA", "Maranhão, MA", "Amazonas, AM",
  "Espírito Santo, ES", "Mato Grosso, MT", "Mato Grosso do Sul, MS",
  "Distrito Federal, DF", "Paraíba, PB", "Rio Grande do Norte, RN",
  "Alagoas, AL", "Piauí, PI", "Sergipe, SE", "Rondônia, RO", "Tocantins, TO",
  "Acre, AC", "Amapá, AP", "Roraima, RR",
];

/* ═══ Componente principal ════════════════════════════════════════════════ */
export default function LojaLeads({ aviso, role: roleProp }) {
  const [aba, setAba] = useState(0);
  const [ciclo, setCiclo] = useState(null);
  const [consumo, setConsumo] = useState(null);
  const [listas, setListas] = useState([]);
  const [precos, setPrecos] = useState([]);
  const [detectedRole, setDetectedRole] = useState(null);
  const role = roleProp || detectedRole || "empresa";
  const isEmpresa = role === "empresa";

  useEffect(() => {
    if (!roleProp) api("/auth/me").then((r) => { if (r?.role) setDetectedRole(r.role); });
    api("/loja-leads/ciclo").then(setCiclo);
    api("/loja-leads/consumo").then(setConsumo);
    api("/loja-leads/precos").then((r) => setPrecos(r?.precos || []));
    carregarTodasListas().then(setListas);
  }, []);

  const recarregarListas = useCallback(async () => { setListas(await carregarTodasListas()); }, []);
  const recarregarCiclo = useCallback(async () => {
    const [c, co] = await Promise.all([api("/loja-leads/ciclo"), api("/loja-leads/consumo")]);
    setCiclo(c); setConsumo(co);
  }, []);

  const precoUnitario = precos.length > 0 ? precos[0].valorUnitario : 0;
  const totalLeads = consumo?.totalRevelados || ciclo?.totalContatos || 0;
  const totalListas = listas.length;
  const consumoValor = ciclo?.valorTotal || 0;
  const proxCobranca = ciclo?.fim ? new Date(ciclo.fim).toLocaleDateString("pt-BR") : "—";

  const ABAS = [
    { label: "Encontrar Leads", Icon: Search },
    { label: "Meus Contatos", Icon: Users },
    { label: "Minhas Listas", Icon: FolderOpen },
    { label: "Consumo", Icon: FileText },
  ];

  return (
    <div className="vx-fade">
      {/* Header */}
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Loja de Leads</div>
          <h1 className="vx-disp">
            {isEmpresa
              ? "Encontre novos clientes e expanda suas oportunidades comerciais."
              : "Construa sua carteira de contatos e encontre novas oportunidades."}
          </h1>
        </div>
      </div>

      {/* Banner */}
      <div className="vx-notice" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, background: "var(--brand-50)", borderColor: "var(--brand-100)" }}>
        <Clock size={20} style={{ color: "var(--brand)", flexShrink: 0 }} />
        <div>
          <strong>Use agora. Pague em 30 dias.</strong>
          <div className="vx-mut" style={{ fontSize: 12.5 }}>
            Encontre e adquira seus leads sem pagamento antecipado. Sua primeira cobrança acontece 30 dias após o primeiro uso.
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="vx-grid vx-g4" style={{ marginBottom: 16 }}>
        {[
          ["Leads adquiridos", totalLeads, Users],
          ["Minhas listas", totalListas, FolderOpen],
          ["Consumo atual", money(consumoValor), Wallet],
          ["Próxima cobrança", proxCobranca, Clock],
        ].map(([label, val, Icon]) => (
          <div key={label} className="vx-glass-panel vx-tile">
            <div className="vx-tile-top">
              <span>{label}</span>
              <Icon size={17} strokeWidth={1.7} />
            </div>
            <div className="vx-tile-val">{val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="vx-seg" style={{ marginBottom: 0, borderRadius: "var(--radius-pill) var(--radius-pill) 0 0" }}>
        {ABAS.map(({ label, Icon }, i) => (
          <button key={i} data-on={aba === i ? "1" : "0"} onClick={() => setAba(i)}>
            <Icon size={14} style={{ marginRight: 4 }} /> {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="vx-card" style={{ borderRadius: "0 var(--radius-md) var(--radius-md) var(--radius-md)", padding: 20, marginBottom: 20 }}>
        {aba === 0 && <AbaBuscar aviso={aviso} listas={listas} precoUnitario={precoUnitario} recarregarCiclo={recarregarCiclo} recarregarListas={recarregarListas} isEmpresa={isEmpresa} ciclo={ciclo} />}
        {aba === 1 && <AbaContatos aviso={aviso} listas={listas} />}
        {aba === 2 && <AbaListas aviso={aviso} isEmpresa={isEmpresa} recarregarListas={recarregarListas} />}
        {aba === 3 && <AbaConsumo ciclo={ciclo} />}
      </div>
    </div>
  );
}

/* ═══ ABA 0: Encontrar leads ═════════════════════════════════════════════ */
function AbaBuscar({ aviso, listas, precoUnitario, recarregarCiclo, recarregarListas, isEmpresa, ciclo }) {
  const [segmento, setSegmento] = useState("");
  const [pais, setPais] = useState("Brasil");
  const [regiao, setRegiao] = useState("");
  const [quantidade, setQuantidade] = useState(100);
  const [campos, setCampos] = useState(() => new Set());
  const [destino, setDestino] = useState("new");
  const [nomeLista, setNomeLista] = useState("");
  const [listaExistente, setListaExistente] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [feedback, setFeedback] = useState("");

  const valorEstimado = quantidade * precoUnitario;
  const listaFinal = destino === "new" ? nomeLista : (listas.find((l) => String(l.id) === listaExistente)?.nome || "");
  const podeEnviar = campos.size > 0 && segmento.trim() && regiao.trim();

  const toggleCampo = (c) => setCampos((prev) => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const toggleGrupo = (fs) => {
    setCampos((prev) => {
      const n = new Set(prev);
      const all = fs.every((f) => n.has(f));
      fs.forEach((f) => all ? n.delete(f) : n.add(f));
      return n;
    });
  };
  const toggleAll = () => setCampos((prev) => prev.size === ALL_CAMPOS.length ? new Set() : new Set(ALL_CAMPOS));

  const buscar = async () => {
    if (!podeEnviar) return;
    setOcupado(true);
    setFeedback("");
    const r = await api("/loja-leads/buscar", { texto: segmento.trim(), regiao: regiao.trim() });
    setOcupado(false);
    if (!r || r.error) { setFeedback(r?.error || "Erro ao buscar."); return aviso?.(r?.error || "Erro ao buscar."); }
    const n = r.contatos?.length || 0;
    setFeedback(n > 0 ? `${n} lead(s) encontrado(s).` : "Nenhum resultado encontrado para esta busca.");
    aviso?.(n > 0 ? `${n} lead(s) encontrado(s).` : "Nenhum resultado.");
    recarregarCiclo?.();
  };

  return (
    <>
      <div className="vx-disp" style={{ fontSize: 20, marginBottom: 4 }}>Encontre seus próximos clientes</div>
      <p className="vx-mut" style={{ margin: "0 0 16px", fontSize: 13 }}>Personalize sua busca e escolha quais informações deseja receber.</p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.3fr) minmax(250px, 1fr)", gap: 20, alignItems: "start" }} className="ll-layout">
        {/* ── Coluna principal ── */}
        <div>
          {/* Segmentos */}
          <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <span className="vx-label">SEGMENTOS POPULARES</span>
            <div className="vx-grid vx-g4 ll-categories" style={{ gap: 10 }}>
              {CATEGORIAS.map(({ key, label, Icon }) => (
                <button key={key} onClick={() => setSegmento(label)}
                  className={`vx-btn ${segmento === label ? "vx-btn-primary" : ""}`}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 80, fontSize: 12.5, textAlign: "center", padding: "10px 5px" }}>
                  <Icon size={22} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Configure sua busca */}
          <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <div className="vx-disp" style={{ fontSize: 17, marginBottom: 12 }}>Configure sua busca</div>
            <div className="vx-grid" style={{ gap: 12 }}>
              <label>
                <span className="vx-label">Segmento ou tipo de empresa</span>
                <select className="vx-input" value={segmento} onChange={(e) => setSegmento(e.target.value)}>
                  <option value="">Selecione o segmento...</option>
                  {SEGMENTOS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div className="vx-grid vx-g2" style={{ gap: 12 }}>
                <label>
                  <span className="vx-label">País</span>
                  <select className="vx-input" value={pais} onChange={(e) => setPais(e.target.value)}>
                    {["Brasil", "Estados Unidos", "Índia", "Portugal", "Reino Unido", "Outro"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label>
                  <span className="vx-label">Cidade ou região</span>
                  <select className="vx-input" value={regiao} onChange={(e) => setRegiao(e.target.value)}>
                    <option value="">Selecione a região...</option>
                    {ESTADOS_BR.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Quantidade */}
          <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <span className="vx-label">QUANTIDADE DE LEADS</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {QTDS.map((q) => (
                <button key={q} onClick={() => setQuantidade(q)}
                  className={`vx-btn ${quantidade === q ? "vx-btn-primary" : ""}`}
                  style={{ flex: 1, minWidth: 60 }}>
                  {q.toLocaleString("pt-BR")}
                </button>
              ))}
            </div>
          </div>

          {/* Informações desejadas */}
          <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <div className="vx-row" style={{ marginBottom: 12 }}>
              <div>
                <div className="vx-disp" style={{ fontSize: 17 }}>Informações desejadas</div>
                <span className="vx-mut" style={{ fontSize: 12 }}>{campos.size} de {ALL_CAMPOS.length} informações selecionadas</span>
              </div>
              <button className="vx-btn vx-btn-sm" onClick={toggleAll}>
                {campos.size === ALL_CAMPOS.length ? "Desmarcar tudo" : "Selecionar tudo"}
              </button>
            </div>
            <div className="vx-grid vx-g2 ll-groups" style={{ gap: 12 }}>
              {GRUPOS.map((g) => {
                const selCount = g.campos.filter((f) => campos.has(f)).length;
                const allSel = selCount === g.campos.length;
                return (
                  <div key={g.key} className="vx-card" style={{ padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                      <g.Icon size={18} style={{ color: "var(--brand)", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{g.label}</div>
                        <span className="vx-mut" style={{ fontSize: 11 }}>{selCount} de {g.campos.length} selecionadas</span>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, cursor: "pointer" }}>
                        <input type="checkbox" checked={allSel}
                          ref={(el) => { if (el) el.indeterminate = selCount > 0 && !allSel; }}
                          onChange={() => toggleGrupo(g.campos)}
                          style={{ accentColor: "var(--brand)", width: 16, height: 16 }} />
                        Todos
                      </label>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {g.campos.map((f) => (
                        <label key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" }}>
                          <input type="checkbox" checked={campos.has(f)} onChange={() => toggleCampo(f)}
                            style={{ accentColor: "var(--brand)", width: 16, height: 16, flexShrink: 0 }} />
                          {f}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="vx-chart-source">O preenchimento depende da disponibilidade das fontes de dados.</div>
          </div>

          {/* Organize seus leads */}
          <div>
            <div className="vx-disp" style={{ fontSize: 17, marginBottom: 4 }}>Organize seus leads</div>
            <p className="vx-mut" style={{ margin: "0 0 12px", fontSize: 13 }}>Escolha onde deseja armazenar os contatos adquiridos.</p>
            <div className="vx-grid vx-g2" style={{ gap: 12 }}>
              <label>
                <span className="vx-label">Destino</span>
                <select className="vx-input" value={destino} onChange={(e) => setDestino(e.target.value)}>
                  <option value="new">Criar nova lista</option>
                  {listas.length > 0 && <option value="existing">Lista existente</option>}
                </select>
              </label>
              <label>
                <span className="vx-label">Lista</span>
                {destino === "new"
                  ? <input className="vx-input" placeholder="Nome da nova lista" value={nomeLista} onChange={(e) => setNomeLista(e.target.value)} />
                  : <select className="vx-input" value={listaExistente} onChange={(e) => setListaExistente(e.target.value)}>
                      <option value="">Selecione</option>
                      {listas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                    </select>}
              </label>
            </div>
          </div>
        </div>

        {/* ── Coluna direita: Resumo ── */}
        <aside className="vx-card ll-summary" style={{ position: "sticky", top: 20, padding: 18, display: "grid", gap: 14, background: "var(--surface-2)" }}>
          <div className="vx-disp" style={{ fontSize: 17 }}>Resumo da aquisição</div>
          <div>
            {[
              ["Segmento", segmento || "—"],
              ["Localização", regiao ? `${regiao}, ${pais}` : pais],
              ["Quantidade", `${quantidade} leads`],
              ["Informações", `${campos.size} campos`],
              ["Lista", listaFinal || "A definir"],
              ["Valor estimado", money(valorEstimado)],
            ].map(([k, v]) => (
              <div key={k} className="vx-row" style={{ fontSize: 13, marginBottom: 10 }}>
                <span className="vx-mut">{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <div className="vx-sep" />
          <div>
            <span className="vx-label">VALOR A PAGAR HOJE</span>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--green)" }}>R$ 0,00</div>
            <span className="vx-mut" style={{ fontSize: 12 }}>
              {ciclo?.fim
                ? `Cobrança prevista em ${new Date(ciclo.fim).toLocaleDateString("pt-BR")}`
                : "Primeira cobrança em 30 dias após o primeiro uso."}
            </span>
          </div>
          <button onClick={buscar} disabled={!podeEnviar || ocupado} className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 44 }}>
            {ocupado ? <Loader2 size={16} className="vx-spin" /> : null}
            {ocupado ? "Buscando..." : `Encontrar ${quantidade} leads`}
          </button>
          {precoUnitario > 0 && <span className="vx-mut" style={{ fontSize: 11.5 }}>Preço por lead: {money(precoUnitario)}</span>}
          {feedback && <p className="vx-mut" style={{ margin: 0, fontSize: 13, color: "var(--brand)" }} role="status">{feedback}</p>}
        </aside>
      </div>

      <style>{`
        @media(max-width:1000px){ .ll-layout{grid-template-columns:1fr!important} .ll-summary{position:static!important} }
        @media(max-width:650px){ .ll-categories{grid-template-columns:repeat(2,1fr)!important} .ll-groups{grid-template-columns:1fr!important} }
      `}</style>
    </>
  );
}

/* ═══ ABA 1: Meus contatos ═══════════════════════════════════════════════ */
function AbaContatos({ aviso, listas }) {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [drawer, setDrawer] = useState(null);

  useEffect(() => { api("/loja-leads/revelados").then((r) => { setContatos(r?.contatos || []); setLoading(false); }); }, []);

  const filtrados = useMemo(() => {
    const t = busca.toLowerCase().trim();
    if (!t) return contatos;
    return contatos.filter((c) => [c.nome, c.endereco, c.categoria].some((v) => (v || "").toLowerCase().includes(t)));
  }, [contatos, busca]);

  if (loading) return <Loading />;

  if (!contatos.length) return (
    <div className="vx-empty">
      <div className="vx-empty-icon"><Users size={24} /></div>
      <h2>Sua carteira começa aqui.</h2>
      <p>Encontre novos contatos comerciais.</p>
    </div>
  );

  return (
    <>
      <div className="vx-disp" style={{ fontSize: 17, marginBottom: 4 }}>Meus contatos</div>
      <p className="vx-mut" style={{ margin: "0 0 14px", fontSize: 13 }}>Minha carteira de contatos comerciais.</p>

      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        <input className="vx-input" style={{ paddingLeft: 36 }} placeholder="Buscar por nome, segmento ou localização..."
          value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div className="vx-table-wrap">
        <table className="vx-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Segmento</th>
              <th>Localização</th>
              <th>Telefone</th>
              <th>Website</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id} onClick={() => setDrawer(c)} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{c.nome || "—"}</td>
                <td>{(c.categoria || "—").replace(/_/g, " ")}</td>
                <td>{c.endereco || "—"}</td>
                <td>{c.telefone ? <a href={`tel:${c.telefone}`} style={{ color: "var(--brand)", textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{c.telefone}</a> : "—"}</td>
                <td>{c.site ? <a href={c.site} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{c.site.replace(/^https?:\/\//, "").slice(0, 30)}</a> : "—"}</td>
              </tr>
            ))}
            {!filtrados.length && <tr><td colSpan={5} style={{ textAlign: "center" }} className="vx-mut">Nenhum contato encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {drawer && <DrawerContato contato={drawer} onClose={() => setDrawer(null)} listas={listas} aviso={aviso} />}
    </>
  );
}

/* ── Drawer contato ──────────────────────────────────────────────────────── */
function DrawerContato({ contato: c, onClose, listas, aviso }) {
  const addToList = async (listaId) => {
    const r = await api("/loja-leads/listas/adicionar", { listaId, contatoId: c.id });
    if (r?.error) return aviso?.(r.error);
    aviso?.("Contato adicionado à lista.");
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.3)" }} onClick={onClose} />
      <div style={{ position: "relative", width: 400, maxWidth: "90vw", height: "100%", background: "var(--surface-solid)", overflowY: "auto", padding: "20px 18px", boxShadow: "var(--shadow-pop)" }}>
        <div className="vx-row" style={{ marginBottom: 16 }}>
          <div className="vx-disp" style={{ fontSize: 17 }}>Detalhes do contato</div>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div className="vx-empty-icon" style={{ width: 42, height: 42, borderRadius: 12 }}><Building2 size={20} /></div>
          <div>
            <div style={{ fontWeight: 700 }}>{c.nome || "Sem nome"}</div>
            {c.categoria && <span className="vx-mut" style={{ fontSize: 12 }}>{c.categoria.replace(/_/g, " ")}</span>}
          </div>
        </div>
        <div className="vx-grid" style={{ gap: 6 }}>
          {c.endereco && <InfoRow icon={<MapPin size={14} />} label="Endereço" value={c.endereco} />}
          {c.telefone && <InfoRow icon={<Phone size={14} />} label="Telefone" value={c.telefone} href={`tel:${c.telefone}`} />}
          {c.site && <InfoRow icon={<Globe size={14} />} label="Website" value={c.site.replace(/^https?:\/\//, "")} href={c.site} />}
          {c.rating > 0 && <InfoRow icon={<Star size={14} />} label="Google" value={`${c.rating.toFixed(1)} (${c.totalAvaliacoes || 0} avaliações)`} />}
        </div>
        {listas.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <span className="vx-label">Adicionar a uma lista</span>
            <div className="vx-grid" style={{ gap: 4, marginTop: 6 }}>
              {listas.map((l) => (
                <button key={l.id} className="vx-btn vx-btn-sm" onClick={() => addToList(l.id)} style={{ justifyContent: "flex-start", display: "flex", gap: 6 }}>
                  <ListPlus size={14} /> {l.nome}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, href }) {
  const content = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "5px 0" }}>
      <span className="vx-mut">{icon}</span>
      <span className="vx-mut" style={{ minWidth: 70, fontSize: 11.5 }}>{label}</span>
      <span style={{ color: href ? "var(--brand)" : "var(--ink)", fontWeight: 500 }}>{value}</span>
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{content}</a> : content;
}

/* ═══ ABA 2: Minhas listas ═══════════════════════════════════════════════ */
function AbaListas({ aviso, isEmpresa, recarregarListas }) {
  const [pastas, setPastas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pastaAberta, setPastaAberta] = useState(null);
  const [listaAberta, setListaAberta] = useState(null);

  const recarregar = useCallback(async () => { const r = await api("/loja-leads/pastas"); setPastas(r?.pastas || []); }, []);
  useEffect(() => { recarregar().then(() => setLoading(false)); }, []);

  if (loading) return <Loading />;

  if (listaAberta) return <VistaLista lista={listaAberta} aviso={aviso} voltar={() => { setListaAberta(null); recarregar(); recarregarListas?.(); }} isEmpresa={isEmpresa} />;
  if (pastaAberta) return <VistaPasta pasta={pastaAberta} aviso={aviso} voltar={() => { setPastaAberta(null); recarregar(); }} abrirLista={setListaAberta} />;

  const novaPasta = async () => {
    const r = await api("/loja-leads/pastas", { nome: "Nova pasta" });
    if (r?.error) return aviso?.(r.error);
    await recarregar();
    aviso?.("Pasta criada.");
  };

  if (!pastas.length) return (
    <div className="vx-empty">
      <div className="vx-empty-icon"><FolderOpen size={24} /></div>
      <h2>Organize suas oportunidades.</h2>
      <p>Crie listas e pastas para manter seus contatos organizados.</p>
      <button className="vx-btn vx-btn-primary" onClick={novaPasta}>Criar primeira pasta</button>
    </div>
  );

  return (
    <>
      <div className="vx-row" style={{ marginBottom: 14 }}>
        <div>
          <div className="vx-disp" style={{ fontSize: 17 }}>Minhas listas</div>
          <span className="vx-mut" style={{ fontSize: 13 }}>Organize suas oportunidades por segmento ou região.</span>
        </div>
        <button className="vx-btn vx-btn-sm" onClick={novaPasta}><Plus size={14} /> Nova pasta</button>
      </div>
      <div className="vx-grid vx-g3" style={{ gap: 12 }}>
        {pastas.map((p) => (
          <PastaCard key={p.id} pasta={p} aviso={aviso} onAbrir={() => setPastaAberta(p)} onAtualizar={recarregar} />
        ))}
      </div>
    </>
  );
}

function PastaCard({ pasta, aviso, onAbrir, onAtualizar }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(pasta.nome);
  const salvar = async () => { if (!nome.trim()) return; await apiPatch(`/loja-leads/pastas/${pasta.id}`, { nome: nome.trim() }); setEditando(false); onAtualizar?.(); };
  const excluir = async () => { if (!confirm(`Excluir pasta "${pasta.nome}" e todas as listas dentro dela?`)) return; const r = await apiDelete(`/loja-leads/pastas/${pasta.id}`); if (r?.error) return aviso?.(r.error); aviso?.("Pasta excluída."); onAtualizar?.(); };

  return (
    <div className="vx-card" style={{ padding: 16, cursor: editando ? "default" : "pointer", display: "grid", gap: 8 }} onClick={!editando ? onAbrir : undefined}>
      <FolderOpen size={20} style={{ color: "var(--brand)" }} />
      {editando ? (
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && salvar()} autoFocus />
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={salvar}>OK</button>
        </div>
      ) : (
        <>
          <strong>{pasta.nome}</strong>
          <span className="vx-mut" style={{ fontSize: 12 }}>{pasta.totalListas || 0} lista(s) · {pasta.totalContatos || 0} contato(s)</span>
          <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setEditando(true)}><Pencil size={13} /></button>
            <button className="vx-btn vx-btn-danger vx-btn-sm" onClick={excluir}><Trash2 size={13} /></button>
          </div>
        </>
      )}
    </div>
  );
}

function VistaPasta({ pasta, aviso, voltar, abrirLista }) {
  const [listas, setListas] = useState([]);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(async () => { const r = await api(`/loja-leads/listas/${pasta.id}`); setListas(r?.listas || []); }, [pasta.id]);
  useEffect(() => { recarregar().then(() => setLoading(false)); }, []);

  const novaLista = async () => {
    const r = await api("/loja-leads/listas", { pastaId: pasta.id, nome: "Nova lista" });
    if (r?.error) return aviso?.(r.error);
    await recarregar();
  };

  if (loading) return <Loading />;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 14 }}>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={voltar} style={{ padding: 0 }}>Minhas Listas</button>
        <ChevronRight size={13} className="vx-mut" />
        <strong>{pasta.nome}</strong>
      </div>
      <div className="vx-row" style={{ marginBottom: 14 }}>
        <span className="vx-mut" style={{ fontSize: 13 }}>{listas.length} lista(s)</span>
        <button className="vx-btn vx-btn-sm" onClick={novaLista}><Plus size={14} /> Nova lista</button>
      </div>
      {!listas.length && <div className="vx-empty"><h2>Nenhuma lista nesta pasta.</h2></div>}
      <div className="vx-grid vx-g3" style={{ gap: 12 }}>
        {listas.map((l) => (
          <ListaCardSimple key={l.id} lista={l} aviso={aviso} onAbrir={() => abrirLista(l)} onAtualizar={recarregar} />
        ))}
      </div>
    </>
  );
}

function ListaCardSimple({ lista, aviso, onAbrir, onAtualizar }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(lista.nome);
  const salvar = async () => { if (!nome.trim()) return; await apiPatch(`/loja-leads/listas/${lista.id}`, { nome: nome.trim() }); setEditando(false); onAtualizar?.(); };
  const excluir = async () => { if (!confirm(`Excluir lista "${lista.nome}"?`)) return; const r = await apiDelete(`/loja-leads/listas/${lista.id}`); if (r?.error) return aviso?.(r.error); aviso?.("Lista excluída."); onAtualizar?.(); };

  return (
    <div className="vx-card" style={{ padding: 16, cursor: editando ? "default" : "pointer", display: "grid", gap: 8 }} onClick={!editando ? onAbrir : undefined}>
      <List size={20} style={{ color: "var(--brand)" }} />
      {editando ? (
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && salvar()} autoFocus />
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={salvar}>OK</button>
        </div>
      ) : (
        <>
          <strong>{lista.nome}</strong>
          <span className="vx-mut" style={{ fontSize: 12 }}>{lista.totalContatos ?? 0} contato(s)</span>
          <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setEditando(true)}><Pencil size={13} /></button>
            <button className="vx-btn vx-btn-danger vx-btn-sm" onClick={excluir}><Trash2 size={13} /></button>
          </div>
        </>
      )}
    </div>
  );
}

function VistaLista({ lista, aviso, voltar, isEmpresa }) {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vinculos, setVinculos] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [showVincular, setShowVincular] = useState(false);
  const [campSel, setCampSel] = useState("");
  const [modoVinculo, setModoVinculo] = useState("pontual");
  const [vinculando, setVinculando] = useState(false);

  const recarregar = useCallback(async () => {
    const [r, v] = await Promise.all([api(`/loja-leads/listas/${lista.id}/contatos`), api(`/loja-leads/vinculos/lista/${lista.id}`)]);
    setContatos(r?.contatos || []); setVinculos(v?.vinculos || []);
  }, [lista.id]);
  useEffect(() => { recarregar().then(() => setLoading(false)); }, []);

  const abrirVincular = async () => {
    const r = await api("/campaigns");
    setCampanhas((r || []).filter((c) => c.status === "ativa" || c.status === "rascunho"));
    setShowVincular(true);
  };
  const vincular = async () => {
    if (!campSel) return aviso?.("Selecione uma campanha.");
    setVinculando(true);
    const r = await api("/loja-leads/vincular", { listaId: lista.id, campaignId: campSel, modo: modoVinculo });
    setVinculando(false);
    if (r?.error) return aviso?.(r.error);
    aviso?.(`Lista vinculada. ${r.copiados} contato(s) copiado(s).`);
    setShowVincular(false); setCampSel(""); recarregar();
  };
  const desvincular = async (id) => { if (!confirm("Remover vínculo?")) return; const r = await apiDelete(`/loja-leads/vinculos/${id}`); if (r?.error) return aviso?.(r.error); aviso?.("Vínculo removido."); recarregar(); };
  const sincronizar = async (cid) => { const r = await api(`/loja-leads/sincronizar/${cid}`, {}); if (r?.error) return aviso?.(r.error); aviso?.(`${r.totalSincronizados} novo(s) contato(s).`); recarregar(); };
  const remover = async (cid) => { const r = await api("/loja-leads/listas/remover", { listaId: lista.id, contatoId: cid }); if (r?.error) return aviso?.(r.error); aviso?.("Contato removido."); recarregar(); };

  if (loading) return <Loading />;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 14 }}>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={voltar} style={{ padding: 0 }}>Minhas Listas</button>
        <ChevronRight size={13} className="vx-mut" />
        <strong>{lista.nome}</strong>
      </div>
      <div className="vx-row" style={{ marginBottom: 14 }}>
        <span className="vx-mut" style={{ fontSize: 13 }}>{contatos.length} contato(s)</span>
        {isEmpresa && <button className="vx-btn vx-btn-sm" onClick={abrirVincular}><Megaphone size={14} /> Vincular à campanha</button>}
      </div>

      {showVincular && (
        <div className="vx-card" style={{ padding: 16, marginBottom: 14, background: "var(--brand-50)", borderColor: "var(--brand-100)" }}>
          <div className="vx-row" style={{ marginBottom: 12 }}>
            <strong>Vincular lista à campanha</strong>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setShowVincular(false)}><X size={15} /></button>
          </div>
          <select className="vx-input" style={{ marginBottom: 10 }} value={campSel} onChange={(e) => setCampSel(e.target.value)}>
            <option value="">Selecione...</option>
            {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo} ({c.status})</option>)}
          </select>
          <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 13 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><input type="radio" name="modo" value="pontual" checked={modoVinculo === "pontual"} onChange={() => setModoVinculo("pontual")} /> Pontual</label>
            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><input type="radio" name="modo" value="automatica" checked={modoVinculo === "automatica"} onChange={() => setModoVinculo("automatica")} /> Automática</label>
          </div>
          <button className="vx-btn vx-btn-primary vx-btn-block" disabled={vinculando || !campSel} onClick={vincular} style={{ minHeight: 44 }}>
            {vinculando ? <Loader2 size={14} className="vx-spin" /> : <Link2 size={14} />}
            {vinculando ? " Vinculando..." : " Vincular"}
          </button>
        </div>
      )}

      {vinculos.length > 0 && vinculos.map((v) => (
        <div key={v.id} className="vx-card vx-row" style={{ padding: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <Megaphone size={14} style={{ color: "var(--brand)", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{v.campanhaTitulo}</div>
              <span className="vx-mut" style={{ fontSize: 11.5 }}>{v.modo === "automatica" ? "Automática" : "Pontual"} · {v.totalCopiados} enviado(s)</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {v.modo === "automatica" && <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => sincronizar(v.campaignId)}><RefreshCw size={13} /></button>}
            <button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => desvincular(v.id)}><Unlink size={13} /></button>
          </div>
        </div>
      ))}

      {!contatos.length ? (
        <div className="vx-empty"><h2>Nenhum contato nesta lista.</h2></div>
      ) : (
        <div className="vx-table-wrap">
          <table className="vx-table">
            <thead><tr><th>Empresa</th><th>Telefone</th><th>Website</th><th style={{ textAlign: "center" }}>Ações</th></tr></thead>
            <tbody>
              {contatos.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nome || "—"}</td>
                  <td>{c.telefone || "—"}</td>
                  <td>{c.site ? <a href={c.site} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", textDecoration: "none" }}>{c.site.replace(/^https?:\/\//, "").slice(0, 25)}</a> : "—"}</td>
                  <td style={{ textAlign: "center" }}><button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => remover(c.id)}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ═══ ABA 3: Consumo ═════════════════════════════════════════════════════ */
function AbaConsumo({ ciclo: cicloInicial }) {
  const [ciclo, setCiclo] = useState(cicloInicial);
  const [faturas, setFaturas] = useState([]);
  const [precos, setPrecos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api("/loja-leads/ciclo"), api("/loja-leads/faturas"), api("/loja-leads/precos")]).then(([c, f, p]) => {
      setCiclo(c); setFaturas(f?.faturas || []); setPrecos(p?.precos || []); setLoading(false);
    });
  }, []);

  if (loading) return <Loading />;

  const fmt = (ts) => ts ? new Date(ts).toLocaleDateString("pt-BR") : "—";

  if (!ciclo && !faturas.length) return (
    <div className="vx-empty">
      <div className="vx-empty-icon"><FileText size={24} /></div>
      <h2>Nenhuma cobrança registrada.</h2>
    </div>
  );

  return (
    <>
      <div className="vx-disp" style={{ fontSize: 17, marginBottom: 12 }}>Consumo e cobrança</div>
      {ciclo && (
        <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
          <span className="vx-eyebrow">Acumulado no ciclo atual</span>
          <div className="vx-tile-val" style={{ margin: "8px 0" }}>{money(ciclo.valorTotal || 0)}</div>
          <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>Início do ciclo: {ciclo.inicio ? fmt(ciclo.inicio) : "aguardando primeiro uso"}</p>
          <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>Próxima cobrança: {ciclo.fim ? fmt(ciclo.fim) : "ainda não definida"}</p>
        </div>
      )}

      {faturas.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <span className="vx-label">Histórico de faturas</span>
          <div className="vx-table-wrap" style={{ marginTop: 8 }}>
            <table className="vx-table">
              <thead><tr><th>Período</th><th>Leads</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>
                {faturas.map((f) => (
                  <tr key={f.id}>
                    <td>{fmt(f.inicio)} — {fmt(f.fim)}</td>
                    <td>{f.totalContatos}</td>
                    <td style={{ fontWeight: 600, color: "var(--brand)" }}>{money(f.valorTotal)}</td>
                    <td>{f.status === "fechado" ? "Fechado" : "Aberto"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {precos.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <span className="vx-label">Tabela de preços</span>
          <div className="vx-table-wrap" style={{ marginTop: 8 }}>
            <table className="vx-table">
              <thead><tr><th>Faixa</th><th style={{ textAlign: "right" }}>Valor / contato</th></tr></thead>
              <tbody>
                {precos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.faixa} contatos</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--brand)" }}>{money(p.valorUnitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Loading ──────────────────────────────────────────────────────────── */
function Loading() {
  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <div className="vx-spinner" />
    </div>
  );
}
