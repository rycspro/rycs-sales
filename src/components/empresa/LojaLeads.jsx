import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search, MapPin, Phone, Globe, Star, Plus, Loader2, ChevronRight, ChevronDown,
  Building2, FolderOpen, List, Pencil, Trash2,
  ListPlus, X, Clock, FileText, Store,
  Megaphone, Link2, Unlink, RefreshCw,
  Wallet, Users,
  Utensils, HeartPulse, Dumbbell,
  Building, Scissors, ShoppingBag, Cpu,
} from "lucide-react";
import { api, apiPatch, apiDelete } from "../../lib/api.js";

/* ── helpers ────────────────────────────────────────────────────────────── */
// Renomeia a pasta no servidor e só confirma se o servidor confirmou.
async function salvarNomePasta(pastaId, nome, aviso) {
  const r = await apiPatch(`/loja-leads/pastas/${pastaId}`, { nome });
  if (!r || r.error) { aviso?.(r?.error || "Não foi possível renomear a pasta."); return false; }
  aviso?.("Pasta renomeada.");
  return true;
}
async function carregarTodasListas() {
  const r = await api("/loja-leads/pastas");
  if (!r || !Array.isArray(r.pastas)) return null; // falha de rede/erro: não zere a tela
  const todas = [];
  for (const p of r.pastas) {
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
const CAMPOS_INDISPONIVEIS = new Set([
  "Razão social", "Nome fantasia", "CNPJ", "Segmento / CNAE", "Porte da empresa",
  "Celular", "WhatsApp", "E-mail comercial", "Nome do responsável", "Cargo do responsável",
  "CEP",
  "Instagram", "Facebook", "LinkedIn",
  "Data de abertura", "Situação cadastral", "Capital social",
]);
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
const ALL_CAMPOS = GRUPOS.flatMap((g) => g.campos).filter((f) => !CAMPOS_INDISPONIVEIS.has(f));
const QTDS = [5, 10, 15, 20, 30, 40, 50, 60];

const SEGMENTOS = [
  // Alimentação
  "Restaurantes", "Lanchonetes e fast food", "Padarias e confeitarias", "Cafeterias",
  "Pizzarias", "Hamburguerias", "Food trucks", "Buffets e eventos",
  "Distribuidoras de bebidas", "Sorveterias e açaiterias", "Marmitarias",
  "Bares e pubs", "Docerias e chocolaterias", "Supermercados", "Mercearias e minimercados",
  // Saúde
  "Clínicas médicas", "Clínicas odontológicas", "Consultórios", "Farmácias",
  "Laboratórios e diagnósticos", "Clínicas de estética", "Fisioterapia",
  "Psicólogos e terapeutas", "Nutricionistas", "Clínicas veterinárias",
  "Pet shops", "Hospitais", "Óticas", "Fonoaudiólogos",
  // Beleza e bem-estar
  "Salões de beleza", "Barbearias", "Estúdios de pilates", "Academias",
  "Academias de artes marciais", "Academias de dança", "Spas e day spas",
  "Estúdios de tatuagem e piercing", "Clínicas de depilação",
  "Estúdios de yoga", "Personal trainers",
  // Serviços profissionais
  "Advocacia", "Contabilidade", "Arquitetura e engenharia", "Consultoria empresarial",
  "Agências de marketing", "Agências de publicidade", "Agências de viagens",
  "Escritórios de design", "Estúdios de fotografia", "Produtoras de vídeo",
  "Escritórios de advocacia", "Despachantes", "Corretores de seguros",
  "Consultorias de RH", "Assessoria de imprensa",
  // Comércio e varejo
  "Comércios", "Lojas de roupas e moda", "Lojas de calçados", "Lojas de eletrônicos",
  "Lojas de móveis", "Lojas de materiais de construção", "Papelarias",
  "Lojas de presentes e decoração", "Floriculturas", "Joalherias e bijuterias",
  "Sex shops", "Lojas de brinquedos", "Lojas de cosméticos",
  "Lojas de artigos esportivos", "Lojas de informática",
  // Imóveis e construção
  "Imobiliárias", "Construtoras", "Incorporadoras", "Administradoras de condomínios",
  "Escritórios de arquitetura", "Empresas de reforma", "Paisagismo e jardinagem",
  "Vidraçarias", "Marmorarias", "Energia solar", "Serralheria",
  // Automotivo
  "Oficinas mecânicas", "Autopeças", "Concessionárias", "Lava rápido e estética automotiva",
  "Funilaria e pintura", "Auto elétricas", "Borracharias e pneus",
  "Locadoras de veículos", "Despachantes veiculares",
  // Tecnologia e digital
  "Tecnologia", "Empresas de software", "Agências digitais", "E-commerces",
  "Startups", "Consultorias de TI", "Empresas de automação",
  // Educação
  "Escolas e cursos", "Escolas de idiomas", "Escolas particulares",
  "Faculdades e universidades", "Cursos profissionalizantes", "Autoescolas",
  "Escolas de música", "Cursos online e EAD", "Reforço escolar",
  // Turismo e hospedagem
  "Hotéis e pousadas", "Hostels", "Aluguel de temporada",
  "Guias e operadoras de turismo", "Parques e atrações",
  // Indústria e logística
  "Indústrias", "Transportadoras", "Distribuidoras", "Gráficas",
  "Metalúrgicas", "Fábricas de alimentos", "Embalagens",
  // Financeiro
  "Bancos e fintechs", "Corretoras de investimentos", "Consórcios",
  "Cooperativas de crédito", "Factoring",
  // Outros
  "Escritórios", "Coworkings", "Lavanderias", "Funerárias",
  "Organizadores de eventos", "DJs e bandas", "Chaveiros",
  "Assistência técnica", "Empresas de limpeza", "Empresas de segurança",
  "Igrejas e instituições religiosas", "ONGs e associações",
  "Ar-condicionado e refrigeração", "Dedetizadoras e controle de pragas",
  "Empresas de mudança", "Empresas de pintura", "Eletricistas",
  "Encanadores e hidráulica", "Marcenarias", "Estofarias",
  "Empresas de impermeabilização", "Empresas de desentupimento",
  "Clínicas de reabilitação", "Casas de repouso", "Creches e berçários",
  "Academias de natação", "Escolas de surf e esportes",
];

const PAISES = ["Brasil", "Estados Unidos", "Portugal", "Índia", "Reino Unido", "Argentina", "Chile", "Colômbia", "México", "Paraguai", "Uruguai", "Alemanha", "Espanha", "França", "Itália", "Japão", "Canadá", "Austrália"];

const TIPO_PT_FRONT = {
  point_of_interest: "", establishment: "", place: "", premise: "", street_address: "", route: "", political: "", locality: "", sublocality: "",
  restaurant: "Restaurante", cafe: "Café", bar: "Bar", bakery: "Padaria", food: "Alimentação", meal_delivery: "Delivery", meal_takeaway: "Takeaway",
  dentist: "Dentista", doctor: "Médico", hospital: "Hospital", pharmacy: "Farmácia", health: "Saúde", physiotherapist: "Fisioterapeuta", veterinary_care: "Veterinário",
  gym: "Academia", spa: "Spa", real_estate_agency: "Imobiliária", insurance_agency: "Seguradora", lawyer: "Advocacia", accounting: "Contabilidade", finance: "Financeiro",
  hair_care: "Salão de beleza", beauty_salon: "Salão de beleza", clothing_store: "Loja de roupas", shoe_store: "Loja de calçados",
  shopping_mall: "Shopping", store: "Loja", supermarket: "Supermercado", convenience_store: "Conveniência", electronics_store: "Eletrônicos",
  furniture_store: "Móveis", hardware_store: "Ferragem", jewelry_store: "Joalheria", home_goods_store: "Casa e decoração", pet_store: "Pet shop",
  car_dealer: "Concessionária", car_repair: "Oficina mecânica", car_wash: "Lava-jato", gas_station: "Posto de combustível",
  lodging: "Hospedagem", hotel: "Hotel", school: "Escola", university: "Universidade", church: "Igreja", mosque: "Mesquita",
  plumber: "Encanador", electrician: "Eletricista", painter: "Pintor", roofing_contractor: "Telhados", locksmith: "Chaveiro",
  moving_company: "Mudanças", storage: "Armazenamento", travel_agency: "Agência de viagens", laundry: "Lavanderia",
  manufacturer: "Indústria", general_contractor: "Empreiteira",
};
function traduzirCategoria(cat) {
  if (!cat) return "";
  if (TIPO_PT_FRONT[cat] !== undefined) return TIPO_PT_FRONT[cat] || "";
  if (cat.includes("_")) return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return cat;
}

const ESTADOS_BR = [
  "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal",
  "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul",
  "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí",
  "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia",
  "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins",
];

const CIDADES_POR_ESTADO = {
  "Acre": ["Rio Branco", "Cruzeiro do Sul", "Sena Madureira"],
  "Alagoas": ["Maceió", "Arapiraca", "Palmeira dos Índios", "Rio Largo"],
  "Amapá": ["Macapá", "Santana", "Laranjal do Jari"],
  "Amazonas": ["Manaus", "Parintins", "Itacoatiara", "Manacapuru"],
  "Bahia": ["Salvador", "Feira de Santana", "Vitória da Conquista", "Camaçari", "Ilhéus", "Itabuna", "Lauro de Freitas", "Juazeiro", "Barreiras"],
  "Ceará": ["Fortaleza", "Caucaia", "Juazeiro do Norte", "Maracanaú", "Sobral", "Crato"],
  "Distrito Federal": ["Brasília", "Taguatinga", "Ceilândia", "Águas Claras", "Samambaia"],
  "Espírito Santo": ["Vitória", "Vila Velha", "Serra", "Cariacica", "Linhares", "Cachoeiro de Itapemirim"],
  "Goiás": ["Goiânia", "Aparecida de Goiânia", "Anápolis", "Rio Verde", "Luziânia", "Águas Lindas de Goiás"],
  "Maranhão": ["São Luís", "Imperatriz", "Timon", "Caxias", "Codó"],
  "Mato Grosso": ["Cuiabá", "Várzea Grande", "Rondonópolis", "Sinop", "Tangará da Serra"],
  "Mato Grosso do Sul": ["Campo Grande", "Dourados", "Três Lagoas", "Corumbá", "Ponta Porã"],
  "Minas Gerais": ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim", "Montes Claros", "Ribeirão das Neves", "Uberaba", "Governador Valadares", "Ipatinga", "Poços de Caldas", "Sete Lagoas"],
  "Pará": ["Belém", "Ananindeua", "Santarém", "Marabá", "Parauapebas", "Castanhal"],
  "Paraíba": ["João Pessoa", "Campina Grande", "Santa Rita", "Patos", "Bayeux"],
  "Paraná": ["Curitiba", "Londrina", "Maringá", "Ponta Grossa", "Cascavel", "São José dos Pinhais", "Foz do Iguaçu", "Colombo"],
  "Pernambuco": ["Recife", "Jaboatão dos Guararapes", "Olinda", "Caruaru", "Petrolina", "Paulista", "Cabo de Santo Agostinho"],
  "Piauí": ["Teresina", "Parnaíba", "Picos", "Piripiri", "Floriano"],
  "Rio de Janeiro": ["Rio de Janeiro", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Niterói", "Belford Roxo", "Campos dos Goytacazes", "Petrópolis", "Volta Redonda", "Macaé"],
  "Rio Grande do Norte": ["Natal", "Mossoró", "Parnamirim", "São Gonçalo do Amarante", "Macaíba"],
  "Rio Grande do Sul": ["Porto Alegre", "Caxias do Sul", "Pelotas", "Canoas", "Santa Maria", "Gravataí", "Viamão", "Novo Hamburgo", "São Leopoldo", "Passo Fundo"],
  "Rondônia": ["Porto Velho", "Ji-Paraná", "Ariquemes", "Vilhena", "Cacoal"],
  "Roraima": ["Boa Vista", "Rorainópolis", "Caracaraí"],
  "Santa Catarina": ["Florianópolis", "Joinville", "Blumenau", "São José", "Chapecó", "Itajaí", "Criciúma", "Jaraguá do Sul", "Balneário Camboriú"],
  "São Paulo": ["São Paulo", "Guarulhos", "Campinas", "São Bernardo do Campo", "Santo André", "Osasco", "São José dos Campos", "Ribeirão Preto", "Sorocaba", "Santos", "Mauá", "São José do Rio Preto", "Mogi das Cruzes", "Diadema", "Jundiaí", "Piracicaba", "Carapicuíba", "Bauru", "Itaquaquecetuba", "São Vicente", "Franca", "Praia Grande", "Guarujá", "Taubaté", "Limeira", "Suzano", "Barueri", "Taboão da Serra", "Sumaré", "Marília", "Indaiatuba", "Presidente Prudente", "Cotia", "Araraquara", "Jacareí", "Hortolândia", "São Carlos", "Americana", "Itapevi", "Embu das Artes"],
  "Sergipe": ["Aracaju", "Nossa Senhora do Socorro", "Lagarto", "Itabaiana"],
  "Tocantins": ["Palmas", "Araguaína", "Gurupi", "Porto Nacional"],
};

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* ── ComboBox: input com sugestões filtrando por digitação ────────────── */
function ComboBox({ value, onChange, options, placeholder, label, allowFreeText = false }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(value);
  const ref = useRef(null);

  useEffect(() => { setTexto(value); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtradas = useMemo(() => {
    const t = norm(texto.trim());
    if (!t) return options;
    return options.filter((o) => norm(o).includes(t));
  }, [texto, options]);

  const selecionar = (v) => { setTexto(v); onChange(v); setAberto(false); };

  return (
    <label ref={ref} style={{ position: "relative", display: "block" }}>
      <span className="vx-label">{label}</span>
      <input className="vx-input" value={texto} placeholder={placeholder}
        onChange={(e) => { setTexto(e.target.value); onChange(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)} />
      {aberto && texto.trim() && (
        <div className="ll-combo-list">
          {filtradas.slice(0, 20).map((o) => (
            <div key={o} className={`ll-combo-item ${o === value ? "ll-combo-sel" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); selecionar(o); }}>
              {o}
            </div>
          ))}
          {filtradas.length > 20 && <div className="ll-combo-item vx-mut" style={{ pointerEvents: "none", fontSize: 11.5 }}>+{filtradas.length - 20} resultados — refine a busca</div>}
          {filtradas.length === 0 && allowFreeText && (
            <div className="ll-combo-item" style={{ color: "var(--brand)", fontWeight: 600 }}
              onMouseDown={(e) => { e.preventDefault(); selecionar(texto.trim()); }}>
              Usar: "{texto.trim()}"
            </div>
          )}
        </div>
      )}
    </label>
  );
}

/* ── MultiComboBox: selecionar múltiplos valores com chips ─────────────── */
function MultiComboBox({ selected, onChange, options, placeholder, label }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtradas = useMemo(() => {
    const t = norm(texto.trim());
    const opts = options.filter((o) => !selected.includes(o));
    if (!t) return opts;
    return opts.filter((o) => norm(o).includes(t));
  }, [texto, options, selected]);

  const adicionar = (v) => { onChange([...selected, v]); setTexto(""); };
  const remover = (v) => onChange(selected.filter((s) => s !== v));

  return (
    <div ref={ref} style={{ position: "relative", display: "block" }}>
      <span className="vx-label">{label}</span>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
          {selected.map((s) => (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "2px 8px", borderRadius: 12, background: "var(--brand-50)", color: "var(--brand)", fontWeight: 500 }}>
              {s}
              <span style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, lineHeight: 1 }} onClick={() => remover(s)}>&times;</span>
            </span>
          ))}
        </div>
      )}
      <input className="vx-input" value={texto} placeholder={selected.length ? "Adicionar mais..." : placeholder}
        onChange={(e) => { setTexto(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)} />
      {aberto && (texto.trim() || selected.length === 0) && filtradas.length > 0 && (
        <div className="ll-combo-list">
          {filtradas.slice(0, 20).map((o) => (
            <div key={o} className="ll-combo-item"
              onMouseDown={(e) => { e.preventDefault(); adicionar(o); }}>
              {o}
            </div>
          ))}
          {filtradas.length > 20 && <div className="ll-combo-item vx-mut" style={{ pointerEvents: "none", fontSize: 11.5 }}>+{filtradas.length - 20} resultados — refine a busca</div>}
        </div>
      )}
    </div>
  );
}

/* ═══ Componente principal ════════════════════════════════════════════════ */
export default function LojaLeads({ aviso, role: roleProp }) {
  const [aba, setAba] = useState(0);
  const [ciclo, setCiclo] = useState(null);
  const [consumo, setConsumo] = useState(null);
  const [listas, setListas] = useState([]);
  const [pastas, setPastas] = useState([]);
  const [precos, setPrecos] = useState([]);
  const [detectedRole, setDetectedRole] = useState(null);
  const role = roleProp || detectedRole || "empresa";
  const isEmpresa = role === "empresa";

  useEffect(() => {
    if (!roleProp) api("/auth/me").then((r) => { if (r?.role) setDetectedRole(r.role); });
    api("/loja-leads/ciclo").then(setCiclo);
    api("/loja-leads/consumo").then(setConsumo);
    api("/loja-leads/precos").then((r) => setPrecos(r?.precos || []));
    carregarTodasListas().then((t) => { if (Array.isArray(t)) setListas(t); });
    api("/loja-leads/pastas").then((r) => { if (Array.isArray(r?.pastas)) setPastas(r.pastas); });
  }, []);

  // Só substitui o estado quando a recarga traz dados válidos. Se a chamada
  // falhar (rede/erro), mantém o que já estava na tela — nunca zera tudo.
  const recarregarListas = useCallback(async () => {
    const t = await carregarTodasListas();
    if (Array.isArray(t)) setListas(t);
    const r = await api("/loja-leads/pastas");
    if (Array.isArray(r?.pastas)) setPastas(r.pastas);
  }, []);
  const recarregarCiclo = useCallback(async () => {
    const [c, co] = await Promise.all([api("/loja-leads/ciclo"), api("/loja-leads/consumo")]);
    setCiclo(c); setConsumo(co);
  }, []);

  const precoUnitario = precos.length > 0 ? precos[0].valorUnitario : 0;
  const totalLeads = consumo?.totalRevelados || ciclo?.totalContatos || 0;
  const totalListas = pastas.length;
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
          <button key={i} data-on={aba === i ? "1" : "0"} onClick={() => { setAba(i); recarregarListas(); }}>
            <Icon size={14} style={{ marginRight: 4 }} /> {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="vx-card" style={{ borderRadius: "0 var(--radius-md) var(--radius-md) var(--radius-md)", padding: 20, marginBottom: 20 }}>
        {aba === 0 && <AbaBuscar aviso={aviso} listas={listas} pastas={pastas} precoUnitario={precoUnitario} recarregarCiclo={recarregarCiclo} recarregarListas={recarregarListas} isEmpresa={isEmpresa} ciclo={ciclo} />}
        {aba === 1 && <AbaContatos aviso={aviso} listas={listas} isEmpresa={isEmpresa} />}
        {aba === 2 && <AbaListas aviso={aviso} isEmpresa={isEmpresa} pastas={pastas} recarregar={recarregarListas} />}
        {aba === 3 && <AbaConsumo ciclo={ciclo} />}
      </div>
    </div>
  );
}

/* ═══ ABA 0: Encontrar leads ═════════════════════════════════════════════ */
function AbaBuscar({ aviso, listas, pastas, precoUnitario, recarregarCiclo, recarregarListas, isEmpresa, ciclo }) {
  const [segmento, setSegmento] = useState("");
  const [pais, setPais] = useState("Brasil");
  const [estados, setEstados] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [quantidade, setQuantidade] = useState(20);
  const [campos, setCampos] = useState(() => new Set());
  const [destino, setDestino] = useState("new");
  const [nomeLista, setNomeLista] = useState("");
  const [pastaSel, setPastaSel] = useState(pastas.length ? pastas[0].id : "");
  const [listaExistente, setListaExistente] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => { if (pastas.length && !pastaSel) setPastaSel(pastas[0].id); }, [pastas]);

  const cidadesDisponiveis = useMemo(() => {
    const todas = [];
    for (const e of estados) todas.push(...(CIDADES_POR_ESTADO[e] || []));
    return [...new Set(todas)].sort();
  }, [estados]);
  const valorEstimado = quantidade * precoUnitario;
  const regiao = cidades.length
    ? `${cidades.join(", ")}, ${estados.join(", ")}`
    : estados.length ? estados.join(", ") : pais;
  const destinoLabel = (() => {
    if (destino === "existing") {
      const l = listas.find((x) => String(x.id) === String(listaExistente));
      return l ? `${l.pastaNome} › ${l.nome}` : "A definir";
    }
    const pastaNome = pastas.find((p) => p.id === pastaSel)?.nome || "—";
    const nome = nomeLista.trim() || `${(segmento || "leads").trim()} — ${regiao || pais}`;
    return `${pastaNome} › ${nome}`;
  })();
  const podeEnviar = campos.size > 0 && segmento.trim();

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

    const body = { texto: segmento.trim(), regiao: regiao.trim(), quantidade };

    if (destino === "existing" && listaExistente) {
      body.listaId = listaExistente;
    } else if (destino === "new") {
      body.novaLista = nomeLista.trim() || `${segmento.trim()} — ${regiao.trim() || new Date().toLocaleDateString("pt-BR")}`;
      body.descricaoLista = `${segmento} — ${regiao || pais}`;
      if (pastaSel) body.novaPasta = pastaSel;
    }

    const r = await api("/loja-leads/buscar", body);
    if (!r || r.error) { setOcupado(false); setFeedback(r?.error || "Erro ao buscar."); return aviso?.(r?.error || "Erro ao buscar."); }
    const contatos = r.contatos || [];
    if (!contatos.length) { setOcupado(false); setFeedback("Nenhum resultado encontrado para esta busca."); return aviso?.("Nenhum resultado."); }

    const novos = r.adicionados ?? contatos.length;
    const repetidos = contatos.length - novos;
    const msg = repetidos > 0
      ? `${novos} novo(s) lead(s) na lista (${repetidos} já estavam lá).`
      : `${novos} lead(s) adicionado(s) à lista.`;
    setFeedback(msg);
    aviso?.(msg);

    setOcupado(false);
    recarregarCiclo?.();
    recarregarListas?.();
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
              <div className="vx-grid vx-g2" style={{ gap: 12 }}>
                <ComboBox label="Segmento ou tipo de empresa" value={segmento} onChange={setSegmento}
                  options={SEGMENTOS} placeholder="Digite para buscar..." allowFreeText />
                <ComboBox label="País" value={pais} onChange={setPais}
                  options={PAISES} placeholder="Digite o país..." />
              </div>
              <div className="vx-grid vx-g2" style={{ gap: 12 }}>
                <MultiComboBox label="Estado (opcional — vazio = país inteiro)" selected={estados} onChange={(v) => { setEstados(v); setCidades((prev) => prev.filter((c) => { const validas = new Set(); v.forEach((e) => (CIDADES_POR_ESTADO[e] || []).forEach((ci) => validas.add(ci))); return validas.has(c); })); }}
                  options={ESTADOS_BR} placeholder="Todos os estados" />
                <MultiComboBox label="Cidade (opcional — vazio = estado inteiro)" selected={cidades} onChange={setCidades}
                  options={cidadesDisponiveis} placeholder={estados.length ? "Todas as cidades" : "Selecione um estado primeiro"} />
              </div>
            </div>
          </div>

          {/* Quantidade */}
          <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <span className="vx-label">QUANTIDADE DE LEADS (máx. 60 por busca)</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {QTDS.map((q) => (
                <button key={q} onClick={() => setQuantidade(q)}
                  className={`vx-btn ${quantidade === q ? "vx-btn-primary" : ""}`}
                  style={{ flex: 1, minWidth: 50 }}>
                  {q}
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
                const disponiveis = g.campos.filter((f) => !CAMPOS_INDISPONIVEIS.has(f));
                const selCount = disponiveis.filter((f) => campos.has(f)).length;
                const allSel = disponiveis.length > 0 && selCount === disponiveis.length;
                return (
                  <div key={g.key} className="vx-card" style={{ padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                      <g.Icon size={18} style={{ color: "var(--brand)", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{g.label}</div>
                        <span className="vx-mut" style={{ fontSize: 11 }}>{selCount} de {disponiveis.length} selecionadas</span>
                      </div>
                      {disponiveis.length > 0 && (
                        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, cursor: "pointer" }}>
                          <input type="checkbox" checked={allSel}
                            ref={(el) => { if (el) el.indeterminate = selCount > 0 && !allSel; }}
                            onChange={() => toggleGrupo(disponiveis)}
                            style={{ accentColor: "var(--brand)", width: 16, height: 16 }} />
                          Todos
                        </label>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {g.campos.map((f) => {
                        const indisponivel = CAMPOS_INDISPONIVEIS.has(f);
                        return (
                          <label key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: indisponivel ? "default" : "pointer", opacity: indisponivel ? 0.45 : 1 }}>
                            <input type="checkbox" checked={!indisponivel && campos.has(f)} disabled={indisponivel}
                              onChange={() => !indisponivel && toggleCampo(f)}
                              style={{ accentColor: "var(--brand)", width: 16, height: 16, flexShrink: 0 }} />
                            <span style={indisponivel ? { textDecoration: "line-through" } : undefined}>{f}</span>
                            {indisponivel && <span style={{ fontSize: 10, color: "var(--muted-2)", marginLeft: "auto", whiteSpace: "nowrap" }}>Em breve</span>}
                          </label>
                        );
                      })}
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
              {destino === "new" && pastas.length > 0 && (
                <label>
                  <span className="vx-label">Pasta</span>
                  <select className="vx-input" value={pastaSel} onChange={(e) => setPastaSel(e.target.value)}>
                    {pastas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </label>
              )}
              {destino === "new" && (
                <label>
                  <span className="vx-label">Nome da lista</span>
                  <input className="vx-input" placeholder="Nome da nova lista" value={nomeLista} onChange={(e) => setNomeLista(e.target.value)} />
                </label>
              )}
              {destino === "existing" && (
                <label>
                  <span className="vx-label">Lista</span>
                  <select className="vx-input" value={listaExistente} onChange={(e) => setListaExistente(e.target.value)}>
                    <option value="">Selecione</option>
                    {listas.map((l) => <option key={l.id} value={l.id}>{l.pastaNome} › {l.nome}</option>)}
                  </select>
                </label>
              )}
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
              ["Destino", destinoLabel || "A definir"],
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
        .ll-combo-list{position:absolute;top:100%;left:0;right:0;z-index:50;max-height:320px;overflow-y:auto;background:var(--surface-solid,#fff);border:1px solid var(--border-strong);border-radius:var(--radius-sm);box-shadow:var(--shadow-pop);margin-top:4px}
        .ll-combo-item{padding:9px 12px;font-size:13px;cursor:pointer;transition:background .1s}
        .ll-combo-item:hover{background:var(--brand-50)}
        .ll-combo-sel{background:var(--brand-50);font-weight:600}
      `}</style>
    </>
  );
}

/* ═══ ABA 1: Meus contatos ═══════════════════════════════════════════════ */
function AbaContatos({ aviso, listas, isEmpresa }) {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [drawer, setDrawer] = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [filtroLista, setFiltroLista] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");

  const recarregar = useCallback(() => { api("/loja-leads/revelados").then((r) => { setContatos(r?.contatos || []); setLoading(false); }); }, []);
  useEffect(recarregar, []);

  const segmentos = useMemo(() => [...new Set(contatos.map((c) => traduzirCategoria(c.categoria)).filter(Boolean))].sort(), [contatos]);
  const listasUnicas = useMemo(() => {
    const m = new Map();
    for (const c of contatos) for (const l of (c.listas || [])) if (!m.has(l.id)) m.set(l.id, l);
    return [...m.values()];
  }, [contatos]);
  const responsaveis = useMemo(() => {
    const m = new Map();
    for (const c of contatos) if (c.respVendedorId) m.set(c.respVendedorId, { id: c.respVendedorId, nome: c.respNome });
    return [...m.values()];
  }, [contatos]);

  const filtrados = useMemo(() => {
    let arr = contatos;
    const t = busca.toLowerCase().trim();
    if (t) arr = arr.filter((c) => [c.nome, c.endereco, traduzirCategoria(c.categoria)].some((v) => (v || "").toLowerCase().includes(t)));
    if (filtroSegmento) arr = arr.filter((c) => traduzirCategoria(c.categoria) === filtroSegmento);
    if (filtroLista) arr = arr.filter((c) => (c.listas || []).some((l) => l.id === filtroLista));
    if (filtroResponsavel) arr = arr.filter((c) => c.respVendedorId === filtroResponsavel);
    return arr;
  }, [contatos, busca, filtroSegmento, filtroLista, filtroResponsavel]);

  const todosSelecionados = filtrados.length > 0 && filtrados.every((c) => selecionados.has(c.id));
  const toggleTodos = () => {
    if (todosSelecionados) setSelecionados(new Set());
    else setSelecionados(new Set(filtrados.map((c) => c.id)));
  };
  const toggleUm = (id) => setSelecionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

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
      <div className="vx-row" style={{ marginBottom: 4 }}>
        <div>
          <div className="vx-disp" style={{ fontSize: 17 }}>Meus contatos</div>
          <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>Minha carteira de contatos comerciais.</p>
        </div>
        {selecionados.size > 0 && (
          <span className="vx-mut" style={{ fontSize: 12 }}>{selecionados.size} selecionado(s)</span>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, marginTop: 12 }}>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input className="vx-input" style={{ paddingLeft: 36 }} placeholder="Buscar por nome, segmento ou localização..."
            value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select className="vx-input" style={{ flex: "0 0 auto", minWidth: 140 }} value={filtroSegmento} onChange={(e) => setFiltroSegmento(e.target.value)}>
          <option value="">Segmento</option>
          {segmentos.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {listasUnicas.length > 0 && (
          <select className="vx-input" style={{ flex: "0 0 auto", minWidth: 140 }} value={filtroLista} onChange={(e) => setFiltroLista(e.target.value)}>
            <option value="">Lista / Pasta</option>
            {listasUnicas.map((l) => <option key={l.id} value={l.id}>{l.pastaNome} › {l.nome}</option>)}
          </select>
        )}
        {responsaveis.length > 0 && (
          <select className="vx-input" style={{ flex: "0 0 auto", minWidth: 140 }} value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
            <option value="">Responsável</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome || "Sem nome"}</option>)}
          </select>
        )}
      </div>

      <div className="vx-table-wrap">
        <table className="vx-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos}
                  style={{ accentColor: "var(--brand)", width: 16, height: 16 }} />
              </th>
              <th>Empresa</th>
              <th>Segmento</th>
              <th>Localização</th>
              <th>Telefone</th>
              <th>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id} onClick={() => setDrawer(c)} style={{ cursor: "pointer", background: selecionados.has(c.id) ? "var(--brand-50)" : undefined }}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selecionados.has(c.id)} onChange={() => toggleUm(c.id)}
                    style={{ accentColor: "var(--brand)", width: 16, height: 16 }} />
                </td>
                <td style={{ fontWeight: 600 }}>{c.nome || "—"}</td>
                <td>{traduzirCategoria(c.categoria) || "—"}</td>
                <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.endereco || "—"}</td>
                <td>{c.telefone ? <a href={`tel:${c.telefone}`} style={{ color: "var(--brand)", textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{c.telefone}</a> : "—"}</td>
                <td>
                  {c.respVendedorId ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {c.respFoto
                        ? <img src={c.respFoto} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                        : <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--brand)" }}>{(c.respNome || "?")[0].toUpperCase()}</div>
                      }
                      <span style={{ fontSize: 12.5 }}>{c.respNome || "—"}</span>
                    </div>
                  ) : <span className="vx-mut" style={{ fontSize: 12 }}>—</span>}
                </td>
              </tr>
            ))}
            {!filtrados.length && <tr><td colSpan={6} style={{ textAlign: "center" }} className="vx-mut">Nenhum contato encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {drawer && <DrawerContato contato={drawer} onClose={() => { setDrawer(null); recarregar(); }} listas={listas} aviso={aviso} isEmpresa={isEmpresa} />}
    </>
  );
}

/* ── Drawer contato ──────────────────────────────────────────────────────── */
function DrawerContato({ contato: c, onClose, listas, aviso, isEmpresa }) {
  const [historico, setHistorico] = useState([]);
  const [novoTexto, setNovoTexto] = useState("");
  const [tipoNota, setTipoNota] = useState("nota");
  const [loadingHist, setLoadingHist] = useState(true);

  useEffect(() => {
    api(`/loja-leads/contato/${c.id}/historico`).then((r) => { setHistorico(r?.historico || []); setLoadingHist(false); });
  }, [c.id]);

  const addToList = async (listaId) => {
    const r = await api("/loja-leads/listas/adicionar", { listaId, contatoId: c.id });
    if (r?.error) return aviso?.(r.error);
    aviso?.("Contato adicionado à lista.");
  };

  const salvarNota = async () => {
    if (!novoTexto.trim()) return;
    const r = await api(`/loja-leads/contato/${c.id}/historico`, { tipo: tipoNota, texto: novoTexto.trim() });
    if (r?.id) {
      setHistorico((prev) => [{ ...r, tipo: tipoNota, texto: novoTexto.trim(), vendedorNome: "", vendedorFoto: "" }, ...prev]);
      setNovoTexto("");
      aviso?.("Registro adicionado ao histórico.");
    }
  };

  const fmtData = (ts) => ts ? new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const TIPOS_HIST = { nota: "Nota", ligacao: "Ligação", email: "E-mail", reuniao: "Reunião", visita: "Visita", proposta: "Proposta" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.3)" }} onClick={onClose} />
      <div style={{ position: "relative", width: 440, maxWidth: "90vw", height: "100%", background: "var(--surface-solid)", overflowY: "auto", padding: "20px 18px", boxShadow: "var(--shadow-pop)" }}>
        <div className="vx-row" style={{ marginBottom: 16 }}>
          <div className="vx-disp" style={{ fontSize: 17 }}>Detalhes do contato</div>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div className="vx-empty-icon" style={{ width: 42, height: 42, borderRadius: 12 }}><Building2 size={20} /></div>
          <div>
            <div style={{ fontWeight: 700 }}>{c.nome || "Sem nome"}</div>
            {traduzirCategoria(c.categoria) && <span className="vx-mut" style={{ fontSize: 12 }}>{traduzirCategoria(c.categoria)}</span>}
          </div>
        </div>
        <div className="vx-grid" style={{ gap: 6 }}>
          {c.endereco && <InfoRow icon={<MapPin size={14} />} label="Endereço" value={c.endereco} />}
          {c.telefone && <InfoRow icon={<Phone size={14} />} label="Telefone" value={c.telefone} href={`tel:${c.telefone}`} />}
          {c.site && <InfoRow icon={<Globe size={14} />} label="Website" value={c.site.replace(/^https?:\/\//, "")} href={c.site} />}
          {c.rating > 0 && <InfoRow icon={<Star size={14} />} label="Google" value={`${c.rating.toFixed(1)} (${c.totalAvaliacoes || 0} avaliações)`} />}
        </div>

        {/* Listas onde está */}
        {(c.listas || []).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <span className="vx-label">Listas</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {c.listas.map((l) => (
                <span key={l.id} style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 20, background: "var(--brand-50)", color: "var(--brand)", fontWeight: 500 }}>
                  {l.pastaNome} › {l.nome}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Responsável */}
        {c.respVendedorId && (
          <div style={{ marginTop: 16 }}>
            <span className="vx-label">Profissional responsável</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              {c.respFoto
                ? <img src={c.respFoto} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>{(c.respNome || "?")[0].toUpperCase()}</div>
              }
              <span style={{ fontWeight: 600, fontSize: 13 }}>{c.respNome}</span>
            </div>
          </div>
        )}

        {/* Adicionar a lista */}
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

        {/* Histórico */}
        <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <span className="vx-label">Histórico de interações</span>
          {!isEmpresa && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <select className="vx-input" style={{ flex: "0 0 auto", minWidth: 100, fontSize: 12.5 }} value={tipoNota} onChange={(e) => setTipoNota(e.target.value)}>
                {Object.entries(TIPOS_HIST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className="vx-input" style={{ flex: 1, fontSize: 12.5 }} placeholder="Adicionar registro..." value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvarNota()} />
              <button className="vx-btn vx-btn-sm" onClick={salvarNota} disabled={!novoTexto.trim()} style={{ flexShrink: 0 }}>
                <Plus size={14} />
              </button>
            </div>
          )}
          {loadingHist ? <div className="vx-mut" style={{ fontSize: 12, marginTop: 8 }}>Carregando...</div> : (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {historico.length === 0 && <div className="vx-mut" style={{ fontSize: 12 }}>Nenhum registro ainda.</div>}
              {historico.map((h) => (
                <div key={h.id} style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, background: "var(--surface-2)" }}>
                  <div style={{ flex: "0 0 auto", marginTop: 2 }}>
                    {h.vendedorFoto
                      ? <img src={h.vendedorFoto} alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                      : <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "var(--brand)" }}>{(h.vendedorNome || "?")[0].toUpperCase()}</div>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{h.vendedorNome || "Sistema"}</span>
                      <span className="vx-mut" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{fmtData(h.criadoEm)}</span>
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "var(--brand-50)", color: "var(--brand)", fontWeight: 500, marginRight: 6 }}>{TIPOS_HIST[h.tipo] || h.tipo}</span>
                      {h.texto}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
function AbaListas({ aviso, isEmpresa, pastas, recarregar }) {
  const [pastaAberta, setPastaAberta] = useState(null);
  const [listaAberta, setListaAberta] = useState(null);

  // Mantém a pasta/lista aberta em sincronia com os dados atualizados do pai.
  const pastaAbertaViva = pastaAberta ? pastas.find((p) => p.id === pastaAberta.id) || pastaAberta : null;

  if (listaAberta) return <VistaLista lista={listaAberta} aviso={aviso} voltar={() => { setListaAberta(null); recarregar?.(); }} isEmpresa={isEmpresa} />;
  if (pastaAbertaViva) return <VistaPasta pasta={pastaAbertaViva} aviso={aviso} voltar={() => { setPastaAberta(null); recarregar?.(); }} abrirLista={setListaAberta} recarregarPai={recarregar} pastas={pastas} />;

  const novaPasta = async () => {
    const r = await api("/loja-leads/pastas", { nome: "Nova pasta" });
    if (r?.error) return aviso?.(r.error);
    await recarregar?.();
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
  const [listasInterna, setListasInterna] = useState([]);
  // O card sempre reflete o nome salvo no servidor.
  useEffect(() => { if (!editando) setNome(pasta.nome); }, [pasta.nome, editando]);
  const salvar = async () => {
    const n = nome.trim();
    if (!n) return;
    if (n === pasta.nome) return setEditando(false);
    if (await salvarNomePasta(pasta.id, n, aviso)) { setEditando(false); await onAtualizar?.(); }
  };
  const excluir = async () => { if (!confirm(`Excluir pasta "${pasta.nome}" e todas as listas dentro dela?`)) return; const r = await apiDelete(`/loja-leads/pastas/${pasta.id}`); if (!r || r.error) return aviso?.(r?.error || "Não foi possível excluir a pasta."); aviso?.("Pasta excluída."); onAtualizar?.(); };

  useEffect(() => { api(`/loja-leads/listas/${pasta.id}`).then((r) => { if (Array.isArray(r?.listas)) setListasInterna(r.listas); }); }, [pasta.id, pasta.totalListas, pasta.totalContatos]);

  return (
    <div className="vx-card" style={{ padding: 16, cursor: editando ? "default" : "pointer", display: "grid", gap: 8 }} onClick={!editando ? onAbrir : undefined}>
      <FolderOpen size={20} style={{ color: "var(--brand)" }} />
      {editando ? (
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <input className="vx-input" aria-label="Nome da pasta" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") salvar(); if (e.key === "Escape") { setNome(pasta.nome); setEditando(false); } }} autoFocus />
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={salvar}>OK</button>
        </div>
      ) : (
        <>
          <strong>{pasta.nome}</strong>
          <span className="vx-mut" style={{ fontSize: 12 }}>{pasta.totalContatos || 0} contato(s)</span>
          {listasInterna.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
              {listasInterna.map((l) => (
                <span key={l.id} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "var(--brand-50)", color: "var(--brand)", fontWeight: 500 }}>
                  {l.nome} ({l.totalContatos || 0})
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" title="Renomear pasta" aria-label="Renomear pasta" onClick={() => setEditando(true)}><Pencil size={13} /></button>
            <button className="vx-btn vx-btn-danger vx-btn-sm" title="Excluir pasta" aria-label="Excluir pasta" onClick={excluir}><Trash2 size={13} /></button>
          </div>
        </>
      )}
    </div>
  );
}

function VistaPasta({ pasta, aviso, voltar, abrirLista, recarregarPai, pastas = [] }) {
  const [listas, setListas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomePasta, setNomePasta] = useState(pasta.nome);
  useEffect(() => { if (!editandoNome) setNomePasta(pasta.nome); }, [pasta.nome, editandoNome]);
  const salvarNome = async () => {
    const n = nomePasta.trim();
    if (!n) return;
    if (n === pasta.nome) return setEditandoNome(false);
    if (await salvarNomePasta(pasta.id, n, aviso)) { setEditandoNome(false); await recarregarPai?.(); }
  };
  const recarregar = useCallback(async () => {
    const r = await api(`/loja-leads/listas/${pasta.id}`);
    setListas(r?.listas || []);
    recarregarPai?.();
  }, [pasta.id, recarregarPai]);
  useEffect(() => { recarregar().then(() => setLoading(false)); }, []);

  const novaLista = async (parentId) => {
    const r = await api("/loja-leads/listas", { pastaId: pasta.id, nome: parentId ? "Nova sub-lista" : "Nova lista", parentId: parentId || undefined });
    if (r?.error) return aviso?.(r.error);
    await recarregar();
  };

  if (loading) return <Loading />;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 14 }}>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={voltar} style={{ padding: 0 }}>Minhas Listas</button>
        <ChevronRight size={13} className="vx-mut" />
        {editandoNome ? (
          <>
            <input className="vx-input" aria-label="Nome da pasta" value={nomePasta} onChange={(e) => setNomePasta(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") salvarNome(); if (e.key === "Escape") { setNomePasta(pasta.nome); setEditandoNome(false); } }} autoFocus style={{ maxWidth: 260 }} />
            <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={salvarNome}>OK</button>
          </>
        ) : (
          <>
            <strong>{pasta.nome}</strong>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" title="Renomear pasta" aria-label="Renomear pasta" onClick={() => setEditandoNome(true)}><Pencil size={13} /></button>
          </>
        )}
      </div>
      <div className="vx-row" style={{ marginBottom: 14 }}>
        <span className="vx-mut" style={{ fontSize: 13 }}>{listas.length} lista(s) nesta pasta</span>
        <button className="vx-btn vx-btn-sm" onClick={() => novaLista()}><Plus size={14} /> Nova lista</button>
      </div>
      {!listas.length && <div className="vx-empty"><h2>Nenhuma lista nesta pasta.</h2></div>}
      <div className="vx-grid vx-g3" style={{ gap: 12 }}>
        {listas.map((l) => (
          <ListaCardSimple key={l.id} lista={l} aviso={aviso} onAbrir={() => abrirLista(l)} onAtualizar={recarregar} onCriarSub={(pai) => novaLista(pai.id)} onAbrirSub={(s) => abrirLista(s)} pastas={pastas} pastaAtual={pasta.id} />
        ))}
      </div>
    </>
  );
}

function ListaCardSimple({ lista, aviso, onAbrir, onAtualizar, onCriarSub, onAbrirSub, pastas = [], pastaAtual }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(lista.nome);
  const [expandido, setExpandido] = useState(false);
  const [movendo, setMovendo] = useState(false);
  const subs = lista.subListas || [];
  const outrasPastas = pastas.filter((p) => p.id !== pastaAtual);
  useEffect(() => { if (!editando) setNome(lista.nome); }, [lista.nome, editando]);
  const salvar = async () => { if (!nome.trim()) return; const r = await apiPatch(`/loja-leads/listas/${lista.id}`, { nome: nome.trim() }); if (!r || r.error) return aviso?.(r?.error || "Não foi possível renomear a lista."); setEditando(false); aviso?.("Lista renomeada."); onAtualizar?.(); };
  const excluir = async () => { if (!confirm(`Excluir lista "${lista.nome}"?`)) return; const r = await apiDelete(`/loja-leads/listas/${lista.id}`); if (r?.error) return aviso?.(r.error); aviso?.("Lista excluída."); onAtualizar?.(); };
  const mover = async (pastaId) => { if (!pastaId) return; const r = await apiPatch(`/loja-leads/listas/${lista.id}`, { pastaId }); if (!r || r.error) return aviso?.(r?.error || "Não foi possível mover a lista."); setMovendo(false); aviso?.("Lista movida."); onAtualizar?.(); };

  return (
    <div className="vx-card" style={{ padding: 0, display: "grid", gap: 0 }}>
      <div style={{ padding: 16, cursor: editando ? "default" : "pointer", display: "grid", gap: 8 }} onClick={!editando ? onAbrir : undefined}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <List size={20} style={{ color: "var(--brand)" }} />
          {subs.length > 0 && (
            <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 2, marginLeft: "auto" }} onClick={(e) => { e.stopPropagation(); setExpandido(!expandido); }}>
              {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ fontSize: 11 }}>{subs.length}</span>
            </button>
          )}
        </div>
        {editando ? (
          <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
            <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && salvar()} autoFocus />
            <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={salvar}>OK</button>
          </div>
        ) : (
          <>
            <strong>{lista.nome}</strong>
            <span className="vx-mut" style={{ fontSize: 12 }}>{lista.totalContatos ?? 0} contato(s){subs.length > 0 ? ` · ${subs.length} sub-lista(s)` : ""}</span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setEditando(true)}><Pencil size={13} /></button>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" title="Criar sub-lista" onClick={() => onCriarSub?.(lista)}><Plus size={13} /></button>
              {outrasPastas.length > 0 && (
                <button className="vx-btn vx-btn-ghost vx-btn-sm" title="Mover para outra pasta" onClick={() => setMovendo((v) => !v)}><FolderOpen size={13} /></button>
              )}
              <button className="vx-btn vx-btn-danger vx-btn-sm" onClick={excluir}><Trash2 size={13} /></button>
            </div>
            {movendo && outrasPastas.length > 0 && (
              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 2 }}>
                <span className="vx-label" style={{ fontSize: 11 }}>Mover para a pasta</span>
                <select className="vx-input" defaultValue="" onChange={(e) => mover(e.target.value)}>
                  <option value="" disabled>Selecione...</option>
                  {outrasPastas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            )}
          </>
        )}
      </div>
      {expandido && subs.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "8px 16px 12px", display: "grid", gap: 6 }}>
          {subs.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer", background: "var(--bg-hover, rgba(0,0,0,0.03))" }} onClick={() => onAbrirSub?.(s)}>
              <List size={14} style={{ color: "var(--brand-400, var(--brand))", opacity: 0.7 }} />
              <span style={{ fontSize: 13, flex: 1 }}>{s.nome}</span>
              <span className="vx-mut" style={{ fontSize: 11 }}>{s.totalContatos ?? 0}</span>
            </div>
          ))}
        </div>
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

  const fmt = (ts) => ts ? new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

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
