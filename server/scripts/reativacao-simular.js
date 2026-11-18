// DRY_RUN local: mostra quem receberia o quê hoje na reativação de empresas,
// sem enviar nem gravar. Usa o banco do DB_PATH (ou o local).
// Uso: npm run reativacao:simular
import "dotenv/config";
import { planejar, resumirPlano } from "../services/reativacaoEmpresas.js";

const r = resumirPlano(planejar(Date.now(), { diaInteiro: true }));
console.log(`Reativação · ${r.dia}${r.diaUtil ? "" : " (não é dia útil: nada sai hoje)"}`);
console.log(JSON.stringify(r.totais));
for (const l of r.linhas) {
  const email = !l.mensagemEmail ? "-" : l.mensagemEmail.pular ? `pula (${l.mensagemEmail.pular})` : `"${l.mensagemEmail.assunto}"${l.mensagemEmail.acimaDoTeto ? " [amanhã, teto]" : ""}`;
  const zap = !l.whatsapp ? "-" : l.whatsapp.pular ? `pula (${l.whatsapp.pular})` : `${l.whatsapp.modelo} às ${l.whatsapp.horario}`;
  console.log(`- ${l.empresa} <${l.email}> · ${l.tipo}${l.dia ? ` dia ${l.dia}` : ""}${l.segmento ? ` · ${l.segmento}` : ""}${l.motivo ? ` · ${l.motivo}` : ""} · e-mail: ${email} · WhatsApp: ${zap}`);
}
process.exit(0);
