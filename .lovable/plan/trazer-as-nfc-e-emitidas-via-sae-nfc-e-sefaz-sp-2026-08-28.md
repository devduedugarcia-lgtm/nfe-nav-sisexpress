# Trazer as NFC-e emitidas via SAE-NFC-e (SEFAZ-SP)

Sim, dá para acessar. A distribuição nacional que usamos hoje não entrega NFC-e (modelo 65) — no banco, as notas reais gravadas são todas modelo 55 de entrada. Os dois webservices do SAE-NFC-e de SP resolvem isso, e já li a Nota Técnica 2026 para montar as mensagens no formato exato.

## Fluxo

```text
Painel → syncNfceSP (server fn) → bridge (mTLS com o certificado da empresa)
   1) NFCeListagemChaves → chaves do período
   2) NFCeDownloadXML    → XML de cada chave nova
   3) grava em invoices (NFCe, saída)
```

- Endereços: `nfce.fazenda.sp.gov.br/ws/...` (produção) e `homologacao.nfce.fazenda.sp.gov.br/ws/...` (homologação), pelo ambiente já cadastrado na configuração fiscal.
- O contribuinte consultado é o do e-CNPJ do certificado, então nada novo a cadastrar.
- Entrada da listagem: `versao`, `tpAmb`, `dataHoraInicial` e `dataHoraFinal` (`AAAA-MM-DDThh:mm`). Retorno traz `cStat`, `xMotivo`, a lista de `chNFCe` e `dhEmisUltNfce`.
- Limite de 2000 chaves por consulta e no máximo 100 dias para trás: o app pede em blocos e, quando vem `cStat=101` (lista incompleta), usa o `dhEmisUltNfce` como nova `dataHoraInicial` e continua até fechar o período.
- Download por chave (`nfceDownloadXML` com `versao`, `tpAmb`, `chNFCe`), aproveitando o `nfeProc` e os `procEventoNFe` do retorno. Só baixa chaves que ainda não estão no banco, respeitando o limite de chamadas por minuto com pausa entre elas.

## Na bridge (serviço Node.js)

Duas rotas novas, stateless como as atuais (certificado por requisição, cache de agente mTLS):
- `POST /nfce/chaves` → monta o SOAP da listagem e devolve `cStat`, `xMotivo`, chaves e `dhEmisUltNfce`.
- `POST /nfce/xml` → monta o SOAP do download por chave e devolve `cStat`, `xMotivo`, o XML da NFC-e e os eventos.

Mensagens sem prefixo de namespace, namespace padrão da NFe, UTF-8 e sem espaços entre tags, para evitar as rejeições 215/587/588/404/402.

## No app

- `syncNfceSP` em `src/lib/nfe.functions.ts`: autenticada, descriptografa o certificado do usuário em memória, percorre o período, grava com `source='sefaz'`, `doc_type='NFCe'`, `direction='saida'` e o ambiente atual; upsert por `(user_id, access_key)`, sem duplicar.
- Cursor próprio da NFC-e em `sefaz_accounts` (`nfce_last_sync_at`, `nfce_last_status`, `nfce_blocked_until`), separado do NSU da distribuição.
- Cooldown de 1h em `656` (consumo indevido) só para a NFC-e, com o botão "Liberar consulta agora" já existente.
- Painel: no modo SEFAZ real, botão "Sincronizar NFC-e (SP)" com período (padrão: últimos 7 dias, limitado a 100 dias) e resumo — chaves encontradas, XMLs baixados, ignorados com o motivo da SEFAZ.
- Mensagens legíveis: 100/200 sucesso, 101 lista incompleta (continua sozinho), 107 sem registros, 104/207 fora do prazo de 100 dias, 203 chave de outro CNPJ, 204/205 chave inválida ou não encontrada, 108/109 serviço paralisado, 282/285 problema no certificado, 656 consumo indevido.

## Detalhes técnicos

- Migration: colunas de cursor/bloqueio da NFC-e em `sefaz_accounts` (nullable, sem tocar em RLS).
- Parser: reaproveita `parseSefazDocument` (já identifica modelo 65 pela chave), extraindo o `nfeProc` do retorno e ignorando blocos de evento.
- Descriptografia do PFX e leitura de segredos apenas dentro do `.handler()`.

## O que preciso de você

Depois de eu entregar o código, fazer o deploy da nova versão da bridge no Render — nenhuma variável nova é necessária.
