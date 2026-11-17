import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Camera, X, CheckCircle, XCircle, Plus, Trash2, Upload, FileText, Star, ZoomIn, Image as ImageIcon } from "lucide-react";
import ComboSelect from "../ui/ComboSelect.jsx";
import MultiSelect from "../ui/MultiSelect.jsx";
import Termos from "./Termos.jsx";
import OnboardingProfissional from "./OnboardingProfissional.jsx";
import { FUNCOES, ORDEM_FUNCOES } from "../../../shared/funcoes.js";
import { PAISES, ESTADOS_BR, CIDADES_BR, IDIOMAS, NIVEIS_IDIOMA, telefoneValido, normalizarTelefoneIntl, SUBDIVISOES, SUBDIVISAO_LABEL } from "../../../shared/localidades.js";
import CampoTelefone from "../CampoTelefone.jsx";
import { ROTAS, navegar, parametro } from "../../lib/rotas.js";
import { LIMITES, avaliarFoto, GUIA_FOTO, exemploEnquadramento } from "../../../shared/fotoPerfil.js";
import { useI18n } from "../../lib/i18n.jsx";

/* ─── constantes visuais ─── */
const AZUL = "#318CE7";
const MAX_W = 840;

const ETAPAS_KEYS = ["pessoal", "profissional", "experiencia"];

/* ─── Opções padronizadas dos novos campos ─── */
const AREAS_ATUACAO = [
  { value: "b2b", label: "B2B (Venda para empresas)" },
  { value: "b2c", label: "B2C (Venda para consumidor final)" },
  { value: "inside-sales", label: "Inside Sales (Vendas remotas)" },
  { value: "field-sales", label: "Field Sales (Vendas presenciais)" },
  { value: "porta-a-porta", label: "Porta a porta / PAP" },
  { value: "vendas-consultivas", label: "Vendas consultivas / Solução" },
  { value: "vendas-recorrentes", label: "Vendas recorrentes / Assinatura" },
  { value: "vendas-tecnicas", label: "Vendas técnicas / Pré-vendas" },
  { value: "canais-parceiros", label: "Canais / Parceiros / Revenda" },
  { value: "inbound", label: "Inbound Sales" },
  { value: "outbound", label: "Outbound / Prospecção ativa" },
  { value: "social-selling", label: "Social Selling (LinkedIn, redes)" },
  { value: "account-management", label: "Account Management / Gestão de contas" },
  { value: "hunting", label: "Hunting (abertura de mercado)" },
  { value: "farming", label: "Farming (expansão de carteira)" },
  { value: "exportacao", label: "Exportação / Comércio exterior" },
];

const HABILIDADES = [
  { value: "prospeccao", label: "Prospecção ativa" },
  { value: "qualificacao-leads", label: "Qualificação de leads" },
  { value: "negociacao", label: "Negociação e fechamento" },
  { value: "apresentacao", label: "Apresentação de produtos/serviços" },
  { value: "cold-call", label: "Cold call / Ligações frias" },
  { value: "cold-email", label: "Cold e-mail / Outbound" },
  { value: "follow-up", label: "Follow-up e nutrição de leads" },
  { value: "rapport", label: "Rapport e relacionamento" },
  { value: "contorno-objecoes", label: "Contorno de objeções" },
  { value: "upsell-cross", label: "Upsell / Cross-sell" },
  { value: "pos-venda", label: "Pós-venda e retenção" },
  { value: "atendimento", label: "Atendimento ao cliente" },
  { value: "redacao-comercial", label: "Redação comercial / Copywriting" },
  { value: "analise-dados", label: "Análise de dados de vendas" },
  { value: "demos", label: "Demonstrações de produto / Demos" },
  { value: "escuta-ativa", label: "Escuta ativa" },
];

const ANOS_EXPERIENCIA = [
  { value: "menos-1", label: "Menos de 1 ano" },
  { value: "1-2", label: "1 a 2 anos" },
  { value: "3-5", label: "3 a 5 anos" },
  { value: "6-10", label: "6 a 10 anos" },
  { value: "mais-10", label: "Mais de 10 anos" },
];

const DISPONIBILIDADE = [
  { value: "integral", label: "Integral (40h+/semana)" },
  { value: "parcial-30", label: "Parcial (20–30h/semana)" },
  { value: "parcial-20", label: "Parcial (10–20h/semana)" },
  { value: "horista", label: "Horista (menos de 10h/semana)" },
  { value: "fins-semana", label: "Somente fins de semana" },
  { value: "noturno", label: "Somente período noturno" },
];

const SEGMENTOS = [
  { value: "tecnologia-saas", label: "Tecnologia / SaaS / Software" },
  { value: "ti-infraestrutura", label: "TI / Infraestrutura / Cloud" },
  { value: "telecomunicacoes", label: "Telecomunicações" },
  { value: "financeiro-banking", label: "Financeiro / Banking / Fintechs" },
  { value: "seguros", label: "Seguros" },
  { value: "contabilidade", label: "Contabilidade / Auditoria" },
  { value: "saude-hospitalar", label: "Saúde / Hospitalar / Clínicas" },
  { value: "farmaceutico", label: "Farmacêutico / Dispositivos médicos" },
  { value: "educacao-edtech", label: "Educação / EdTech / Cursos" },
  { value: "industria-manufatura", label: "Indústria / Manufatura" },
  { value: "automotivo", label: "Automotivo / Concessionárias" },
  { value: "construcao-civil", label: "Construção civil / Engenharia" },
  { value: "imobiliario", label: "Imobiliário / Incorporadoras" },
  { value: "energia-solar", label: "Energia / Energia solar" },
  { value: "agronegocio", label: "Agronegócio / Agritech" },
  { value: "alimentos-bebidas", label: "Alimentos e bebidas" },
  { value: "varejo-comercio", label: "Varejo / Comércio" },
  { value: "atacado-distribuicao", label: "Atacado / Distribuição" },
  { value: "e-commerce", label: "E-commerce / Marketplace" },
  { value: "moda-beleza", label: "Moda / Beleza / Cosméticos" },
  { value: "turismo-hotelaria", label: "Turismo / Hotelaria / Viagens" },
  { value: "entretenimento", label: "Entretenimento / Eventos" },
  { value: "logistica-transporte", label: "Logística / Transporte / Frete" },
  { value: "juridico", label: "Jurídico / Legal / Compliance" },
  { value: "rh-recrutamento", label: "RH / Recrutamento / Gestão de pessoas" },
  { value: "marketing-publicidade", label: "Marketing / Publicidade / Agências" },
  { value: "consultoria", label: "Consultoria empresarial" },
  { value: "servicos-gerais", label: "Serviços gerais / Facilities" },
  { value: "seguranca", label: "Segurança / Monitoramento" },
  { value: "pet-veterinario", label: "Pet / Veterinário" },
  { value: "fitness-esportes", label: "Fitness / Esportes / Wellness" },
  { value: "religioso-igrejas", label: "Religioso / Igrejas" },
  { value: "governo-setor-publico", label: "Governo / Setor público" },
  { value: "ongs-terceiro-setor", label: "ONGs / Terceiro setor" },
  { value: "startups", label: "Startups em geral" },
  { value: "franquias", label: "Franquias" },
  { value: "meio-ambiente", label: "Meio ambiente / Sustentabilidade" },
  { value: "mineracao", label: "Mineração / Siderurgia" },
  { value: "quimica-plasticos", label: "Química / Plásticos / Embalagens" },
  { value: "grafica-impressao", label: "Gráfica / Impressão / Sinalização" },
];

