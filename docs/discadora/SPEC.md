# Discadora: especificação

> Escrita em 25/11/2026. Nada foi construído ainda. Preços e regras são dessa data; as fontes estão na seção 18.

**Decisões do dono (25/11/2026)**

| Tema | Decisão |
|---|---|
| Modo de discagem | Várias linhas ao mesmo tempo |
| Pagamento | Cota de minutos inclusa no plano da empresa; o que passar é cobrado à parte |
| Motor | Próprio, sem licença da 3C Plus |
| O que a empresa vê | Números e resultados, gravações e transcrições, escuta ao vivo, tempo logado e pausas |
| Fase 1 | Ligar, listas, gravação, resultado, painel, IA, apoio na chamada, recebidas, metas e ranking |

**Assumido por recomendação, ainda sem confirmação:** gravar todas as chamadas; guardar por 180 dias; ocultar telefone como opção por campanha; só Brasil e números brasileiros.

## 1. Objetivo e escopo
O profissional liga pelo navegador, dentro da RYCS, para os leads de uma campanha. A lista disca sozinha, a chamada é gravada, o resultado move o funil e a empresa acompanha.

**Fora da fase 1:** robô que fala sozinho (robocall), discador preditivo com estimativa de atendimento, ligação pelo WhatsApp, chamada internacional, aplicativo de celular próprio. No celular, só clique para ligar com a tela aberta.

## 2. Quem faz o quê

| Ação | Empresa | Profissional | Admin RYCS |
|---|---|---|---|
| Criar lista, campanha de discagem e metas | Sim | Não | Sim |
| Ligar | Não | Sim, se aprovado na empresa | Não |
| Ouvir gravação | Das próprias campanhas | Das próprias chamadas | Sim, com motivo registrado |
| Ouvir ao vivo e orientar | Das próprias campanhas | Não | Não |
| Ver tempo logado e pausas | Do próprio time, na própria campanha | Os próprios | Sim |
| Apagar gravação | Pedido com motivo | Não | Sim |

Vínculo: `vendedorAprovado(companyId, sellerId)` e `exigirOportunidadesLiberadas`, já existentes. Um profissional que atende duas empresas escolhe a campanha ao entrar. Nada de uma empresa aparece na outra.

## 3. Fluxo do profissional
1. Abre **Discadora**, escolhe a campanha, testa microfone e fone.
2. Na primeira vez em cada campanha, aceita o termo que lista tudo o que é gravado e visto pela empresa.
3. Aperta **Iniciar**. O sistema disca as linhas e conecta a primeira pessoa que atender.
4. Na tela: nome, histórico, script aprovado, campo de anotação e cronômetro.
5. Desligou: escolhe o resultado em um clique. Sem resultado, a próxima não sai.
6. **Pausar** a qualquer momento. Motivo opcional.

## 4. Motor de discagem
**Modos da lista:** *carteira* (cada um disca os próprios leads) ou *fila do time* (quem estiver livre pega o próximo; o lead passa a ser de quem falou).

**Linhas.** Padrão 2 por profissional, máximo 3, escolhido pela empresa.
- A primeira pessoa confirmada é conectada e as linhas que ainda tocam são canceladas.
- Se uma segunda pessoa atender antes do cancelamento, vai para outro profissional livre da mesma campanha. Sem ninguém livre, ouve uma mensagem com o nome da empresa e o lead vai para o topo da fila de um profissional, para ligação manual. Nunca fica mudo.
- Caixa postal é detectada e registrada; recado gravado é opcional.
- Só disca para profissional online, fora de pausa e sem resultado pendente de registro.

**Simulação do abandono** (1 profissional, detecção de 3 s, atendimento espalhado entre 4 e 25 s; é estimativa, não medição):

| Atendimento da lista | 1 linha | 2 linhas | 3 linhas |
|---|---|---|---|
| 20% | conecta 20% dos lotes, abandono 0% | 36%, abandono 2,8% | 49%, abandono 5,7% |
| 30% | 30%, 0% | 51%, 4,5% | 66%, 8,6% |
| 40% | 40%, 0% | 64%, 6,3% | 78%, 11,7% |

