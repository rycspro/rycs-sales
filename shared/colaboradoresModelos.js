// Modelos de referência para colaboradores internos: áreas e cargos de
// exemplo e textos de contrato no formato usado no mercado, com base na CLT,
// na Lei 10.097/2000 (aprendiz), na Lei 11.788/2008 (estágio) e no Código
// Civil (prestação de serviços). O dono decidiu não passar por advogado; os
// textos ficam editáveis em Configuração e cada edição vira nova versão.
// Os campos entre chaves duplas são preenchidos pelo sistema.

// ───────────────────────────── Áreas e cargos de exemplo ─────────────────────────────

const t = (titulo, descricao, tipoProva = "texto", recorrencia = "diaria") => ({ titulo, descricao, tipoProva, recorrencia });

export const AREAS_EXEMPLO = [
  {
    chave: "marketing", nome: "Marketing", icone: "megaphone",
    cargos: [
      { chave: "social-media", nome: "Social media", vinculo: "clt", tarefas: [
        t("Publicar o conteúdo do dia", "Postar nas redes da RYCS o que está no calendário de conteúdo.", "link"),
        t("Responder comentários e mensagens", "Responder comentários e directs das redes no mesmo dia."),
        t("Relatório semanal das redes", "Alcance, seguidores e posts que mais engajaram na semana.", "arquivo", "semanal"),
      ] },
      { chave: "designer", nome: "Designer", vinculo: "clt", tarefas: [
        t("Peças do dia", "Entregar as artes pedidas no quadro de demandas.", "arquivo"),
      ] },
      { chave: "trafego", nome: "Tráfego pago", vinculo: "clt", tarefas: [
        t("Conferir campanhas", "Verificar gasto, custo por lead e pausar o que estiver ruim.", "texto"),
        t("Relatório semanal de anúncios", "Investimento, leads e custo por lead da semana.", "arquivo", "semanal"),
      ] },
      { chave: "social-media-formacao", nome: "Social media em formação", vinculo: "formacao", tarefas: [
        t("Aula ou estudo do dia", "Registrar o que estudou hoje (curso, vídeo ou material).", "texto"),
        t("Rascunho de post", "Criar um rascunho de post para revisão.", "arquivo"),
      ] },
    ],
  },
  {
    chave: "administrativo", nome: "Administrativo", icone: "building",
    cargos: [
      { chave: "assistente-adm", nome: "Assistente administrativo", vinculo: "clt", tarefas: [
        t("Organizar a caixa de e-mails", "Responder ou encaminhar os e-mails do dia.", "texto"),
        t("Atualizar planilhas e cadastros", "Manter cadastros de clientes e fornecedores em dia.", "texto"),
        t("Resumo da semana", "O que foi resolvido e o que ficou pendente.", "texto", "semanal"),
      ] },
      { chave: "auxiliar-adm-formacao", nome: "Auxiliar administrativo em formação", vinculo: "formacao", tarefas: [
        t("Tarefa de apoio do dia", "Registrar a tarefa de apoio feita hoje.", "texto"),
        t("Aprendizado do dia", "O que aprendeu hoje e com quem.", "texto"),
      ] },
    ],
  },
  {
    chave: "financeiro", nome: "Financeiro e contábil", icone: "calculator",
    cargos: [
      { chave: "auxiliar-financeiro", nome: "Auxiliar financeiro", vinculo: "clt", tarefas: [
        t("Conciliação do dia", "Conferir entradas e saídas do dia com o extrato.", "arquivo"),
        t("Contas a pagar e a receber", "Atualizar vencimentos e cobranças.", "texto"),
      ] },
      { chave: "analista-contabil", nome: "Analista contábil", vinculo: "clt", tarefas: [
        t("Documentos para o contador", "Separar e enviar notas e comprovantes do período.", "arquivo", "semanal"),
      ] },
    ],
  },
  {
    chave: "comercial", nome: "Comercial", icone: "target",
    cargos: [
      { chave: "sdr", nome: "SDR", vinculo: "clt", tarefas: [
        t("Prospecção do dia", "Quantidade de contatos feitos e reuniões marcadas.", "texto"),
      ] },
      { chave: "closer", nome: "Closer", vinculo: "clt", tarefas: [
        t("Reuniões do dia", "Reuniões feitas, propostas enviadas e vendas fechadas.", "texto"),
      ] },
      { chave: "pos-venda", nome: "Pós-venda", vinculo: "clt", tarefas: [
        t("Acompanhamento de clientes", "Clientes atendidos hoje e pendências.", "texto"),
      ] },
    ],
  },
];

