# Importar NFC-e emitidas em SP (NFCeListagemChaves + NFCeDownloadXML)

## Por que hoje não vem

Confirmei no banco: as 15 notas reais são todas `resNFe` modelo 55, de entrada. A distribuição nacional (`NFeDistribuicaoDFe`) não entrega NFC-e (modelo 65), então nenhuma NFC-e emitida aparece por esse caminho. A SEFAZ-SP oferece dois webservices próprios para isso, e é esse caminho que vamos implementar.

## Fluxo novo

```text
Painel → syncNfceSP (server fn) → bridge (mTLS com o certificado da empresa)
   1) NFCeListagemChaves  → chaves do período
   2) NFCeDownloadXML     → XML de cada chave nova
   3) grava em invoices (doc_type NFCe, direction saida)
```

- Endpoints: `https://nfce.fazenda.sp.gov.br/ws/...` (produção) e `https://homologacao.nfce.fazenda.sp.gov.br/ws/...` (homologação), escolhidos pelo ambiente já cadastrado na configuração fiscal.
- O CNPJ consultado é o do próprio certificado (e-CNPJ), como a nota técnica exige — nada a informar além do que já está cadastrado.
- Período pedido em blocos (ex. 1 dia por chamada) para respeitar o limite de 2000 chaves; quando a SEFAZ responder `101` (lista incompleta), o app reduz automaticamente a janela e repete.
- Só baixa o XML de chaves que ainda não existem no banco, evitando consultas desnecessárias.

## Na bridge (serviço Node.js)

Duas rotas novas, stateless como as atuais (recebem PFX cifrado + senha por requisição, cache de agente mTLS por thumbprint):
- `POST /nfce/chaves` → monta o SOAP com `tpAmb`, `dhReq`, `dataHoraInicial`, `dataHoraFinal`; devolve `cStat`, `xMotivo` e a lista de chaves.
- `POST /nfce/xml` → monta o SOAP por chave; devolve `cStat`, `xMotivo`, o XML da NFC-e e os eventos (`procEventoNFe`) quando houver.

## No app

- `syncNfceSP` em `src/lib/nfe.functions.ts`: autenticada, usa o certificado cifrado do usuário, percorre o período, grava as notas com `source = 'sefaz'`, `doc_type = 'NFCe'`, `direction = 'saida'` e o ambiente atual; upsert por `(user_id, access_key)` (sem duplicar).
- Cursor próprio da NFC-e em `sefaz_accounts` (`nfce_last_sync_at`, `nfce_last_status`), separado do NSU da distribuição, para as sincronizações não interferirem uma na outra.
- Cooldown para `656` (consumo indevido) igual ao já existente, contado só para a NFC-e.
- Painel: no modo SEFAZ real, botão "Sincronizar NFC-e (SP)" com seleção de período (padrão: últimos 7 dias) e resumo — chaves encontradas, XMLs baixados, ignorados com o motivo da SEFAZ.
- Mensagens legíveis para os retornos da nota técnica: `100/200` sucesso, `101` lista incompleta (janela reduzida automaticamente), `107` sem registros, `205` chave não encontrada, `207` fora do prazo, `656` consumo indevido, `108/109` serviço paralisado.

## Detalhes técnicos

- Migration: colunas de cursor NFC-e em `sefaz_accounts` (nullable, sem mexer em RLS existente).
- Parser reaproveita `parseSefazDocument`, que já identifica modelo 65 pela chave; ajuste para tratar o XML completo da NFC-e e ignorar apenas os eventos.
- Segredos e descriptografia do PFX apenas dentro do `.handler()`, como hoje; nada sensível no bundle do cliente.
- Assinatura/namespace conforme MOC (namespace padrão da NFe, sem prefixos e sem caracteres de edição), para evitar as rejeições 587/588/404.

## O que preciso de você

Depois de eu entregar o código, atualizar o serviço no Render (deploy da nova versão da bridge) — nenhuma variável nova é necessária.
