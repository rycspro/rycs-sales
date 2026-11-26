import test from "node:test";
import assert from "node:assert/strict";
import { inferirSegmentoEmpresa, rotuloSegmentoEmpresa, SEGMENTOS } from "../shared/segmentos.js";

const casos = [
  [{ nome: "Agência Make web", descricaoInstitucional: "Marketing digital" }, "servicos_profissionais", "Marketing e Publicidade"],
  [{ nome: "Solar X", produto: "Energia solar para comércio" }, "energia", "Energia Solar Fotovoltaica"],
  [{ nome: "Y", descricaoInstitucional: "Corretora de planos de saúde empresariais" }, "saude", "Planos de Saúde"],
  [{ nome: "IDE ESTRUTURAS METÁLICAS", descricaoInstitucional: "Galpões industriais, estrutura metálica" }, "construcao", "Estruturas Metálicas e Galpões"],
  [{ nome: "Martin", descricaoInstitucional: "Assessoria de vendas e times comerciais" }, "servicos_profissionais", "Consultoria Empresarial"],
  [{ nome: "Imob", produto: "Imobiliária, corretora de imóveis" }, "imobiliario", ""],
];

test("segmento automático usa o catálogo e o nicho mais específico", () => {
  for (const [empresa, segmento, nicho] of casos) {
    assert.deepEqual(inferirSegmentoEmpresa(empresa), { segmento, nicho }, empresa.nome);
    const seg = SEGMENTOS.find((s) => s.valor === segmento);
    assert.ok(seg, segmento);
    if (nicho) assert.ok(seg.nichos.includes(nicho), nicho);
  }
});

test("sem pista no cadastro não inventa segmento", () => {
  assert.equal(inferirSegmentoEmpresa({ nome: "Empresa Teste" }), null);
  assert.equal(rotuloSegmentoEmpresa({ nome: "Empresa Teste" }), "");
});

test("rótulo respeita o que a empresa escolheu", () => {
  assert.equal(rotuloSegmentoEmpresa({ segmento: "tecnologia", nicho: "Fintechs", produto: "energia solar" }), "Fintechs");
  assert.equal(rotuloSegmentoEmpresa({ segmento: "Geração Distribuida" }), "Geração Distribuida");
  assert.equal(rotuloSegmentoEmpresa({ segmento: "energia" }), "Energia");
});