// Galeria para "novo cargo a partir de um exemplo" (todos os cargos acima).
export const CARGOS_EXEMPLO = AREAS_EXEMPLO.flatMap((a) => a.cargos.map((c) => ({ ...c, area: a.nome })));

// ───────────────────────────── Contratos ─────────────────────────────

const PARTES_EMPREGO = `EMPREGADORA: {{empresaNome}}, inscrita no CNPJ sob o nº {{empresaCnpj}}, com sede em {{empresaEndereco}}, neste ato representada por {{empresaRepresentante}}.

EMPREGADO(A): {{nome}}, inscrito(a) no CPF sob o nº {{cpf}}.`;

const ACOMPANHAMENTO = `ACOMPANHAMENTO DAS ATIVIDADES E PROTEÇÃO DE DADOS
As atividades são registradas na plataforma da EMPREGADORA por meio das tarefas, das provas que o(a) EMPREGADO(A) escolhe anexar, das datas e horários de envio e dos acessos. Não há captura de imagem da pessoa, localização, captura de tela nem registro de teclado ou mouse. Os dados são tratados para a execução deste contrato (Lei 13.709/2018, art. 7º, V), ficam visíveis apenas ao(à) EMPREGADO(A) e à administração da EMPREGADORA, e o(a) EMPREGADO(A) pode consultá-los, pedir correção e contestar registros na própria plataforma. A inteligência artificial da plataforma apenas resume e sinaliza; nenhuma decisão sobre pagamento, desconto ou vínculo é tomada de forma automática.`;

const ASSINATURA = `As partes reconhecem a validade da assinatura eletrônica feita na plataforma da EMPREGADORA, mediante nome digitado e código de confirmação enviado ao e-mail cadastrado, como meio de comprovação de autoria e integridade aceito por ambas (Medida Provisória 2.200-2/2001, art. 10, § 2º).

{{empresaCidade}}, {{dataEmissao}}.`;

const CLT = `CONTRATO INDIVIDUAL DE TRABALHO POR PRAZO INDETERMINADO, COM PERÍODO DE EXPERIÊNCIA

${PARTES_EMPREGO}

CLÁUSULA 1 – FUNÇÃO
O(A) EMPREGADO(A) é admitido(a) para exercer a função de {{funcao}}, na área de {{area}}, obrigando-se a executar todas as atividades compatíveis com a sua condição pessoal e com a função (CLT, art. 456, parágrafo único).

CLÁUSULA 2 – INÍCIO E EXPERIÊNCIA
O contrato tem início em {{dataInicio}}. Os primeiros 45 (quarenta e cinco) dias são de experiência, prorrogáveis uma única vez por igual período, até {{fimExperiencia}}, no máximo 90 (noventa) dias (CLT, art. 445, parágrafo único, e art. 451). Encerrado esse período sem manifestação em contrário, o contrato passa a vigorar por prazo indeterminado.

CLÁUSULA 3 – REGIME, JORNADA E HORÁRIO
O trabalho será prestado no regime {{regime}}, com jornada de {{jornada}}, nos dias {{diasPrevistos}}, {{horario}}, com intervalo para repouso e alimentação na forma do art. 71 da CLT. Horas extras só serão feitas quando pedidas ou autorizadas pela EMPREGADORA e serão pagas com adicional mínimo de 50% (Constituição Federal, art. 7º, XVI) ou compensadas em banco de horas por acordo escrito, em até 6 (seis) meses (CLT, art. 59, § 5º). Em teletrabalho, aplicam-se os arts. 75-A a 75-F da CLT, e a responsabilidade por equipamentos e despesas será ajustada por escrito.

CLÁUSULA 4 – REMUNERAÇÃO
O(A) EMPREGADO(A) receberá salário mensal de {{fixo}}, pago até o 5º (quinto) dia útil do mês seguinte (CLT, art. 459, § 1º), com os descontos legais. Remuneração variável: {{variavel}}. Teto mensal do variável: {{teto}}. Os valores variáveis são apurados mensalmente na plataforma, com regras visíveis ao(à) EMPREGADO(A), e pagos na folha de pagamento.

CLÁUSULA 5 – VALE-TRANSPORTE
A EMPREGADORA fornecerá vale-transporte nos termos da Lei 7.418/1985, mediante opção do(a) EMPREGADO(A), com o desconto de até 6% (seis por cento) do salário-base previsto em lei.

CLÁUSULA 6 – ${ACOMPANHAMENTO}

CLÁUSULA 7 – DEVERES E SIGILO
O(A) EMPREGADO(A) se compromete a cumprir as orientações da EMPREGADORA, a zelar pelos equipamentos e sistemas e a manter sigilo sobre informações de clientes, parceiros, preços, estratégias e dados pessoais a que tiver acesso, durante e após o contrato.

CLÁUSULA 8 – DESCONTOS POR DANO
Em caso de dano causado pelo(a) EMPREGADO(A), o desconto será lícito quando houver dolo ou, havendo culpa, com base nesta cláusula, conforme o art. 462, § 1º, da CLT.

CLÁUSULA 9 – ALTERAÇÕES
Qualquer alteração deste contrato depende de concordância das partes, formalizada em termo aditivo, e não poderá trazer prejuízo ao(à) EMPREGADO(A) (CLT, art. 468).

CLÁUSULA 10 – RESCISÃO E FORO
A rescisão seguirá a CLT, inclusive quanto ao aviso prévio (Lei 12.506/2011). Fica eleita a Justiça do Trabalho do local da prestação dos serviços (CLT, art. 651). O registro deste contrato será feito na Carteira de Trabalho Digital.

${ASSINATURA}`;