**Novas tentativas (editável por lista):** não atendeu, até 4 vezes em dias e horários diferentes; ocupado, 30 min; caixa postal, no dia seguinte; número errado, nunca mais.

**Reserva do contato.** Cada contato é reservado numa transação, com validade de 2 min. Queda do navegador ou do servidor devolve o contato à fila sem ligar duas vezes.

## 5. Limites e freios
Regra da MP 1.396/2026 (art. 6º): bloqueio de 15 dias para quem, no mesmo dia, passar de 1.000 chamadas por número **ou** de 10.000 somando todos os números do titular, **e** tiver 85% ou mais de chamadas curtas. Curta é a não completada, a que cai na caixa postal ou a de até 6 segundos.

| Freio | Valor inicial | O que acontece |
|---|---|---|
| Chamadas por número no dia | 800 | Para o número até o dia seguinte |
| Chamadas por CNPJ no dia | 8.000 | Para a empresa até o dia seguinte |
| Chamadas para a mesma pessoa | 2 por dia, 6 no total | Contato sai da fila |
| Abandono nas últimas 200 atendidas | 5% | Cai para 1 linha |
| Chamadas curtas (com 200+ no dia) | 80% | Cai para 1 linha |
| Chamadas curtas (com 200+ no dia) | 85% | Pausa a lista e avisa a empresa |
| Horário | seg a sex 9h–20h, sáb 10h–16h, fuso do DDD, sem feriado nacional | Não disca |

- Os valores ficam no admin, não no código. A Anatel pode endurecer os parâmetros e regulamenta até cerca de 12/12/2026.
- O freio de volume é o que protege. Lista que atende 20% ou menos já passa de 80% de curtas mesmo com uma linha.
- Trocar de número para continuar depois de um freio é proibido no sistema.
- O número sai no **CNPJ da empresa**. Se tudo estiver no da RYCS, o teto de 10.000 soma todas as empresas e o bloqueio de uma atinge as outras. Com 200 tentativas por profissional, 8.000 por dia comporta 40 profissionais.

**"Não ligar":** por empresa, por pedido na chamada (um clique), por planilha e por cadastro estadual do Procon quando a empresa informar. Vale para todas as listas da empresa, na importação e de novo na hora de discar.

## 6. Gravação e LGPD
- Dois canais (profissional e cliente separados), todas as chamadas conectadas.
- Aviso no começo: "Esta ligação é gravada." Se a pessoa não aceitar, um botão para a gravação e apaga o trecho; a chamada pode seguir.
- O arquivo vai para o armazenamento privado já usado ([arquivos.js](../../server/services/arquivos.js)), é apagado do fornecedor e só abre por rota autenticada. Cada escuta fica registrada: quem, quando, qual.
- Guarda de 180 dias; gravação usada como prova de pagamento fica até o fim do prazo de contestação. Depois, apaga o áudio e mantém os números.
- Dono do dado: a empresa. A RYCS opera em nome dela. Pedido de exclusão do titular atende áudio, transcrição e lead.
- Uso em treino só com a empresa autorizando e com nomes removidos.

## 7. IA nas ligações
Reaproveita [auditoriaConversas.js](../../server/services/auditoriaConversas.js): mesmos materiais da empresa, mesmo script aprovado e a mesma regra de que apontamento sem trecho que o sustente é descartado.
- Transcrição depois da chamada com o whisper.cpp que já vem na imagem ([Dockerfile](../../Dockerfile), modelo `small`), sem custo por minuto. É lento: roda em fila, fora do horário de ligação e fora do servidor de produção quando houver volume; com muitos profissionais, só conversas acima de 2 min.
- Resumo, objeções, próximo passo sugerido e nota por critério do script.
- Alertas: promessa fora do script, preço diferente do cadastrado, assunto proibido.
- Busca por palavra nas transcrições da empresa.
- A IA não muda lead, não pontua profissional, não aprova nem recusa pagamento.
- Sem as chaves configuradas, a discadora funciona sem IA e a tela diz "em ativação".

## 8. Apoio na chamada
- Script aprovado pelo dono, em blocos, com respostas a objeções.
- Histórico do lead: ligações, WhatsApp, e-mails e notas.
- Agendar reunião na hora. Depende de agenda por empresa, que não existe: a atual ([agendaComercial.js](../../server/services/agendaComercial.js)) é dos closers da RYCS. Na fase 1, grava data e hora como próximo passo do lead.
- WhatsApp depois de não atendida: abre a conversa no canal conectado da empresa. Envio automático só com modelo aprovado e conforme as regras de conta já em uso.

