# Blocos

Editor de notas moderno para **.md** e **.txt**, feito com **Tauri 2** (Rust) + React + TipTap.
Roda no Linux e no Windows.

![Blocos](assets/icon.svg)

## O que ele faz

- **Abas** em formato de pílula, com ponto laranja quando há algo não salvo e etiqueta `TXT` para texto puro.
- **Reabre tudo como você deixou**: abas, aba ativa, posição do cursor e rolagem — inclusive abas novas que nunca foram salvas.
- **Salva sozinho** logo depois que você para de digitar (dá para desligar nas Preferências).
- **Formatação** em `.md`: títulos, negrito, itálico, sublinhado, tachado, cor do texto, **destaque colorido**, listas, lista de tarefas, links, tabelas, imagens, citação, código, divisor.
- **Digite `/`** para inserir blocos: tabela, lista de tarefas, **seção recolhível**, **caixa de destaque**, títulos…
- **Alça à esquerda de cada bloco**: `+` adiciona um bloco abaixo, `⋮⋮` arrasta o bloco para outro lugar (uma linha laranja mostra onde ele vai entrar; Esc cancela).
- **Seções recolhíveis** com contador de itens — ótimo para grupos de registros.
- **Selos abaixo do título** (H1): quando foi editado, quantos grupos e quantos registros.
- **Lateral**: busca em tudo, "Continuar de onde parou", fixados, recentes e pastas.
- **Busca geral (Ctrl+P)** nos nomes e no conteúdo de todos os `.md`/`.txt` das suas pastas (ignora acentos).
- **Localizar e substituir (Ctrl+F / Ctrl+H)**.
- **Texto puro (.txt)** fica texto puro, com botão **Converter para .md** (cria um `.md` ao lado e mantém o `.txt`).
- **Não reescreve o que você não mexeu**: ao salvar um `.md`, cada bloco que você não editou é gravado exatamente como estava no arquivo (mesmos marcadores de lista, linhas em branco, espaços, definições de link). Só os blocos editados são reescritos.
- **Preserva o arquivo**: codificação (UTF-8, UTF-8 com BOM, Windows-1252/Latin-1, UTF-16) e quebras de linha (LF/CRLF).
- **Nunca grava por cima de mudanças de fora**: se o arquivo mudar no disco enquanto está aberto (Dropbox, Syncthing, outro programa), o salvamento automático para e um aviso pergunta qual versão manter.
- **Cópia de segurança**: antes de sobrescrever um arquivo pela primeira vez em cada sessão, a versão anterior vai para a pasta de backups (guardada por 30 dias).
- **Percebe mudanças feitas fora do app** e recarrega (ou pergunta, se você também mudou).
- **Exportar** como HTML e **imprimir/salvar PDF**.
- Tema **claro**, **escuro** ou do sistema; zoom do texto.
- **Fonte do app inteiro** à escolha: as que vêm com o Blocos (Bricolage Grotesque, Inter, Atkinson Hyperlegible Next, Literata, JetBrains Mono), a fonte do sistema ou qualquer fonte instalada no computador.
- Editor ajustável nas Preferências: texto **à esquerda** ou **centralizado**, largura da coluna, margens do topo e das laterais em pixels, espaço entre linhas e entre letras, e fundo **pontilhado**, **cruzes**, **grade técnica**, **isométrico**, **relevo**, **fluxo**, **aurora**, **papel**, **colmeia**, **liso**, de **cor** própria (o texto clareia sozinho em fundo escuro) ou uma **imagem** sua com véu ajustável.
- Abre arquivos com **dois cliques** no gerenciador de arquivos; um segundo arquivo abre como nova aba na mesma janela.

## Como o Markdown é gravado

