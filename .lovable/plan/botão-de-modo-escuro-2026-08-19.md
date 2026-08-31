# Botão de modo escuro

Adicionar um botão de alternância claro/escuro, visível no cabeçalho do app e também na tela de login.

## Comportamento
- Botão com ícone (sol / lua) que alterna entre tema claro e escuro.
- A escolha é salva no navegador e reaplicada nas próximas visitas.
- Sem preferência salva, segue a preferência do sistema operacional.
- Aplicado sem "piscar" o tema errado ao carregar a página.

## Ajuste visual
As cores atuais de modo escuro são o padrão genérico (cinza-azulado). Serão ajustadas para a mesma identidade do app (azul petróleo + âmbar), mantendo contraste legível em tabelas, cartões de resumo, badges de NFe/NFCe e etiquetas Recebida/Emitida.

## Detalhes técnicos
- Novo hook/provider `src/hooks/use-theme.tsx`: estado `light | dark`, aplica/remove a classe `dark` em `document.documentElement`, persiste em `localStorage` (`nfe-theme`), fallback `prefers-color-scheme`. Leitura do storage dentro de `useEffect` para evitar mismatch de hidratação.
- Novo componente `src/components/ThemeToggle.tsx`: `Button variant="ghost" size="icon"` com `Sun`/`Moon` do lucide-react e `aria-label`.
- `src/routes/__root.tsx`: envolver a árvore com o provider do tema e incluir um pequeno script inline no `<head>` que aplica a classe antes da pintura.
- `src/components/AppHeader.tsx`: inserir `<ThemeToggle />` na área direita, antes do botão "Sair".
- `src/routes/index.tsx` (login): `<ThemeToggle />` no canto superior direito da tela.
- `src/styles.css`: revisar os valores do bloco `.dark` para a paleta do projeto (todas em oklch), sem alterar `:root`.
- Nenhuma mudança de banco de dados, autenticação ou lógica de notas.