const FERRAMENTAS = [
  // CRMs
  { value: "hubspot", label: "HubSpot CRM" },
  { value: "salesforce", label: "Salesforce" },
  { value: "pipedrive", label: "Pipedrive" },
  { value: "rd-station-crm", label: "RD Station CRM" },
  { value: "ploomes", label: "Ploomes" },
  { value: "bitrix24", label: "Bitrix24" },
  { value: "zoho-crm", label: "Zoho CRM" },
  { value: "agendor", label: "Agendor" },
  { value: "moskit", label: "Moskit CRM" },
  { value: "nectar-crm", label: "Nectar CRM" },
  { value: "funildevendas", label: "Funil de Vendas CRM" },
  { value: "freshsales", label: "Freshsales" },
  { value: "close-crm", label: "Close CRM" },
  { value: "monday-crm", label: "Monday Sales CRM" },
  { value: "dynamics-365", label: "Microsoft Dynamics 365" },
  { value: "oracle-sales", label: "Oracle Sales Cloud" },
  { value: "sugar-crm", label: "SugarCRM" },
  { value: "insightly", label: "Insightly" },
  { value: "copper", label: "Copper (Google CRM)" },
  // Prospecção e enriquecimento
  { value: "linkedin-navigator", label: "LinkedIn Sales Navigator" },
  { value: "apollo", label: "Apollo.io" },
  { value: "lusha", label: "Lusha" },
  { value: "zoominfo", label: "ZoomInfo" },
  { value: "snov-io", label: "Snov.io" },
  { value: "hunter-io", label: "Hunter.io" },
  { value: "leadster", label: "Leadster" },
  { value: "ramper", label: "Ramper" },
  { value: "econodata", label: "Econodata" },
  { value: "speedio", label: "Speedio" },
  { value: "cnpj-biz", label: "CNPJ.biz / Dados públicos" },
  { value: "clearbit", label: "Clearbit" },
  { value: "seamless-ai", label: "Seamless.AI" },
  { value: "linkedin-recruiter", label: "LinkedIn Recruiter" },
  // Engajamento e automação de vendas
  { value: "outreach", label: "Outreach" },
  { value: "salesloft", label: "SalesLoft" },
  { value: "meetime", label: "Meetime" },
  { value: "exact-sales", label: "Exact Sales (Spotter)" },
  { value: "reev", label: "Reev" },
  { value: "lemlist", label: "Lemlist" },
  { value: "reply-io", label: "Reply.io" },
  { value: "woodpecker", label: "Woodpecker" },
  { value: "mailshake", label: "Mailshake" },
  { value: "instantly", label: "Instantly" },
  { value: "mixmax", label: "Mixmax" },
  // Marketing e automação
  { value: "rd-station-mkt", label: "RD Station Marketing" },
  { value: "mailchimp", label: "Mailchimp" },
  { value: "activecampaign", label: "ActiveCampaign" },
  { value: "mautic", label: "Mautic" },
  { value: "leadlovers", label: "Leadlovers" },
  { value: "e-goi", label: "E-goi" },
  { value: "klickpages", label: "Klickpages / Klicksend" },
  { value: "hotmart", label: "Hotmart" },
  // Comunicação e ligações
  { value: "whatsapp-business", label: "WhatsApp Business" },
  { value: "whatsapp-api", label: "WhatsApp API (Twilio, Zenvia, etc.)" },
  { value: "telefonia-voip", label: "Telefonia VoIP (Nvoip, PhoneTrack, etc.)" },
  { value: "zenvia", label: "Zenvia" },
  { value: "take-blip", label: "Take Blip" },
  { value: "intercom", label: "Intercom" },
  { value: "drift", label: "Drift" },
  { value: "jivochat", label: "JivoChat" },
  { value: "crisp", label: "Crisp" },
  { value: "zoom", label: "Zoom" },
  { value: "google-meet", label: "Google Meet" },
  { value: "microsoft-teams", label: "Microsoft Teams" },
  { value: "slack", label: "Slack" },
  // Produtividade e gestão
  { value: "excel-sheets", label: "Excel / Google Sheets" },
  { value: "google-workspace", label: "Google Workspace" },
  { value: "microsoft-365", label: "Microsoft 365 / Office" },
  { value: "notion", label: "Notion" },
  { value: "trello", label: "Trello" },
  { value: "asana", label: "Asana" },
  { value: "clickup", label: "ClickUp" },
  { value: "pipefy", label: "Pipefy" },
  { value: "monday", label: "Monday.com" },
  // Propostas, contratos, pagamento
  { value: "proposeful", label: "Proposeful" },
  { value: "pandadoc", label: "PandaDoc" },
  { value: "docusign", label: "DocuSign" },
  { value: "clicksign", label: "ClickSign" },
  { value: "d4sign", label: "D4Sign" },
  { value: "nfe-io", label: "NFe.io / Emissão de NF" },
  // BI e analytics
  { value: "power-bi", label: "Power BI" },
  { value: "google-analytics", label: "Google Analytics" },
  { value: "looker-studio", label: "Looker Studio (Data Studio)" },
  { value: "metabase", label: "Metabase" },
  // Redes sociais e conteúdo
  { value: "canva", label: "Canva" },
  { value: "instagram-business", label: "Instagram Business / Meta" },
  { value: "mlabs", label: "mLabs / Hootsuite" },
  // IA e automação
  { value: "chatgpt-ia", label: "ChatGPT / Ferramentas de IA" },
  { value: "zapier-make", label: "Zapier / Make (Integromat)" },
  { value: "n8n", label: "n8n" },
];

const TIPOS_FORMACAO = [
  { value: "ensino-medio", label: "Ensino médio" },
  { value: "curso-tecnico", label: "Curso técnico" },
  { value: "tecnologo", label: "Tecnólogo" },
  { value: "graduacao", label: "Graduação" },
  { value: "pos-graduacao", label: "Pós-graduação / MBA" },
  { value: "mestrado", label: "Mestrado" },
  { value: "doutorado", label: "Doutorado" },
  { value: "curso-livre", label: "Curso livre / Extensão" },
  { value: "certificacao", label: "Certificação profissional" },
  { value: "bootcamp", label: "Bootcamp / Imersão" },
  { value: "treinamento", label: "Treinamento corporativo" },
];

const CONHECIMENTOS = [
  // Metodologias de vendas
  { value: "spin-selling", label: "SPIN Selling" },
  { value: "bant", label: "BANT / Qualificação" },
  { value: "challenger-sale", label: "Challenger Sale" },
  { value: "solution-selling", label: "Solution Selling" },
  { value: "sandler-selling", label: "Sandler Selling System" },
  { value: "meddic", label: "MEDDIC / MEDDPICC" },
  { value: "receita-previsivel", label: "Receita Previsível (Predictable Revenue)" },
  { value: "the-gap-selling", label: "Gap Selling" },
  { value: "snap-selling", label: "SNAP Selling" },
  { value: "neat-selling", label: "NEAT Selling" },
  { value: "value-selling", label: "Value Selling Framework" },
  // Gestão e liderança
  { value: "gestao-comercial", label: "Gestão comercial" },
  { value: "lideranca-equipes", label: "Liderança de equipes comerciais" },
  { value: "planejamento-estrategico", label: "Planejamento estratégico de vendas" },
  { value: "gestao-pipeline", label: "Gestão de pipeline / Forecast" },
  { value: "gestao-metas", label: "Gestão de metas e OKRs" },
  { value: "territory-management", label: "Gestão de território" },
  // Técnicas e frameworks
  { value: "negociacao-avancada", label: "Negociação avançada" },
  { value: "oratoria", label: "Oratória / Apresentação" },
  { value: "pnl", label: "PNL / Persuasão" },
  { value: "storytelling-vendas", label: "Storytelling para vendas" },
  { value: "inteligencia-emocional", label: "Inteligência emocional" },
  { value: "design-thinking", label: "Design Thinking" },
  // Conhecimentos complementares
  { value: "financas-basicas", label: "Finanças / Contabilidade básica" },
  { value: "gestao-projetos", label: "Gestão de projetos" },
  { value: "gestao-tempo", label: "Gestão de tempo / Produtividade" },
  { value: "customer-success-mgt", label: "Customer Success Management" },
  { value: "pricing", label: "Precificação / Pricing" },
  { value: "funil-vendas", label: "Funil de vendas / Jornada do cliente" },
  { value: "growth-hacking", label: "Growth Hacking" },
  { value: "scrum-agile", label: "Scrum / Agile" },
];

const EQUIPAMENTOS = [
  { value: "notebook", label: "Notebook / Computador" },
  { value: "smartphone", label: "Smartphone" },
  { value: "headset", label: "Headset / Fone com microfone" },
  { value: "webcam", label: "Webcam" },
  { value: "internet-estavel", label: "Internet estável (fibra)" },
  { value: "ambiente-silencioso", label: "Ambiente silencioso para ligações" },
  { value: "segundo-monitor", label: "Segundo monitor" },
  { value: "impressora", label: "Impressora" },
  { value: "veiculo", label: "Veículo próprio" },
];

const GENEROS_MAP = [
  { value: "masculino", key: "masculino" },
  { value: "feminino", key: "feminino" },
  { value: "nao-binario", key: "naoBinario" },
  { value: "prefiro-nao-dizer", key: "prefiroNaoDizer" },
];

