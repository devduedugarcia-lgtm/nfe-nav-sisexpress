# Fiscal Friend

# Gestor de Notas Fiscais




## Objetivo




Aplicação para importar, listar e baixar notas fiscais NFe/NFCe, com autenticação, upload de certificado digital e controle de usuários com aprovação.




## Telas




### Autenticação




**Rota:** `/`




**Objetivo:** Autenticar usuário ou criar nova conta.




**Componentes:**




- **Input Email**

- **Input Senha**

- **Botão Entrar**: Autentica o usuário e redireciona para o painel principal ou para a tela de pendência conforme o status da conta.

- **Link Criar Conta**: Exibe o formulário de registro.

- **Input Confirmar Senha**

- **Botão Registrar**: Cria uma nova conta no sistema e redireciona para a tela de pendência.

- **Texto Demo Admin**




### Aguardando Aprovação




**Rota:** `/pending-approval`




**Objetivo:** Informar que a conta do usuário está pendente de aprovação.




**Componentes:**




- **Texto Aguardando Aprovação**

- **Botão Sair**: Faz logout e redireciona para a tela de autenticação.




### Painel Principal




**Rota:** `/dashboard`




**Objetivo:** Listar e gerenciar notas fiscais com resumos, filtros, busca e ações.




**Componentes:**




- **Cards de Resumo**

- **Filtros de Período**

- **Filtros de Tipo e Direção**

- **Campo de Busca**

- **Botão Buscar**: Simula busca no SEFAZ e carrega notas mockadas na tabela.

- **Tabela de Notas**

- **Botão Detalhe da Nota**: Abre modal com informações completas da nota selecionada.

- **Botão Download XML**: Baixa o arquivo XML mockado da nota selecionada.

- **Botão Exportar ZIP**: Gera e baixa um arquivo ZIP com os XMLs das notas visíveis no filtro.

- **Botão Limpar Tudo**: Exibe confirmação e limpa todos os dados do painel.




### Upload Certificado




**Rota:** `/certificate`




**Objetivo:** Permitir o upload do certificado digital .pfx/.p12.




**Componentes:**




- **Input Selecionar Arquivo**

- **Input Senha do Certificado**

- **Botão Enviar**: Simula o upload e armazena o certificado mockado no servidor.

- **Texto Status**




### Administrar Usuários




**Rota:** `/admin/users`




**Objetivo:** Gerenciar aprovação de novos usuários.




**Componentes:**




- **Tabela de Usuários**

- **Botão Aprovar**: Aprova o usuário selecionado, permitindo acesso ao sistema.

- **Botão Recusar**: Recusa o usuário selecionado.

- **Botão Sair**: Faz logout e redireciona para a tela de autenticação.




## Personas




### Administrador




Administrador do sistema com permissões para aprovar ou recusar novos usuários, visualizar todas as notas fiscais exportadas, gerenciar certificados digitais e realizar buscas avançadas.




**User Stories:**




- Como Administrador, eu quero Aprovar ou recusar novos usuários para controlar quem tem acesso ao sistema

- Como Administrador, eu quero Visualizar o resumo de notas fiscais para ter uma visão geral do faturamento

- Como Administrador, eu quero Exportar XMLs em lote para enviar ao contador

- Como Administrador, eu quero Gerenciar certificados digitais de todos os usuários para garantir validade das consultas




### Usuário




Usuário regular que utiliza o sistema para importar, buscar e baixar notas fiscais. Pode fazer upload do seu próprio certificado digital e visualizar seus dados.




**User Stories:**




- Como Usuário, eu quero Fazer upload do certificado digital para autenticar as buscas na SEFAZ

- Como Usuário, eu quero Buscar notas fiscais por período e tipo para encontrar rapidamente as informações necessárias

- Como Usuário, eu quero Baixar XMLs individuais ou em lote para arquivamento ou contabilidade

- Como Usuário, eu quero Ver detalhes completos de uma nota fiscal para conferir dados fiscais




### Usuário Pendente




Usuário que criou uma conta, mas ainda não foi aprovado pelo administrador. Não tem acesso às funcionalidades do sistema.




**User Stories:**




- Como Usuário Pendente, eu quero Visualizar mensagem de conta pendente para saber que preciso aguardar aprovação

- Como Usuário Pendente, eu quero Sair da conta para tentar novamente mais tarde ou criar outra conta

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nfe-nav-sisexpress.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7667e139-03f3-4ad2-8e01-b768b0b4e210).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