## 9. Chamadas recebidas
- Quem retorna é reconhecido pelo telefone e cai no último profissional que ligou, se estiver online; senão, em qualquer um da campanha; senão, mensagem e tarefa de retorno.
- Horário de atendimento por empresa. Fora dele, mensagem e registro.
- Recebida também é gravada, com o mesmo aviso, e gasta a cota.

## 10. Painel da empresa
**Números:** tentativas, atendidas, conversas acima de 2 min, tempo falado, reuniões, vendas, minutos usados e custo por reunião, por lista, profissional, horário e número.

**Ao vivo:** quem está ligando, em resultado, em pausa ou offline; linha do tempo do dia; abandono e chamadas curtas do momento. Botões **Ouvir** e **Orientar** (só o profissional escuta). Aviso fixo na tela do profissional enquanto alguém ouve, e registro de cada escuta.

**Tempo logado e pausas:** entrada, saída, falando, em resultado, em pausa e ocioso. O profissional vê os mesmos números.
- Não entra em score, ranking, pagamento, recusa de tarefa nem desligamento automático.
- Não existe horário obrigatório, meta de tempo logado ou cobrança por pausa.
- Sem captura de tela, teclado, câmera ou localização, como em [colaboradores](../colaboradores/SPEC.md).

> **Antes de ligar em produção:** o profissional é autônomo. Controle de tempo e escuta ao vivo podem pesar como subordinação (CLT, art. 6º, parágrafo único). A função é construída com chave desligada no admin e só liga com parecer do advogado.

## 11. Metas e ranking
- Metas por campanha, sobre resultado: conversas, reuniões e vendas.
- Ranking do time na campanha, pelos mesmos itens. Tempo logado nunca conta.
- Melhor horário e qualidade da lista só aparecem com amostra mínima (200 tentativas); antes, a tela mostra "dados insuficientes".

## 12. Prova automática de Cold call
Hoje a ação `ligacao` exige prova manual ([acoes.js](../../shared/acoes.js:43)). Com a discadora, o envio nasce preenchido com cliente, telefone, duração, resultado e gravação, marcado como "comprovado pela discadora".
- Duração acima de 2 min é medida. "Falou com o decisor" é declarado pelo profissional, com trecho da transcrição como apoio.
- A aprovação e o pagamento seguem as regras atuais. Nada é pago sozinho.
- Uma chamada comprova um envio só.

## 13. Cota e cobrança
**Decisão do dono (25/11/2026):** motor próprio, sem licença da 3C Plus, com custo operacional igual ou menor que o dela.

### Custo zero para a RYCS (proposta de 25/11/2026, a confirmar)
O dono pediu a estrutura que gasta o mínimo ou nada. Com 10 profissionais o dia todo, celular a R$ 0,06, 3 números e IA:

| Corte | Troca | Economia | Total da RYCS por mês |
|---|---|---|---|
| Ponto de partida | RYCS paga tudo | | R$ 3.810 |
| 1. Transcrição | whisper.cpp que já existe | R$ 850 | R$ 2.960 |
| 2. Servidor | AWS por 2 VPS de R$ 42,99 (24 meses adiantados; renova a R$ 77,99) | R$ 1.017 | R$ 1.943 |
| 3. Minutos e números | Cada empresa conecta a própria operadora e paga direto a ela | R$ 1.857 | R$ 86 |
| 4. Servidor grátis | Oracle Always Free ou créditos AWS Activate | R$ 86 | R$ 0 |

- **O corte 3 substitui a cota inclusa no plano** e resolve junto número no CNPJ da empresa, limite da MP 1.396 por titular e revenda de minutos. Falta o dono confirmar.
- Oracle Always Free: 2 OCPU e 12 GB, 10 TB de saída; pode recolher instância ociosa; região São Paulo, uso comercial e SLA não confirmados. AWS Activate Founders: a partir de US$ 1.000, para conta paga que ainda não recebeu; validade não confirmada. Servidor grátis serve para validar, não para prometer disponibilidade.
- A produção atual fica em Ohio: serve para teste de voz, com atraso perceptível; não para operação.
- **Sem operadora nenhuma:** modo celular (seção 14) e ligação por link, em que o lead abre um endereço e fala pelo navegador. A ligação por link aceita gravação, escuta e transcrição, mas depende de o lead clicar.

