# Colaboradores internos — especificação

> As seções 1 a 8 foram escritas em 19/11/2026 a partir do acréscimo (seções 9 a 12) e das conversas com o dono.
>
> **Decisões aprovadas pelo dono em 19/11/2026:**
> - Seção 2.4: o variável de empregado vai para o fechamento e é pago na folha, nunca pelo saque da plataforma.
> - Seção 4.1: prova pode ser aprovada automaticamente, por regra escolhida pelo admin por tipo de tarefa, com reversão até o fechamento do mês. A IA nunca recusa.
> - Seção 2.1: confirmado que o fixo é o salário de quem tem vínculo empregatício.
>
> - Seção 13: todas as sugestões (13.1 a 13.13) aprovadas. As que tocam lei trabalhista (13.1, 13.5, 13.7, 13.8 e 13.13) ainda passam pelo advogado ou pelo contador antes de serem implementadas.

### 1. Objetivo, escopo e ativação
**Objetivo.** A RYCS tem pessoas trabalhando para ela mesma (família e equipe), sem registro do que cada uma faz. Esta função dá a cada colaborador um ambiente com contrato, tarefas, provas, produtividade e extrato do mês, e dá ao admin a visão de todos sem precisar fiscalizar ninguém.

**Quem é colaborador interno.** Pessoa que trabalha para a própria RYCS. É diferente do RYCS Professional, que atende campanhas de empresas clientes. A mesma conta pode ser as duas coisas; as áreas ficam separadas.

**Ativação.**
- Na ficha do usuário, no admin, há a chave "Colaborador interno". Vale para qualquer usuário, sem nada fixo no código.
- Ao ligar, o admin preenche: nome completo, CPF, função (cargo), tipo de vínculo (empregatício ou outro), data de início real do trabalho, jornada (horas por semana) e dias de trabalho previstos.
- Depois de ligada, a conta ganha o item "Colaborador RYCS" no menu. A primeira tela é o contrato (seção 9).
- Desligar a chave não apaga nada: segue o encerramento de vínculo (seção 13.9).

**Fora do escopo.** Folha de pagamento, encargos, ponto legal e qualquer forma de monitoramento escondido (ver Ajustes e seção 10).

### 2. Remuneração: fixo e variável
Cada colaborador tem a própria regra de remuneração, montada no admin com qualquer combinação dos itens abaixo. Nenhum valor fica no código.

**2.1 Fixo por mês (opcional).** Salário base de quem tem vínculo empregatício. A plataforma registra o valor e a data de vigência e o informa ao contador no fechamento. Quem paga é a folha.

**2.2 Variável.** Quatro tipos, cada um ligado ou desligado por pessoa:
- **Por cadastro:** valor por cadastro trazido pelo colaborador que cumpre a regra de "cadastro válido" (seção 4.2).
- **Por empresa pagante:** valor fixo ou percentual sobre o pagamento de uma empresa trazida pelo colaborador. O admin define se vale só a primeira cobrança ou as cobranças de um número de meses.
- **Por tarefa:** valor definido na própria tarefa ou na regra da pessoa para aquele tipo de tarefa.
- **Diária verificada:** valor por dia com atividade verificada, conforme a regra da pessoa (seção 4.3).

**2.3 Regras gerais.**
- Cada valor tem data de início de vigência. Mudança de valor cria uma nova vigência e um aditivo (seção 9); a anterior fica no histórico.
- Teto mensal do variável é opcional, por pessoa.
- Telas de exemplo nunca mostram valor que pareça real.

**2.4 Como o dinheiro é pago.**
- **Empregado:** fixo e variável vão no fechamento do mês (seção 5) e são pagos pela folha, via contador. O variável de empregado não sai pelo saque da plataforma. Motivo: comissão paga fora da folha não recolhe encargos e gera passivo trabalhista.
- **Sem vínculo empregatício:** o variável aprovado pode entrar no saldo e sair pelo saque já existente (Pix). O admin escolhe isso na regra da pessoa.

