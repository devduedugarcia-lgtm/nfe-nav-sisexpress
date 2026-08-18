# Painel: nova lista de notas + ZIP por pastas

## 1. Lista de dados (visual como na referência)

Reorganizar a tabela para leitura rápida, mantendo as cores atuais do tema:

- Cabeçalhos em caixa alta, menores e em cinza, com linha separadora sutil.
- Colunas: `Número` · `Chave de acesso` · `Emitente` · `Destinatário` · `Data` · `Valor` · `Tipo` · `Status` · ação.
- Chave de acesso em fonte monoespaçada, quebrada em duas linhas, em tom suave (deixa de ficar escondida no modal).
- Data com dia e hora (`11/08/2026, 16:08`) em cinza.
- Valor alinhado à direita, com destaque de peso.
- `Tipo` como etiqueta contornada: NFe em azul, NFCe em âmbar.
- `Status` substituído por direção com ícone: seta para baixo âmbar "Recebida" (entrada) e seta para cima azul "Emitida" (saída); situação cancelada aparece como etiqueta vermelha ao lado.
- Linhas mais altas, hover leve, clique na linha abre o detalhe (o ícone de olho sai, sobra só o de download à direita).
- Cabeçalho da tabela fixo ao rolar; no mobile, as colunas de chave e destinatário são ocultadas.
- Barra acima da tabela: campo de busca com ícone de lupa ocupando a largura, e os seletores de tipo e direção ao lado — o bloco de filtros de período/botão SEFAZ fica separado acima, como na referência.

## 2. Exportação ZIP separada por pastas

O ZIP passa a ter a estrutura:

```text
notas-fiscais-2026-07-19-a-2026-08-18.zip
├── entradas/
│   ├── NFe-31960-2808585376601031...xml
│   └── ...
└── saidas/
    ├── NFCe-53697-0943009562947346...xml
    └── ...
```

Cada nota é gravada na pasta conforme a direção; se um dos lados não tiver notas, a pasta simplesmente não aparece. O contador do toast continua mostrando o total, agora com a quebra entre entradas e saídas.

## Detalhes técnicos

- `src/routes/_authenticated/dashboard.tsx`: reestruturação da seção da tabela e da barra de filtros; novos subcomponentes `DocTypeBadge` e `DirectionCell`; nenhuma mudança na lógica de consulta.
- `src/lib/download.ts`: usar `formatDateTime` na coluna de data.
- `src/lib/nfe.functions.ts` (`exportInvoicesZip`): prefixar o nome do arquivo com `entradas/` ou `saidas/` e retornar `{ base64, count, inbound, outbound }`.
- `src/lib/nfe.server.ts`: o escritor de ZIP já aceita nomes com barra, sem alteração necessária.
- Tokens de cor existentes (`primary`, `warning`, `destructive`, `muted-foreground`) — sem cores fixas novas.
