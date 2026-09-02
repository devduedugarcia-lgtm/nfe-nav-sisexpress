# Corrigir o 404 do serviço de consulta (sefaz-bridge)

## O que está acontecendo

Chamei o serviço publicado agora: `https://sefaz-bridge-a33m.onrender.com/health` responde
**404 Not Found** — e `/health` é a rota mais simples da ponte, que não exige token nem
certificado. Ou seja: o que está no ar nesse endereço **não é a versão atual da ponte**
(deploy antigo/falhado, serviço suspenso pelo plano gratuito do Render, ou o endereço
mudou). Por isso o app mostra 404 tanto na conexão com a SEFAZ quanto no envio do
certificado ("o serviço não tem o endpoint de validação").

Isso não é um problema no código do app: `/health`, `/validar`, `/distribuicao`,
`/nfce/chaves` e `/nfce/xml` já existem em `sefaz-bridge/server.mjs` no repositório.
O que falta é publicar essa versão no Render.

## O que você precisa fazer no Render

1. Abrir o serviço `sefaz-bridge` no Render.
2. Confirmar as configurações:
   - Root Directory: `sefaz-bridge`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Variável de ambiente: `BRIDGE_TOKEN` (a mesma que está guardada no app)
   - `CERT_PFX_BASE64` / `CERT_PASSWORD` podem ser removidas (não são mais necessárias
     no modo dinâmico, em que cada consulta usa o certificado do próprio usuário).
3. Clicar em **Manual Deploy → Deploy latest commit** e esperar o log terminar com
   `[bridge] ouvindo na porta ...`.
4. Testar: abrir `https://<sua-url>.onrender.com/health` no navegador. Deve responder
   um JSON com `"ok": true` e `"mode": "dinamico"`. Se responder 404, o deploy não subiu.
5. Me enviar a URL final (se tiver mudado) para eu atualizar o segredo do app.

Se o log do Render mostrar erro, me mande o texto — eu ajusto o serviço.

## O que eu faço no app depois disso

- Confirmar o `/health` pelo próprio app (botão "Testar conexão") e o segredo
  `SEFAZ_BRIDGE_URL`, atualizando-o se o endereço mudou.
- Melhorar as mensagens de erro para deixar o diagnóstico óbvio, em vez do 404 genérico:
  - `/health` 404 → "O serviço de consulta não está publicado neste endereço. Faça o
    deploy da pasta sefaz-bridge no Render."
  - `/validar` 404 → mesma mensagem, com o aviso de que o envio do certificado depende
    do serviço no ar.
  - Timeout/serviço adormecido (plano gratuito do Render) → "O serviço demorou a
    responder; tente novamente em alguns segundos."
- Na tela do certificado e no painel, mostrar o estado da conexão com o serviço antes
  de permitir o envio, evitando erro depois de escolher o arquivo.
- Ligar o botão "Sincronizar NFC-e (SP)" ao painel (período padrão: últimos 7 dias),
  já que a parte de servidor está pronta e só faltava validar contra o serviço no ar.

## Detalhes técnicos

- Nenhuma mudança de banco.
- Alterações no app: mensagens e checagem de disponibilidade em `src/lib/sefaz.server.ts`
  e a integração do botão de NFC-e em `src/routes/_authenticated/dashboard.tsx`.
- Nenhuma variável nova na ponte; o certificado continua trafegando cifrado e só em
  memória, por chamada.
