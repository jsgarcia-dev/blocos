# Fidelidade ao mock "C · Blocos"

## Como foi medido

A janela inteira do mock aprovado (`fidelidade/mock-janela-c.html`, a variação C exatamente
como foi mostrada) e o app no **mesmo estado** — mesmo documento, menu "/" aberto depois das
seções recolhíveis, alça sobre "Banco Alfa", as mesmas abas e a mesma lateral
(`npm run dev` com `?demo=mock`) — foram capturados pelo Google Chrome em modo headless, os dois
em **1180 × 700** pixels, e comparados **pixel a pixel** (`scripts/fidelidade/comparar.sh`).

A captura (`scripts/fidelidade/capturar.mjs`) usa o protocolo de depuração do Chrome em tempo
real: espera as fontes e o sinal de pronto do app, leva as animações ao estado final (o cursor
piscando fica no quadro inicial) e captura. O mock capturado assim é idêntico, pixel a pixel, ao
capturado pelo modo `--screenshot`. Esse modo antigo usa "tempo virtual" e, nele, a sombra
grande do menu "/" faz o Chrome desenhar o texto do menu em tons de cinza no app (no uso normal
isso não acontece). Por isso ele deixou de ser usado.

## Mudança pedida depois da aprovação (14/10)

O usuário preferiu o texto **direto no fundo pontilhado**, sem o cartão branco centralizado do
mock. A página branca (fundo, borda e sombra) saiu; a coluna de texto continua com a mesma largura
e o mesmo recuo. Os selos e o código ganharam um tom um pouco mais escuro para não sumirem no
fundo bege. Por isso, na área do documento o app agora difere do mock **de propósito**.

## Resultado

Comparação atual (sem o cartão branco):

| | |
| --- | --- |
| Pixels da janela | 826.000 |
| Área do documento | difere do mock de propósito (fundo bege em vez do cartão branco) |
| Fora do documento e do seletor de estilo: diferença maior que 40 | **0 pixels** |
| Fora do documento e do seletor de estilo: diferença maior que 10 | **1 pixel** (13 em 255, na borda do canto inferior direito) |

Comparação da versão com o cartão branco, igual ao mock (commit anterior a esta mudança):

| | |
| --- | --- |
| Pixels diferentes (mais de 40 em 255) | 219 (0,03 %) — **todos no seletor de estilo** (abaixo) |
| Fora do seletor: diferença maior que 40 | **0 pixels** |
| Fora do seletor: diferença maior que 10 | **1 pixel** |

A única área que difere, além do cartão, é **estado**, não desenho:

| Área | Mock | App | Motivo |
| --- | --- | --- | --- |
| Seletor de estilo | "Título 2" | "Texto" | o cursor está na linha "/", que é um parágrafo; o app mostra o estilo real |

O que sobra abaixo de 10 em 255 não se vê a olho nu: a sombra lateral da página fica até 7 em
255 mais escura nos últimos 20 px. No mock, o documento termina ali, apesar de a barra de status
do próprio mock dizer 1.284 palavras; no app, o documento tem de fato essas 1.284 palavras e
continua abaixo. Há também variações de até 5 em 255 em alguns ícones da barra de formatação.

Imagens: `fidelidade/mock-c-1180x700.png` (mock), `fidelidade/app-1180x700.png` (app atual, sem o cartão) e
`fidelidade/diferencas-1180x700.png` (pixels com diferença maior que 40 em vermelho).

## O que a comparação corrigiu

Primeira rodada (janela inteira): menu "/" com 2 linhas e 15 px de texto, 4 px abaixo da linha;
"+" de PASTAS escondido até passar o mouse; faixa bege do bloco sob o mouse (10 px para cada
lado, raio 8); alça 50 px à esquerda dessa faixa; espaçamento de 8 px entre abas; "x" da aba
ativa com 12 px e cinza; ponto e etiqueta "TXT" sem espaços extras; seta das seções com 15 px;
altura de linha 1,5 nos parágrafos; largura fixa de 96,84 px no seletor de estilo (a barra não
pula); ícones com os mesmos traços do mock; cantos de 14 px; cursor laranja de 2 px desenhado
como no mock; desfazer/refazer, negrito e contagens no mesmo estado do mock.

Segunda rodada (diferenças de suavização e frações de pixel):

- **Fontes**: os mesmos arquivos do mock (Bricolage Grotesque e IBM Plex Mono, licença OFL)
  ficam dentro do app, sem depender de pacotes ou da internet, e com as mesmas listas de fontes
  reserva do mock (um "·" ou "~" cai na mesma fonte reserva).
- **Menu "/"**: a lista não usa rolagem nativa (a área rolável fazia o texto perder a suavização
  colorida; o WebView2 do Windows, que é o Chromium, faria o mesmo). A roda do mouse e as setas
  rolam a lista pelo código. Altura exata de duas linhas: 103,375 px.
- **Textos em um só nó** ("Linha 42 · há 2 min", "~6 min de leitura", "100%"): o navegador não
  aplica o ajuste entre letras (kerning) entre pedaços de texto separados.
- **"— Equipe Sul"** a exatamente 8 px do nome, qualquer que seja a letra antes.
- Ícone do cartão "Continuar" sem encolher; sombra desse cartão sem corte na lateral; nomes de
  arquivo sem cortar a borda suavizada da última letra.
- Selo "2 itens" centralizado pelo layout (sem `transform`), com as bordas alinhadas aos pixels.
- Canto inferior direito: sem fundo repetido na área de trabalho (cada camada recortada clareava
  a borda arredondada); contorno de 1 px e sombra da janela do mock nos cantos.
