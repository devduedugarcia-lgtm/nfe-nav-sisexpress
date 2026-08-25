# Corrigir "permission denied" — restaurar GRANTs do banco

## Diagnóstico (confirmado por consultas ao banco)

- **Nenhuma tabela pública tem GRANT** para `authenticated`, `anon` ou `service_role` — nem `certificates`, nem `invoices`, `profiles`, `sefaz_accounts` ou `user_roles`. Por isso o app recebe `permission denied for table certificates` (e receberia o mesmo erro nas outras telas).
- As políticas de acesso (RLS) estão corretas e o schema da tabela `certificates` está completo — só faltam os GRANTs.
- A visualização (preview) e o app publicado usam o mesmo banco: depois desta correção, o teste real funciona no preview, sem precisar publicar.
- Detalhe encontrado: a função de trigger `set_updated_at` está sem permissão de execução para usuários logados, o que quebraria atualizações (ex.: salvar CNPJ/UF, substituir certificado).

## Correção

**1. Migração no banco (uma única):**
- `invoices`: acesso total ao dono logado + service_role.
- `sefaz_accounts`: acesso total ao dono logado + service_role.
- `profiles`: leitura/edição para logados (policies limitam à própria linha/admin) + service_role.
- `user_roles`: leitura para logados (necessária para a verificação de admin) + service_role.
- `certificates`: acesso total ao dono logado + service_role, **mantendo as colunas secretas** (`pfx_ciphertext`, `password_ciphertext`) fora do alcance de leitura/escrita direta pelo app.
- Permissão de execução da função de trigger `set_updated_at` para usuários logados.
- Sem acesso anônimo: todas as policies exigem login, então nada muda para visitantes.

**2. Ajuste de código (1 função):**
- `uploadCertificate` em `src/lib/nfe.functions.ts`: o salvamento do certificado passa a usar o cliente administrativo no servidor (o usuário já está autenticado e a linha é sempre a dele). Isso mantém a proteção das colunas secretas sem quebrar o fluxo de **substituir** um certificado já enviado.

## Verificação após aplicar

- Reexecutar as consultas de permissões para confirmar os GRANTs.
- Testar no preview: enviar certificado, substituir, remover, salvar configuração fiscal e sincronizar.
- Avisar que as demais telas (dashboard, admin) também voltam a funcionar.

## Detalhes técnicos

- Erro exato do PostgREST sem GRANT: `permission denied for table <nome>` mesmo com RLS correta.
- REVOKE em nível de coluna (`SELECT`/`UPDATE` em `pfx_ciphertext`/`password_ciphertext`) preserva a regra de que o certificado cifrado nunca sai do servidor.
- `handle_new_user` (trigger de cadastro) e `has_role` já estão com permissões corretas — sem mudança.
