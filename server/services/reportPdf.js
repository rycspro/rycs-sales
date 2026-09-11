import { inflateSync } from "zlib";

const ascii=(s)=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g," ").replace(/[()\\]/g,(m)=>`\\${m}`);

export function extrairTextoPdf(buffer){
  const bruto=buffer.toString("latin1"); if(!bruto.startsWith("%PDF"))throw new Error("Arquivo não é um PDF válido");
  const blocos=[bruto]; const re=/<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g; let m;
  while((m=re.exec(bruto))){try{const b=Buffer.from(m[2],"latin1");blocos.push(/FlateDecode/.test(m[1])?inflateSync(b).toString("latin1"):m[2]);}catch{}}
  const textos=[]; for(const bloco of blocos){for(const x of bloco.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g))textos.push(x[1]);for(const a of bloco.matchAll(/\[(.*?)\]\s*TJ/gs))for(const x of a[1].matchAll(/\(([^()]*)\)/g))textos.push(x[1]);}
  return textos.join(" ").replace(/\\[nrt]/g," ").replace(/\\([()\\])/g,"$1").replace(/\s+/g," ").trim();
}

function pngInfo(buffer){let p=8,w=0,h=0,bits=8,cores=3;const idat=[];while(p<buffer.length){const len=buffer.readUInt32BE(p),tipo=buffer.toString("ascii",p+4,p+8),d=buffer.subarray(p+8,p+8+len);if(tipo==="IHDR"){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bits=d[8];cores=d[9]===2?3:1;}if(tipo==="IDAT")idat.push(d);p+=12+len;if(tipo==="IEND")break;}return{w,h,bits,cores,data:Buffer.concat(idat)};}

export function gerarRelatorioPdf({empresa,periodo,dados,logo}){
  const img=pngInfo(logo), linhas=[
    `Empresa: ${empresa.nome}`,`Periodo: ${periodo}`,`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`,
    "",`Reunioes agendadas: ${dados.agendadas||0}`,`Reunioes realizadas: ${dados.realizadas||0}`,`Vendas realizadas: ${dados.vendas||0}`,
    `Investimento: R$ ${Number(dados.investimento||0).toFixed(2)}`,`Retorno: R$ ${Number(dados.retorno||0).toFixed(2)}`,`ROI: ${dados.roi==null?"indisponivel":Number(dados.roi).toFixed(1)+"%"}`,
    "","Analise",dados.analise||"Indicadores calculados com registros operacionais autorizados da empresa.","","Fontes","Campanhas, leads, tarefas, aprovacoes e livro financeiro da empresa.","","Conclusao",dados.conclusao||"Revise filtros e premissas antes de tomar decisoes. Projecoes nao sao garantias.","","RYCS - Inteligencia comercial com rastreabilidade."
  ].map(ascii);
  let y=748,content="q 44 0 0 44 48 765 cm /Logo Do Q\nBT /F1 22 Tf 108 788 Td (RELATORIO RYCS) Tj ET\n";
  content+="0.15 0.35 0.85 rg 48 730 499 3 re f\n";
  for(const l of linhas){content+=`BT /F1 ${l==="Analise"||l==="Fontes"||l==="Conclusao"?14:10} Tf 48 ${y} Td (${l}) Tj ET\n`;y-=l?22:10;}
  const stream=Buffer.from(content,"latin1");
  const objs=[null,
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents 6 0 R >>"),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent ${img.bits} /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${img.cores} /BitsPerComponent ${img.bits} /Columns ${img.w} >> /Length ${img.data.length} >>\nstream\n`),img.data,Buffer.from("\nendstream")]),
    Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),stream,Buffer.from("endstream")])];
  const partes=[Buffer.from("%PDF-1.4\n%RYCS\n")],offsets=[0];let off=partes[0].length;
  for(let i=1;i<objs.length;i++){offsets[i]=off;const b=Buffer.concat([Buffer.from(`${i} 0 obj\n`),objs[i],Buffer.from("\nendobj\n")]);partes.push(b);off+=b.length;}
  const xref=off;let x=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;for(let i=1;i<objs.length;i++)x+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;x+=`trailer << /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  partes.push(Buffer.from(x));return Buffer.concat(partes);
}