### Custo se a RYCS pagar os minutos
**Custo por profissional e por mês** (2 linhas, 200 tentativas por dia, 22 dias, 2.970 minutos faturados, sem IA e sem imposto, dólar a R$ 5,89):

| Minuto de celular | 5 profissionais | 10 profissionais | 20 profissionais |
|---|---|---|---|
| R$ 0,03 | R$ 214 | R$ 199 | R$ 199 |
| R$ 0,06 | R$ 303 | R$ 288 | R$ 288 |
| R$ 0,10 | R$ 422 | R$ 407 | R$ 407 |

- Servidor de voz na AWS São Paulo, preço oficial sob demanda mais US$ 25 de disco, IP e cópia de segurança (estimativa): 1 c7g.large até 5 profissionais (R$ 625), 1 c7g.xlarge até 10 (R$ 1.103), 2 c7g.xlarge até 20 (R$ 2.205). A capacidade precisa de teste de carga.
- Transcrição em um canal soma cerca de R$ 85.
- Referência: 3C Plus, R$ 444 de licença em revenda mais R$ 0,03/min, cerca de R$ 533.
- O servidor é custo fixo: com 1 profissional, ele sozinho custa R$ 625.

**Proposta de cota, a confirmar:** reservar até 15% da mensalidade mais barata do plano (a do ciclo anual, 30% menor), a R$ 0,17 por minuto (celular a R$ 0,10, 5 a 10 profissionais, com transcrição):

| Plano | Mensalidade anual | Minutos inclusos |
|---|---|---|
| Grátis | R$ 0 | 0 |
| Start | R$ 279 | 240 |
| Growth | R$ 559 | 490 |
| Scale | R$ 1.049 | 920 |
| Premium (R$ 3.000) | R$ 2.100 | 1.850 |

- O excedente sai de **pacotes de minutos pré-pagos por Pix**, com preço definido pelo dono. Sem cota e sem pacote, não disca. Chamada em andamento nunca é cortada.
- O saldo de minutos é separado do caixa de campanha, que paga profissionais.
- Desconta o tempo faturado pela operadora, inclusive caixa postal, para a cota acompanhar o custo real. Aviso em 80% e 100%, como em `consumirCota`.
- A cota vive em `shared/planos.js` (`limites.minutosDiscadora`). Premium concedido pelo admin e proposta Enterprise: definidos pelo admin.
- Refazer com a cotação assinada.

## 14. Telefonia
**Desenho:** servidor de voz próprio (Asterisk) numa EC2 separada, em São Paulo, ligado a operadora brasileira por SIP no atacado. A RYCS comanda por API; o profissional fala pelo navegador (WebRTC). Camada de adaptação para trocar de operadora ou de motor sem refazer telas.

| Recurso | Asterisk, sem licença |
|---|---|
| Discar por API, várias linhas | Confirmado (ARI, `originate`) |
| Caixa postal | Confirmado (`AMD`); acerto em português precisa de teste |
| Gravação com canais separados | Confirmado (`MixMonitor`, áudio recebido e enviado em arquivos próprios) |
| Ouvir, orientar e entrar | Confirmado (`ChanSpy`, `snoopChannel`) |
| Navegador | Documentação de WebRTC existe; validar no piloto |
| Licença | GPLv2 |

**O que a 3C aparenta usar:** os servidores de voz que ela publica estão no Google Cloud, e a escuta dela se chama "Spy Snoop", mesmo nome do recurso do Asterisk. É indício, não confirmação. A operadora e o preço de atacado dela não são públicos.

**AWS:** serve para o servidor (EC2) e para as gravações (S3). O Amazon Connect não serve: US$ 0,038/min de serviço mais US$ 0,0389/min para o Brasil, cerca de R$ 0,45/min, sem região em São Paulo e com campanha saindo dos EUA.

