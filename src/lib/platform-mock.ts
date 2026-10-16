/**
 * Plataforma de demonstração para rodar a interface num navegador comum
 * (sem Tauri). Guarda tudo no localStorage. Não é usada no app instalado.
 */
import type { FileData, FolderEntry, Platform, SearchHit } from "./platform";
import { basename, dirname } from "./paths";

const HOME = "/home/voce";
const DOCS = `${HOME}/Documentos`;
const WORK = `${HOME}/Trabalho`;

const CONTROLE = `# Controle de clientes

## Banco Alfa — Equipe Norte

- \`AB1\` Ana Ribeiro · (11) 90000-0001 · ==conferir documento==
- \`AB2\` Bruno Matos · (11) 90000-0002
- \`AB3\` Carla Nunes · (21) 90000-0003 · <mark style="background-color: #C3F0C8">ok</mark>

<details>
<summary>Banco Beta — Equipe Sul</summary>

- \`AC1\` Diego Prado · (31) 90000-0004 · <mark style="background-color: #FFD1DC">pendente</mark>
- \`AC2\` Elisa Torres · (41) 90000-0005

</details>

<details>
<summary>Banco Gama — Equipe Leste</summary>

- \`AG1\` Fábio Lima · (51) 90000-0006
- \`AG2\` Gabriela Souza · (61) 90000-0007
- \`AG3\` Heitor Alves · (71) 90000-0008
- \`AG4\` Isabela Rocha · (81) 90000-0009
- \`AG5\` João Pedro Dias · (91) 90000-0010
- \`AG6\` Karina Melo · (11) 90000-0011
- \`AG7\` Lucas Martins · (21) 90000-0012
- \`AG8\` Marina Castro · (31) 90000-0013
- \`AG9\` Nicolas Freitas · (41) 90000-0014
- \`AG10\` Olívia Ramos · (51) 90000-0015
- \`AG11\` Paulo Henrique · (61) 90000-0016
- \`AG12\` Queila Nogueira · (71) 90000-0017

</details>

> [!NOTE]
> Tudo é salvo como .md. O arquivo continua legível em qualquer outro editor.

### Tarefas da semana

- [x] Atualizar cadastros do grupo Alfa
- [ ] Enviar relatório pelo [Portal do cliente](https://portal.exemplo.com)
- [ ] Revisar contatos sem telefone
`;

const SEED: Record<string, string> = {
  [`${DOCS}/Controle de clientes.md`]: CONTROLE,
  [`${DOCS}/Ideias.md`]: "# Ideias\n\n- Organizar os contatos por região\n- Criar um modelo para relatórios\n",
  [`${DOCS}/rascunho.txt`]: "[CONTA Y]\nAB1 - anotações soltas\nAB2 - ligar amanhã\n\nlembrar: revisar planilha\n",
  [`${DOCS}/Reunião 13-10.md`]: "# Reunião 13/10\n\n## Pauta\n\n1. Resultados do mês\n2. Próximos passos\n",
  [`${DOCS}/Lista de compras.md`]: "# Lista de compras\n\n- [ ] Café\n- [ ] Pão\n- [x] Frutas\n",
};
for (let i = 1; i <= 19; i++) SEED[`${DOCS}/Arquivo/nota-${String(i).padStart(2, "0")}.md`] = `# Nota ${i}\n`;
for (let i = 1; i <= 9; i++) SEED[`${WORK}/projeto-${i}.md`] = `# Projeto ${i}\n`;

/*
 * Modo "?demo=mock": reproduz exatamente o estado mostrado no mock aprovado
 * (usado só para comparar o visual pixel a pixel; nunca no app instalado).
 */
const DEMO = typeof location !== "undefined" && new URLSearchParams(location.search).get("demo") === "mock";

const DEMO_CONTROLE = `# Controle de clientes

## Banco Alfa — Equipe Norte

- \`AB1\` Ana Ribeiro · (11) 90000-0001 · ==conferir documento==
- \`AB2\` Bruno Matos · (11) 90000-0002
- \`AB3\` Carla Nunes · (21) 90000-0003 · <mark style="background-color: #C3F0C8">ok</mark>

<details>
<summary>Banco Beta — Equipe Sul</summary>

- \`AC1\` Diego Prado
- \`AC2\` Elisa Torres

</details>

<details>
<summary>Banco Gama — Equipe Leste</summary>

${Array.from({ length: 12 }, (_, i) => `- \`AG${i + 1}\` Registro ${i + 1}`).join("\n")}

