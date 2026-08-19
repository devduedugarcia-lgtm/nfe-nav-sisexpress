# Conectar o app ao serviço publicado e testar a SEFAZ

O serviço já responde: `GET https://sefaz-bridge-a33m.onrender.com/health`
devolveu `200 {"ok":true}`. Ou seja, está no ar e o Render subiu o processo.

## Antes de tudo: as credenciais foram expostas no chat

Você colou o token da ponte e a senha do certificado direto na conversa. Isso
deixa esses valores registrados no histórico, então o certo é trocá-los:

1. No Render, gere um **novo** `BRIDGE_TOKEN` (string longa e aleatória) e
   atualize a variável de ambiente do serviço.
2. A senha do certificado A1 não pode ser trocada, mas ela só é útil junto com
   o arquivo `.pfx` — mantenha o `.pfx` fora de qualquer chat, e-mail ou
   repositório. Nunca vou pedir nem armazenar essa senha no app.
3. Depois disso, eu abro o formulário seguro e você cola lá a URL e o token
   novo — os valores vão direto para o cofre, sem passar pela conversa.

## Etapas

1. **Guardar URL e token no cofre**
   Formulário seguro para `SEFAZ_BRIDGE_URL` (`https://sefaz-bridge-a33m.onrender.com`)
   e `SEFAZ_BRIDGE_TOKEN` (o token novo).

2. **Testar conexão pelo painel**
   Botão "Testar conexão" (já existe) chama o `/health` com o Bearer token.
   Isso confirma que o token cadastrado no app é aceito pelo serviço.

3. **Cadastrar a conta fiscal**
   CNPJ, UF e ambiente, com `ult_nsu` em 0.

4. **Sincronizar um lote e conferir**
   Rodo "Sincronizar com SEFAZ" no modo real e verifico no banco:
   - código de retorno da SEFAZ (138 documentos / 137 nada novo / 656 consumo indevido);
   - notas gravadas com `source = 'sefaz'` e `nsu` preenchido;
   - avanço do `ult_nsu` e o comportamento da paginação;
   - entrada/saída correta comparando o CNPJ do emitente com o seu.

5. **Ajustes conforme o retorno real**
   Mensagens do painel e estratégia de paginação afinadas pelo que a SEFAZ
   devolver.

## O que preciso de você

- Token novo gerado no Render (para eu guardar no formulário seguro).
- **CNPJ**, **UF** e se começamos em **homologação** ou **produção**.

Observação: o `/health` atual só diz `{"ok":true}` — ele não informa se o
certificado foi carregado. Se você quiser, incluo no serviço um retorno com
titular e validade do certificado, para o teste de conexão distinguir
"token errado" de "certificado errado" antes de acionar a SEFAZ.