**Piso do minuto:** a tarifa regulada que a operadora paga à rede móvel (VU-M) vai de R$ 0,0147 a R$ 0,0180, sem impostos, entre 2024 e 2027. Celular a R$ 0,03 é possível com volume; abaixo disso, desconfiar da rota.

| Operadora (preço publicado) | Celular | Fixo | Observação |
|---|---|---|---|
| Atacado VoIP | R$ 0,06; com número exibido, R$ 0,10; "a partir de" R$ 0,04 | R$ 0,03 | Cita call center e Asterisk; tabela sem data; nada sobre autenticação ou número próprio |
| Directcall | R$ 0,18 a 0,25 no plano comum; atacado sob consulta | R$ 0,05 a 0,06 | Opção STIR/SHAKEN; número a R$ 25/mês; valores lidos por resumo |

**Conferido em 25/11/2026:** o formulário de contato do Atacado VoIP está desativado, então o preço dele não pode ser tratado como disponível. A Directcall proíbe automação nos planos ilimitados e pode ter fidelidade de 36 meses. A KVOIP cobra R$ 168 por chamada simultânea, mínimo 2, com discador próprio dela; tronco para discador externo não confirmado.

**Telefonia pronta (Api4Com):** R$ 209,90 por usuário no mensal, sem fidelidade, ou R$ 169,90 no anual; teste grátis com R$ 5 de crédito; API, webhooks, gravação e monitoramento inclusos; IA à parte (R$ 129,90 ou R$ 99,90). Não vende discador automático; os termos citam limite de minutos por plano sem informar o número; revenda a clientes e chamadas simultâneas não confirmadas. Para 1 a 3 pessoas ligando muito, sai mais barata que o tronco; para muitas pessoas ligando pouco, o tronco ganha.

A rota mais barata costuma vir sem o número da empresa. Com a MP 1.396/2026, a operadora de destino pode bloquear chamada não autenticada. Contar com R$ 0,06 a R$ 0,10 até a cotação.

**n8n:** não faz telefonia; só dispara comandos. A fila e as regras ficam no servidor da RYCS.

### Modo celular (opcional, sem discagem automática)
O profissional clica no lead e a chamada sai pelo celular dele: Vincular ao Celular no Windows, ou iPhone com Mac. Um clique por ligação, uma ligação por vez. Não há gravação, escuta, caixa postal nem prova automática; o resultado é declarado. Não gasta cota.

**Atender e ligar dentro do painel (Mac).** O navegador sozinho não acessa a linha do celular. Um programa auxiliar no Mac conecta o iPhone ou Android por Bluetooth como viva-voz (`IOBluetoothHandsFreeDevice`) e conversa com o painel: disca, atende, desliga e informa tocando, em conversa e encerrada. Os comandos existem no macOS do dono e não estão obsoletos; existe projeto aberto que faz isso (PhoneBT, Apache 2.0). O áudio no Mac depende da combinação de aparelho e sistema e precisa de teste. No Windows, o recurso equivalente tem relatos de falha no Windows 11; lá, usar o Vincular ao Celular. Uma chamada por vez e um clique por chamada.

**Não usar linha ilimitada comum para discagem automática.** Os regulamentos lidos proíbem:
- TIM Controle Fit Anual 2.0: veda uso comercial e lista excesso de destinos por dia e uso parado em mais de 60% do tráfego como uso indevido.
- Claro Pós (206) e Claro Controle (210): uso pessoal, sem disparo automático; contato massivo com clientes e call center são mau uso. Penas: bloqueio da linha ou de todas do contrato, rescisão e cobrança.
- Vivo e planos empresariais: não lidos. Vale o contrato da linha de cada um.

**Proibido no produto:** chipeira e rodízio de chips. O Claro Controle 210 cita chipeira como mau uso.

**Piloto, antes do código:** (1) operadora aceita discagem em volume por Asterisk; (2) número no CNPJ da empresa e chamada autenticada; (3) preço de celular, tarifação mínima e canais; (4) áudio no navegador; (5) acerto da caixa postal; (6) carga com 10 chamadas simultâneas.

**Plano B:** Twilio com operadora brasileira (cerca de R$ 757 por profissional a R$ 0,06) ou 3C Plus como motor. Sem servidor para cuidar, com custo maior.