/* ─── CSS-in-JS scoped ─── */
const css = `
.cp-page{min-height:100dvh;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px 48px;background:var(--bg);overflow-y:auto}
.cp-shell{width:100%;max-width:${MAX_W}px}
.cp-fade{animation:cpIn .25s cubic-bezier(.22,.9,.32,1)}
@keyframes cpIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.cp-fade{animation:none}}

/* header */
.cp-header{text-align:center;margin-bottom:28px}
.cp-logo{height:30px;width:auto;max-width:70%;object-fit:contain;display:block;margin:0 auto 16px}
html.dark .cp-logo{mix-blend-mode:normal;filter:brightness(0) invert(1)}
.cp-badge{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${AZUL};border:1px solid rgba(49,140,231,.22);background:rgba(49,140,231,.06);border-radius:999px;padding:4px 14px;margin-bottom:14px}
.cp-eyebrow{font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${AZUL};margin-bottom:6px}
.cp-titulo{font-family:'Geist','Inter',system-ui,sans-serif;font-size:24px;font-weight:600;letter-spacing:-.025em;color:var(--ink);margin:0 0 6px;line-height:1.25}
.cp-desc{font-size:13.5px;color:var(--muted);line-height:1.55;margin:0}

/* progress */
.cp-progress{display:flex;gap:6px;margin-bottom:24px}
.cp-seg{flex:1;display:flex;flex-direction:column;gap:5px}
.cp-seg-bar{height:4px;border-radius:999px;transition:background .3s}
.cp-seg-label{font-size:10.5px;font-weight:500;text-align:center;letter-spacing:.02em;transition:color .3s}
.cp-step-num{text-align:center;font-size:11.5px;font-weight:600;color:var(--muted);margin-bottom:8px;font-variant-numeric:tabular-nums}

/* card */
.cp-card{background:var(--surface-solid);border:1px solid var(--border-strong);border-radius:16px;padding:28px 32px}

/* foto */
.cp-foto-area{display:flex;align-items:center;gap:16px;padding:18px;background:var(--surface-2);border:1px solid var(--border-strong);border-radius:14px;margin-bottom:20px}
.cp-foto-circle{width:80px;height:80px;border-radius:50%;border:2px dashed var(--border-strong);background:var(--surface-solid);cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;transition:border-color .2s}
.cp-foto-circle:hover{border-color:${AZUL}}
.cp-foto-circle.has-photo{border-style:solid;border-color:${AZUL}}
.cp-editor-frame{position:relative;margin:4px auto 0;border-radius:50%;overflow:hidden;background:var(--surface-2);cursor:grab;touch-action:none;user-select:none;box-shadow:0 2px 14px rgba(0,0,0,.18)}
.cp-editor-frame:active{cursor:grabbing}
.cp-editor-ring{position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 2px ${AZUL},inset 0 0 0 9999px rgba(0,0,0,.02);pointer-events:none}
.cp-editor-zoom{display:flex;align-items:center;gap:10px;margin:16px 2px 4px}
.cp-editor-zoom input[type=range]{flex:1;accent-color:${AZUL};height:4px;cursor:pointer}
.cp-foto-info{flex:1;min-width:0}
.cp-foto-titulo{font-size:14px;font-weight:600;color:var(--ink);margin:0 0 2px}
.cp-foto-desc{font-size:12px;color:var(--muted);line-height:1.45;margin:0 0 10px}
.cp-foto-btn{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:${AZUL};background:rgba(49,140,231,.08);border:1px solid rgba(49,140,231,.18);border-radius:8px;padding:7px 14px;cursor:pointer;transition:background .15s}
.cp-foto-btn:hover{background:rgba(49,140,231,.14)}
.cp-foto-formatos{font-size:11px;color:var(--muted-2);margin-top:6px}

/* grid 2 cols */
.cp-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cp-cargos-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* seção */
.cp-secao{margin-bottom:4px}
.cp-secao-titulo{font-size:13px;font-weight:600;color:var(--ink);margin:18px 0 10px;display:flex;align-items:center;gap:7px}
.cp-secao-titulo::after{content:'';flex:1;height:1px;background:var(--border)}

/* campo customizado */
.cp-campo{margin-bottom:14px}
.cp-campo-label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:0 0 5px;letter-spacing:.01em}
.cp-campo-label .cp-req{color:var(--red,#ef4444);margin-left:2px}
.cp-campo-label .cp-opt{font-weight:400;color:var(--muted-2);margin-left:4px;font-size:11px}

/* senha wrapper */
.cp-senha-wrap{position:relative}
.cp-senha-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:var(--muted);display:flex}
.cp-senha-toggle:hover{color:var(--ink)}

/* idiomas */
.cp-idioma-row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
.cp-idioma-row>div{flex:1}
.cp-idioma-rem{background:none;border:none;cursor:pointer;padding:4px;color:var(--muted);flex-shrink:0;display:flex}
.cp-idioma-rem:hover{color:var(--red,#ef4444)}

/* currículo */
.cp-curriculo-area{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--surface-2);border:1px solid var(--border-strong);border-radius:12px;margin-bottom:14px}
.cp-curriculo-icon{width:40px;height:40px;border-radius:10px;background:rgba(49,140,231,.08);color:${AZUL};display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cp-curriculo-info{flex:1;min-width:0}

/* checkbox termos */
.cp-termos{display:flex;align-items:flex-start;gap:8px;margin:14px 0;cursor:pointer;font-size:12.5px;color:var(--ink-2,var(--ink))}
.cp-termos input{margin-top:2px;accent-color:${AZUL}}
.cp-termos-link{color:${AZUL};text-decoration:underline;background:none;border:none;padding:0;cursor:pointer;font:inherit}

/* erro */
.cp-erro{color:var(--red,#ef4444);font-size:12.5px;margin-bottom:12px;padding:9px 14px;background:var(--red-50,rgba(239,68,68,.06));border-radius:10px;border:1px solid var(--red-100,rgba(239,68,68,.12))}
.cp-campo-erro{color:var(--red,#ef4444);font-size:12px;margin-top:5px}

/* nav */
.cp-nav{display:flex;gap:10px;margin-top:20px}
.cp-nav-voltar{flex:1;appearance:none;border:1px solid var(--border-strong);background:var(--surface-solid);color:var(--ink);font:inherit;font-size:14px;font-weight:500;border-radius:10px;padding:12px 16px;cursor:pointer;min-height:48px;transition:background .15s}
.cp-nav-voltar:hover{background:var(--surface-2)}
.cp-nav-avancar{flex:2;appearance:none;border:1px solid ${AZUL};background:${AZUL};color:#fff;font:inherit;font-size:14.5px;font-weight:600;border-radius:10px;padding:12px 20px;cursor:pointer;min-height:48px;transition:background .15s;box-shadow:0 2px 8px rgba(49,140,231,.25)}
.cp-nav-avancar:hover:not(:disabled){background:#2b7cd0;border-color:#2b7cd0}
.cp-nav-avancar:disabled{opacity:.5;cursor:not-allowed}
.cp-nav-avancar:focus-visible,.cp-nav-voltar:focus-visible{outline:2px solid ${AZUL};outline-offset:2px}

/* rodapé */
.cp-footer{text-align:center;margin-top:20px}
.cp-footer-link{background:none;border:none;cursor:pointer;color:var(--muted);font:inherit;font-size:13px;font-weight:500;padding:6px 4px;transition:color .15s}
.cp-footer-link:hover{color:${AZUL}}
.cp-footer-empresa{font-size:12px}

/* depois do form */
.cp-depois{margin-top:18px;padding:14px 16px;background:var(--surface-2);border-radius:12px;font-size:12.5px;line-height:1.6;color:var(--muted)}
.cp-depois b{color:var(--ink-2,var(--ink));font-weight:600}

/* perfil desc */
.cp-perfil-desc{font-size:12px;color:var(--muted);line-height:1.5;margin:-6px 0 14px;padding:0 2px}

/* ═══ MOBILE ═══ */
@media(max-width:600px){
  .cp-page{padding:24px 12px 36px}
  .cp-header{margin-bottom:20px}
  .cp-logo{height:26px;margin-bottom:12px}
  .cp-badge{font-size:9px;padding:3px 10px;margin-bottom:10px}
  .cp-eyebrow{font-size:9.5px;margin-bottom:4px}
  .cp-titulo{font-size:20px;margin-bottom:4px}
  .cp-desc{font-size:12.5px}
  .cp-step-num{font-size:10.5px;margin-bottom:6px}
  .cp-progress{gap:4px;margin-bottom:16px}
  .cp-seg-label{font-size:9.5px}
  .cp-card{padding:18px 14px;border-radius:12px}
  .cp-row{grid-template-columns:1fr;gap:0}
  .cp-cargos-grid{grid-template-columns:1fr}
  .cp-foto-area{flex-direction:column;text-align:center;gap:12px;padding:16px 14px}
  .cp-foto-circle{width:72px;height:72px}
  .cp-foto-info{text-align:center}
  .cp-foto-titulo{font-size:13px}
  .cp-foto-desc{font-size:11.5px;margin-bottom:8px}
  .cp-campo{margin-bottom:12px}
  .cp-campo-label{font-size:11.5px}
  .cp-secao-titulo{font-size:12px;margin:14px 0 8px}
  .cp-idioma-row{flex-wrap:wrap;gap:6px}
  .cp-idioma-row>div{min-width:calc(50% - 16px);flex:1 1 auto}
  .cp-curriculo-area{flex-wrap:wrap;gap:10px;padding:12px 14px}
  .cp-curriculo-icon{width:36px;height:36px;border-radius:8px}
  .cp-nav{margin-top:16px}
  .cp-nav-voltar{min-height:44px;font-size:13px;padding:10px 12px}
  .cp-nav-avancar{min-height:44px;font-size:13.5px;padding:10px 16px}
  .cp-depois{margin-top:14px;padding:12px 14px;font-size:12px}
  .cp-footer{margin-top:16px}
  .cp-footer-link{font-size:12px}
}

/* ═══ TABLET ═══ */
@media(min-width:601px) and (max-width:768px){
  .cp-page{padding:32px 20px 40px}
  .cp-card{padding:24px 22px}
  .cp-titulo{font-size:22px}
}
`;

