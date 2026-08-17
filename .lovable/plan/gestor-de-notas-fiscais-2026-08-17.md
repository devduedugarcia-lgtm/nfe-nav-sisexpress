# Gestor de Notas Fiscais

App para importar, listar e baixar notas fiscais NFe/NFCe, com login, aprovação de contas, upload de certificado digital e exportação de XMLs.

## Backend (Lovable Cloud)

Ativar o Lovable Cloud para contas, aprovação e persistência.

Tabelas:
- `profiles`: id (= usuário), email, nome, `status` (`pending` / `approved` / `rejected`), criado_em. Criada automaticamente no cadastro por trigger.
- `user_roles`: papéis (`admin`, `user`) em tabela separada, com função `has_role` para checagem segura.
- `invoices`: notas por usuário — chave, número, série, tipo (NFe/NFCe), direção (entrada/saída), emitente, destinatário, CNPJ, data de emissão, valor, status, XML.
- `certificates`: certificado por usuário — nome do arquivo, validade simulada, data de envio (senha nunca armazenada em texto).

Regras de acesso: cada usuário só lê/escreve seus próprios dados; admin vê tudo. Cadastro entra direto (sem confirmação de e-mail) e a conta nasce `pending`.

## Telas

**`/` — Autenticação**
E-mail, senha, botão Entrar, link Criar conta (com Confirmar senha) e texto com as credenciais do admin demo. Após entrar: `approved` → `/dashboard`; `pending`/`rejected` → `/pending-approval`. Se já logado, redireciona automaticamente.

**`/pending-approval`**
Mensagem de conta aguardando aprovação e botão Sair.

**`/dashboard`** (só aprovados)
- Cards de resumo: total de notas, valor total, entradas, saídas.
- Filtros de período (mês atual, últimos 30/90 dias, ano, personalizado), tipo (NFe/NFCe) e direção (entrada/saída).
- Campo de busca + botão Buscar: simula consulta ao SEFAZ e grava notas simuladas no banco do usuário (persistem entre sessões).
- Tabela de notas com número, tipo, emitente, data, valor, status.
- Botão de detalhe: modal com dados fiscais completos.
- Download XML individual e Exportar ZIP com os XMLs das notas filtradas.
- Limpar tudo: confirmação e remoção das notas do usuário.

**`/certificate`**
Seleção de arquivo `.pfx`/`.p12`, senha do certificado, botão Enviar (upload simulado, registra nome/validade) e texto de status do certificado atual.

**`/admin/users`** (só admin)
Tabela de usuários com e-mail, data e status; botões Aprovar e Recusar; botão Sair. Acesso negado para não-admins.

Cabeçalho comum nas telas internas com navegação (Painel, Certificado, Usuários para admin) e sair.

## Detalhes técnicos

- Rotas protegidas sob `_authenticated/` (gate gerenciado); `/` e `/pending-approval` públicas.
- Leituras/escritas via `createServerFn` com `requireSupabaseAuth`; geração de notas simuladas e do ZIP no servidor (ZIP montado sem dependência nativa) e download via blob no cliente.
- Aprovar/recusar validam o papel de admin no servidor antes de escrever.
- Admin demo criado na migração com papel `admin` e status `approved`.
- Design próprio: tema claro sóbrio de gestão fiscal (azul-petróleo/âmbar), tokens semânticos no `src/styles.css`, tabelas densas e legíveis, sem gradiente roxo genérico.
- `head()` com título/descrição próprios em cada rota; textos em português.