### 3. Tarefas
- O admin cria a tarefa com: título, descrição, quem pode fazer (pessoa, função ou "qualquer colaborador", seção 11), prazo, recorrência (única, diária ou semanal), valor (se o variável for por tarefa), tipo de prova exigida e se conta para a meta (seção 10).
- Tarefa recorrente gera as próximas sozinha, sem o admin recriar.
- Andamento: aberta → enviada → aprovada, ou recusada com motivo (o colaborador pode corrigir e reenviar até o prazo).
- Tarefa para "qualquer colaborador" ou para uma função fica reservada para quem pegar primeiro, para duas pessoas não fazerem a mesma coisa.
- A IA pode sugerir tarefas ao admin, mas nenhuma sugestão fica ativa sem aprovação dele.
- O colaborador só vê as tarefas depois de assinar o contrato (seção 9).

### 4. Provas e verificação
**4.1 Provas de tarefa.**
- Tipos de prova: link, arquivo (PDF ou imagem de documento ou de tela que o próprio colaborador escolhe enviar) e texto.
- Não é aceita foto de pessoa (selfie, foto do colaborador trabalhando) nem localização.
- Checagens automáticas, sempre as mesmas: campos obrigatórios preenchidos, link acessível e prova repetida (mesmo arquivo ou link já usado em outra tarefa, da mesma pessoa ou de outra), detectada por hash do arquivo.
- Por tipo de tarefa, o admin escolhe entre aprovação manual ou automática. Na automática, a prova que passa em todas as checagens é aprovada sozinha, e o admin pode reverter até o fechamento do mês. É o que permite acompanhar sem fiscalizar cada envio.
- A IA lê a prova e, se vir algo estranho, deixa uma observação e manda para a fila do admin. Ela não recusa nem aprova pagamento por conta própria. Só o admin recusa, sempre com motivo.

**4.2 Cadastros e empresas pagantes.** Quem verifica é o próprio sistema, sem prova manual:
- O colaborador usa o código ou link de indicação dele. O cadastro ou a empresa fica atribuído a ele; vale o primeiro vínculo.
- "Cadastro válido" segue a regra definida no admin (por exemplo: e-mail confirmado e cadastro concluído).
- Empresa pagante conta quando o gateway confirma o pagamento.
- Estorno ou cancelamento dentro do prazo de garantia definido no admin gera um lançamento de estorno. Nada é apagado.
- Não conta cadastro com o mesmo CPF, e-mail ou telefone do próprio colaborador.
- Se dois colaboradores disputarem a mesma empresa, o admin decide e o motivo fica registrado.

**4.3 Diária verificada.** A diária é lançada no dia em que a pessoa teve "dia trabalhado" pela regra dela (seção 10), por exemplo, uma tarefa de deslocamento aprovada naquele dia. Sem GPS e sem foto.

**4.4 Contestação.** Ver seção 13.6.

### 5. Saldo do mês e fechamento
- Cada colaborador tem um extrato do mês: fixo (informativo), cada lançamento do variável com origem, data e situação (previsto, aprovado, estornado) e o total. Ele vê o próprio extrato atualizado em tempo real.
- Lançamentos não são editados nem apagados. Correção é um novo lançamento de ajuste, com motivo e autor.
- O mês vai do dia 1 ao último dia. Depois disso, o admin revisa e fecha o mês. Mês fechado fica trancado; correções vão como ajuste no mês seguinte.
- Ao fechar, sai a exportação para o contador (detalhe na seção 13.5) e, para quem não tem vínculo, o variável aprovado vai para o saldo, se a regra da pessoa prevê saque (seção 2.4).

### 6. Termo de transparência e aceite
- Antes de usar a área, o colaborador lê e aceita um termo que diz, em linguagem simples:
  - o que é registrado: tarefas, provas, acessos, data e hora dos envios;
  - o que NUNCA é registrado: foto, localização, tela, teclado ou mouse;
  - quem vê: só o admin e a própria pessoa;
  - para quê: calcular o variável e acompanhar a produtividade;
  - o que a IA faz: resume e alerta; não decide pagamento, desconto nem vínculo;
  - quanto tempo os dados ficam guardados e como pedir acesso, correção ou contestação.