## 15. Dados e servidor
Tabelas novas, só aditivas. Prefixo `voz_`, porque `disc_` já é do teste DISC.

| Tabela | Guarda |
|---|---|
| `voz_numeros` | Número, empresa, operadora, estado, uso do dia |
| `voz_listas` | Campanha, modo, linhas, horário, regras de nova tentativa |
| `voz_lista_itens` | Lead, tentativas, próxima tentativa, reserva e validade |
| `voz_chamadas` | Lead, lista, profissional, número, direção, estado, horários, duração, resultado, custo |
| `voz_gravacoes` | Chave do arquivo, duração, prazo, situação |
| `voz_transcricoes` | Texto por canal com tempo, modelo, situação |
| `voz_analises` | Resumo, critérios, alertas, trechos |
| `voz_sessoes` | Entrada, saída e estados do profissional |
| `voz_escutas` | Quem ouviu, o quê, quando, ao vivo ou gravado |
| `voz_nao_ligar` | Telefone, empresa, origem, data |
| `voz_consumo` | Minutos por empresa e mês, cota e pacotes |
| `voz_aceites` | Termo aceito por profissional, campanha e versão |
| `voz_eventos` | Avisos do fornecedor já processados |

- `lead_events` ganha `chamadaId`; a linha do tempo do lead continua a mesma. Resultados novos são somados a `RESULTADOS_LIGACAO`, sem mudar os atuais.
- **Tempo real:** não existe no projeto. Usar SSE, deixando `text/event-stream` fora do `compression()` ([index.js](../../server/index.js:117)), com consulta periódica de reserva.
- **Avisos do fornecedor:** assinatura conferida, `rawBody` preservado, cada evento processado uma vez.
- **Deploy no meio da ligação:** todo push na `main` reinicia o servidor. O áudio não passa por ele, então a conversa continua; ao subir, o servidor confere no fornecedor as chamadas abertas, fecha as órfãs e devolve as reservas. Nada novo é discado até essa conferência terminar.
- **Importação:** hoje aceita 1.000 contatos por envio e não valida telefone ([leads.js](../../server/routes/leads.js:48)). A lista valida e normaliza para o padrão +55, aponta inválidos e repetidos e aplica o "não ligar".
- **Ligado por variável**, como em [ATIVACAO.md](../leads/ATIVACAO.md): sem as chaves, a tela mostra "em ativação". Segredos só no GitHub Secrets.

## 16. Entregas
Cada entrega vai ao ar sozinha, com teste.

| # | Entrega | Pronto quando |
|---|---|---|
| A | Modo celular: lista, um clique, script, resultado e painel, sem operadora e sem servidor | Um profissional trabalha uma lista de 100 contatos e a empresa vê os números |
| 0 | Piloto: servidor de voz numa EC2 de teste, fora da plataforma | Os 6 itens da seção 14 respondidos |
| 1 | Base: números, clique para ligar, gravação, resultado, termo, "não ligar", cota | Ligação real gravada aparece no lead e desconta a cota |
| 2 | Listas, uma linha, freios, novas tentativas, prova de Cold call | Lista de 100 contatos discada sem repetir contato, inclusive com queda do navegador |
| 3 | Várias linhas, fila do time, painel de números | Abandono e curtas medidos e freios acionados em teste |
| 4 | Transcrição, IA, script, agendamento | Resumo com trechos conferíveis numa ligação real |
| 5 | Recebidas, metas, ranking | Retorno cai em quem ligou |
| 6 | Ao vivo, tempo logado e pausas | Pronto com chave desligada; liga após o parecer |

Identidade visual de `src/styles.js`, componentes existentes, português do Brasil, alvos de 44px e foco visível.

## 17. Pendências do dono

