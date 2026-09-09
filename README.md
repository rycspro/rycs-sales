# RYCS Sales Machine

Plataforma de execução comercial que conecta empresas e profissionais, controla campanhas, qualificação, leads, comprovação de tarefas e repasses.

## Executar localmente

Requer Node.js 20 ou superior.

```bash
npm install
cp .env.example .env
npm run server
```

Em outro terminal:

```bash
npm run dev
```

Frontend: `http://localhost:5173`. API: `http://localhost:3001`. Para abrir dados demonstrativos sem gravar no banco, use `/preview/empresa`, `/preview/vendedor` ou `/preview/admin`.

## Fluxo operacional implementado

1. A empresa completa cadastro, ICP, contatos e materiais e envia para análise.
2. A plataforma aprova ou suspende a empresa.
3. Uma empresa aprovada contrata plano pago, configura campanha, treinamento, tarefas e orçamento.
4. A publicação valida cadastro, plano, caixa, limite do plano e campos obrigatórios.
5. O profissional se candidata, conclui a qualificação e passa pela aprovação.
6. Leads são vinculados à empresa/campanha, protegidos contra duplicidade e acompanhados no funil.
7. Uma submissão reserva no caixa o pagamento do profissional mais a taxa do plano.
8. Recusa estorna a reserva; liberação debita a empresa, credita integralmente o profissional e registra a receita RYCS.
9. O painel separa saldo total, disponível e reservado e apresenta o extrato operacional.

## Alterações necessárias no ambiente da empresa

Para produção, não use o SQLite efêmero do container. Configure `DB_PATH` em volume persistente ou migre o repositório para Postgres, defina `NODE_ENV=production`, um `JWT_SECRET` forte e um `AUDIT_HMAC_SECRET` separado. Cadastre também a URL pública exata em `FRONTEND_URL` e `VITE_API_URL` durante o build.

Integrações externas:

- Asaas: `ASAAS_API_KEY`, `ASAAS_ENV=production` e `ASAAS_WEBHOOK_TOKEN` para depósitos e pagamentos.
- Resend: `RESEND_API_KEY` e `EMAIL_FROM` com domínio verificado.
- S3 ou Cloudflare R2: bucket, endpoint e credenciais; aplique no bucket o limite real de 50 MB e política privada.
- Anthropic: `ANTHROPIC_API_KEY` para auditoria assistida por IA. Sem a chave, a API continua no ar e usa as regras locais disponíveis.
- Administração: `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_SECURITY_KEY`. Guarde tudo no cofre de segredos do provedor.

Antes do piloto, configure domínio/TLS, backups automáticos, alertas de erro e saldo, retenção de evidências, política de privacidade/LGPD, termos de uso, contrato da operação, conciliação diária e responsáveis por aprovação de empresas, contestações e saques.

## Comandos de validação

```bash
npm test
npm run build
```

O endpoint `GET /api/health` deve responder `{ "status": "ok" }`.

## Planos configurados

- Sandbox: configuração sem campanha ativa.
- Start: R$ 499/mês, taxa de 12%, 1 campanha e até 5 profissionais.
- Growth: R$ 999/mês, taxa de 9%, 3 campanhas e até 20 profissionais.
- Scale: R$ 2.700/mês, taxa de 7%, 10 campanhas e até 100 profissionais.

O profissional recebe o valor integral definido para a tarefa. A taxa variável é adicionada ao débito da empresa e registrada separadamente no livro financeiro.