| No editor | No arquivo `.md` |
| --- | --- |
| Destaque amarelo | `==texto==` |
| Destaque de outra cor | `<mark style="background-color: #C3F0C8">texto</mark>` |
| Cor do texto | `<span style="color: #E5484D">texto</span>` |
| Sublinhado | `<u>texto</u>` |
| Caixa de destaque | `> [!NOTE]` (alerta do GitHub) |
| Seção recolhível | `<details><summary>…</summary> … </details>` |
| Lista de tarefas | `- [ ] item` / `- [x] item` |
| Quebra de linha simples | uma quebra de linha comum |

Tudo continua legível em qualquer editor de texto, no GitHub e no Obsidian.
Texto entre `< >` que não é uma dessas tags (ex.: `<nome do cliente>`, `<!-- nota -->`) aparece e é gravado como texto comum.

Fidelidade ao design aprovado: veja [docs/fidelidade.md](docs/fidelidade.md).

## Atalhos

| Atalho | Ação |
| --- | --- |
| Ctrl+T / Ctrl+N | Nova aba |
| Ctrl+O | Abrir arquivo |
| Ctrl+S / Ctrl+Shift+S | Salvar / Salvar como |
| Ctrl+W | Fechar aba |
| Ctrl+Shift+T | Reabrir aba fechada |
| Ctrl+Tab / Ctrl+Shift+Tab | Próxima / anterior aba |
| Ctrl+1…9 | Ir para a aba |
| Ctrl+P | Buscar em tudo |
| Ctrl+F / Ctrl+H | Localizar / Substituir |
| Ctrl+K | Link |
| Ctrl+B / I / U | Negrito / Itálico / Sublinhado |
| Ctrl+Shift+H | Destacar |
| Ctrl+Shift+P | Imprimir / PDF |
| Ctrl+= / Ctrl+- / Ctrl+0 | Zoom |
| Ctrl+\ | Mostrar/esconder a lateral |
| Ctrl+, | Preferências |

## Desenvolvimento

Pré-requisitos no Linux (Debian/Ubuntu/Mint):

```bash
sudo apt install libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libgtk-3-dev build-essential
```

E o Rust (https://rustup.rs) + Node.js 20+.

```bash
npm install
npm run tauri dev      # app em modo desenvolvimento
npm test               # testes do Markdown
cd src-tauri && cargo test   # testes do backend em Rust
npm run tauri build    # gera o binário e o pacote .deb
./scripts/instalar.sh  # instala para o seu usuário (~/.local) e define como app padrão
```

`npm run dev` sozinho abre a interface num navegador comum com arquivos de demonstração.

### Windows

O instalador para Windows (10/11, x64) é gerado aqui mesmo no Linux, sem `sudo`:

```bash
./scripts/build-windows.sh
```

Na primeira vez o script baixa o MinGW-w64 e o NSIS dos repositórios oficiais do
Ubuntu para `~/.local/opt/blocos-wintools`. O instalador sai em
`src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/Blocos_0.1.0_x64-setup.exe`.
Ele usa o WebView2 que já vem no Windows 10/11 (e instala sozinho se faltar).

Também dá para gerar no GitHub Actions (`.github/workflows/build.yml`).

## Onde ficam os dados do app

- Linux: `~/.local/share/br.blocos.editor/` (`sessao.json`, `biblioteca.json`, `backups/`, `imagens/`)
- Windows: `%APPDATA%\br.blocos.editor\`

Imagens coladas num documento salvo vão para a pasta `imagens/` ao lado do arquivo.

## Fontes e licenças

As fontes que vêm com o Blocos (`src/assets/fonts/`) são livres, sob a
[SIL Open Font License 1.1](https://openfontlicense.org); o texto da licença de cada uma
está em `src/assets/fonts/licencas/`:

- Bricolage Grotesque — The Bricolage Grotesque Project Authors
- IBM Plex Mono — IBM Corp.
- Inter — The Inter Project Authors
- Atkinson Hyperlegible Next — The Atkinson Hyperlegible Next Project Authors
- Literata — The Literata Project Authors
- JetBrains Mono — The JetBrains Mono Project Authors
