-- PostgreSQL nao permite revogar colunas de um GRANT em nivel de tabela.
-- Troca o SELECT em nivel de tabela por um GRANT so nas colunas nao sensiveis.
REVOKE SELECT ON public.certificates FROM authenticated;
GRANT SELECT (id, user_id, file_name, subject_name, holder_cnpj, thumbprint, valid_from, valid_until, status, uploaded_at)
  ON public.certificates TO authenticated;
-- INSERT/UPDATE seguem em nivel de tabela (o envio grava as colunas cifradas),
-- protegidos pela RLS: cada usuario so escreve na propria linha.