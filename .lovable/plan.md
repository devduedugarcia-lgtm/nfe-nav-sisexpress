# Trazer as NFC-e emitidas para o painel

## O que está acontecendo

A sincronização atual usa a distribuição nacional da SEFAZ (`NFeDistribuicaoDFe`). Confirmei no banco: as 15 notas reais importadas são todas `resNFe` de **entrada**, modelo 55. Essa distribuição não entrega NFC-e (modelo 65) — nem as emitidas pelo próprio CNPJ. Ou seja, nenhuma mudança no sincronismo atual fará as NFC-e aparecerem; precisamos de um caminho adicional.

Como não houve resposta sobre a preferência, vou implementar os dois caminhos mais úteis, no mesmo lugar do painel.

## Caminho 1 — Importar XMLs emitidos (principal)

Nova área "Importar XMLs" na tela de sincronização:
- Aceita vários arquivos `.xml` ou um `.zip` exportado do sistema emissor de NFC-e.
- Cada XML é lido no servidor, normalizado com o mesmo parser já existente (chave, número, série, modelo 55/65, emitente, destinatário, data, valor, status/cancelamento) e gravado com `source = 'sefaz'` e o ambiente configurado.
- Reaproveita o upsert por `(user_id, access_key)`, então reimportar o mesmo arquivo não duplica.
- Resumo ao final: arquivos lidos, notas gravadas, ignorados (com motivo curto).

## Caminho 2 — Buscar por chave de acesso

- Campo para colar uma ou várias chaves de 44 dígitos (uma por linha).
- Novo endpoint na bridge que consulta a SEFAZ por chave (`consChNFe`) com o certificado da empresa, devolvendo o XML completo quando disponível.
- Mesma normalização e gravação do caminho 1. Chaves com retorno negativo aparecem na lista de ignorados com a mensagem da SEFAZ.

## Ajustes no painel

- As NFC-e importadas passam a contar nos cards e a aparecer na lista, com o filtro de tipo "NFCe" já existente funcionando.
- Etiqueta de origem distinguindo "SEFAZ" (distribuição) de "Importado" para você saber de onde cada nota veio.
- Texto explicando, na tela, que NFC-e não vem pela distribuição nacional e precisa ser importada.

## Detalhes técnicos

- Banco: nova coluna `origin_detail` (ou valor extra em `source`) para diferenciar `sefaz` de `import`/`chave`, com migration e GRANTs; sem alterar RLS existente.
- Servidor: `importInvoiceXmls` e `fetchInvoicesByKey` em `src/lib/nfe.functions.ts`, autenticadas, com validação Zod (tamanho de arquivo, quantidade máxima por lote); descompactação de ZIP e parse sem dependência nativa, compatível com o runtime.
- Bridge: rota `POST /consulta-chave` stateless, recebendo PFX cifrado/senha como já faz `/distribuicao`, com cache de agente mTLS por thumbprint.
- Sem alteração no cooldown de 656/137 do sincronismo atual.