const FORMACAO = CLT
  .replace("CONTRATO INDIVIDUAL DE TRABALHO POR PRAZO INDETERMINADO, COM PERÍODO DE EXPERIÊNCIA", "CONTRATO INDIVIDUAL DE TRABALHO POR PRAZO INDETERMINADO, COM PERÍODO DE EXPERIÊNCIA – COLABORADOR EM FORMAÇÃO")
  .replace(`CLÁUSULA 2 – INÍCIO E EXPERIÊNCIA`, `CLÁUSULA 1-A – FORMAÇÃO
Durante o contrato, a EMPREGADORA oferecerá orientação prática e materiais de estudo ligados à função, e parte das tarefas será de aprendizado registrado na plataforma. Este contrato é de emprego comum regido pela CLT e não se confunde com o contrato de aprendizagem da Lei 10.097/2000.

CLÁUSULA 2 – INÍCIO E EXPERIÊNCIA`);

const APRENDIZ = `CONTRATO DE APRENDIZAGEM

EMPREGADORA: {{empresaNome}}, inscrita no CNPJ sob o nº {{empresaCnpj}}, com sede em {{empresaEndereco}}, neste ato representada por {{empresaRepresentante}}.

APRENDIZ: {{nome}}, inscrito(a) no CPF sob o nº {{cpf}}, nascido(a) em {{dataNascimento}}.

CLÁUSULA 1 – OBJETO
Contrato de trabalho especial, por prazo determinado, em que a EMPREGADORA se compromete a assegurar ao(à) APRENDIZ formação técnico-profissional metódica, compatível com o seu desenvolvimento físico, moral e psicológico, no programa de aprendizagem "{{cursoAprendizagem}}", desenvolvido pela entidade formadora {{entidadeFormadora}}, e o(a) APRENDIZ se compromete a executar com zelo e diligência as tarefas necessárias a essa formação, na função de {{funcao}} (CLT, art. 428).

CLÁUSULA 2 – REQUISITOS
O(A) APRENDIZ declara ter entre 14 (catorze) e 24 (vinte e quatro) anos, estar inscrito(a) no programa de aprendizagem acima e, se ainda não concluiu o ensino médio, estar matriculado(a) e frequentando a escola (CLT, art. 428, § 1º). A falta desses requisitos invalida a aprendizagem.

CLÁUSULA 3 – PRAZO
O contrato vigora de {{dataInicio}} a {{dataFim}}, sem ultrapassar 2 (dois) anos (CLT, art. 428, § 3º), e se extingue no seu termo, quando o(a) APRENDIZ completar 24 (vinte e quatro) anos, salvo pessoa com deficiência, ou antes, nas hipóteses do art. 433 da CLT: desempenho insuficiente ou inadaptação, falta disciplinar grave, ausência injustificada à escola que implique perda do ano letivo, ou a pedido do(a) APRENDIZ.

CLÁUSULA 4 – JORNADA
A jornada é de {{jornada}}, nos dias {{diasPrevistos}}, {{horario}}, não excedendo 6 (seis) horas diárias, vedadas a prorrogação e a compensação, admitidas até 8 (oito) horas para quem já concluiu o ensino fundamental, se nelas forem computadas as horas de aprendizagem teórica (CLT, art. 432). Carga de atividades teóricas: {{cargaTeorica}}. É vedado trabalho noturno, perigoso ou insalubre ao(à) menor de 18 (dezoito) anos.

CLÁUSULA 5 – REMUNERAÇÃO E DEPÓSITOS
O(A) APRENDIZ receberá {{fixo}} por mês, respeitado o salário-mínimo hora (CLT, art. 428, § 2º). Remuneração variável, se houver: {{variavel}}. A EMPREGADORA depositará o FGTS à alíquota de 2% (dois por cento) (Lei 8.036/1990, art. 15, § 7º) e fornecerá vale-transporte nos termos da Lei 7.418/1985.

CLÁUSULA 6 – ${ACOMPANHAMENTO.replace(/EMPREGADO\(A\)/g, "APRENDIZ")}

CLÁUSULA 7 – SIGILO E FORO
O(A) APRENDIZ manterá sigilo sobre as informações a que tiver acesso. O registro será feito na Carteira de Trabalho Digital. Fica eleita a Justiça do Trabalho do local da prestação dos serviços.

${ASSINATURA}`;