export default function CadastroProfissional({ onRegister }) {
  const { t } = useI18n();
  const [onboardingVisto, setOnboardingVisto] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rycs_cadastro_prof"))?.onboardingVisto || false; } catch { return false; }
  });
  const [etapa, setEtapa] = useState(0);

  /* ── estado: dados pessoais ── */
  const [nome, setNome] = useState("");
  const [dataNasc, setDataNasc] = useState("");
  const [genero, setGenero] = useState("");
  const [pais, setPais] = useState("BR");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");

  /* ── estado: profissional ── */
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [verSenhaConfirm, setVerSenhaConfirm] = useState(false);
  const [whats, setWhats] = useState("");
  const [idiomas, setIdiomas] = useState([{ idioma: "Português", nivel: "nativo" }]);

  /* ── estado: novos campos profissional ── */
  const [areasAtuacao, setAreasAtuacao] = useState([]);
  const [habilidades, setHabilidades] = useState([]);
  const [anosExperiencia, setAnosExperiencia] = useState("");
  const [disponibilidade, setDisponibilidade] = useState("");
  const [segmentos, setSegmentos] = useState([]);
  const [ferramentas, setFerramentas] = useState([]);
  const [formacoes, setFormacoes] = useState([{ tipo: "", descricao: "" }]);
  const [conhecimentos, setConhecimentos] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);

  /* ── estado: experiência em vendas (cargos) ── */
  const [cargosExp, setCargosExp] = useState([]);
  const [cargoPrincipal, setCargoPrincipal] = useState("");

  /* ── estado: foto ── */
  const [foto, setFoto] = useState(null);
  const [fotoPrevia, setFotoPrevia] = useState("");
  const [fotoErro, setFotoErro] = useState("");
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const inputFoto = useRef(null);

  /* ── estado: enquadramento da foto (zoom + arraste) ── */
  const FRAME = 240; // tamanho do quadro de enquadramento (px)
  const [editorSrc, setEditorSrc] = useState("");          // data URL da imagem original
  const [editorNat, setEditorNat] = useState({ w: 0, h: 0 }); // dimensões naturais
  const [editorZoom, setEditorZoom] = useState(1);
  const [editorOff, setEditorOff] = useState({ x: 0, y: 0 }); // deslocamento em px
  const editorDrag = useRef(null);

  /* ── estado: currículo ── */
  const [curriculo, setCurriculo] = useState(null);
  const [curriculoErro, setCurriculoErro] = useState("");
  const inputCurriculo = useRef(null);

  /* ── estado: geral ── */
  const [indicacao, setIndicacao] = useState(() => (parametro("ref") || "").toUpperCase());
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erroSenha, setErroSenha] = useState("");
  const [erroEtapa, setErroEtapa] = useState("");
  const [sucesso, setSucesso] = useState(null); // { entrar } após cadastro concluído

  /* ── persistência localStorage ── */
  const STORAGE_KEY = "rycs_cadastro_prof";
  const carregou = useRef(false);

  useEffect(() => {
    if (carregou.current) return;
    carregou.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.nome) setNome(s.nome);
      if (s.dataNasc) setDataNasc(s.dataNasc);
      if (s.genero) setGenero(s.genero);
      if (s.pais) setPais(s.pais);
      if (s.estado) setEstado(s.estado);
      if (s.cidade) setCidade(s.cidade);
      if (s.email) setEmail(s.email);
      if (s.whats) setWhats(s.whats);
      if (s.idiomas?.length) setIdiomas(s.idiomas);
      if (s.areasAtuacao?.length) setAreasAtuacao(s.areasAtuacao);
      if (s.habilidades?.length) setHabilidades(s.habilidades);
      if (s.anosExperiencia) setAnosExperiencia(s.anosExperiencia);
      if (s.disponibilidade) setDisponibilidade(s.disponibilidade);
      if (s.segmentos?.length) setSegmentos(s.segmentos);
      if (s.ferramentas?.length) setFerramentas(s.ferramentas);
      if (s.formacoes?.length) setFormacoes(s.formacoes);
      if (s.conhecimentos?.length) setConhecimentos(s.conhecimentos);
      if (s.equipamentos?.length) setEquipamentos(s.equipamentos);
      if (s.cargosExp?.length) setCargosExp(s.cargosExp);
      if (s.cargoPrincipal) setCargoPrincipal(s.cargoPrincipal);
      if (s.indicacao) setIndicacao(s.indicacao);
      if (s.onboardingVisto) setOnboardingVisto(true);
      if (s.etapa != null) setEtapa(s.etapa);
      if (s.fotoPrevia) { setFotoPrevia(s.fotoPrevia); setFoto(s.foto || null); }
    } catch {}
  }, []);

  const salvarTimer = useRef(null);
  const salvarRascunho = useCallback(() => {
    clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          nome, dataNasc, genero, pais, estado, cidade,
          email, whats, idiomas,
          areasAtuacao, habilidades, anosExperiencia, disponibilidade,
          segmentos, ferramentas, formacoes, conhecimentos, equipamentos,
          cargosExp, cargoPrincipal, indicacao, etapa,
          onboardingVisto, foto, fotoPrevia,
        }));
      } catch {}
    }, 400);
  }, [
    nome, dataNasc, genero, pais, estado, cidade,
    email, whats, idiomas,
    areasAtuacao, habilidades, anosExperiencia, disponibilidade,
    segmentos, ferramentas, formacoes, conhecimentos, equipamentos,
    cargosExp, cargoPrincipal, indicacao, etapa,
    onboardingVisto, foto, fotoPrevia,
  ]);

  useEffect(() => { if (carregou.current) salvarRascunho(); }, [salvarRascunho]);

  const limparRascunho = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  /* ── handlers de arquivo ── */
  const selecionarCurriculo = (arquivo) => {
    if (!arquivo) return;
    setCurriculoErro("");
    const tiposOk = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!tiposOk.includes(arquivo.type)) { setCurriculoErro(t("cadProf.erros.curriculoFormato")); return; }
    if (arquivo.size > 8 * 1024 * 1024) { setCurriculoErro(t("cadProf.erros.curriculoTamanho")); return; }
    const reader = new FileReader();
    reader.onload = () => setCurriculo({ base64: reader.result.split(",")[1], mimetype: arquivo.type, nome: arquivo.name });
    reader.readAsDataURL(arquivo);
  };

  const selecionarFoto = (arquivo) => {
    if (!arquivo) return;
    setFotoErro("");
    const img = new Image();
    img.onload = () => {
      const avaliacao = avaliarFoto({ mimetype: arquivo.type, tamanhoBytes: arquivo.size, largura: img.naturalWidth, altura: img.naturalHeight });
      if (!avaliacao.aprovada) {
        setFotoErro(avaliacao.problemas[0]?.comoResolver || t("cadProf.erros.fotoReprovada"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        // Abre o enquadrador: o usuário posiciona/aproxima antes de salvar.
        setEditorNat({ w: img.naturalWidth, h: img.naturalHeight });
        setEditorZoom(1);
        setEditorOff({ x: 0, y: 0 });
        setEditorSrc(reader.result);
      };
      reader.readAsDataURL(arquivo);
    };
    img.onerror = () => setFotoErro(t("cadProf.erros.fotoLeitura"));
    img.src = URL.createObjectURL(arquivo);
  };

  /* ── enquadramento: mantém a imagem sempre cobrindo o quadro ── */
  const clampOff = (off, zoom) => {
    const base = Math.max(FRAME / editorNat.w, FRAME / editorNat.h) * zoom;
    const maxX = Math.max(0, (editorNat.w * base - FRAME) / 2);
    const maxY = Math.max(0, (editorNat.h * base - FRAME) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, off.x)),
      y: Math.max(-maxY, Math.min(maxY, off.y)),
    };
  };

  const editorPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    editorDrag.current = { px: e.clientX, py: e.clientY, ox: editorOff.x, oy: editorOff.y };
  };
  const editorPointerMove = (e) => {
    const d = editorDrag.current;
    if (!d) return;
    setEditorOff(clampOff({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }, editorZoom));
  };
  const editorPointerUp = () => { editorDrag.current = null; };
  const editorSetZoom = (z) => { setEditorZoom(z); setEditorOff((o) => clampOff(o, z)); };

  // Gera a imagem quadrada já enquadrada e a envia ao fluxo normal da foto.
  const confirmarEnquadramento = () => {
    const OUT = 600;
    const im = new Image();
    im.onload = () => {
      const base = Math.max(FRAME / editorNat.w, FRAME / editorNat.h) * editorZoom;
      const dispW = editorNat.w * base, dispH = editorNat.h * base;
      const sLado = FRAME / base; // lado do recorte, em px da imagem original
      const sx = (dispW / 2 - FRAME / 2 - editorOff.x) / base;
      const sy = (dispH / 2 - FRAME / 2 - editorOff.y) / base;
      const canvas = document.createElement("canvas");
      canvas.width = OUT; canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, OUT, OUT);
      ctx.drawImage(im, sx, sy, sLado, sLado, 0, 0, OUT, OUT);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setFoto({ base64: dataUrl.split(",")[1], mimetype: "image/jpeg", largura: OUT, altura: OUT });
      setFotoPrevia(dataUrl);
      setEditorSrc("");
    };
    im.src = editorSrc;
  };

  const abrirSeletorFoto = () => {
    if (fotoPrevia) inputFoto.current?.click();
    else setMostrarGuia(true);
  };

  /* ── idiomas ── */
  const addIdioma = () => setIdiomas((l) => [...l, { idioma: "", nivel: "basico" }]);
  const remIdioma = (i) => setIdiomas((l) => l.filter((_, j) => j !== i));
  const setIdiomaVal = (i, campo, val) => setIdiomas((l) => l.map((x, j) => j === i ? { ...x, [campo]: val } : x));

  /* ── formações ── */
  const addFormacao = () => setFormacoes((l) => [...l, { tipo: "", descricao: "" }]);
  const remFormacao = (i) => setFormacoes((l) => l.filter((_, j) => j !== i));
  const setFormacaoVal = (i, campo, val) => setFormacoes((l) => l.map((x, j) => j === i ? { ...x, [campo]: val } : x));

  /* ── dados derivados ── */
  const cidadeLabel = pais === "BR" && estado ? (CIDADES_BR[estado] || []).map((c) => ({ value: c, label: c })) : [];
  const estadosOpcoes = pais === "BR"
    ? ESTADOS_BR.map((e) => ({ value: e.uf, label: `${e.nome} (${e.uf})` }))
    : (SUBDIVISOES[pais] || []).map((s) => ({ value: s, label: s }));
  const temSubdivisao = pais === "BR" || estadosOpcoes.length > 0;
  const subdivisaoLabel = SUBDIVISAO_LABEL[pais] || t("cadProf.campos.estadoRegiao");
  const generosOpcoes = GENEROS_MAP.map((g) => ({ value: g.value, label: t(`cadProf.generos.${g.key}`) }));

  /* ── validação ── */
  const validarEtapa = () => {
    setErroEtapa("");
    if (etapa === 0) {
      if (!foto) { setFotoErro(t("cadProf.erros.fotoObrigatoria")); return false; }
      if (!nome.trim()) { setErroEtapa(t("cadProf.erros.nome")); return false; }
      if (!dataNasc) { setErroEtapa(t("cadProf.erros.dataNasc")); return false; }
      if (!genero) { setErroEtapa(t("cadProf.erros.genero")); return false; }
      if (!pais) { setErroEtapa(t("cadProf.erros.pais")); return false; }
      if (pais === "BR" && !estado) { setErroEtapa(t("cadProf.erros.estado")); return false; }
      if (!cidade) { setErroEtapa(t("cadProf.erros.cidade")); return false; }
    }
    if (etapa === 1) {
      if (!email.trim()) { setErroEtapa(t("cadProf.erros.email")); return false; }
      if (senha.length < 6) { setErroEtapa(t("cadProf.erros.senhaMin")); return false; }
      if (senha !== senhaConfirm) { setErroEtapa(t("cadProf.erros.senhaDif")); return false; }
      if (!whats.trim()) { setErroEtapa(t("cadProf.erros.whatsapp")); return false; }
      if (!telefoneValido(pais, whats)) { setErroEtapa(t("cadProf.erros.whatsInvalido")); return false; }
      if (idiomas.some((i) => !i.idioma)) { setErroEtapa(t("cadProf.erros.idiomas")); return false; }
    }
    if (etapa === 2) {
      if (cargosExp.length === 0) { setErroEtapa("Selecione pelo menos um cargo com experiência em vendas."); return false; }
      if (!cargoPrincipal) { setErroEtapa("Selecione qual é sua experiência principal."); return false; }
      if (areasAtuacao.length === 0) { setErroEtapa("Selecione pelo menos uma área de atuação."); return false; }
      if (habilidades.length === 0) { setErroEtapa("Selecione pelo menos uma habilidade."); return false; }
      if (!anosExperiencia) { setErroEtapa("Selecione seus anos de experiência."); return false; }
      if (!disponibilidade) { setErroEtapa("Selecione sua disponibilidade semanal."); return false; }
    }
    return true;
  };

  const avancar = () => {
    if (!validarEtapa()) return;
    setEtapa((e) => Math.min(e + 1, ETAPAS_KEYS.length - 1));
  };

  const voltar = () => setEtapa((e) => Math.max(e - 1, 0));

  const submit = async (e) => {
    e.preventDefault();
    setErroSenha(""); setErroEtapa("");
    if (!aceitouTermos) { setErroEtapa(t("cadProf.erros.termos")); return; }
    if (!foto) { setFotoErro(t("cadProf.erros.fotoObrigatoria")); setEtapa(0); return; }
    if (senha.length < 6) { setErroSenha(t("cadProf.erros.senhaMinCurta")); setEtapa(1); return; }
    if (senha !== senhaConfirm) { setErroSenha(t("cadProf.erros.senhaDif")); setEtapa(1); return; }
    setLoading(true);
    const cidadeCompleta = pais === "BR" && estado ? `${cidade}, ${estado}` : cidade;
    const res = await onRegister({
      role: "vendedor", nome, email, senha, whats: normalizarTelefoneIntl(pais, whats) || whats,
      cidade: cidadeCompleta, pais, estado,
      dataNascimento: dataNasc, genero,
      perfil: cargoPrincipal || "sdr",
      cargosExp,
      perfilComercial: {
        areasAtuacao, habilidades, anosExperiencia, disponibilidade,
        segmentos, ferramentas, formacoes, conhecimentos, equipamentos,
      },
      idiomas: idiomas.filter((i) => i.idioma),
      aceitouTermos: true, indicacao: indicacao || undefined,
      foto, curriculo: curriculo || undefined,
    });
    setLoading(false);
    // Erro: preserva o rascunho e leva ao campo certo em vez de perder tudo.
    if (!res?.ok) {
      const msg = res?.error || "Não foi possível concluir o cadastro. Tente novamente.";
      if (res?.campo === "email") { setEtapa(1); setErroEtapa(msg); }
      else if (res?.campo === "foto") { setEtapa(0); setFotoErro(msg); }
      else if (res?.campo === "senha") { setEtapa(1); setErroSenha(msg); }
      else setErroEtapa(msg);
      return;
    }
    // Sucesso: limpa o rascunho e mostra a confirmação antes de entrar.
    limparRascunho();
    setSucesso({ entrar: res.entrar });
  };

  /* ── telas auxiliares ── */
  if (!onboardingVisto) return <OnboardingProfissional onConcluir={() => setOnboardingVisto(true)} />;
  if (showTermos) return <Termos onAceitar={() => { setAceitouTermos(true); setShowTermos(false); }} onVoltar={() => setShowTermos(false)} />;

  // Confirmação de cadastro: dá o retorno claro que faltava e evita reenvio.
  if (sucesso) return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="vx-fade" style={{ background: "var(--surface-solid)", border: "1px solid var(--border-strong)", borderRadius: 16, padding: 32, maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <CheckCircle size={34} style={{ color: "var(--green, #22c55e)" }} />
        </div>
        <h1 className="vx-disp" style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)", margin: "0 0 10px" }}>Cadastro concluído!</h1>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 6px" }}>
          Sua conta foi criada com sucesso. Enviamos um e-mail de confirmação para <b style={{ color: "var(--ink)" }}>{email}</b>.
        </p>
        <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 22px" }}>
          Seu perfil passará por uma triagem da plataforma. Você será avisado por e-mail quando a análise terminar.
        </p>
        <button type="button" className="cp-nav-avancar" style={{ width: "100%" }}
          onClick={() => sucesso.entrar?.()}>
          Acessar minha conta
        </button>
      </div>
    </div>
  );

  const etapaInfo = [`s1`, `s2`, `s3`][etapa];

  return (
    <>
      <style>{css}</style>
      <div className="cp-page">
        <div className="cp-shell">

          {/* ══════════ CABEÇALHO ══════════ */}
          <div className="cp-header">
            <img className="cp-logo" src="/logo-rycs-sm.png" alt="RYCS Sales Machine"
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <div className="cp-eyebrow">{t(`cadProf.${etapaInfo}.eyebrow`)}</div>
            <h1 className="cp-titulo">{t(`cadProf.${etapaInfo}.titulo`)}</h1>
            <p className="cp-desc">{t(`cadProf.${etapaInfo}.descricao`)}</p>
          </div>

          {/* ══════════ PROGRESSO ══════════ */}
          <div className="cp-step-num">{t("cadProf.etapa", { n: etapa + 1, total: ETAPAS_KEYS.length })}</div>
          <div className="cp-progress">
            {ETAPAS_KEYS.map((key, i) => (
              <div className="cp-seg" key={key}>
                <div className="cp-seg-bar" style={{
                  background: i < etapa ? AZUL : i === etapa ? AZUL : "var(--border-strong)",
                  opacity: i < etapa ? 0.45 : 1,
                }} />
                <span className="cp-seg-label" style={{
                  color: i <= etapa ? AZUL : "var(--muted-2)",
                  fontWeight: i === etapa ? 700 : 500,
                }}>
                  {t(`cadProf.etapas.${key}`)}
                </span>
              </div>
            ))}
          </div>

          {/* ══════════ CARD DO FORMULÁRIO ══════════ */}
          <div className="cp-card">
            <form onSubmit={submit}>
              <div className="cp-fade" key={`etapa-${etapa}`}>

                {/* ━━━━━━━━ ETAPA 0: Dados pessoais ━━━━━━━━ */}
                {etapa === 0 && (
                  <>
                    {/* Foto de perfil */}
                    <div className="cp-foto-area">
                      <button type="button" className={`cp-foto-circle${fotoPrevia ? " has-photo" : ""}`} onClick={abrirSeletorFoto}
                        aria-label={t("cadProf.foto.adicionar")}>
                        {fotoPrevia
                          ? <img src={fotoPrevia} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <Camera size={26} style={{ color: "var(--muted-2)" }} />}
                      </button>
                      <div className="cp-foto-info">
                        <div className="cp-foto-titulo">{t("cadProf.foto.titulo")}</div>
                        <p className="cp-foto-desc">{t("cadProf.foto.descricao")}</p>
                        <button type="button" className="cp-foto-btn" onClick={abrirSeletorFoto}>
                          <Camera size={14} />
                          {fotoPrevia ? t("cadProf.foto.trocar") : t("cadProf.foto.adicionar")}
                        </button>
                        <div className="cp-foto-formatos">{t("cadProf.foto.formatos", { max: Math.round(LIMITES.tamanhoMaximoBytes / 1024 / 1024) })}</div>
                      </div>
                      <input ref={inputFoto} type="file" hidden accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => { selecionarFoto(e.target.files?.[0]); if (inputFoto.current) inputFoto.current.value = ""; }} />
                    </div>
                    {fotoErro && <div className="cp-campo-erro" style={{ marginTop: -12, marginBottom: 14 }}>{fotoErro}</div>}

                    {/* Nome */}
                    <div className="cp-campo">
                      <label className="cp-campo-label">{t("cadProf.campos.nome")} <span className="cp-req">*</span></label>
                      <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)}
                        placeholder={t("cadProf.campos.nomePlaceholder")} required />
                    </div>

                    {/* Data + Gênero */}
                    <div className="cp-row">
                      <div className="cp-campo">
                        <label className="cp-campo-label">{t("cadProf.campos.dataNasc")} <span className="cp-req">*</span></label>
                        <input className="vx-input" type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)}
                          required style={{ minHeight: 42 }} />
                      </div>
                      <div className="cp-campo">
                        <label className="cp-campo-label">{t("cadProf.campos.genero")} <span className="cp-req">*</span></label>
                        <ComboSelect opcoes={generosOpcoes} valor={genero} onChange={setGenero} placeholder={t("cadProf.selecione")} />
                      </div>
                    </div>

                    {/* País */}
                    <div className="cp-campo">
                      <label className="cp-campo-label">{t("cadProf.campos.pais")} <span className="cp-req">*</span></label>
                      <ComboSelect opcoes={PAISES.map((p) => ({ value: p.code, label: p.nome }))} valor={pais}
                        onChange={(v) => { setPais(v); setEstado(""); setCidade(""); }} placeholder={t("cadProf.selecionePais")} />
                    </div>

                    {/* Estado/Subdivisão + Cidade */}
                    {temSubdivisao ? (
                      <div className="cp-row">
                        <div className="cp-campo">
                          <label className="cp-campo-label">{subdivisaoLabel} {pais === "BR" && <span className="cp-req">*</span>}</label>
                          <ComboSelect opcoes={estadosOpcoes} valor={estado}
                            onChange={(v) => { setEstado(v); if (pais === "BR") setCidade(""); }} placeholder={t("cadProf.selecione")} />
                        </div>
                        <div className="cp-campo">
                          <label className="cp-campo-label">{t("cadProf.campos.cidade")} <span className="cp-req">*</span></label>
                          {pais === "BR" ? (
                            <ComboSelect opcoes={cidadeLabel} valor={cidade} onChange={setCidade}
                              placeholder={estado ? t("cadProf.selecione") : t("cadProf.selecioneEstado")} disabled={!estado} />
                          ) : (
                            <input className="vx-input" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Mumbai" required />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="cp-row">
                        <div className="cp-campo">
                          <label className="cp-campo-label">{subdivisaoLabel}</label>
                          <input className="vx-input" value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="Ex.: California" />
                        </div>
                        <div className="cp-campo">
                          <label className="cp-campo-label">{t("cadProf.campos.cidade")} <span className="cp-req">*</span></label>
                          <input className="vx-input" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: New York" required />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ━━━━━━━━ ETAPA 1: Profissional ━━━━━━━━ */}
                {etapa === 1 && (
                  <>
                    {/* Seção: Acesso */}
                    <div className="cp-secao">
                      <div className="cp-secao-titulo">{t("cadProf.campos.email")} &amp; {t("cadProf.campos.senha")}</div>
                    </div>

                    <div className="cp-campo">
                      <label className="cp-campo-label">{t("cadProf.campos.email")} <span className="cp-req">*</span></label>
                      <input className="vx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("cadProf.campos.emailPlaceholder")} required />
                    </div>

                    <div className="cp-row">
                      <div className="cp-campo">
                        <label className="cp-campo-label">{t("cadProf.campos.senha")} <span className="cp-req">*</span></label>
                        <div className="cp-senha-wrap">
                          <input className="vx-input" type={verSenha ? "text" : "password"} value={senha}
                            onChange={(e) => { setSenha(e.target.value); setErroSenha(""); }}
                            placeholder={t("cadProf.campos.senhaPlaceholder")} required minLength={6} style={{ paddingRight: 42 }} />
                          <button type="button" className="cp-senha-toggle" onClick={() => setVerSenha(!verSenha)}
                            tabIndex={-1} aria-label={verSenha ? "Ocultar" : "Mostrar"}>
                            {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div className="cp-campo">
                        <label className="cp-campo-label">{t("cadProf.campos.confirmarSenha")} <span className="cp-req">*</span></label>
                        <div className="cp-senha-wrap">
                          <input className="vx-input" type={verSenhaConfirm ? "text" : "password"} value={senhaConfirm}
                            onChange={(e) => { setSenhaConfirm(e.target.value); setErroSenha(""); }}
                            placeholder={t("cadProf.campos.confirmarSenhaPlaceholder")} required minLength={6} style={{ paddingRight: 42 }} />
                          <button type="button" className="cp-senha-toggle" onClick={() => setVerSenhaConfirm(!verSenhaConfirm)}
                            tabIndex={-1} aria-label={verSenhaConfirm ? "Ocultar" : "Mostrar"}>
                            {verSenhaConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {erroSenha && <div className="cp-campo-erro" style={{ marginBottom: 10 }}>{erroSenha}</div>}

                    <div className="cp-campo">
                      <label className="cp-campo-label">{t("cadProf.campos.whatsapp")} <span className="cp-req">*</span></label>
                      <CampoTelefone pais={pais} value={whats} onChange={(e) => setWhats(e.target.value)} required />
                    </div>

                    {/* Seção: Formações */}
                    <div className="cp-secao">
                      <div className="cp-secao-titulo">Formações</div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      {formacoes.map((f, i) => (
                        <div className="cp-idioma-row" key={i} style={{ alignItems: "flex-start" }}>
                          <div style={{ flex: "0 0 45%" }}>
                            <ComboSelect opcoes={TIPOS_FORMACAO} valor={f.tipo}
                              onChange={(v) => setFormacaoVal(i, "tipo", v)} placeholder="Tipo de formação" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <input className="vx-input" value={f.descricao}
                              onChange={(e) => setFormacaoVal(i, "descricao", e.target.value)}
                              placeholder={f.tipo ? "Descreva (ex.: Administração de Empresas)" : "Selecione o tipo primeiro"}
                              disabled={!f.tipo} style={{ minHeight: 42 }} />
                          </div>
                          {formacoes.length > 1 && (
                            <button type="button" className="cp-idioma-rem" onClick={() => remFormacao(i)} title="Remover"
                              style={{ marginTop: 10 }}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="cp-foto-btn" onClick={addFormacao} style={{ marginTop: 4 }}>
                        <Plus size={14} /> Adicionar formação
                      </button>
                    </div>

                    {/* Seção: Conhecimentos */}
                    <div className="cp-secao">
                      <div className="cp-secao-titulo">Conhecimentos</div>
                    </div>

                    <div className="cp-campo">
                      <label className="cp-campo-label">Conhecimentos profissionais <span className="cp-opt">(opcional)</span></label>
                      <MultiSelect opcoes={CONHECIMENTOS} valor={conhecimentos} onChange={setConhecimentos} placeholder="Selecione seus conhecimentos" />
                    </div>

                    {/* Seção: Equipamentos */}
                    <div className="cp-secao">
                      <div className="cp-secao-titulo">Equipamentos disponíveis</div>
                    </div>

                    <div className="cp-campo">
                      <label className="cp-campo-label">Equipamentos disponíveis <span className="cp-opt">(opcional)</span></label>
                      <MultiSelect opcoes={EQUIPAMENTOS} valor={equipamentos} onChange={setEquipamentos} placeholder="Selecione seus equipamentos" />
                    </div>

                    {/* Seção: Idiomas */}
                    <div className="cp-secao">
                      <div className="cp-secao-titulo">{t("cadProf.campos.idiomas")}</div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      {idiomas.map((idi, i) => (
                        <div className="cp-idioma-row" key={i}>
                          <div>
                            <ComboSelect opcoes={IDIOMAS} valor={idi.idioma}
                              onChange={(v) => setIdiomaVal(i, "idioma", v)} placeholder="Idioma" />
                          </div>
                          <div>
                            <ComboSelect opcoes={NIVEIS_IDIOMA} valor={idi.nivel}
                              onChange={(v) => setIdiomaVal(i, "nivel", v)} placeholder="Nível" />
                          </div>
                          {idiomas.length > 1 && (
                            <button type="button" className="cp-idioma-rem" onClick={() => remIdioma(i)} title="Remover">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="cp-foto-btn" onClick={addIdioma} style={{ marginTop: 4 }}>
                        <Plus size={14} /> {t("cadProf.campos.addIdioma")}
                      </button>
                    </div>
                  </>
                )}

                {/* ━━━━━━━━ ETAPA 2: Experiência ━━━━━━━━ */}
                {etapa === 2 && (
                  <>
                    {/* Cargo com experiência em vendas */}
                    <div className="cp-campo">
                      <label className="cp-campo-label">Qual cargo você tem experiência em vendas? <span className="cp-req">*</span></label>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
                        Selecione todos que se aplicam. {cargosExp.length > 1 ? "Clique na ★ para marcar o principal — é o que aparece no seu perfil." : ""}
                      </p>

                      <div className="cp-cargos-grid">
                        {["sdr", "bdr", "closer", "pap"].map((k) => {
                          const sel = cargosExp.includes(k);
                          const princ = cargoPrincipal === k;
                          return (
                            <button key={k} type="button"
                              onClick={() => {
                                let next;
                                if (sel) {
                                  next = cargosExp.filter((v) => v !== k && v !== "sem-exp");
                                } else {
                                  next = [...cargosExp.filter((v) => v !== "sem-exp"), k];
                                }
                                setCargosExp(next);
                                if (next.length === 1) setCargoPrincipal(next[0]);
                                else if (!next.includes(cargoPrincipal)) setCargoPrincipal(next[0] || "");
                              }}
                              style={{
                                position: "relative", textAlign: "left",
                                padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                                border: sel ? `2px solid ${AZUL}` : "1.5px solid var(--border-strong)",
                                background: sel ? "rgba(49,140,231,.05)" : "var(--surface-solid)",
                                transition: "all .15s",
                              }}>
                              {/* Estrela do principal */}
                              {sel && cargosExp.filter((v) => v !== "sem-exp").length > 1 && (
                                <button type="button" title="Marcar como principal"
                                  onClick={(e) => { e.stopPropagation(); setCargoPrincipal(k); }}
                                  style={{
                                    position: "absolute", top: 8, right: 8,
                                    background: "none", border: "none", cursor: "pointer", padding: 2,
                                    color: princ ? AZUL : "var(--muted-2)",
                                    transition: "color .15s",
                                  }}>
                                  <Star size={16} fill={princ ? AZUL : "none"} />
                                </button>
                              )}
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{
                                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                                  border: sel ? `2px solid ${AZUL}` : "2px solid var(--border-strong)",
                                  background: sel ? AZUL : "transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  color: "#fff", fontSize: 11, fontWeight: 700,
                                }}>{sel ? "✓" : ""}</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: sel ? AZUL : "var(--ink)" }}>
                                  {FUNCOES[k].nome}
                                </span>
                                {princ && cargosExp.filter((v) => v !== "sem-exp").length > 1 && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, color: AZUL,
                                    background: "rgba(49,140,231,.1)", borderRadius: 4,
                                    padding: "1px 6px", letterSpacing: ".03em",
                                  }}>PRINCIPAL</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45, paddingLeft: 26 }}>
                                {FUNCOES[k].descricao}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Iniciante — desmarca todos os outros ao selecionar */}
                      <label style={{
                        display: "flex", alignItems: "center", gap: 10, marginTop: 16,
                        padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                        border: cargosExp.includes("sem-exp") ? `2px solid ${AZUL}` : "1.5px solid var(--border-strong)",
                        background: cargosExp.includes("sem-exp") ? "rgba(49,140,231,.06)" : "var(--surface-solid)",
                        transition: "all .15s",
                      }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                          border: cargosExp.includes("sem-exp") ? `2px solid ${AZUL}` : "2px solid var(--border-strong)",
                          background: cargosExp.includes("sem-exp") ? AZUL : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 11, fontWeight: 700,
                        }}>{cargosExp.includes("sem-exp") ? "✓" : ""}</span>
                        <input type="checkbox" checked={cargosExp.includes("sem-exp")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCargosExp(["sem-exp"]);
                              setCargoPrincipal("sem-exp");
                            } else {
                              setCargosExp([]);
                              setCargoPrincipal("");
                            }
                          }}
                          style={{ display: "none" }} />
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: cargosExp.includes("sem-exp") ? AZUL : "var(--ink)" }}>
                            Iniciante — primeira experiência em vendas
                          </span>
                          <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45, marginTop: 2 }}>
                            Ainda não tenho experiência formal com vendas
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Seção: Detalhes da experiência */}
                    <div className="cp-secao">
                      <div className="cp-secao-titulo">Detalhes da experiência</div>
                    </div>

                    <div className="cp-campo">
                      <label className="cp-campo-label">Áreas de atuação <span className="cp-req">*</span></label>
                      <MultiSelect opcoes={AREAS_ATUACAO} valor={areasAtuacao} onChange={setAreasAtuacao} placeholder="Selecione suas áreas" />
                    </div>

                    <div className="cp-campo">
                      <label className="cp-campo-label">Habilidades específicas <span className="cp-req">*</span></label>
                      <MultiSelect opcoes={HABILIDADES} valor={habilidades} onChange={setHabilidades} placeholder="Selecione suas habilidades" />
                    </div>

                    <div className="cp-row">
                      <div className="cp-campo">
                        <label className="cp-campo-label">Anos de experiência <span className="cp-req">*</span></label>
                        <ComboSelect opcoes={ANOS_EXPERIENCIA} valor={anosExperiencia} onChange={setAnosExperiencia} placeholder="Selecione" />
                      </div>
                      <div className="cp-campo">
                        <label className="cp-campo-label">Disponibilidade semanal <span className="cp-req">*</span></label>
                        <ComboSelect opcoes={DISPONIBILIDADE} valor={disponibilidade} onChange={setDisponibilidade} placeholder="Selecione" />
                      </div>
                    </div>

                    <div className="cp-campo">
                      <label className="cp-campo-label">Experiência por segmento <span className="cp-opt">(opcional)</span></label>
                      <MultiSelect opcoes={SEGMENTOS} valor={segmentos} onChange={setSegmentos} placeholder="Selecione os segmentos" />
                    </div>

                    <div className="cp-campo">
                      <label className="cp-campo-label">Ferramentas que domina <span className="cp-opt">(opcional)</span></label>
                      <MultiSelect opcoes={FERRAMENTAS} valor={ferramentas} onChange={setFerramentas} placeholder="Selecione as ferramentas" />
                    </div>

                    {/* Currículo */}
                    <div className="cp-curriculo-area">
                      <div className="cp-curriculo-icon">
                        <FileText size={20} />
                      </div>
                      <div className="cp-curriculo-info">
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                          {t("cadProf.campos.curriculo")}
                          <span style={{ fontWeight: 400, color: "var(--muted-2)", marginLeft: 6, fontSize: 11.5 }}>
                            ({t("cadProf.campos.curriculoOpcional")})
                          </span>
                        </div>
                        {curriculo && <span style={{ fontSize: 12, color: "var(--muted)", display: "block", marginTop: 2 }}>{curriculo.nome}</span>}
                      </div>
                      <button type="button" className="cp-foto-btn" onClick={() => inputCurriculo.current?.click()}>
                        <Upload size={14} />
                        {curriculo ? t("cadProf.campos.trocarArquivo") : t("cadProf.campos.enviarCurriculo")}
                      </button>
                      <input ref={inputCurriculo} type="file" hidden
                        accept="application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => selecionarCurriculo(e.target.files?.[0])} />
                    </div>
                    {curriculoErro && <div className="cp-campo-erro" style={{ marginBottom: 14 }}>{curriculoErro}</div>}

                    {/* Termos */}
                    <label className="cp-termos">
                      <input type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)} />
                      <span>
                        {t("cadProf.campos.termos")}{" "}
                        <button type="button" className="cp-termos-link" onClick={() => setShowTermos(true)}>
                          {t("cadProf.campos.termosLink")}
                        </button>
                      </span>
                    </label>
                  </>
                )}
              </div>

              {/* ── Erro da etapa ── */}
              {erroEtapa && <div className="cp-erro">{erroEtapa}</div>}

              {/* ── Navegação ── */}
              <div className="cp-nav">
                {etapa > 0 && (
                  <button type="button" className="cp-nav-voltar" onClick={voltar}>
                    {t("cadProf.voltar")}
                  </button>
                )}
                {etapa < ETAPAS_KEYS.length - 1 ? (
                  <button type="button" className="cp-nav-avancar" onClick={avancar}>
                    {t("cadProf.continuar")}
                  </button>
                ) : (
                  <button className="cp-nav-avancar" type="submit" disabled={loading || !aceitouTermos}>
                    {loading ? t("cadProf.criando") : t("cadProf.criarConta")}
                  </button>
                )}
              </div>
            </form>

            {/* Info pós-form */}
            <div className="cp-depois">
              <b>{t("cadProf.depoisTitulo")}</b> {t("cadProf.depoisTexto")}
            </div>
          </div>

          {/* ══════════ RODAPÉ ══════════ */}
          <div className="cp-footer">
            <button className="cp-footer-link" onClick={() => navegar(ROTAS.login)}>
              {t("cadProf.jaTemConta")}
            </button>
            <div style={{ marginTop: 4 }}>
              <button className="cp-footer-link cp-footer-empresa" onClick={() => navegar(ROTAS.cadastroEmpresa)}>
                {t("cadProf.souEmpresa")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ MODAL: Guia de Foto ══════════ */}
      {mostrarGuia && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setMostrarGuia(false); }}>
          <div style={{ background: "var(--surface-solid)", borderRadius: 16, padding: 28, maxWidth: 420, width: "100%", maxHeight: "90vh", overflowY: "auto", position: "relative", border: "1px solid var(--border-strong)" }}>
            <button type="button" onClick={() => setMostrarGuia(false)} aria-label="Fechar"
              style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)" }}>
              <X size={20} />
            </button>
            <h3 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{GUIA_FOTO.titulo}</h3>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 22 }}>
              <div style={{ textAlign: "center" }}>
                <img src={exemploEnquadramento("certo")} alt="Correto" style={{ width: 100, height: 100, borderRadius: 12 }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <img src={exemploEnquadramento("errado")} alt="Incorreto" style={{ width: 100, height: 100, borderRadius: 12 }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>Requisitos</div>
              {GUIA_FOTO.requisitos.map((r) => (
                <div key={r.chave} style={{ fontSize: 12.5, marginBottom: 5, lineHeight: 1.5 }}>
                  <b style={{ color: "var(--ink)" }}>{r.texto}</b> — <span style={{ color: "var(--muted)" }}>{r.detalhe}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 5, color: "var(--green, #22c55e)" }}>
                  <CheckCircle size={13} style={{ verticalAlign: -2, marginRight: 3 }} />Recomendado
                </div>
                {GUIA_FOTO.recomendado.map((txt, i) => (
                  <div key={i} style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 2, color: "var(--muted)" }}>{txt}</div>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 5, color: "var(--red, #ef4444)" }}>
                  <XCircle size={13} style={{ verticalAlign: -2, marginRight: 3 }} />Evitar
                </div>
                {GUIA_FOTO.evitar.map((txt, i) => (
                  <div key={i} style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 2, color: "var(--muted)" }}>{txt}</div>
                ))}
              </div>
            </div>
            <button type="button" className="cp-nav-avancar" style={{ width: "100%" }}
              onClick={() => { setMostrarGuia(false); inputFoto.current?.click(); }}>
              Entendi, escolher foto
            </button>
          </div>
        </div>
      )}

      {/* ══════════ ENQUADRAR FOTO (zoom + arraste) ══════════ */}
      {editorSrc && (() => {
        const base = editorNat.w ? Math.max(FRAME / editorNat.w, FRAME / editorNat.h) * editorZoom : 1;
        const edW = editorNat.w * base, edH = editorNat.h * base;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 920, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) setEditorSrc(""); }}>
            <div style={{ background: "var(--surface-solid)", borderRadius: 16, padding: 24, maxWidth: 360, width: "100%", maxHeight: "92vh", overflowY: "auto", position: "relative", border: "1px solid var(--border-strong)" }}>
              <button type="button" onClick={() => setEditorSrc("")} aria-label="Fechar"
                style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)" }}>
                <X size={20} />
              </button>
              <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>Ajustar foto</h3>
              <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
                Arraste para posicionar o rosto e use o controle para aproximar.
              </p>

              <div className="cp-editor-frame" style={{ width: FRAME, height: FRAME }}
                onPointerDown={editorPointerDown} onPointerMove={editorPointerMove}
                onPointerUp={editorPointerUp} onPointerLeave={editorPointerUp}>
                <img src={editorSrc} alt="" draggable={false}
                  style={{ position: "absolute", width: edW, height: edH,
                    left: FRAME / 2 + editorOff.x - edW / 2, top: FRAME / 2 + editorOff.y - edH / 2,
                    maxWidth: "none", pointerEvents: "none", userSelect: "none" }} />
                <div className="cp-editor-ring" />
              </div>

              <div className="cp-editor-zoom">
                <ImageIcon size={16} style={{ color: "var(--muted-2)", flexShrink: 0 }} />
                <input type="range" min={1} max={3} step={0.01} value={editorZoom}
                  aria-label="Aproximar" onChange={(e) => editorSetZoom(Number(e.target.value))} />
                <ZoomIn size={18} style={{ color: "var(--muted-2)", flexShrink: 0 }} />
              </div>

              <div className="cp-nav" style={{ marginTop: 18 }}>
                <button type="button" className="cp-nav-voltar" onClick={() => setEditorSrc("")}>Cancelar</button>
                <button type="button" className="cp-nav-avancar" onClick={confirmarEnquadramento}>Usar esta foto</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
