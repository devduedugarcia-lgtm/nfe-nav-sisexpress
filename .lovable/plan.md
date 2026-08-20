# Certificado dinâmico por empresa (fim da variável no Render)

Resposta curta: o `CERT_PFX_BASE64` no Render foi só para o primeiro teste. Não é a mecânica final —
cada usuário deve enviar o próprio certificado pela tela do app, e o serviço deve usar o certificado
daquele usuário na hora da consulta.

## Como fica

```text
usuário envia .pfx + senha na tela  →  app cifra e guarda (storage privado)
painel "Sincronizar"  →  server function decifra em memória  →  envia .pfx+senha ao serviço
serviço monta conexão mTLS só para aquela consulta  →  SEFAZ
```

- O `.pfx` nunca aparece no navegador depois do envio e nunca é gravado em texto claro.
- O serviço no Render deixa de ter certificado próprio: ele passa a ser "sem estado", recebendo o
  certificado em cada chamada. Um mesmo serviço atende quantas empresas você quiser.
- O certificado no Render fica apenas como opção de fallback para testes (se nenhum for enviado).

## Mudanças no app

**Armazenamento**
- Bucket privado `certificates` (sem acesso público, leitura só pelo servidor).
- Tabela `certificates` ganha: caminho do arquivo, senha cifrada, validade, CNPJ do titular,
  impressão digital e status (válido/expirado/erro). RLS: só o dono; GRANTs incluídos.
- Segredo novo `CERT_ENCRYPTION_KEY` (eu gero) usado para cifrar a senha e o arquivo com AES-GCM.

**Envio (tela Certificado digital)**
- Passa a enviar o arquivo de verdade (hoje é simulado): o arquivo vai como base64 para uma server
  function autenticada, que valida o par arquivo+senha chamando `POST /validar` no serviço,
  lê titular e validade, cifra e grava. Erros voltam claros: "senha incorreta",
  "arquivo não é um .pfx/.p12 válido", "certificado expirado".
- A tela mostra titular, CNPJ, validade, dias restantes e botão para substituir/remover.

**Sincronização**
- `syncSefaz` carrega o certificado do usuário, decifra em memória e envia junto do pedido ao serviço.
- Sem certificado válido: mensagem "Envie seu certificado digital antes de consultar o SEFAZ",
  com link para a tela.
- Certificado vencido: bloqueia a consulta avisando a data de vencimento.

## Mudanças no serviço (sefaz-bridge)

- `POST /distribuicao` aceita `pfxBase64` + `certPassword` no corpo e monta um `https.Agent`
  por certificado, com cache em memória de curta duração (por impressão digital) para não
  recriar a conexão a cada página de NSU.
- Novo `POST /validar`: recebe o certificado e devolve titular, CNPJ e validade (sem gravar nada).
- `/health` continua respondendo, agora sem depender de certificado configurado.
- README atualizado: no Render só ficam `BRIDGE_TOKEN` (e opcionalmente um certificado de teste).
- Depois de publicar essa versão do serviço, você remove `CERT_PFX_BASE64`/`CERT_PASSWORD` do Render.

## Detalhes técnicos

- Cifra AES-256-GCM via WebCrypto (compatível com o runtime do app); IV por registro.
- O certificado trafega app→serviço só por HTTPS, com o token Bearer; nunca é logado.
- Cache do agente no serviço com TTL curto e limite de entradas, chaveado por hash do arquivo.
- Multiusuário: cada `sefaz_accounts` (CNPJ/UF/ambiente) casa com o certificado do mesmo usuário;
  aviso se o CNPJ do certificado não bater com o cadastrado.