const ESTAGIO = `TERMO DE COMPROMISSO DE ESTÁGIO

CONCEDENTE: {{empresaNome}}, inscrita no CNPJ sob o nº {{empresaCnpj}}, com sede em {{empresaEndereco}}, representada por {{empresaRepresentante}}.

ESTAGIÁRIO(A): {{nome}}, CPF {{cpf}}, estudante do curso de {{curso}} na instituição de ensino {{instituicaoEnsino}}, que também assina este termo.

CLÁUSULA 1 – OBJETO
Estágio não obrigatório, ato educativo supervisionado, nos termos da Lei 11.788/2008, na área de {{area}}, com atividades de {{funcao}} compatíveis com o curso, conforme plano de atividades registrado na plataforma.

CLÁUSULA 2 – VIGÊNCIA E JORNADA
De {{dataInicio}} a {{dataFim}}, sem ultrapassar 2 (dois) anos na mesma concedente (art. 11). Jornada de {{jornada}}, nos dias {{diasPrevistos}}, {{horario}}, limitada a 6 (seis) horas diárias e 30 (trinta) semanais e compatível com as atividades escolares (art. 10), reduzida pelo menos à metade nos períodos de avaliação.

CLÁUSULA 3 – BOLSA E BENEFÍCIOS
O(A) ESTAGIÁRIO(A) receberá bolsa de {{fixo}} por mês e auxílio-transporte (art. 12). Valores por entrega, se houver: {{variavel}}. A CONCEDENTE contratará seguro contra acidentes pessoais em favor do(a) ESTAGIÁRIO(A) (art. 9º, IV) e concederá recesso de 30 (trinta) dias a cada ano de estágio, remunerado, preferencialmente nas férias escolares (art. 13).

CLÁUSULA 4 – SUPERVISÃO
A supervisão fica a cargo de {{empresaRepresentante}}. A CONCEDENTE enviará à instituição de ensino, a cada 6 (seis) meses, relatório de atividades, com vista obrigatória ao(à) ESTAGIÁRIO(A) (art. 9º, VII).

CLÁUSULA 5 – ${ACOMPANHAMENTO.replace(/EMPREGADO\(A\)/g, "ESTAGIÁRIO(A)").replace(/EMPREGADORA/g, "CONCEDENTE")}

CLÁUSULA 6 – VÍNCULO E ENCERRAMENTO
Cumpridos os requisitos da Lei 11.788/2008, o estágio não cria vínculo de emprego (art. 3º). O termo pode ser encerrado a qualquer tempo por qualquer das partes, por escrito, e se encerra automaticamente com a conclusão ou o trancamento do curso.

${ASSINATURA.replace("da EMPREGADORA", "da CONCEDENTE")}`;

