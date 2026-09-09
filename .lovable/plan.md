# Descobrir o formato exato da mensagem NFC-e (SP) e corrigir a rejeição

## O que já está confirmado

- A ponte publicada responde e o token é aceito; a chamada agora chega à SEFAZ-SP (antes dava HTTP 500, agora vem uma rejeição de conteúdo).
- A ponte monta a mensagem com envelope SOAP 1.2, elemento `nfceListagemChaves` / `nfceDownloadXML` e namespace `http://www.portalfiscal.inf.br/nfe/wsdl/...`, e envia a ação no cabeçalho.
- A rejeição "Mensagem SOAP inválida" indica que algum desses nomes (namespace, elemento externo ou versão do SOAP) não corresponde ao que o serviço de SP espera.
- Não é possível confirmar o formato correto a partir daqui: o endereço da SEFAZ-SP não é alcançável deste ambiente, e o serviço só responde a quem apresenta o certificado digital. A ponte publicada, sim, alcança.

Ou seja: a causa exata ainda não está confirmada. O primeiro passo do plano é descobri-la com dado real, em vez de tentar variações no escuro.

## Passos

1. Acrescentar à ponte uma rota de diagnóstico (protegida pelo mesmo token) que, usando o certificado da empresa, busca a definição oficial dos dois serviços de SP e devolve: nomes das operações, namespace declarado, versão do SOAP aceita e o formato do cabeçalho de ação.
2. Fazer a ponte devolver o texto completo do motivo da rejeição da SEFAZ (o trecho "Reason"), sem cortar, para que a mensagem no painel diga exatamente o que a Fazenda recusou.
3. Com a definição em mãos, ajustar a montagem da mensagem das duas consultas (namespace, elemento externo, versão do SOAP e cabeçalho de ação) para o formato exato publicado por SP.
4. Novo deploy da ponte no Render (necessário porque a ponte roda fora do app).
5. Validar: primeiro a rota de diagnóstico, depois "Sincronizar NFC-e (SP)" com um intervalo curto, confirmando o código de retorno e a quantidade de chaves/XMLs.

## Detalhes técnicos

- Alterações em `sefaz-bridge/server.mjs`: nova rota `GET/POST /nfce/wsdl` (autenticada, usa `agentFor` com o PFX enviado), preservação integral de `soap:Reason` no erro de HTTP, e correção de `nfceEnvelope` / `nfceAction` conforme a definição obtida.
- Ajuste em `src/lib/sefaz.server.ts` apenas para repassar a mensagem detalhada da rejeição ao painel.
- A validação TLS continua obrigatória (a cadeia ICP-Brasil já embarcada); nada de `rejectUnauthorized: false`.
- Nenhuma mudança de banco de dados; nenhum certificado, senha ou token é registrado em log.
