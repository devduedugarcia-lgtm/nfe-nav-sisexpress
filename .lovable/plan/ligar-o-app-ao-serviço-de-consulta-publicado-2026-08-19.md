# Ligar o app ao serviço de consulta publicado

O serviço Node.js já está no ar. Falta conectar o app a ele e validar a primeira
sincronização real com a SEFAZ.

## Etapas

1. **Guardar as credenciais do serviço**
   Abro o formulário seguro para você colar:
   - `SEFAZ_BRIDGE_URL` — endereço público do serviço (ex.: `https://sefaz-bridge.onrender.com`)
   - `SEFAZ_BRIDGE_TOKEN` — o mesmo token configurado no serviço (`BRIDGE_TOKEN`)

   Os valores ficam no cofre do backend; nunca vão para o código nem para o navegador.

2. **Teste de conexão no painel**
   Novo botão "Testar conexão" na configuração fiscal, consultando o `/health` do
   serviço. Mostra se o serviço responde, se o certificado foi carregado e sua validade.
   Assim separamos "problema de token/URL" de "problema de certificado".

3. **Primeira sincronização real**
   Cadastro de CNPJ + UF + ambiente e execução de "Sincronizar com SEFAZ" no modo
   SEFAZ real, começando do NSU 0. Verifico o retorno da SEFAZ (137/138/656),
   quantas notas entraram e se entrada/saída ficou correta em relação ao seu CNPJ.

4. **Ajustes de robustez conforme o retorno**
   - Paginação por NSU: repetir a consulta enquanto houver documentos pendentes,
     com limite por execução para não cair em consumo indevido (656).
   - Mensagens claras no painel para 137 (nada novo), 656 (aguardar 1 hora) e rejeições.
   - Etiqueta "demo" nas notas simuladas, para não misturar com as reais.

## O que preciso de você

- URL pública e token do serviço (no formulário seguro da etapa 1).
- CNPJ e UF da empresa, e se começamos em **homologação** ou **produção**.

Se a SEFAZ recusar (certificado sem permissão, CNPJ não autorizado), o painel
continua utilizável no modo Demonstração enquanto resolvemos.

## Detalhes técnicos

- `sefaz.server.ts` ganha `checkBridgeHealth()`, que consome `GET /health` com o
  Bearer token e devolve só um resumo seguro ao cliente.
- Nova server function autenticada `testSefazBridge`, usada pelo botão de teste.
- `syncSefaz` passa a paginar por NSU com teto de páginas por execução, gravando
  `ult_nsu` a cada página para não reprocessar em caso de falha no meio.