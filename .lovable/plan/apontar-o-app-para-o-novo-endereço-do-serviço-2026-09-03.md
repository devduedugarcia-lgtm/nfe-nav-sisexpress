# Apontar o app para o novo endereço do serviço

Chamei o serviço agora e ele respondeu certo:

```text
GET https://nfe-nav-sisexpress-3.onrender.com/health  →  200
{"ok": true, "mode": "dinamico", "certLoaded": false}
```

Ou seja: a ponte nova está no ar, em modo dinâmico (o certificado vai por chamada, sem nada
fixo no Render). Só que o endereço **mudou** — o app ainda guarda o antigo
(`sefaz-bridge-a33m.onrender.com`), que é o que causava o 404 na conexão com a SEFAZ e no
envio do certificado.

## O que eu faço

1. Atualizar o segredo `SEFAZ_BRIDGE_URL` para `https://nfe-nav-sisexpress-3.onrender.com`
   (o token `SEFAZ_BRIDGE_TOKEN` continua o mesmo).
2. Conferir pelo próprio app: "Testar conexão" no painel deve responder "Serviço acessível
   e token aceito". Se o token não bater, aviso para você corrigir no Render.
3. Testar o envio do certificado digital na tela Certificado (validação de titular, CNPJ e
   validade pelo endpoint `/validar`).
4. Testar as duas sincronizações:
   - **NFe recebidas** (distribuição por NSU) — confirmar que volta a importar.
   - **NFC-e emitidas (SP)** — período dos últimos 7 dias, conferindo chaves encontradas e
     notas gravadas.
5. Se aparecer 656 (consumo indevido) da SEFAZ, uso o botão "Liberar consulta agora" para
   não travar a validação por 1 hora.

## Detalhes técnicos

- Nenhuma mudança de banco e nenhuma mudança de código prevista; é troca de segredo mais
  validação ponta a ponta.
- Se algum endpoint da NFC-e responder diferente do esperado, ajusto o tratamento em
  `src/lib/sefaz.server.ts` e reporto.
