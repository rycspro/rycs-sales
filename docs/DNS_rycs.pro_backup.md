# Zona DNS de rycs.pro — migração em 15/09/2026

## Autoridade DNS atual

Em 15/09/2026, a delegação foi alterada na Hostinger para os nameservers da
Vercel, provedor que já hospeda a landing page do domínio:

    ns1.vercel-dns.com
    ns2.vercel-dns.com

Antes da troca, todos os registros ativos abaixo foram replicados e consultados
diretamente em `ns1.vercel-dns.com`. O CNAME `app` usa TTL de 60 segundos na
Vercel. Durante a propagação, a zona antiga da Hostinger continua íntegra e o
TTL do `app` foi reduzido para 300 segundos.

Os nameservers anteriores, preservados somente para referência e eventual
rollback, eram:

    hermes.dns-parking.com
    artemis.dns-parking.com

## Registros preservados

Se a zona for recriada em outro provedor, TODOS os registros abaixo precisam
existir no destino antes de trocar os nameservers no registrador.

| Nome                      | Tipo  | Valor                                                                 | Para que serve |
|---------------------------|-------|-----------------------------------------------------------------------|----------------|
| rycs.pro                  | ALIAS | f4f6b98acb32dbe5.vercel-dns-017.com                                  | Site na Vercel |
| *.rycs.pro                | ALIAS | cname.vercel-dns-017.com                                              | Fallback de subdomínios na Vercel |
| www.rycs.pro              | CNAME | rycs.pro                                                              | Site na Vercel |
| app.rycs.pro              | CNAME | ok7cf5qa.up.railway.app                                               | Aplicação na Railway |
| _railway-verify.app.rycs.pro | TXT | railway-verify=f1c5d93bbec5856f34dc43d5cd6cb56644e1ac6645592a8e2f669b54e95f2df4 | Verificação Railway |
| rycs.pro                  | MX 10 | inbound-smtp.sa-east-1.amazonaws.com                                  | RECEBER e-mail (Amazon SES) |
| send.rycs.pro             | CNAME | send.forge.rmta.net                                                   | Envio transacional (Resend) |
| rsend.rycs.pro            | CNAME | rsend-sae1.forge.rmta.net                                             | Rastreamento/retorno (Resend) |
| resend._domainkey.rycs.pro| TXT   | p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDGDld7ZzTk4v02eJT/vrDtCX+EivIiD5QAlzzwq46dlBX6+9hFSBW07/2INcll1j71aFS0Xu374Jh+H+mZKe6RyuqyDDnbzrdP2UTY2oDpPffp5cUmY8Wyu0gGMSbAeCCUwjf/vkRam9cj565qRV7ql3mtjcra4O+jSYs+VNRyYwIDAQAB | DKIM do Resend |
| _dmarc.rycs.pro           | TXT   | v=DMARC1; p=none;                                                     | Política DMARC |

## O que NÃO existe hoje

- Nenhum registro AAAA (IPv6) — nem no apex, nem em www, nem em app.
- Nenhum registro CAA.
- Nenhum TXT no apex.

## Os dois registros que, se esquecidos, causam dano silencioso

1. **MX do apex** — sem ele, todo e-mail enviado PARA @rycs.pro deixa de chegar.
   Ninguém recebe erro; a mensagem simplesmente some.
2. **resend._domainkey + send.rycs.pro + rsend.rycs.pro** — sem eles, os e-mails que a plataforma
   ENVIA (boas-vindas, notificações de campanha, aprovação) passam a cair em
   spam ou a ser recusados.