- O aceite registra data, hora, IP e versão do termo. Uma nova versão do termo exige novo aceite.
- O aceite registra que a pessoa está ciente. A base legal do tratamento dos dados é o próprio contrato (LGPD, art. 7º, V), não o consentimento.
- A seção 10 amplia este termo com o acompanhamento de produtividade e presença.

### 7. Acesso, permissões e privacidade
- O colaborador vê só os próprios dados: contrato, tarefas, provas, extrato e painel. Não há ranking entre colaboradores na área dele.
- O admin vê tudo. Um papel de gestor por função (ver só a própria equipe) fica para uma fase seguinte.
- CPF aparece mascarado nas listas; completo só na ficha e no contrato.
- Toda ação do admin que mexe em valor, aprova, recusa, reverte, faz ajuste ou envia aditivo fica num registro de auditoria, com autor, data e hora.
- Interface em português do Brasil, com as variáveis de `src/styles.js` e as mesmas regras de acessibilidade do onboarding: todo campo com `label`, foco visível, alvos de 44px ou mais e contraste mínimo de 4,5:1.

### 8. Critérios de aceite
- [ ] A chave "Colaborador interno" ativa a área para qualquer usuário, sem nada fixo no código.
- [ ] Fixo opcional e variável (cadastro, empresa pagante, tarefa, diária) configuráveis por pessoa, com vigência e histórico.
- [ ] Tarefas atribuíveis a pessoa, função ou qualquer colaborador, com prazo, recorrência e tipo de prova.
- [ ] Prova repetida detectada por hash.
- [ ] Aprovação automática por regra, com reversão pelo admin até o fechamento; recusa só pelo admin, com motivo.
- [ ] Cadastros e empresas pagantes contados pelo próprio sistema, com estorno automático.
- [ ] Extrato com lançamentos que não se apagam; correção só por ajuste, com motivo e autor.
- [ ] Mês fechado fica trancado.
- [ ] Variável de empregado vai para o fechamento e não sai por saque.
- [ ] Termo aceito e versionado antes do primeiro uso.
- [ ] O colaborador vê só os próprios dados; ações do admin ficam na auditoria.

---

## Acréscimo: contrato, produtividade e presença

### Ajustes ao que já foi descrito
- O "Fixo por mês" (seção 2) é o salário base de quem tem vínculo empregatício. Continua opcional por pessoa.
- A plataforma NÃO substitui a folha de pagamento. Encargos, FGTS, INSS, férias e 13º continuam com o contador. A plataforma registra contrato, tarefas, produtividade, presença e o variável (valores por cadastro, empresa pagante e tarefa), e exporta o fechamento do mês para o contador.
- Haverá vários colaboradores (irmã, cunhado, Jonathan e outros). Tudo deve funcionar para N pessoas, sem nada fixo no código, e cada colaborador com função (cargo) e regra próprias.

### 9. Contrato automático
- No admin, ao ligar a chave "Colaborador interno" e escolher o tipo de vínculo (empregatício ou outro), o sistema gera um contrato a partir de um MODELO por tipo de vínculo, preenchido com os dados do cadastro (nome, CPF, função, valor do fixo, regras do variável, data de início, jornada).
- Os modelos de contrato são escritos e aprovados por advogado. O sistema só preenche campos; a IA não redige cláusulas.
- O colaborador recebe o contrato no ambiente dele e assina eletronicamente. Guardar o PDF assinado, a data e hora, o IP e a versão do modelo usada. Integrar com um serviço de assinatura eletrônica (ex.: ZapSign ou Clicksign) ou, se for mais simples na fase 1, com aceite registrado dentro da plataforma, a decidir com o advogado.
- O contrato precisa estar ASSINADO antes de o colaborador ver ou fazer qualquer tarefa. Enquanto não assinar, ele vê só a tela do contrato.
- Alteração de valores ou de regras gera um aditivo que o colaborador também aceita. Guardar o histórico de versões.

