import test from "node:test";
import assert from "node:assert/strict";
import { metricasEmpresa, projetarROI, valorMonetario } from "../shared/analytics.js";
import { calcularValorTarefa } from "../shared/valorTarefa.js";
import { calcularVoucher, normalizarVoucher } from "../server/services/vouchers.js";
import { parseTabela } from "../src/lib/importers.js";
import { gerarRelatorioPdf } from "../server/services/reportPdf.js";
import { readFileSync } from "node:fs";

test("dashboard calcula retorno e ROI somente com vendas aprovadas",()=>{const m=metricasEmpresa({companyId:"c1",submissions:[{companyId:"c1",tipo:"agendamento",status:"liberado",valor:10,criadoEm:Date.now()},{companyId:"c1",tipo:"realizada",status:"liberado",valor:20,criadoEm:Date.now()},{companyId:"c1",tipo:"venda",status:"liberado",valor:100,prova:{valorContrato:"R$ 1.000,00"},criadoEm:Date.now()}]});assert.equal(m.retorno,1000);assert.equal(m.investimento,130);assert.equal(Math.round(m.roi),669);});
test("projeção não inventa dados ausentes e produz três cenários",()=>{assert.equal(projetarROI({metricas:{agendadas:0,realizadas:0,vendas:0,investimento:0},metaVendas:5}).disponivel,false);const p=projetarROI({metricas:{agendadas:20,realizadas:10,vendas:2,investimento:200},metaVendas:5,ticketMedio:1000});assert.equal(p.disponivel,true);assert.deepEqual(Object.keys(p.cenarios),["conservador","provavel","otimista"]);});
test("taxa real é descontada do bruto e voucher respeita o preço",()=>{assert.deepEqual(calcularValorTarefa(10,"starter"),{bruto:10,percentual:.3,taxa:3,liquido:7});assert.deepEqual(calcularVoucher(999.9,{tipo:"percentual",valor:10}),{valorOriginal:999.9,desconto:99.99,valorFinal:899.91});assert.equal(normalizarVoucher(" rycs 10! "),"RYCS10");});
test("importador CSV preserva campos entre aspas",()=>{const r=parseTabela('nome;empresa;email\n"Ana Silva";"ACME; Brasil";ana@acme.com');assert.equal(r.linhas[0][1],"ACME; Brasil");});
test("PDF da RYCS é gerado com a logo oficial",()=>{const pdf=gerarRelatorioPdf({empresa:{nome:"ACME"},periodo:"30 dias",dados:{agendadas:3,realizadas:2,vendas:1,investimento:100,retorno:1000,roi:900},logo:readFileSync(new URL("../public/logo-rycs.png",import.meta.url))});assert.equal(pdf.subarray(0,4).toString(),"%PDF");assert.ok(pdf.length>10000);});
test("conversor monetário entende formato brasileiro",()=>assert.equal(valorMonetario("R$ 1.490,50/mês"),1490.5));
