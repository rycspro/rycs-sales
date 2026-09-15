# Zona DNS de rycs.pro — estado em 15/09/2026

Capturado antes de qualquer migração de nameserver. Se a zona for recriada em
outro provedor, TODOS os registros abaixo precisam existir no destino antes de
trocar os nameservers no registrador.

Nameservers atuais (Hostinger / estacionamento):
    hermes.dns-parking.com
    artemis.dns-parking.com

| Nome                      | Tipo  | Valor                                                                 | Para que serve |
|---------------------------|-------|-----------------------------------------------------------------------|----------------|
| rycs.pro                  | A     | 216.198.79.1                                                          | Site na Vercel |
| rycs.pro                  | A     | 76.76.21.21                                                           | Site na Vercel |
| www.rycs.pro              | CNAME | rycs.pro                                                              | Site na Vercel |
| app.rycs.pro              | CNAME | ok7cf5qa.up.railway.app                                               | Aplicação na Railway |
| rycs.pro                  | MX 10 | inbound-smtp.sa-east-1.amazonaws.com                                  | RECEBER e-mail (Amazon SES) |
| send.rycs.pro             | MX 10 | feedback.forge.rmta.net                                               | Retorno de envio (Resend) |
| send.rycs.pro             | MX    | send.forge.rmta.net                                                   | Retorno de envio (Resend) |
| send.rycs.pro             | TXT   | v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all    | SPF do Resend |
| resend._domainkey.rycs.pro| TXT   | p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDGDld7ZzTk4v02eJT/vrDtCX+EivIiD5QAlzzwq46dlBX6+9hFSBW07/2INcll1j71aFS0Xu374Jh+H+mZKe6RyuqyDDnbzrdP2UTY2oDpPffp5cUmY8Wyu0gGMSbAeCCUwjf/vkRam9cj565qRV7ql3mtjcra4O+jSYs+VNRyYwIDAQAB | DKIM do Resend |
| _dmarc.rycs.pro           | TXT   | v=DMARC1; p=none;                                                     | Política DMARC |

## O que NÃO existe hoje

- Nenhum registro AAAA (IPv6) — nem no apex, nem em www, nem em app.
- Nenhum registro CAA.
- Nenhum TXT no apex.

## Os dois registros que, se esquecidos, causam dano silencioso

1. **MX do apex** — sem ele, todo e-mail enviado PARA @rycs.pro deixa de chegar.
   Ninguém recebe erro; a mensagem simplesmente some.
2. **resend._domainkey + send.rycs.pro** — sem eles, os e-mails que a plataforma
   ENVIA (boas-vindas, notificações de campanha, aprovação) passam a cair em
   spam ou a ser recusados.