### 10. Produtividade e presença (a dor que motivou a função)
Objetivo: o fundador saber, sem precisar fiscalizar, quanto cada colaborador produziu e se trabalhou nos dias esperados.
- Cada colaborador tem uma META por dia ou por semana (por exemplo, número de tarefas ou de entregas), definida no admin.
- "Dia trabalhado" = dia em que houve atividade verificada (tarefa enviada com prova ou outro registro previsto na regra dele). O sistema marca o dia como presente, ausente ou parcial. A definição de "dia trabalhado" é configurável por pessoa.
- A IA acompanha sozinha e produz, para cada colaborador, um painel (visível só para o admin e para o próprio colaborador) com: dias trabalhados e faltas no período, tarefas feitas versus meta, taxa de aprovação das provas, nível de produtividade (nota ou faixa), tendência (subindo ou caindo) e alertas (por exemplo, três dias sem atividade, queda de produtividade, provas repetidas).
- Relatório semanal e mensal automático por colaborador, enviado ao admin (e-mail ou painel).
- A IA só ALERTA e RESUME. Ela não penaliza, não desconta e não decide sozinha sobre pagamento ou vínculo. Quem decide é o admin.
- O colaborador vê o próprio painel e sabe exatamente o que é medido. Nada de monitoramento escondido: sem captura de tela, sem rastreio de teclado ou mouse, sem foto e sem localização. Só entram no cálculo o que o colaborador registra na plataforma: tarefas, provas e acessos.
- Registrar o aceite do colaborador a este acompanhamento (termo da seção 6, ampliado).

### 11. Colaboradores com perfis diferentes
- Cada pessoa tem função e regra próprias (irmã: salário + variável; cunhado: diária de transporte verificada; Jonathan e outros: o que for definido).
- Tarefas podem ser atribuídas a uma pessoa, a um grupo (por função) ou a "qualquer colaborador".
- O painel do admin mostra todos lado a lado, com ordenação e filtro por produtividade, presença e saldo do mês.

### 12. Critérios de aceite adicionais
- [ ] Contrato gerado a partir do modelo aprovado, preenchido e assinado eletronicamente, com PDF e versão guardados.
- [ ] Sem contrato assinado, o colaborador não acessa as tarefas.
- [ ] Meta por pessoa, e dias trabalhados e faltas calculados automaticamente.
- [ ] Painel de produtividade por colaborador, com alertas e relatório semanal e mensal.
- [ ] A IA nunca altera pagamento, desconta valores ou muda o status do vínculo.
- [ ] Nenhuma coleta de foto de pessoa, localização, captura de tela ou rastreio de teclado.
- [ ] Exportação do fechamento do mês para o contador.

---

## 13. Sugestões aprovadas (19/11/2026)

Todas aprovadas pelo dono em 19/11/2026. As que tocam lei trabalhista (13.1, 13.5, 13.7, 13.8 e 13.13) passam pelo advogado ou pelo contador antes de serem implementadas.

### 13.1 Quem não é CLT: medir entrega, não presença
- Para colaborador sem vínculo empregatício (autônomo, MEI, diarista), presença, faltas e meta diária vêm DESLIGADAS por padrão. O painel dele mede entregas e provas.
- Motivo: cobrar presença diária, jornada e meta de quem não é empregado é justamente o que a Justiça do Trabalho usa para reconhecer vínculo (subordinação e habitualidade). Ligar esse acompanhamento para alguém fora da CLT só depois de falar com o advogado.
- O caso do cunhado (diária de transporte verificada, todo dia) é o primeiro a levar para essa conversa.

