# Acesso aos dados reais do SEFAZ

O app hoje gera notas simuladas no próprio backend. Para notas reais precisamos falar com o
webservice `NFeDistribuicaoDFe` da SEFAZ, que exige SOAP + conexão TLS mútua com o certificado
digital A1 da empresa. O runtime do nosso backend (edge/Workers) não faz TLS mútuo, então o
caminho é o que você indicou: um pequeno serviço Node.js separado, e o app conversando com ele.

## Arquitetura

```text
Navegador → server function do app  →  serviço Node.js (fora do Lovable)  →  SEFAZ SOAP/mTLS
                    ↓                                ↑
              banco (notas)                 certificado .pfx + senha
```

- O certificado **nunca** entra no Lovable. Fica só no serviço Node.js (variável de ambiente/arquivo).
- O app autentica no serviço com um token compartilhado (`SEFAZ_BRIDGE_URL`, `SEFAZ_BRIDGE_TOKEN`).
- Continuamos com dois modos no painel: **Demonstração** (gerador atual) e **SEFAZ real** (bridge).

## Serviço Node.js (entrego o código pronto para você hospedar)

Pasta nova `sefaz-bridge/` no repositório, não faz parte do build do app:
- Express + `https.Agent` com `pfx`/`passphrase` para mTLS.
- `POST /distribuicao` recebendo `{ cnpj, uf, ambiente, ultNSU }` e devolvendo os documentos
  (chave, resumo e XML já descomprimido de gzip/base64).
- Assinatura XML quando necessário (`xml-crypto`), consulta ao endpoint nacional (`AN`)
  e tratamento dos códigos `cStat` 137/138/656 (nada novo / rejeição / consumo indevido).
- README com passos de deploy (Render, Railway, Fly.io ou VPS) e as variáveis exigidas.

## Mudanças no app

**Banco**
- `sefaz_accounts`: por usuário — CNPJ, UF, ambiente (produção/homologação), `ult_nsu`,
  `last_sync_at`, `last_status`. RLS: só o dono lê/escreve; admin lê tudo. GRANTs incluídos.
- `invoices`: novas colunas `source` (`demo` | `sefaz`), `nsu`, `schema_type`; índice único por
  `(user_id, access_key)` já usado no upsert continua valendo.

**Backend do app** (`src/lib/nfe.functions.ts` + novo `sefaz.server.ts`)
- `syncSefaz`: autenticada, lê a conta do usuário, chama a bridge a partir do `ult_nsu`,
  faz o parse dos XMLs (chave, número, série, tipo, emitente/destinatário, data, valor, status),
  grava as notas e atualiza `ult_nsu`. Erros da SEFAZ voltam como mensagem legível, sem stack.
- `getSefazAccount` / `saveSefazAccount`: cadastro do CNPJ/UF/ambiente.
- A direção (entrada/saída) passa a ser derivada do CNPJ do usuário vs. emitente do XML.
- Busca simulada mantida como `searchSefazDemo`.

**Telas**
- Painel: seletor de modo (Demonstração / SEFAZ real); no modo real o botão passa a ser
  "Sincronizar com SEFAZ", exibindo último NSU, horário da última sincronização e o retorno da SEFAZ.
- Nova aba/seção de configuração fiscal: CNPJ, UF, ambiente e status da conexão com a bridge.
- Tela de certificado fica **informativa** (nome e validade), com aviso de que o certificado
  usado nas consultas vive no serviço da empresa.
- Coluna/etiqueta discreta indicando notas de demonstração.

## O que preciso de você

1. Onde hospedar o serviço Node.js (Render/Railway/Fly/VPS) — só para eu escrever o README certo.
2. Depois do deploy: a URL e o token, que eu guardo como segredos do app.
3. CNPJ e UF da empresa e se começamos em homologação ou produção.

Sem a bridge no ar, o app continua funcional no modo Demonstração; o modo real mostra
"integração não configurada".

## Detalhes técnicos

- Parser de XML sem dependência nativa (compatível com o runtime do app) para ler o retorno da bridge.
- Segredos lidos apenas dentro do `.handler()`; nenhum valor sensível no bundle do cliente.
- Sincronização incremental por NSU, com limite por chamada e respeito ao intervalo mínimo
  da SEFAZ (uma consulta por hora por CNPJ) para evitar bloqueio por consumo indevido.
- `resNFe` (só resumo) é gravado com XML parcial e marcado para download completo via
  manifestação — fora do escopo desta etapa.
