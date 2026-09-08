# Corrigir a demora na consulta NFC-e da SEFAZ-SP

## Situação confirmada

- O novo serviço está publicado e responde normalmente no endereço cadastrado (`/health` = 200).
- A versão publicada está em modo dinâmico e carrega os dois certificados da cadeia oficial ICP-Brasil.
- O endpoint de NFC-e existe e a proteção por token está ativa.
- As tentativas de sincronização chegam ao app como 502/503/504 sem uma mensagem aproveitável; por isso o painel mostra o aviso genérico de que o serviço pode estar iniciando.
- O serviço permite que a chamada à SEFAZ-SP espere até 60 segundos. Esse tempo pode ultrapassar o limite da chamada feita pelo app antes que o serviço consiga devolver o erro real.

## Alteração

1. Reduzir e controlar o tempo máximo da chamada externa à SEFAZ-SP, encerrando-a antes do limite do app.
2. Fazer o serviço sempre devolver uma resposta JSON clara para demora, falha TLS, rejeição HTTP ou encerramento da conexão.
3. Acrescentar identificação da etapa (`listagem de chaves` ou `download do XML`) sem registrar certificado, senha ou token.
4. Ajustar o painel para diferenciar serviço fora do ar, demora da SEFAZ-SP e erro devolvido pela Fazenda, removendo a sugestão incorreta sobre inicialização quando o `/health` já está normal.
5. Validar primeiro a conexão e depois uma consulta NFC-e em intervalo curto; se a SEFAZ responder, confirmar o status e a quantidade de chaves/XMLs processados.

## Detalhes técnicos

- Alterações concentradas em `sefaz-bridge/server.mjs` e `src/lib/sefaz.server.ts`.
- A validação TLS continuará obrigatória; não será usado `rejectUnauthorized: false`.
- Nenhuma alteração no banco de dados ou nos certificados armazenados.
- Após a alteração da ponte, será necessário um novo deploy no Render para o teste final.