### 13.2 Calendário e ausências justificadas
- Cada colaborador tem os dias de trabalho previstos (ex.: segunda a sexta). O sistema conhece os feriados nacionais e os que o admin cadastrar (estaduais e municipais).
- Férias, folga combinada, atestado e licença entram como "ausência justificada", marcada pelo admin ou pedida pelo colaborador e aprovada pelo admin. Esses dias não contam como falta nem derrubam a produtividade.
- O atestado em si não sobe para a plataforma (é dado de saúde). Fica só o registro "ausência justificada — atestado"; o documento vai para o contador.
- O dia fecha às 23h59 (horário de Brasília) e a marcação presente / ausente / parcial sai na manhã seguinte, para não contar como falta quem envia tarefa à noite.
- Motivo: sem calendário, o painel acusa falta em feriado e em férias e o alerta perde credibilidade.

### 13.3 Nota de produtividade calculada por regra; a IA só escreve o resumo
- A nota vem de uma fórmula fixa e visível, com pesos definidos no admin. Exemplo: tarefas feitas ÷ meta, taxa de aprovação das provas, dias trabalhados ÷ dias previstos.
- A IA escreve o resumo, explica a tendência e aponta os alertas, mas não inventa a nota.
- O colaborador vê a fórmula e a conta do mês dele.
- Motivo: a mesma situação dá sempre a mesma nota, a nota se explica em uma frase e a IA não tira conclusões sobre a pessoa por conta própria.

### 13.4 Quem já trabalha hoje (irmã, cunhado)
- O contrato usa a data real de início do trabalho, não a data da assinatura. O vínculo existe desde o primeiro dia trabalhado, com ou sem contrato assinado.
- Para essas pessoas, a tela do contrato aparece no primeiro acesso. O painel de produtividade começa do zero, sem inventar histórico anterior.

### 13.5 Fechamento para o contador com a natureza de cada valor
- Cada linha da exportação diz o que o valor é: fixo, comissão, prêmio, diária ou reembolso.
- Comissão integra o salário (art. 457, §1º, da CLT). Prêmio, ajuda de custo e diária para viagem, em regra, não integram (§2º), mas depende de como são pagos. A diária de transporte, se funcionar como vale-transporte, tem regra própria (Lei 7.418/1985).
- Quem classifica cada tipo de valor é o contador; a plataforma só guarda a classificação definida por ele.
- Formato: CSV e PDF por mês, por colaborador e consolidado.

### 13.6 Contestação pelo colaborador
- O colaborador pode comentar um dia marcado como ausente ou uma prova recusada. O comentário vai para o admin, que decide. Tudo fica no histórico.

### 13.7 Aditivo que reduz valor
- Antes de enviar um aditivo que reduz o fixo ou o variável, o admin vê um aviso: alteração que prejudica o empregado não vale nem com aceite dele (art. 468 da CLT). Recomendação: falar com o contador antes de enviar.

### 13.8 Assinatura na fase 1: aceite dentro da plataforma
- Sugestão para levar ao advogado: na fase 1, o colaborador confirma com um código enviado por e-mail. O sistema guarda o PDF, o hash SHA-256 do arquivo (prova de que não foi alterado depois), data e hora, IP, usuário logado e versão do modelo.
- Contrato de trabalho não exige certificado ICP-Brasil; outros meios valem quando as partes aceitam (MP 2.200-2/2001, art. 10, §2º; Lei 14.063/2020). ZapSign ou Clicksign entram depois, se o advogado preferir.

### 13.9 Encerramento do vínculo
- Botão "Encerrar vínculo" no admin: data de saída, bloqueio do acesso às tarefas e fechamento final para o contador.
- O ex-colaborador continua com acesso de leitura ao próprio contrato e aos próprios relatórios.
- Contratos e registros ficam guardados pelo prazo legal indicado pelo contador (normalmente 5 anos ou mais). Nada é apagado na saída.

### 13.10 "Registro de atividade" não é ponto
- Se alguém trabalha presencialmente em coisas que não viram tarefa na plataforma, a regra dele pode incluir botões "Comecei o dia" e "Encerrei o dia", apertados pelo próprio colaborador, sem localização e sem foto.
- A tela chama isso de "registro de atividade", nunca de "ponto". O controle de ponto legal (obrigatório para empresa com mais de 20 empregados, art. 74 da CLT) segue com sistema próprio quando chegar a hora.