</details>
`;

/** "Editado hoje, 09:42", como no mock. */
function todayAt(h: number, m: number) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

const SESSION_SEED = {
  version: 1,
  activePath: `${DOCS}/Controle de clientes.md`,
  tabs: [
    { path: `${DOCS}/Controle de clientes.md`, kind: "md" },
    { path: `${DOCS}/Ideias.md`, kind: "md" },
    { path: `${DOCS}/rascunho.txt`, kind: "txt" },
    {
      path: `${DOCS}/Reunião 13-10.md`,
      kind: "md",
      dirty: true,
      content: { type: "markdown", text: SEED[`${DOCS}/Reunião 13-10.md`] + "3. Dúvidas\n" },
    },
  ],
};

const LIBRARY_SEED = {
  version: 1,
  pinned: [`${DOCS}/Controle de clientes.md`, `${DOCS}/Ideias.md`],
  recents: [
    { path: `${DOCS}/rascunho.txt`, at: Date.now() - 3600e3 },
    { path: `${DOCS}/Reunião 13-10.md`, at: Date.now() - 7200e3 },
    { path: `${DOCS}/Lista de compras.md`, at: Date.now() - 86400e3 },
  ],
  folders: [DOCS, WORK],
  lastPosition: { path: `${DOCS}/Controle de clientes.md`, line: 42, at: Date.now() - 120e3 },
};

const FS_KEY = "blocos-demo-fs";

function loadFs(): Record<string, { content: string; mtime: number }> {
  if (DEMO) {
    const fs = Object.fromEntries(Object.entries(SEED).map(([p, c]) => [p, { content: c, mtime: Date.now() - 600e3 }]));
    fs[`${DOCS}/Controle de clientes.md`] = { content: DEMO_CONTROLE, mtime: todayAt(9, 42) };
    return fs;
  }
  try {
    const raw = localStorage.getItem(FS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* sem armazenamento */
  }
  const now = Date.now() - 600e3;
  const fs = Object.fromEntries(Object.entries(SEED).map(([p, c]) => [p, { content: c, mtime: now }]));
  if (DEMO) fs[`${DOCS}/Controle de clientes.md`] = { content: DEMO_CONTROLE, mtime: todayAt(9, 42) };
  return fs;
}

export function createMockPlatform(): Platform {
  const fs = loadFs();
  const persist = () => {
    if (DEMO) return;
    try {
      localStorage.setItem(FS_KEY, JSON.stringify(fs));
    } catch {
      /* ignora */
    }
  };

  const tree = (root: string): FolderEntry => {
    const files = Object.keys(fs).filter((p) => p.startsWith(root + "/"));
    const build = (dir: string): FolderEntry => {
      const direct = new Map<string, FolderEntry>();
      for (const f of files) {
        if (!f.startsWith(dir + "/")) continue;
        const rest = f.slice(dir.length + 1);
        const [first, ...more] = rest.split("/");
        const p = `${dir}/${first}`;
        if (more.length) {
          if (!direct.has(p)) direct.set(p, build(p));
        } else direct.set(p, { path: p, name: first, isDir: false, children: [], count: 0 });
      }
      const children = [...direct.values()].sort((a, b) =>
        a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
      );
      const count = files.filter((f) => f.startsWith(dir + "/")).length;
      return { path: dir, name: basename(dir), isDir: true, children, count };
    };
    return build(root);
  };

  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  return {
    native: false,
    async readTextFile(path): Promise<FileData> {
      const f = fs[path];
      if (!f) throw new Error(`Não foi possível abrir ${path}: arquivo não encontrado`);
      return { content: f.content, encoding: "utf-8", lineEnding: "lf", mtime: f.mtime, size: f.content.length };
    },
    async writeTextFile(path, content, _encoding, _lineEnding, expectedMtime) {
      if (expectedMtime != null && fs[path]?.mtime !== expectedMtime) {
        throw new Error("CONFLITO: o arquivo foi alterado fora do Blocos");
      }
      fs[path] = { content, mtime: Date.now() };
      persist();
      return { mtime: fs[path].mtime, size: content.length, encoding: "utf-8" };
    },
    async fileStat(path) {
      const f = fs[path];
      return f ? { mtime: f.mtime, size: f.content.length, encoding: "" } : null;
    },
    async listFolder(path) {
      return tree(path);
    },
    async searchFiles(folders, extraFiles, query): Promise<SearchHit[]> {
      const q = fold(query.trim());
      if (!q) return [];
      const hits: SearchHit[] = [];
      for (const [path, f] of Object.entries(fs)) {
        if (!folders.some((d) => path.startsWith(d + "/")) && !extraFiles.includes(path)) continue;
        const name = basename(path);
        const nameMatch = fold(name).includes(q);
        const lines = f.content.split("\n");
        const idx = lines.findIndex((l) => fold(l).includes(q));
        if (!nameMatch && idx < 0) continue;
        hits.push({ path, name, nameMatch, line: idx >= 0 ? idx + 1 : null, snippet: idx >= 0 ? lines[idx].trim() : null });
      }
      return hits.sort((a, b) => Number(b.nameMatch) - Number(a.nameMatch)).slice(0, 40);
    },
    async importImage(src) {
      return src;
    },
    async saveImageBytes(bytes, name) {
      const blob = new Blob([bytes as BlobPart]);
      return await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(blob);
        void name;
      });
    },
    async loadState(name) {
      if (DEMO && name === "biblioteca") {
        return JSON.stringify({ ...LIBRARY_SEED, prefs: { autosave: false }, lastPosition: { ...LIBRARY_SEED.lastPosition, at: Date.now() - 120e3 } });
      }
      if (DEMO && name === "sessao") return JSON.stringify(SESSION_SEED);
      try {
        const raw = localStorage.getItem(`blocos-demo-${name}`);
        if (raw) return raw;
      } catch {
        /* ignora */
      }
      if (name === "sessao") return JSON.stringify(SESSION_SEED);
      if (name === "biblioteca") return JSON.stringify(LIBRARY_SEED);
      return null;
    },
    async saveState(name, data) {
      if (DEMO) return;
      try {
        localStorage.setItem(`blocos-demo-${name}`, data);
      } catch {
        /* ignora */
      }
    },
    async takeLaunchPaths() {
      return [];
    },
    async appDirs() {
      return { documents: DOCS, home: HOME, data: `${HOME}/.local/share/blocos` };
    },
    async listSystemFonts() {
      // demonstração: fontes comuns que o navegador costuma ter
      return ["Arial", "Courier New", "DejaVu Sans", "Georgia", "Liberation Serif", "Noto Sans", "Times New Roman", "Ubuntu", "Verdana"];
    },
    async printPage() {
      window.print();
    },
    async openFiles() {
      const p = window.prompt("Caminho do arquivo (demonstração):", `${DOCS}/Ideias.md`);
      return p ? [p] : [];
    },
    async openImage() {
      return window.prompt("URL da imagem (demonstração):", "https://picsum.photos/640/320");
    },
    async pickFolder() {
      return window.prompt("Pasta (demonstração):", WORK);
    },
    async saveDialog(defaultPath) {
      return window.prompt("Salvar como (demonstração):", defaultPath);
    },
    async openUrl(url) {
      window.open(url, "_blank");
    },
    async revealInDir(path) {
      alert(`Mostrar na pasta: ${dirname(path)}`);
    },
    assetUrl: (path) => path,
    async onOpenPaths() {
      return () => {};
    },
    async windowMinimize() {},
    async windowToggleMaximize() {},
    async windowClose() {},
    async windowIsMaximized() {
      return false;
    },
    async onWindowResized() {
      return () => {};
    },
    async onWindowFocus(cb) {
      window.addEventListener("focus", cb);
      return () => window.removeEventListener("focus", cb);
    },
    async onCloseRequested(cb) {
      const h = () => void cb();
      window.addEventListener("beforeunload", h);
      return () => window.removeEventListener("beforeunload", h);
    },
    async setTitle(title) {
      document.title = title;
    },
  };
}
