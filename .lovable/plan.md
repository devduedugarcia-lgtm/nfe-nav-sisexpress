# Fazer a importação de NFC-e avançar sem renovar o bloqueio da SEFAZ

## Diagnóstico confirmado

- A conexão com a ponte está normal e o token foi aceito.
- As três consultas recentes de NFC-e retornaram **656 — consumo indevido**, às 15:43, 15:44 e 15:45 (horário de São Paulo).
- Cada tentativa devolveu **0 chaves, 0 downloads e 0 notas gravadas**.
- O banco contém 18 NFe reais de entrada, mas **nenhuma NFC-e real**. Portanto, a lista vazia não é causada pelo filtro do painel.
- O botão **“Liberar consulta agora”** permite repetir uma consulta que a própria SEFAZ mandou aguardar; isso renova o bloqueio de uma hora e impede chegar ao retorno útil da listagem.

## Alterações

1. **Respeitar o bloqueio 656**
   - Remover a liberação manual para bloqueios obrigatórios da NFC-e.
   - Manter a próxima consulta desabilitada até o horário informado pela SEFAZ, sem permitir que novas tentativas renovem a espera.
   - Exibir o 656 como bloqueio da consulta, não como uma sincronização concluída sem notas.

2. **Evitar múltiplas chamadas de descoberta em produção**
   - Substituir a tentativa automática de várias combinações SOAP por um único formato confirmado pela definição oficial do serviço.
   - Não repetir a consulta dentro da mesma ação quando a SEFAZ já devolver um código de negócio, especialmente 656.

3. **Dar visibilidade ao resultado real**
   - Mostrar separadamente: código da listagem, motivo da SEFAZ, formato SOAP usado, chaves encontradas, XMLs baixados, notas gravadas e notas ignoradas.
   - Se o retorno for 107, informar claramente que a SEFAZ não encontrou NFC-e no período; se houver chaves sem XML válido, mostrar o motivo do download.

4. **Validar após a janela obrigatória**
   - Aguardar o bloqueio atual expirar sem novas tentativas.
   - Fazer uma única consulta curta em produção.
   - Confirmar no banco se as chaves e os XMLs foram gravados e conferir que aparecem como NFC-e emitidas no período correspondente.

## Detalhes técnicos

- Áreas afetadas: sincronização NFC-e, ponte SAE-NFC-e e apresentação do estado no painel.
- O certificado continuará dinâmico e a validação TLS permanecerá obrigatória.
- Nenhuma alteração de estrutura do banco está prevista.
- Se a primeira consulta limpa retornar 107 em vez de chaves, o aplicativo estará funcionando e o próximo diagnóstico será cadastral/período na própria SEFAZ, sem mascarar esse retorno como sucesso genérico.
