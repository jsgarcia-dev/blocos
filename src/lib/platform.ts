/**
 * Ponte com o sistema. Dentro do Tauri usa os comandos Rust; num navegador
 * comum (desenvolvimento/visualização) usa um sistema de arquivos em memória.
 */
import { createMockPlatform } from "./platform-mock";

export interface FileData {
  content: string;
  encoding: string;
  lineEnding: "lf" | "crlf";
  mtime: number;
  size: number;
  /** Algum byte não pôde ser lido e foi trocado por "�". */
  lossy?: boolean;
}

export interface FileStat {
  mtime: number;
  size: number;
  encoding: string;
}

export interface FolderEntry {
  path: string;
  name: string;
  isDir: boolean;
  children: FolderEntry[];
  count: number;
}

export interface SearchHit {
  path: string;
  name: string;
  nameMatch: boolean;
  line: number | null;
  snippet: string | null;
}

export interface AppDirs {
  documents: string | null;
  home: string | null;
  data: string;
}

export interface DialogFilter {
  name: string;
  extensions: string[];
}

export interface Platform {
  readonly native: boolean;
  readTextFile(path: string): Promise<FileData>;
  /** Com `expectedMtime`, recusa gravar (erro "CONFLITO…") se o arquivo mudou ou sumiu desde então. */
  writeTextFile(path: string, content: string, encoding: string, lineEnding: string, expectedMtime?: number | null): Promise<FileStat>;
  fileStat(path: string): Promise<FileStat | null>;
  listFolder(path: string): Promise<FolderEntry>;
  searchFiles(folders: string[], extraFiles: string[], query: string): Promise<SearchHit[]>;
  importImage(src: string, docPath: string | null): Promise<string>;
  saveImageBytes(bytes: Uint8Array, name: string, docPath: string | null): Promise<string>;
  loadState(name: string): Promise<string | null>;
  saveState(name: string, data: string): Promise<void>;
  takeLaunchPaths(): Promise<string[]>;
  appDirs(): Promise<AppDirs>;
  /** Famílias de fonte instaladas no computador, em ordem alfabética. */
  listSystemFonts(): Promise<string[]>;
  printPage(): Promise<void>;
  openFiles(filters?: DialogFilter[]): Promise<string[]>;
  openImage(): Promise<string | null>;
  pickFolder(): Promise<string | null>;
  saveDialog(defaultPath: string, filters: DialogFilter[]): Promise<string | null>;
  openUrl(url: string): Promise<void>;
  revealInDir(path: string): Promise<void>;
  assetUrl(path: string): string;
  onOpenPaths(cb: (paths: string[]) => void): Promise<() => void>;
  windowMinimize(): Promise<void>;
  windowToggleMaximize(): Promise<void>;
  windowClose(): Promise<void>;
  windowIsMaximized(): Promise<boolean>;
  onWindowResized(cb: () => void): Promise<() => void>;
  onWindowFocus(cb: () => void): Promise<() => void>;
  onCloseRequested(cb: () => Promise<void>): Promise<() => void>;
  setTitle(title: string): Promise<void>;
}

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function createTauriPlatform(): Promise<Platform> {
  const { invoke, convertFileSrc } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const dialog = await import("@tauri-apps/plugin-dialog");
  const opener = await import("@tauri-apps/plugin-opener");
  const win = getCurrentWindow();

  const toList = (r: string | string[] | null): string[] => (r == null ? [] : Array.isArray(r) ? r : [r]);

  return {
    native: true,
    readTextFile: (path) => invoke("read_text_file", { path }),
    writeTextFile: (path, content, encoding, lineEnding, expectedMtime = null) =>
      invoke("write_text_file", { path, content, encoding, lineEnding, expectedMtime }),
    fileStat: (path) => invoke("file_stat", { path }),
    listFolder: (path) => invoke("list_folder", { path }),
    searchFiles: (folders, extraFiles, query) => invoke("search_files", { folders, extraFiles, query }),
    importImage: (src, docPath) => invoke("import_image", { src, docPath }),
    saveImageBytes: (bytes, name, docPath) => invoke("save_image_bytes", { bytes: Array.from(bytes), name, docPath }),
    loadState: (name) => invoke("load_state", { name }),
    saveState: (name, data) => invoke("save_state", { name, data }),
    takeLaunchPaths: () => invoke("take_launch_paths"),
    appDirs: () => invoke("app_dirs"),
    listSystemFonts: () => invoke("list_system_fonts"),
    printPage: () => invoke("print_page"),
    openFiles: async (filters) =>
      toList(
        await dialog.open({
          multiple: true,
          directory: false,
          filters: filters ?? [
            { name: "Notas", extensions: ["md", "markdown", "txt"] },
            { name: "Todos os arquivos", extensions: ["*"] },
          ],
        }),
      ),
    openImage: async () => {
      const r = await dialog.open({
        multiple: false,
        directory: false,
        filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"] }],
      });
      return toList(r)[0] ?? null;
    },
    pickFolder: async () => toList(await dialog.open({ directory: true, multiple: false }))[0] ?? null,
    saveDialog: (defaultPath, filters) => dialog.save({ defaultPath, filters }),
    openUrl: (url) => opener.openUrl(url),
    revealInDir: (path) => opener.revealItemInDir(path),
    assetUrl: (path) => convertFileSrc(path),
    onOpenPaths: (cb) => listen<string[]>("open-paths", (e) => cb(e.payload)),
    windowMinimize: () => win.minimize(),
    windowToggleMaximize: () => win.toggleMaximize(),
    windowClose: () => win.close(),
    windowIsMaximized: () => win.isMaximized(),
    onWindowResized: (cb) => win.onResized(() => cb()),
    onWindowFocus: (cb) => win.onFocusChanged(({ payload }) => payload && cb()),
    onCloseRequested: (cb) =>
      win.onCloseRequested(async () => {
        await cb();
      }),
    setTitle: (title) => win.setTitle(title),
  };
}

let current: Platform | null = null;

export async function initPlatform(): Promise<Platform> {
  if (!current) current = isTauri ? await createTauriPlatform() : createMockPlatform();
  return current;
}

/** Plataforma já inicializada (chamar depois de `initPlatform`). */
export function platform(): Platform {
  if (!current) throw new Error("Plataforma não inicializada");
  return current;
}