const AUTONOMO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS

CONTRATANTE: {{empresaNome}}, inscrita no CNPJ sob o nº {{empresaCnpj}}, com sede em {{empresaEndereco}}, representada por {{empresaRepresentante}}.

CONTRATADO(A): {{nome}}, CPF {{cpf}}.

CLÁUSULA 1 – OBJETO
Prestação de serviços de {{funcao}}, na área de {{area}}, de forma autônoma, nos termos dos arts. 593 a 609 do Código Civil e do art. 442-B da CLT.

CLÁUSULA 2 – AUTONOMIA
O(A) CONTRATADO(A) define como, quando e onde executa os serviços, usa os próprios meios, pode prestar serviços a terceiros e não está sujeito(a) a controle de horário ou de presença. A CONTRATANTE acompanha apenas as entregas.

CLÁUSULA 3 – REMUNERAÇÃO
Pelos serviços, o(a) CONTRATADO(A) receberá: {{variavel}}. Valor fixo mensal, se houver: {{fixo}}. Teto mensal: {{teto}}. Os valores são apurados por entrega aprovada na plataforma e pagos no fechamento mensal, contra recibo ou nota fiscal, com as retenções legais.

CLÁUSULA 4 – PRAZO E RESCISÃO
Prazo indeterminado, a partir de {{dataInicio}}, podendo qualquer das partes encerrar o contrato com aviso de 30 (trinta) dias (Código Civil, art. 599).

CLÁUSULA 5 – REGISTRO DAS ENTREGAS E DADOS
As entregas e provas são registradas na plataforma da CONTRATANTE, sem captura de imagem, localização, tela ou teclado. Os dados são tratados para a execução deste contrato (Lei 13.709/2018, art. 7º, V).

CLÁUSULA 6 – SIGILO E FORO
O(A) CONTRATADO(A) manterá sigilo sobre as informações a que tiver acesso. Fica eleito o foro da comarca de {{empresaCidade}}.

${ASSINATURA.replace("da EMPREGADORA", "da CONTRATANTE")}`;

const ADITIVO = `TERMO ADITIVO AO CONTRATO

Partes: {{empresaNome}} (CNPJ {{empresaCnpj}}) e {{nome}} (CPF {{cpf}}).

As partes alteram, de comum acordo, as condições do contrato vigente, que passam a ser as seguintes a partir desta data:

Função: {{funcao}}, na área de {{area}}.
Jornada: {{jornada}}, nos dias {{diasPrevistos}}, {{horario}}.
Remuneração fixa: {{fixo}}.
Remuneração variável: {{variavel}}.
Teto mensal do variável: {{teto}}.

Permanecem inalteradas as demais cláusulas do contrato. Esta alteração não traz prejuízo ao(à) contratado(a) (CLT, art. 468, quando aplicável).

${ASSINATURA.replace("da EMPREGADORA", "da RYCS")}`;

export const MODELOS_REFERENCIA = [
  { vinculo: "clt", tipo: "contrato", titulo: "Contrato de trabalho CLT (modelo de referência)", texto: CLT },
  { vinculo: "formacao", tipo: "contrato", titulo: "Contrato de trabalho CLT – em formação (modelo de referência)", texto: FORMACAO },
  { vinculo: "aprendiz", tipo: "contrato", titulo: "Contrato de aprendizagem (modelo de referência)", texto: APRENDIZ },
  { vinculo: "estagio", tipo: "contrato", titulo: "Termo de compromisso de estágio (modelo de referência)", texto: ESTAGIO },
  { vinculo: "outro", tipo: "contrato", titulo: "Contrato de prestação de serviços autônomos (modelo de referência)", texto: AUTONOMO },
  ...["clt", "formacao", "aprendiz", "estagio", "outro"].map((vinculo) => ({ vinculo, tipo: "aditivo", titulo: "Termo aditivo (modelo de referência)", texto: ADITIVO })),
];

// Classificação padrão de cada valor na exportação para a folha. Comissão e
// valor por produção integram o salário (CLT, art. 457, § 1º).
export const NATUREZAS_PADRAO = {
  fixo: "salario", cadastro: "comissao", empresa_pagante: "comissao", tarefa: "comissao",
  diaria: "vale_transporte", ajuste: "a_classificar", estorno: "a_classificar",
};
