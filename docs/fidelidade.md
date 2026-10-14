# Fidelidade ao mock "C · Blocos"

## Como foi medido

A janela inteira do mock aprovado (`fidelidade/mock-janela-c.html`, a variação C exatamente
como foi mostrada) e o app no **mesmo estado** — mesmo documento, menu "/" aberto depois das
seções recolhíveis, alça sobre "Banco Alfa", as mesmas abas e a mesma lateral
(`npm run dev` com `?demo=mock`) — foram capturados pelo Google Chrome em modo headless, os dois
em **1180 × 700** pixels, e comparados **pixel a pixel** (`scripts/fidelidade/comparar.sh`).

## Resultado

| | |
| --- | --- |
| Pixels da janela | 826.000 |
| Pixels diferentes | 1.178 (0,14 %) |
| Diferenças fora das 6 áreas abaixo | **8 pixels (0,001 %)** — suavização de borda de letras |

As 6 áreas que diferem são **estado ou dados**, não desenho:

| Área | Mock | App | Motivo |
| --- | --- | --- | --- |
| Botão refazer | ativo | inativo | não há o que refazer |
| Seletor de estilo | "Título 2" | "Texto" | o cursor está na linha "/", que é um parágrafo |
| Botão negrito | aceso | apagado | estado da seleção |
| Selo de registros | "18 registros" | "17 registros" | o próprio mock mostra 3 + 2 + 12 = 17 itens; o app conta de verdade |
| Cursor depois do "/" | barra desenhada de 2 px | cursor de texto do sistema | cursor nativo |
| Barra de status | "1.284 palavras · ~6 min" | contagem real | dados |

Imagens: `fidelidade/mock-c-1180x700.png` (mock), `fidelidade/app-1180x700.png` (app) e
`fidelidade/diferencas-1180x700.png` (pixels diferentes em vermelho).

## O que a comparação corrigiu

A comparação da janela inteira encontrou e corrigiu: menu "/" com 2 linhas e 15 px de texto,
4 px abaixo da linha; "+" de PASTAS escondido até passar o mouse; faixa bege do bloco sob o
mouse (10 px para cada lado, raio 8); alça 50 px à esquerda dessa faixa; espaçamento de 8 px
entre abas; "x" da aba ativa com 12 px e cinza; ponto e etiqueta "TXT" sem espaços extras;
seta das seções com 15 px; trecho "— Equipe…" a 8 px do nome; altura de linha 1,5 nos parágrafos;
largura fixa de 96,84 px no seletor de estilo (a barra não pula); fonte com eixo de tamanho
óptico; ícones com os mesmos traços do mock; cantos de 14 px.
