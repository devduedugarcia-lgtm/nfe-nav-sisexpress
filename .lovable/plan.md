# Concluir a conexão com a ponte SEFAZ

## Situação verificada agora

- O serviço no Render responde em `https://nfe-nav-sisexpress-3.onrender.com` (`/health` = 200, modo dinâmico).
- O token **já está igual** nos dois lados: impressão `c7a34d41` no serviço e no app.
- Com o cabeçalho correto, os endpoints autenticam: `/validar` e `/nfce/chaves` respondem 400 por falta de dados (ou seja, passaram pela autenticação). O erro "token recusado" que você viu é de uma tentativa anterior.
- Ponto que resta: o segredo `SEFAZ_BRIDGE_URL` no app ainda guarda o endereço antigo (`sefaz-bridge-a33m.onrender.com`). Hoje isso só funciona por causa de um desvio provisório escrito no código.

## O que fazer

1. Atualizar o segredo `SEFAZ_BRIDGE_URL` para `https://nfe-nav-sisexpress-3.onrender.com` (abro o formulário seguro para você confirmar).
2. Remover do código o desvio provisório que reescreve a URL antiga, deixando o app usar apenas o segredo.
3. Melhorar a mensagem de erro: hoje qualquer 401 fala em "token divergente". Passará a distinguir token divergente (impressões diferentes) de outras falhas de autorização, evitando diagnóstico enganoso.
4. Validar de ponta a ponta no preview: "Testar conexão" na tela de certificado, upload/validação do certificado e "Sincronizar NFC-e (SP)" com um intervalo curto de datas, reportando o status real retornado pela SEFAZ.

## Detalhes técnicos

- Arquivo afetado: `src/lib/sefaz.server.ts` (resolução da URL base e mapeamento de erros HTTP 401/404).
- Autenticação da ponte: cabeçalho `Authorization: Bearer <BRIDGE_TOKEN>`; a ponte compara com o valor exato após `trim()`.
- Nenhuma mudança de banco de dados é necessária.
