# Teste real da conexão SEFAZ (mTLS + paginação por NSU)

Antes de rodar o teste, verifiquei o estado atual do projeto:

- Os segredos `SEFAZ_BRIDGE_URL` e `SEFAZ_BRIDGE_TOKEN` **não estão cadastrados** (o cofre só tem a chave interna de IA).
- A tabela de configuração fiscal (`sefaz_accounts`) está **vazia** — nenhum CNPJ/UF/ambiente cadastrado.

Sem esses dois itens o modo "SEFAZ real" não tem como sair do estado
"integração não configurada", então o teste ponta a ponta começa por eles.

## Etapas

1. **Guardar as credenciais do serviço publicado**
   Abro o formulário seguro para você colar a URL pública do serviço e o token
   (`BRIDGE_TOKEN` configurado nele). Os valores ficam só no cofre do backend.

2. **Testar conexão**
   Uso o botão "Testar conexão" já existente (consulta `/health` do serviço) e
   confirmo: serviço acessível, token aceito, certificado carregado e validade.
   Isso separa "problema de URL/token" de "problema de certificado" antes de
   incomodar a SEFAZ.

3. **Cadastrar a conta fiscal**
   CNPJ, UF e ambiente (homologação ou produção), com `ult_nsu` em 0.

4. **Sincronizar um lote pequeno**
   Executo "Sincronizar com SEFAZ" no modo real e verifico no banco:
   - retorno da SEFAZ (`cStat` 138 documentos / 137 nada novo / 656 consumo indevido);
   - quantas notas entraram, com `source = 'sefaz'` e `nsu` preenchido;
   - se `ult_nsu` avançou e a paginação parou no teto de páginas por execução;
   - se entrada/saída ficou correta comparando o CNPJ do emitente com o seu.

5. **Relatório e ajustes**
   Devolvo o resultado observado (código da SEFAZ, notas gravadas, NSU final).
   Se aparecer erro de certificado, CNPJ sem autorização ou 656, corrijo as
   mensagens do painel e a estratégia de paginação conforme o retorno real.

## O que preciso de você

- URL pública e token do serviço (etapa 1).
- CNPJ, UF e se começamos em **homologação** ou **produção**.

Atenção: em homologação a SEFAZ normalmente não devolve notas reais, então o
resultado esperado ali é `137` (nada novo) — o que já valida mTLS e o caminho
completo. Para ver notas de verdade o teste precisa rodar em produção.

## Detalhes técnicos

- Verificação via a função autenticada `testSefazBridge` (`checkBridgeHealth`).
- `syncSefaz` já pagina por NSU com teto de páginas por execução e grava o
  cursor a cada página; confiro isso na prática pelos valores de `ult_nsu`.
- Conferência dos resultados por consulta ao banco (`invoices`, `sefaz_accounts`),
  sem expor tokens ou dados do certificado em nenhuma tela ou log.
