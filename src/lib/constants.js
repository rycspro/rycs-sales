import {
  Video, Send, ClipboardList, Users, Banknote,
  CheckCircle2, Clock, AlertTriangle, XCircle, Sparkles,
  Building2, Wallet, User as UserIcon,
  BarChart3, ShieldCheck, MessageSquare, UserCheck,
} from "lucide-react";

// Re-export shared constants (used by both frontend and backend)
export { CAMPOS, ORDEM_ACOES, TAXA } from "../../shared/acoes.js";

// ACOES with Icons added (shared version has no React icons)
import { ACOES as ACOES_BASE } from "../../shared/acoes.js";

const ICONS = { ligacao: Video, follow: Send, agendamento: ClipboardList, realizada: Users, venda: Banknote };

export const ACOES = Object.fromEntries(
  Object.entries(ACOES_BASE).map(([k, v]) => [k, { ...v, Icon: ICONS[k] }])
);

export const STATUS = {
  analisando: { txt: "Analisando com IA", tone: "muted", Icon: Clock },
  ia_aprovado: { txt: "Aprovado pela IA", tone: "indigo", Icon: Sparkles },
  revisao: { txt: "Revisão manual", tone: "amber", Icon: AlertTriangle },
  ia_recusado: { txt: "Recusado pela IA", tone: "red", Icon: XCircle },
  conferido: { txt: "Confirmado pela empresa", tone: "indigo", Icon: CheckCircle2 },
  liberado: { txt: "Liberado", tone: "brand", Icon: CheckCircle2 },
  recusado: { txt: "Recusado", tone: "red", Icon: XCircle },
};

export const MOTIVO_COR = {
  analisando: "var(--muted)", ia_aprovado: "#3730A1", revisao: "var(--amber)",
  ia_recusado: "var(--red)", conferido: "#3730A1", liberado: "var(--brand)", recusado: "var(--red)",
};

export const NAV = {
  vendedor: [
    { key: "empresas", label: "Empresas", Icon: Building2 },
    { key: "carteira", label: "Carteira", Icon: Wallet },
    { key: "perfil", label: "Perfil", Icon: UserIcon },
  ],
  empresa: [
    { key: "painel", label: "Painel", Icon: BarChart3 },
    { key: "conferir", label: "Conferir", Icon: ShieldCheck },
    { key: "time", label: "Time", Icon: Users },
    { key: "tabela", label: "Tabela", Icon: ClipboardList },
    { key: "chat", label: "Chat", Icon: MessageSquare },
  ],
  admin: [
    { key: "dashboard", label: "Dashboard", Icon: BarChart3 },
    { key: "profissionais", label: "Profissionais", Icon: UserCheck },
    { key: "empresas", label: "Empresas", Icon: Building2 },
    { key: "triagem", label: "Triagem", Icon: ShieldCheck },
    { key: "liberar", label: "Liberar", Icon: Banknote },
    { key: "saques", label: "Saques", Icon: Wallet },
  ],
};

export const QUIZ = [
  {
    q: "O cliente diz 'me manda por e-mail que eu vejo depois'. O que você faz?",
    ops: [
      ["Mando o e-mail e espero ele responder", 0],
      ["Mando na hora e já pergunto o que precisa estar no e-mail para virar uma conversa", 10],
      ["Pergunto o que ficou em aberto e proponho 15 minutos ainda essa semana", 20],
    ],
  },
  {
    q: "Quantas tentativas você faz antes de considerar um contato perdido?",
    ops: [["1 ou 2", 0], ["3 a 5", 12], ["6 ou mais, variando canal e horário", 20]],
  },
  {
    q: "Na primeira ligação, o que vem primeiro?",
    ops: [["O preço, para filtrar rápido", 0], ["As funcionalidades do produto", 5], ["O problema que ele vive hoje", 20]],
  },
  {
    q: "Quanto tempo por dia você consegue prospectar de verdade?",
    ops: [["Menos de 1 hora", 5], ["2 a 3 horas", 15], ["4 horas ou mais", 20]],
  },
  {
    q: "Você grava suas calls?",
    ops: [["Nunca gravei", 0], ["Às vezes", 10], ["Sempre, e reescuto as que perdi", 20]],
  },
];