*Sugestões 13.11 a 13.13 acrescentadas na segunda revisão de 19/11/2026.*

### 13.11 A meta começa medindo, sem chute
- Hoje ninguém sabe o nível de produtividade de cada colaborador, então não há base para fixar meta no primeiro dia. Proposta: as primeiras 4 semanas de cada pessoa são de calibração. O painel mostra tudo o que mede, mas sem "abaixo da meta".
- No fim da calibração, o sistema mostra a média real dessas semanas e sugere uma meta a partir dela. O admin aprova, muda ou recusa. Nenhuma meta passa a valer sem essa aprovação.
- O alerta de dias sem atividade (seção 10) já vale durante a calibração.
- Motivo: meta inventada gera alerta falso logo no começo, e a pessoa deixa de confiar no painel.

### 13.12 O primeiro aviso vai para o próprio colaborador
- Quando falta atividade num dia previsto, o primeiro aviso vai para o colaborador, na manhã seguinte, no ambiente dele e por e-mail, em tom de lembrete: "ontem não houve envio; se foi folga ou atestado, registre aqui".
- O admin só recebe alerta quando a falta continua até o limite da regra da pessoa (ex.: 3 dias seguidos) ou quando a produtividade cai por duas semanas seguidas.
- O relatório semanal ao admin abre com uma linha por pessoa ("em dia" ou o que mudou). O detalhe fica no painel.
- Nenhum aviso sai para o colaborador fora da jornada combinada nem em dia de folga.
- Motivo: o dono não quer ser o chefe que cobra. A própria pessoa resolve a maior parte dos casos (inclusive registrando a ausência justificada da seção 13.2) e o admin só vê o que precisa de decisão dele.

### 13.13 Regime de trabalho e horário no contrato
- O cadastro de quem é CLT ganha o campo "regime": presencial, teletrabalho por jornada ou teletrabalho por produção ou tarefa. O campo vai para o contrato, porque o teletrabalho precisa constar expressamente nele (art. 75-C da CLT).
- O regime muda o que o painel mede. No teletrabalho por produção ou tarefa não há controle de jornada (art. 62, III, e art. 75-B, §3º, da CLT), e o painel mede entregas, como na seção 13.1. Nos outros regimes entram presença e dias previstos.
- Se houver envios frequentes fora da jornada combinada (noite, fim de semana, feriado), o admin recebe um aviso informativo: pode ser hora extra, e o contador precisa saber. O sistema não desconta nem bloqueia nada.
- Motivo: os registros com data e hora da plataforma podem servir de prova de jornada numa ação trabalhista, para qualquer um dos lados. É melhor o regime estar claro desde o contrato e o excesso aparecer para o admin na hora, e não anos depois.
- O regime de cada pessoa se decide com o advogado.

---

## Anexo: o que já existe no código para reaproveitar
Não é regra de negócio; serve de ponto de partida para quem for implementar.
- **Cadastros trazidos:** `referrals` e `users.codigoIndicacao` (indicação, qualificação, ativação e pagamento).
- **Empresas pagantes:** `affiliate_attributions` (atribuição, com o método `primeiro_vinculo`) e `affiliate_commissions` (comissão por pagamento confirmado no gateway, com chave de idempotência).
- **Provas:** o padrão de `submissions` e `submission_evidence` (hash da prova, `proofHash`, trilha de revisão). Tarefa interna não pertence a empresa cliente, então deve ganhar tabela própria seguindo esse padrão, em vez de reaproveitar `submissions`, que exige `companyId`.
- **Extrato e saque:** `financial_ledger` e `withdrawals` (saque Pix que já existe).
- **Acessos:** `users.ultimoAcessoEm`.
- **Relatórios por e-mail:** a infraestrutura de envio de e-mails que já existe (`email_sequences` e `email_templates`).
- **Banco:** só colunas e tabelas novas, via `adicionarColuna` e `CREATE TABLE IF NOT EXISTS`; nada destrutivo.
