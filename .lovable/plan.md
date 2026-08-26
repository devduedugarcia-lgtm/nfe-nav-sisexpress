# Voltar a trazer as notas reais e afrouxar o bloqueio de 1h

## O que os dados mostram agora

Consultei o banco antes de propor qualquer coisa:

- Na tabela de notas existem **apenas 12 notas de demonstração**. Não há nenhuma
  nota com origem SEFAZ gravada.
- Na configuração fiscal: CNPJ 32080128000107, UF SP, ambiente **produção**,
  cursor `ult_nsu = 274`, último retorno `656`, bloqueio até **15:40** (SP).

O cursor em 274 é o ponto central: a SEFAZ só devolve documentos com NSU **maior**
que o cursor. Como o cursor avançou até 274 sem que as notas tenham ficado
gravadas, os documentos daquele intervalo não voltam mais em novas consultas —
por isso "não busca nada". O bloqueio de 1h apenas atrasa o teste; ele não é a
causa da lista vazia.

## O que muda

**1. Recomeçar do zero e não perder documentos**
- Zerar o cursor (`ult_nsu = 0`) e o bloqueio para reprocessar o lote inteiro
  disponível na SEFAZ (janela dos últimos ~3 meses).
- Passar a gravar as notas **antes** de avançar o cursor: se a gravação ou a
  leitura do XML falhar, o cursor não avança e nada é perdido.

**2. Diagnóstico de documentos que não viram nota**
- Contar, por página, quantos documentos vieram e quantos foram efetivamente
  interpretados. Esse resumo aparece na mensagem do painel
  (ex.: "12 documentos recebidos, 12 gravados" ou "3 não interpretados").
- Tratar os tipos que hoje podem ser ignorados em silêncio (resumo de NFe,
  eventos, documentos compactados) sem descartar o avanço correto.

**3. Bloqueio mais inteligente (sem travar a validação)**
- `656` continua bloqueando 1h (é exigência da SEFAZ).
- `137` (nada novo) passa a bloquear **apenas 5 minutos**, não 1h — foi esse
  excesso que comprometeu o teste.
- Botão "Liberar consulta agora" ao lado do sincronizar, para você forçar uma
  tentativa quando o bloqueio for do nosso controle (137), assumindo o risco.
- Continua havendo pausa entre páginas para não provocar o 656 de novo.

## Ordem de execução

1. Ajustar a sincronização (gravar antes de avançar cursor, contagem, tempos de
   bloqueio).
2. Ajustar o painel (contagem no retorno + botão de liberar consulta).
3. Zerar cursor e bloqueio.
4. Rodar uma sincronização real a partir do NSU 0 e te reportar: código da SEFAZ,
   documentos recebidos, notas gravadas, cursor final.

## Detalhes técnicos

- `syncSefaz`: inverter a ordem gravação/atualização do cursor; acumular
  `received`/`parsed` por página; `137` grava `blocked_until = agora + 5min`,
  `656` mantém 1h.
- Nova função autenticada para limpar `blocked_until` (usada pelo botão), sem
  mexer no `ult_nsu`.
- `parseSefazDocument` ganha retorno de motivo quando devolve `null`, para o
  resumo do painel; nenhuma mudança no serviço da bridge nem no certificado.
