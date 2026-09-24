# RYCS Beta

Beta é o ambiente de homologação da RYCS.

É a mesma aplicação e o mesmo código da Produção, porém com ambiente e dados separados.

## Estrutura

Produção:

- clientes reais;
- dados reais;
- dinheiro real.

Beta:

- usuários demo;
- dados fictícios;
- saldo fictício;
- campanhas e tarefas de teste;
- possibilidade de reset;
- sem impacto em Produção.

## Fluxo

Desenvolvimento
→ Beta
→ Validação
→ Produção

## Regras

- Nunca misturar dados de Beta e Produção.
- Nunca levar dados fictícios para Produção.
- Features relevantes devem ser validadas no Beta antes da Produção.
- Se houver falha crítica no Beta, corrigir antes de promover.
- Promover o mesmo código que foi validado.
- Funcionalidades exclusivas de teste devem existir somente no Beta.
- Beta deve permitir testar Empresa e Profissional sem depender de dinheiro real.
- Correções localizadas devem testar apenas os fluxos afetados, sem auditoria geral desnecessária.
