# Assistente de diagnóstico SOAP para administradores

## Objetivo

Criar uma área exclusiva para administradores colarem uma mensagem de erro e, opcionalmente, a requisição e a resposta SOAP. O aplicativo enviará uma versão higienizada desse material ao Lovable AI e apresentará uma explicação objetiva da causa provável, evidências encontradas e correções sugeridas.

## Experiência no aplicativo

1. Adicionar **Diagnóstico SOAP** à navegação administrativa e criar uma página própria.
2. Exibir campos separados para:
   - contexto ou etapa da operação;
   - mensagem de erro;
   - requisição SOAP (opcional);
   - resposta SOAP (opcional).
3. Disponibilizar a ação **Analisar erro**, com estado de processamento, preservação dos campos quando houver falha e mensagens claras para erros de configuração, créditos ou indisponibilidade.
4. Mostrar o resultado em seções fáceis de consultar: causa provável, indícios observados, correções em ordem de prioridade, verificações recomendadas e nível de confiança.
5. Permitir copiar o diagnóstico gerado. A análise será pontual: entradas e resultados não serão gravados no banco nem no navegador.

## Segurança e privacidade

- Validar no servidor que o usuário autenticado possui papel de administrador; ocultar a página no menu não será a única proteção.
- Limitar o tamanho dos campos e rejeitar entradas vazias ou excessivas antes de chamar o modelo.
- Remover ou mascarar antes do envio tokens, senhas, certificados/base64, cabeçalhos de autorização, cookies, chaves privadas, CNPJ/CPF e chaves de acesso fiscal.
- Manter a chave do Lovable AI somente no servidor e não registrar o conteúdo SOAP em logs.
- Informar na tela que a resposta é uma hipótese técnica e deve ser validada antes de alterar a integração ou publicar a ponte.

## Implementação técnica

- Criar uma função de servidor autenticada para a análise, reutilizando a verificação administrativa já existente com `has_role`.
- Adicionar os pacotes oficiais do AI SDK necessários e um helper server-only para o Lovable AI Gateway, incluindo propagação do identificador de execução.
- Usar o modelo obrigatório `openai/gpt-6-astra` pela Responses API, com raciocínio habilitado, `store: false`, streaming interno e saída estruturada validada.
- Construir o prompt para diagnóstico de SOAP/SEFAZ sem afirmar certeza quando os dados forem insuficientes e sem sugerir desativação de TLS.
- Tratar respostas 400/401/402/403 como falhas finais com a mensagem segura recebida; aplicar tentativas limitadas apenas para 429 e falhas temporárias 5xx.
- Criar a nova rota administrativa com metadados próprios e preservar o visual azul-petróleo/âmbar e o modo escuro atuais.

## Validação

- Confirmar que um administrador consegue analisar um erro SOAP e copiar o resultado.
- Confirmar que um usuário comum não consegue abrir a área nem chamar a função diretamente.
- Verificar que segredos e identificadores mascarados não chegam ao pedido enviado ao modelo.
- Testar entrada inválida, falta de créditos, falha do modelo e resposta bem-sucedida sem perder o texto preenchido.
- Executar lint e build completos e conferir a página em desktop e celular.
