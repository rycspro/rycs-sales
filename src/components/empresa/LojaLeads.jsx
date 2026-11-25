import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search, MapPin, Phone, Globe, Star, Eye, Plus, Loader2, ChevronRight,
  Building2, FolderOpen, List, Receipt, Pencil, Trash2,
  ChevronDown, ListPlus, X, Clock, FileText, Store,
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

/* ── Design tokens (referência) ─────────────────────────────────────────── */
const C = {
  blue: "#318CE7", blueBg: "#eaf3fe", blueBorder: "#d9e9fb", blueLight: "#e9f3ff",
  green: "#16A085", greenBg: "#e9f9f4",
  orange: "#D97706", orangeBg: "#fef3e2",
  purple: "#9363DB", purpleBg: "#f0eafc",
  pink: "#DC5472", pinkBg: "#fce8ed",
  gray: "#64748B", grayBg: "#f0f2f5",
  line: "#e1e6ec", muted: "#687586", bg: "#f7f8fa", ink: "#172333",
};
const R = 12;

/* ── Categorias (8, referência) ─────────────────────────────────────────── */
const CATEGORIAS = [
  { key: "restaurantes", label: "Restaurantes", Icon: Utensils, cor: "#E28A35" },
  { key: "clinicas", label: "Clínicas odontológicas", Icon: HeartPulse, cor: C.blue },
  { key: "imobiliarias", label: "Imobiliárias", Icon: Building2, cor: C.purple },
  { key: "academias", label: "Academias", Icon: Dumbbell, cor: C.green },
  { key: "escritorios", label: "Escritórios", Icon: Building, cor: C.gray },
  { key: "saloes", label: "Salões de beleza", Icon: Scissors, cor: C.pink },
  { key: "comercios", label: "Comércios", Icon: ShoppingBag, cor: "#D99529" },
  { key: "tecnologia", label: "Tecnologia", Icon: Cpu, cor: C.blue },
];

/* ── 5 grupos de informações (27 campos, referência) ──────────────────── */
const GRUPOS = [
  { key: "empresariais", label: "Dados empresariais", Icon: Building2, cor: C.blue,
    campos: ["Nome da empresa", "Razão social", "Nome fantasia", "CNPJ", "Segmento / CNAE", "Porte da empresa"] },
  { key: "contatos", label: "Contatos", Icon: Users, cor: C.green,
    campos: ["Telefone fixo", "Celular", "WhatsApp", "E-mail comercial", "Nome do responsável", "Cargo do responsável"] },
  { key: "localizacao", label: "Localização", Icon: MapPin, cor: C.orange,
    campos: ["Endereço completo", "Cidade e estado", "CEP", "Geolocalização"] },
  { key: "digital", label: "Presença digital", Icon: Globe, cor: C.purple,
    campos: ["Website", "Instagram", "Facebook", "LinkedIn", "Google Maps"] },
  { key: "complementares", label: "Informações complementares", Icon: FileText, cor: C.pink,
    campos: ["Avaliação no Google", "Quantidade de avaliações", "Horário de funcionamento", "Data de abertura", "Situação cadastral", "Capital social"] },
];
const ALL_CAMPOS = GRUPOS.flatMap((g) => g.campos);
const QTDS = [25, 50, 100, 250, 500, 1000];