| # | Pendência | Bloqueia |
|---|---|---|
| 1 | Minutos inclusos por plano e preço do pacote | Entrega 1 |
| 2 | Cotação de atacado em 2 ou 3 operadoras | Entrega 0 |
| 2b | Criar a EC2 de voz e definir quem cuida dela (segurança, fraude, plantão) | Entrega 0 |
| 3 | Advogado: aviso de gravação, termo do profissional, contrato de dados com a empresa, vínculo | Entregas 1 e 6 |
| 4 | Contador: nota e imposto sobre minutos revendidos. Confirmar também se revender minuto exige autorização ou parceria com a operadora | Entrega 1 |
| 5 | Plano do profissional: `minutosDiscadora` está em aberto e a gravação é só do Premium ([planosProfissional.js](../../shared/planosProfissional.js:135)). Proposta: gravação vale para todos; Premium mantém o feedback por IA | Entrega 1 |
| 6 | Ocultar telefone do lead: sim ou não como padrão. Se oculto, o WhatsApp manual do profissional deixa de funcionar | Entrega 2 |
| 7 | Prazo de guarda (proposta: 180 dias) | Entrega 1 |

## 18. Fontes
**Oficiais:** [MP 1.396/2026](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/mpv/mpv1396.htm) · [Anatel, chamadas abusivas](https://www.gov.br/anatel/pt-br/consumidor/chamadas-abusivas)

**Fornecedores:** [AWS Connect](https://aws.amazon.com/connect/pricing/) · [AWS, regiões do Connect](https://docs.aws.amazon.com/connect/latest/adminguide/regions.html) · [Asterisk, ARI](https://docs.asterisk.org/Latest_API/API_Documentation/Asterisk_REST_Interface/Channels_REST_API/) · [Asterisk, ChanSpy](https://docs.asterisk.org/Latest_API/API_Documentation/Dialplan_Applications/ChanSpy/) · [Asterisk, AMD](https://docs.asterisk.org/Latest_API/API_Documentation/Dialplan_Applications/AMD/) · [AWS Activate](https://aws.amazon.com/startups/credits) · [Oracle Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm) · [Hostinger VPS](https://www.hostinger.com/br/servidor-vps) · [VU-M](https://www.telesintese.com.br/anatel-fixa-tarifas-de-vu-m-e-eild-para-2024-a-2027/) · [TIM Fit](https://timbrasil.widen.net/content/qdcxs44st4/pdf/fit-anual-2.0.pdf) · [Claro Pós 206](https://www.claro.com.br/files/104379/x/c22418d25a/planon206-clarops-202502102-2.pdf) · [Claro Controle 210](https://www.claro.com.br/files/104379/x/c3ff939020/planon210-clarocontroleon-sumrio-20250113-3.pdf) · [Agendor, celular pelo Windows](https://intercom.help/agendor/pt-BR/articles/10362328-como-realizar-chamadas-no-agendor-usando-meu-celular-via-windows) · [Twilio, preço Brasil](https://www.twilio.com/pt-br/voice/pricing/br) · [Twilio, regras Brasil](https://www.twilio.com/en-us/guidelines/br/voice) · [Twilio, conferência](https://twilio.com/docs/voice/conference) · [Twilio, BYOC](https://www.twilio.com/en-us/changelog/bring-your-own-carrier-trunking-origination-price-reduced) · [Api4Com](https://www.api4com.com/) · [Api4Com, API](https://developers.api4com.com/) · [Directcall](http://directcall.com.br/produto/sip-trunk/) · [Atacado VoIP](https://www.atacadovoip.com.br/) · [3C Plus, integração](https://alo.3cplusnow.com/help/integra%C3%A7%C3%A3o-com-o-3c-plus-completo-3c-plus-help-center) · [3C Plus, eventos](https://alo.3cplusnow.com/help/eventos-do-socket-3c-plus-3c-plus-help-center) · [3C Plus, campanha](https://alo.3cplusnow.com/help/configura%C3%A7%C3%B5es-da-campanha-3c-plus-help-center) · [3C Plus, rotas](https://alo.3cplusnow.com/help/diferen%C3%A7a-entre-as-rotas-da-3c-3c-plus-help-center) · [BRVOZ](https://www.brvoz.com.br/trunk), cujo R$ 0,23 veio do buscador e não pôde ser conferido na página

**Não confirmado em fonte oficial:** fim da obrigação do 0303 (imprensa e fornecedores dizem facultativo desde 08/2025; a página da Twilio ainda o exige para telemarketing), data da autenticação obrigatória, Despacho 82/2026, horário legal para ligar e obrigação de atender cadastros estaduais. Custo de voz para texto estimado em até US$ 0,012/min em dois canais; a cobrança por canal precisa ser conferida.
