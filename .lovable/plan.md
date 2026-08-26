# Tratar o bloqueio 656 (consumo indevido) da SEFAZ

Boa notícia dentro do erro: o `656` só é devolvido depois que a SEFAZ aceitou o
certificado e o CNPJ. Ou seja, o mTLS e o caminho app → serviço → SEFAZ estão
funcionando. O `656` significa que consultamos com frequência acima do permitido
(a SEFAZ exige ~1 hora de intervalo quando a resposta é "nada novo", e a nossa
sincronização pagina várias vezes seguidas).

## O que muda

**Banco (`sefaz_accounts`)**
- Nova coluna `blocked_until` (data/hora até quando não podemos consultar).

**Sincronização**
- Antes de chamar a SEFAZ: se `blocked_until` estiver no futuro, nem chamamos —
  devolvemos a mensagem com o horário exato em que a consulta libera.
- Ao receber `656`: grava `blocked_until = agora + 1 hora`, interrompe a paginação
  e devolve mensagem clara.
- Ao receber `137` (nada novo): grava uma espera de 1 hora também, que é a regra
  da SEFAZ e a principal causa de cair em `656`.
- Paginação passa a continuar **apenas** quando vieram documentos e o NSU avançou
  (`cStat 138`), com uma pequena pausa entre páginas; qualquer outro código encerra
  a execução na hora.

**Painel**
- Botão "Sincronizar com o SEFAZ" fica desabilitado enquanto houver bloqueio,
  mostrando "Disponível às HH:MM" e um contador.
- Linha de status mostra o retorno da SEFAZ em texto amigável (bloqueado / nada
  novo / documentos importados) em vez do código cru.
- No modo Demonstração nada muda.

## O que você faz agora

Espere completar 1 hora desde a última tentativa e clique em sincronizar novamente.
Depois desta correção o app passa a controlar esse intervalo sozinho, então o `656`
não deve mais acontecer.

## Detalhes técnicos

- Migration adiciona `blocked_until timestamptz` (sem novos GRANTs além dos já
  existentes na tabela).
- `syncSefaz` lê/escreve `blocked_until`; a decisão de bloqueio vive no servidor,
  não na tela.
- `describeSefazStatus` continua a fonte única dos textos de `cStat`.
- Nenhuma alteração no serviço da bridge nem no armazenamento do certificado.