/* ═══ Estilos inline fiéis à referência ═══════════════════════════════════ */
const S = {
  root: { fontFamily: "'General Sans', Arial, sans-serif", color: C.ink, padding: 28, boxSizing: "border-box" },
  header: { display: "flex", alignItems: "center", gap: 14, marginBottom: 22 },
  symbol: (cor = C.blue) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 11, background: `${cor}18`, color: cor, flexShrink: 0 }),
  symbolSm: (cor = C.blue) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 11, background: `${cor}18`, color: cor, flexShrink: 0 }),
  banner: { display: "flex", alignItems: "center", gap: 14, background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: R, padding: 22, marginBottom: 20, color: "#174e85" },
  bannerP: { color: "#37638c", lineHeight: 1.55, margin: 0 },
  metrics: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 },
  metric: { background: "white", border: `1px solid ${C.line}`, borderRadius: R, padding: 18, display: "grid", gap: 8 },
  nav: { display: "flex", gap: 5, overflowX: "auto" },
  tab: (active) => ({
    display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", borderRadius: "10px 10px 0 0",
    background: active ? C.blue : "#edf0f4", border: "none", padding: "14px 20px",
    color: active ? "white" : "#667281", cursor: "pointer", fontSize: 14, fontWeight: 500,
    fontFamily: "'General Sans', Arial, sans-serif",
  }),
  sheet: { background: "white", border: `1px solid ${C.line}`, borderRadius: "0 12px 12px 12px", padding: 24 },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 2.3fr) minmax(250px, 1fr)", gap: 24, alignItems: "start" },
  section: { padding: "22px 0", borderBottom: `1px solid ${C.line}` },
  sectionLast: { padding: "22px 0" },
  label: { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".65px", color: C.muted, margin: "0 0 9px", textTransform: "uppercase" },
  categories: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 },
  category: (active) => ({
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9,
    minHeight: 94, fontSize: 13, textAlign: "center", padding: "10px 5px", cursor: "pointer",
    border: active ? `1px solid ${C.blue}` : `1px solid ${C.line}`, borderRadius: 8,
    background: active ? "#eef6ff" : "white", color: active ? "#2479c9" : C.ink,
    fontFamily: "'General Sans', Arial, sans-serif", fontWeight: 500,
  }),
  formgrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 },
  input: { width: "100%", height: 46, border: `1px solid ${C.line}`, borderRadius: 8, padding: "0 12px", background: "white", color: C.ink, fontSize: 14, fontFamily: "'General Sans', Arial, sans-serif", boxSizing: "border-box" },
  quantities: { display: "flex", flexWrap: "wrap", gap: 8 },
  qtyBtn: (active) => ({
    flex: 1, padding: "10px 14px", cursor: "pointer", borderRadius: 8, fontSize: 14, fontWeight: 500,
    border: active ? `1px solid ${C.blue}` : `1px solid ${C.line}`,
    background: active ? "#eef6ff" : "white", color: active ? "#2479c9" : C.ink,
    fontFamily: "'General Sans', Arial, sans-serif",
  }),
  between: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  groups: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 16 },
  group: { background: "white", border: `1px solid ${C.line}`, borderRadius: R, padding: 14 },
  groupHead: { display: "flex", alignItems: "center", gap: 9, marginBottom: 14 },
  checks: { display: "grid", gap: 10 },
  checkLabel: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" },
  checkbox: { accentColor: C.blue, width: 16, height: 16, flexShrink: 0, margin: 0, cursor: "pointer" },
  summary: { position: "sticky", top: 20, background: "#f7f9fc", border: `1px solid ${C.line}`, borderRadius: R, padding: 20, display: "grid", gap: 16, alignSelf: "start" },
  summaryRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13, marginBottom: 12 },
  today: { fontSize: 32, color: "#16866b", fontWeight: 700 },
  hr: { border: 0, borderTop: `1px solid ${C.line}`, width: "100%", margin: 0 },
  primary: (disabled) => ({
    width: "100%", fontWeight: 600, padding: 14, borderRadius: 8, border: "none",
    background: C.blue, color: "white", cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, fontSize: 14, fontFamily: "'General Sans', Arial, sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  }),
  btn: { cursor: "pointer", border: `1px solid ${C.line}`, background: "white", color: C.ink, borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "'General Sans', Arial, sans-serif" },
  folders: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 20 },
  folder: { background: "white", border: `1px solid ${C.line}`, borderRadius: R, padding: 18, display: "grid", gap: 10, cursor: "pointer" },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 20, textAlign: "left", fontSize: 14 },
  th: { padding: 14, borderBottom: `1px solid ${C.line}`, fontWeight: 600, color: C.muted, fontSize: 12 },
  td: { padding: 14, borderBottom: `1px solid ${C.line}`, color: C.ink },
  empty: { textAlign: "center", padding: "40px 12px", color: C.muted },
};

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
    { label: "Encontrar leads", Icon: Search },
    { label: "Meus contatos", Icon: Users },
    { label: "Minhas listas", Icon: FolderOpen },
    { label: "Consumo", Icon: FileText },
  ];

  return (
    <div style={S.root} className="loja-leads-root">
      <style>{`
        @media(max-width:1000px){
          .loja-leads-root .ll-layout{grid-template-columns:1fr!important}
          .loja-leads-root .ll-summary{position:static!important}
        }
        @media(max-width:650px){
          .loja-leads-root{padding:14px!important}
          .loja-leads-root .ll-sheet{padding:14px!important}
          .loja-leads-root .ll-metrics{grid-template-columns:repeat(2,1fr)!important}
          .loja-leads-root .ll-categories{grid-template-columns:repeat(2,1fr)!important}
          .loja-leads-root .ll-groups{grid-template-columns:1fr!important}
          .loja-leads-root .ll-formgrid{grid-template-columns:1fr!important}
          .loja-leads-root .ll-folders{grid-template-columns:1fr!important}
          .loja-leads-root .ll-between{flex-wrap:wrap}
        }
      `}</style>
      {/* Header */}
      <div style={S.header}>
        <span style={S.symbol()}><Store size={24} /></span>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-.7px" }}>Loja de Leads</h1>
          <p style={{ margin: 0, color: C.muted, lineHeight: 1.55 }}>
            {isEmpresa
              ? "Encontre novos clientes e expanda suas oportunidades comerciais."
              : "Construa sua carteira de contatos e encontre novas oportunidades comerciais."}
          </p>
        </div>
      </div>

      {/* Banner */}
      <div style={S.banner}>
        <span style={S.symbol()}><Clock size={24} /></span>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, letterSpacing: "-.35px" }}>Use agora. Pague em 30 dias.</h2>
          <p style={S.bannerP}>
            Encontre e adquira seus leads sem pagamento antecipado. Sua primeira cobrança acontece 30 dias após o primeiro uso, considerando os leads adquiridos no período.
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div style={S.metrics} className="ll-metrics">
        <Metric icon={<Users size={24} />} cor={C.blue} label="Leads adquiridos" valor={totalLeads} sub="Neste ciclo" />
        <Metric icon={<FolderOpen size={24} />} cor="#D99529" label="Minhas listas" valor={totalListas} sub="Listas criadas" />
        <Metric icon={<Wallet size={24} />} cor={C.green} label="Consumo atual" valor={money(consumoValor)} sub="Valor acumulado" />
        <Metric icon={<Clock size={24} />} cor={C.purple} label="Próxima cobrança" valor={proxCobranca} sub="Após o primeiro uso" />
      </div>

      {/* Tabs fichário */}
      <nav style={S.nav}>
        {ABAS.map(({ label, Icon }, i) => (
          <button key={i} onClick={() => setAba(i)} style={S.tab(aba === i)}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>

      {/* Sheet */}
      <div style={S.sheet} className="ll-sheet">
        {aba === 0 && <AbaBuscar aviso={aviso} listas={listas} precoUnitario={precoUnitario} recarregarCiclo={recarregarCiclo} recarregarListas={recarregarListas} isEmpresa={isEmpresa} ciclo={ciclo} />}
        {aba === 1 && <AbaContatos aviso={aviso} listas={listas} />}
        {aba === 2 && <AbaListas aviso={aviso} isEmpresa={isEmpresa} recarregarListas={recarregarListas} />}
        {aba === 3 && <AbaConsumo ciclo={ciclo} />}
      </div>
    </div>
  );
}

/* ── Metric card ──────────────────────────────────────────────────────── */
function Metric({ icon, cor, label, valor, sub }) {
  return (
    <article style={S.metric}>
      <span style={S.symbol(cor)}>{icon}</span>
      <small style={{ color: C.muted }}>{label}</small>
      <strong style={{ fontSize: 26, letterSpacing: "-.7px" }}>{valor}</strong>
      <small style={{ color: C.muted }}>{sub}</small>
    </article>
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
      <h2 style={{ margin: 0, fontSize: 20, letterSpacing: "-.35px" }}>Encontre seus próximos clientes</h2>
      <p style={{ margin: "0 0 4px", color: C.muted, lineHeight: 1.55 }}>Personalize sua busca e escolha quais informações deseja receber.</p>

      <div style={S.layout} className="ll-layout">
        {/* ── Coluna principal ── */}
        <div>
          {/* Segmentos */}
          <div style={S.section}>
            <span style={S.label}>SEGMENTOS POPULARES</span>
            <div style={S.categories} className="ll-categories">
              {CATEGORIAS.map(({ key, label, Icon, cor }) => (
                <button key={key} onClick={() => setSegmento(label)} style={S.category(segmento === label)}>
                  <span style={S.symbol(cor)}><Icon size={24} /></span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Configure sua busca */}
          <div style={S.section}>
            <h2 style={{ margin: 0, fontSize: 20, letterSpacing: "-.35px" }}>Configure sua busca</h2>
            <div style={S.formgrid} className="ll-formgrid">
              <label style={{ gridColumn: "1 / -1" }}>
                <span style={S.label}>SEGMENTO OU TIPO DE EMPRESA</span>
                <input style={S.input} value={segmento} onChange={(e) => setSegmento(e.target.value)}
                  placeholder="Clínicas odontológicas, empresas de tecnologia..." />
              </label>
              <label>
                <span style={S.label}>PAÍS</span>
                <select style={S.input} value={pais} onChange={(e) => setPais(e.target.value)}>
                  {["Brasil", "Estados Unidos", "Índia", "Portugal", "Reino Unido", "Outro"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>
                <span style={S.label}>CIDADE OU REGIÃO</span>
                <input style={S.input} value={regiao} onChange={(e) => setRegiao(e.target.value)} placeholder="Sorocaba, SP" />
              </label>
            </div>
          </div>

          {/* Quantidade */}
          <div style={S.section}>
            <span style={S.label}>QUANTIDADE DE LEADS</span>
            <div style={S.quantities}>
              {QTDS.map((q) => (
                <button key={q} onClick={() => setQuantidade(q)} style={S.qtyBtn(quantidade === q)}>
                  {q.toLocaleString("pt-BR")}
                </button>
              ))}
            </div>
          </div>

          {/* Informações desejadas */}
          <div style={S.section}>
            <div style={S.between}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, letterSpacing: "-.35px" }}>Informações desejadas</h2>
                <small style={{ color: C.muted }}>{campos.size} de {ALL_CAMPOS.length} informações selecionadas</small>
              </div>
              <button onClick={toggleAll} style={S.btn}>
                {campos.size === ALL_CAMPOS.length ? "Desmarcar tudo" : "Selecionar tudo"}
              </button>
            </div>
            <div style={S.groups} className="ll-groups">
              {GRUPOS.map((g, gi) => {
                const selCount = g.campos.filter((f) => campos.has(f)).length;
                const allSel = selCount === g.campos.length;
                return (
                  <article key={g.key} style={S.group}>
                    <div style={S.groupHead}>
                      <span style={S.symbolSm(g.cor)}><g.Icon size={19} /></span>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: 14 }}>{g.label}</h3>
                        <small style={{ color: C.muted }}>{selCount} de {g.campos.length} selecionadas</small>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, cursor: "pointer", marginLeft: "auto" }}>
                        <input type="checkbox" checked={allSel}
                          ref={(el) => { if (el) el.indeterminate = selCount > 0 && !allSel; }}
                          onChange={() => toggleGrupo(g.campos)} style={S.checkbox} />
                        Todos
                      </label>
                    </div>
                    <div style={S.checks}>
                      {g.campos.map((f) => (
                        <label key={f} style={S.checkLabel}>
                          <input type="checkbox" checked={campos.has(f)} onChange={() => toggleCampo(f)} style={S.checkbox} />
                          {f}
                        </label>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
            <small style={{ display: "block", marginTop: 12, color: C.muted }}>O preenchimento depende da disponibilidade das fontes de dados.</small>
          </div>

          {/* Organize seus leads */}
          <div style={S.sectionLast}>
            <h2 style={{ margin: 0, fontSize: 20, letterSpacing: "-.35px" }}>Organize seus leads</h2>
            <p style={{ margin: "4px 0 0", color: C.muted, lineHeight: 1.55 }}>Escolha onde deseja armazenar os contatos adquiridos.</p>
            <div style={S.formgrid} className="ll-formgrid">
              <label>
                <span style={S.label}>DESTINO</span>
                <select style={S.input} value={destino} onChange={(e) => setDestino(e.target.value)}>
                  <option value="new">Criar nova lista</option>
                  {listas.length > 0 && <option value="existing">Lista existente</option>}
                </select>
              </label>
              <label>
                <span style={S.label}>LISTA</span>
                {destino === "new"
                  ? <input style={S.input} placeholder="Nome da nova lista" value={nomeLista} onChange={(e) => setNomeLista(e.target.value)} />
                  : <select style={S.input} value={listaExistente} onChange={(e) => setListaExistente(e.target.value)}>
                      <option value="">Selecione</option>
                      {listas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                    </select>}
              </label>
            </div>
          </div>
        </div>

        {/* ── Coluna direita: Resumo ── */}
        <aside style={S.summary} className="ll-summary">
          <h2 style={{ margin: 0, fontSize: 20, letterSpacing: "-.35px" }}>Resumo da aquisição</h2>
          <div>
            {[
              ["Segmento", segmento || "—"],
              ["Localização", regiao ? `${regiao}, ${pais}` : pais],
              ["Quantidade", `${quantidade} leads`],
              ["Informações", `${campos.size} campos`],
              ["Lista", listaFinal || "A definir"],
              ["Valor estimado", money(valorEstimado)],
            ].map(([k, v]) => (
              <div key={k} style={S.summaryRow}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <hr style={S.hr} />
          <span style={S.label}>VALOR A PAGAR HOJE</span>
          <div style={S.today}>R$ 0,00</div>
          <small style={{ color: C.muted }}>
            {ciclo?.fim
              ? `Cobrança prevista em ${new Date(ciclo.fim).toLocaleDateString("pt-BR")}`
              : "Primeira cobrança em 30 dias após o primeiro uso."}
          </small>
          <button onClick={buscar} disabled={!podeEnviar || ocupado} style={S.primary(!podeEnviar || ocupado)}>
            {ocupado ? <Loader2 size={16} className="vx-spin" /> : null}
            {ocupado ? "Buscando..." : `Encontrar ${quantidade} leads`}
          </button>
          {precoUnitario > 0 && <small style={{ color: C.muted }}>Preço por lead: {money(precoUnitario)}</small>}
          {feedback && <p style={{ margin: 0, fontSize: 13, color: C.blue }} role="status">{feedback}</p>}
        </aside>
      </div>
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
    <div style={S.empty}>
      <span style={S.symbol()}><Users size={24} /></span>
      <h3 style={{ margin: "12px 0 4px" }}>Sua carteira começa aqui.</h3>
      <p style={{ margin: 0, color: C.muted }}>Encontre novos contatos comerciais.</p>
    </div>
  );

  return (
    <>
      <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Meus contatos</h2>
      <p style={{ margin: "0 0 16px", color: C.muted }}>Minha carteira de contatos comerciais.</p>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
        <input style={{ ...S.input, paddingLeft: 36 }} placeholder="Buscar por nome, segmento ou localização..."
          value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Empresa</th>
              <th style={S.th}>Segmento</th>
              <th style={S.th}>Localização</th>
              <th style={S.th}>Telefone</th>
              <th style={S.th}>Website</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id} onClick={() => setDrawer(c)} style={{ cursor: "pointer" }}>
                <td style={{ ...S.td, fontWeight: 600 }}>{c.nome || "—"}</td>
                <td style={S.td}>{(c.categoria || "—").replace(/_/g, " ")}</td>
                <td style={S.td}>{c.endereco || "—"}</td>
                <td style={S.td}>{c.telefone ? <a href={`tel:${c.telefone}`} style={{ color: C.blue, textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{c.telefone}</a> : "—"}</td>
                <td style={S.td}>{c.site ? <a href={c.site} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{c.site.replace(/^https?:\/\//, "").slice(0, 30)}</a> : "—"}</td>
              </tr>
            ))}
            {!filtrados.length && <tr><td colSpan={5} style={{ ...S.td, textAlign: "center", color: C.muted }}>Nenhum contato encontrado.</td></tr>}
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
      <div style={{ position: "relative", width: 400, maxWidth: "90vw", height: "100%", background: "#fff", overflowY: "auto", padding: "24px 22px", boxShadow: "-4px 0 24px rgba(0,0,0,.08)" }}>
        <div style={{ ...S.between, marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Detalhes do contato</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={18} style={{ color: C.muted }} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={S.symbol()}><Building2 size={22} /></span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{c.nome || "Sem nome"}</div>
            {c.categoria && <small style={{ color: C.muted }}>{c.categoria.replace(/_/g, " ")}</small>}
          </div>
        </div>
        {c.endereco && <InfoRow icon={<MapPin size={14} />} label="Endereço" value={c.endereco} />}
        {c.telefone && <InfoRow icon={<Phone size={14} />} label="Telefone" value={c.telefone} href={`tel:${c.telefone}`} />}
        {c.site && <InfoRow icon={<Globe size={14} />} label="Website" value={c.site.replace(/^https?:\/\//, "")} href={c.site} />}
        {c.rating > 0 && <InfoRow icon={<Star size={14} />} label="Google" value={`${c.rating.toFixed(1)} (${c.totalAvaliacoes || 0} avaliações)`} />}
        {listas.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <span style={S.label}>ADICIONAR A UMA LISTA</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {listas.map((l) => (
                <button key={l.id} onClick={() => addToList(l.id)} style={{ ...S.btn, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start" }}>
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 0" }}>
      <span style={{ color: C.muted }}>{icon}</span>
      <span style={{ color: C.muted, minWidth: 70, fontSize: 12 }}>{label}</span>
      <span style={{ color: href ? C.blue : C.ink, fontWeight: 500 }}>{value}</span>
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
    <div style={S.empty}>
      <span style={S.symbol("#D99529")}><FolderOpen size={24} /></span>
      <h3 style={{ margin: "12px 0 4px" }}>Organize suas oportunidades.</h3>
      <p style={{ margin: "0 0 16px", color: C.muted }}>Crie listas e pastas para manter seus contatos organizados.</p>
      <button onClick={novaPasta} style={{ ...S.btn, borderColor: C.blue, color: C.blue }}>Criar primeira pasta</button>
    </div>
  );

  return (
    <>
      <div style={S.between}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Minhas listas</h2>
          <p style={{ margin: "4px 0 0", color: C.muted }}>Organize suas oportunidades por segmento ou região.</p>
        </div>
        <button onClick={novaPasta} style={{ ...S.btn, display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Nova pasta</button>
      </div>
      <div style={S.folders} className="ll-folders">
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
    <article style={S.folder} onClick={!editando ? onAbrir : undefined}>
      <span style={S.symbol("#D99529")}><FolderOpen size={24} /></span>
      {editando ? (
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <input style={{ ...S.input, height: 36 }} value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && salvar()} autoFocus />
          <button onClick={salvar} style={{ ...S.btn, padding: "6px 12px", background: C.blue, color: "white", borderColor: C.blue }}>OK</button>
        </div>
      ) : (
        <>
          <strong>{pasta.nome}</strong>
          <small style={{ color: C.muted }}>{pasta.totalListas || 0} lista(s) · {pasta.totalContatos || 0} contato(s)</small>
          <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setEditando(true)} title="Renomear" style={{ ...S.btn, padding: 6 }}><Pencil size={13} /></button>
            <button onClick={excluir} title="Excluir" style={{ ...S.btn, padding: 6, color: "#B42318" }}><Trash2 size={13} /></button>
          </div>
        </>
      )}
    </article>
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
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.muted, marginBottom: 14 }}>
        <button onClick={voltar} style={{ background: "none", border: "none", color: C.blue, cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0 }}>Minhas Listas</button>
        <ChevronRight size={13} />
        <span style={{ fontWeight: 600, color: C.ink }}>{pasta.nome}</span>
      </div>
      <div style={S.between}>
        <span style={{ fontSize: 13, color: C.muted }}>{listas.length} lista(s)</span>
        <button onClick={novaLista} style={{ ...S.btn, display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Nova lista</button>
      </div>
      {!listas.length && <div style={S.empty}><h3>Nenhuma lista nesta pasta.</h3></div>}
      <div style={S.folders} className="ll-folders">
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
    <article style={S.folder} onClick={!editando ? onAbrir : undefined}>
      <span style={S.symbol()}><List size={24} /></span>
      {editando ? (
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <input style={{ ...S.input, height: 36 }} value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && salvar()} autoFocus />
          <button onClick={salvar} style={{ ...S.btn, padding: "6px 12px", background: C.blue, color: "white", borderColor: C.blue }}>OK</button>
        </div>
      ) : (
        <>
          <strong>{lista.nome}</strong>
          <small style={{ color: C.muted }}>{lista.totalContatos ?? 0} contato(s)</small>
          <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setEditando(true)} style={{ ...S.btn, padding: 6 }}><Pencil size={13} /></button>
            <button onClick={excluir} style={{ ...S.btn, padding: 6, color: "#B42318" }}><Trash2 size={13} /></button>
          </div>
        </>
      )}
    </article>
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
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.muted, marginBottom: 14 }}>
        <button onClick={voltar} style={{ background: "none", border: "none", color: C.blue, cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0 }}>Minhas Listas</button>
        <ChevronRight size={13} />
        <span style={{ fontWeight: 600, color: C.ink }}>{lista.nome}</span>
      </div>
      <div style={{ ...S.between, marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: C.muted }}>{contatos.length} contato(s)</span>
        {isEmpresa && <button onClick={abrirVincular} style={{ ...S.btn, display: "flex", alignItems: "center", gap: 6, color: C.blue, borderColor: C.blue }}><Megaphone size={14} /> Vincular à campanha</button>}
      </div>

      {showVincular && (
        <div style={{ background: C.blueBg, borderRadius: R, padding: 18, border: `1px solid ${C.blue}33`, marginBottom: 16 }}>
          <div style={{ ...S.between, marginBottom: 12 }}>
            <strong>Vincular lista à campanha</strong>
            <button onClick={() => setShowVincular(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={15} /></button>
          </div>
          <select style={{ ...S.input, marginBottom: 10 }} value={campSel} onChange={(e) => setCampSel(e.target.value)}>
            <option value="">Selecione...</option>
            {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo} ({c.status})</option>)}
          </select>
          <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
            <label style={{ ...S.checkLabel }}><input type="radio" name="modo" value="pontual" checked={modoVinculo === "pontual"} onChange={() => setModoVinculo("pontual")} /> Pontual</label>
            <label style={{ ...S.checkLabel }}><input type="radio" name="modo" value="automatica" checked={modoVinculo === "automatica"} onChange={() => setModoVinculo("automatica")} /> Automática</label>
          </div>
          <button onClick={vincular} disabled={vinculando || !campSel} style={S.primary(vinculando || !campSel)}>
            {vinculando ? <Loader2 size={14} className="vx-spin" /> : <Link2 size={14} />}
            {vinculando ? "Vinculando..." : "Vincular"}
          </button>
        </div>
      )}

      {vinculos.length > 0 && vinculos.map((v) => (
        <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.bg, borderRadius: 8, marginBottom: 8 }}>
          <Megaphone size={14} style={{ color: C.blue, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{v.campanhaTitulo}</div>
            <small style={{ color: C.muted }}>{v.modo === "automatica" ? "Automática" : "Pontual"} · {v.totalCopiados} enviado(s)</small>
          </div>
          {v.modo === "automatica" && <button onClick={() => sincronizar(v.campaignId)} style={{ ...S.btn, padding: 6 }}><RefreshCw size={13} /></button>}
          <button onClick={() => desvincular(v.id)} style={{ ...S.btn, padding: 6, color: "#B42318" }}><Unlink size={13} /></button>
        </div>
      ))}

      {!contatos.length ? (
        <div style={S.empty}><h3>Nenhum contato nesta lista.</h3></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Empresa</th><th style={S.th}>Telefone</th><th style={S.th}>Website</th><th style={{ ...S.th, textAlign: "center" }}>Ações</th></tr></thead>
            <tbody>
              {contatos.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{c.nome || "—"}</td>
                  <td style={S.td}>{c.telefone || "—"}</td>
                  <td style={S.td}>{c.site ? <a href={c.site} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: "none" }}>{c.site.replace(/^https?:\/\//, "").slice(0, 25)}</a> : "—"}</td>
                  <td style={{ ...S.td, textAlign: "center" }}><button onClick={() => remover(c.id)} style={{ ...S.btn, padding: 5, color: "#B42318" }}><Trash2 size={13} /></button></td>
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
    <div style={S.empty}>
      <span style={S.symbol(C.purple)}><FileText size={24} /></span>
      <h3 style={{ margin: "12px 0 4px" }}>Nenhuma cobrança registrada.</h3>
    </div>
  );

  return (
    <>
      <h2 style={{ margin: 0, fontSize: 20 }}>Consumo e cobrança</h2>
      {ciclo && (
        <div style={S.section}>
          <small style={{ color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 700 }}>ACUMULADO NO CICLO ATUAL</small>
          <h1 style={{ margin: "8px 0", fontSize: 28, letterSpacing: "-.7px" }}>{money(ciclo.valorTotal || 0)}</h1>
          <p style={{ margin: 0, color: C.muted }}>Início do ciclo: {ciclo.inicio ? fmt(ciclo.inicio) : "aguardando primeiro uso"}</p>
          <p style={{ margin: 0, color: C.muted }}>Próxima cobrança: {ciclo.fim ? fmt(ciclo.fim) : "ainda não definida"}</p>
        </div>
      )}

      {faturas.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <span style={S.label}>HISTÓRICO DE FATURAS</span>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Período</th><th style={S.th}>Leads</th><th style={S.th}>Valor</th><th style={S.th}>Status</th></tr></thead>
            <tbody>
              {faturas.map((f) => (
                <tr key={f.id}>
                  <td style={S.td}>{fmt(f.inicio)} — {fmt(f.fim)}</td>
                  <td style={S.td}>{f.totalContatos}</td>
                  <td style={{ ...S.td, fontWeight: 600, color: C.blue }}>{money(f.valorTotal)}</td>
                  <td style={S.td}>{f.status === "fechado" ? "Fechado" : "Aberto"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {precos.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <span style={S.label}>TABELA DE PREÇOS</span>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Faixa</th><th style={{ ...S.th, textAlign: "right" }}>Valor / contato</th></tr></thead>
            <tbody>
              {precos.map((p) => (
                <tr key={p.id}>
                  <td style={S.td}>{p.faixa} contatos</td>
                  <td style={{ ...S.td, textAlign: "right", fontWeight: 600, color: C.blue }}>{money(p.valorUnitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ── Loading ──────────────────────────────────────────────────────────── */
function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 48, borderRadius: 10, background: C.bg, animation: "pulse 1.5s infinite" }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
    </div>
  );
}
