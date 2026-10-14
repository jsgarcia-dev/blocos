import { initPlatform, platform } from "../lib/platform";
import { baselines, handles, pendingJumps } from "../lib/handles";
import { basename, dirname, joinPath, kindOf, stripExt } from "../lib/paths";
import { splitFrontmatter } from "../lib/markdown";
import { DEFAULT_PREFS, activeTab, askUser, getState, getTab, setState, toast, updateTab } from "./store";
import type { DocKind, InitialContent, Library, Tab } from "./types";

/* ---------------------------------------------------------------- abas */

let idSeq = 0;
const newId = () => `t${Date.now().toString(36)}${(idSeq++).toString(36)}`;

export function tabTitle(t: Pick<Tab, "path" | "untitledIndex">): string {
  if (t.path) return stripExt(basename(t.path));
  return t.untitledIndex <= 1 ? "Sem título" : `Sem título ${t.untitledIndex}`;
}

function nextUntitledIndex(): number {
  const used = new Set(getState().tabs.filter((t) => !t.path).map((t) => t.untitledIndex));
  let i = 1;
  while (used.has(i)) i++;
  return i;
}

function makeTab(p: Partial<Tab> & { kind: DocKind; initial: InitialContent }): Tab {
  return {
    id: newId(),
    path: null,
    untitledIndex: 0,
    dirty: false,
    status: "idle",
    error: null,
    encoding: "utf-8",
    lineEnding: "lf",
    mtime: 0,
    frontmatter: null,
    version: 0,
    selection: null,
    scrollTop: 0,
    lastEdited: null,
    externalChange: false,
    missing: false,
    lossy: false,
    stats: { words: 0, line: 1 },
    ...p,
  };
}

function contentFromFile(kind: DocKind, text: string): { initial: InitialContent; frontmatter: string | null } {
  if (kind === "txt") return { initial: { type: "text", text }, frontmatter: null };
  const { frontmatter, body } = splitFrontmatter(text);
  return { initial: { type: "markdown", text: body }, frontmatter };
}

const EMPTY_DOC: InitialContent = {
  type: "json",
  json: { type: "doc", content: [{ type: "heading", attrs: { level: 1 } }, { type: "paragraph" }] },
};

/** Aba sem arquivo e sem conteúdo (pode ser substituída ao abrir um arquivo). */
function isPristine(t: Tab | undefined): boolean {
  if (!t || t.path || t.dirty) return false;
  const h = handles.get(t.id);
  return !h || h.getText() === "";
}

export function newTab(kind: DocKind = "md") {
  const tab = makeTab({
    kind,
    untitledIndex: nextUntitledIndex(),
    initial: kind === "md" ? EMPTY_DOC : { type: "text", text: "" },
  });
  baselines.set(tab.id, "");
  setState((s) => ({ tabs: [...s.tabs, tab] }));
  activate(tab.id);
  schedulePersist();
}

export function activate(id: string) {
  const tab = getTab(id);
  if (!tab) return;
  setState({ activeId: id });
  updateWindowTitle();
  if (tab.path) setLastPosition(tab.path, tab.stats.line);
  requestAnimationFrame(() => handles.get(id)?.focus());
  schedulePersist();
}

export function cycleTab(dir: 1 | -1) {
  const { tabs, activeId } = getState();
  if (tabs.length < 2) return;
  const i = tabs.findIndex((t) => t.id === activeId);
  activate(tabs[(i + dir + tabs.length) % tabs.length].id);
}

export function activateIndex(i: number) {
  const { tabs } = getState();
  const t = i === 8 ? tabs[tabs.length - 1] : tabs[i];
  if (t) activate(t.id);
}

export function moveTab(fromId: string, toId: string) {
  setState((s) => {
    const tabs = [...s.tabs];
    const from = tabs.findIndex((t) => t.id === fromId);
    const to = tabs.findIndex((t) => t.id === toId);
    if (from < 0 || to < 0 || from === to) return {};
    const [t] = tabs.splice(from, 1);
    tabs.splice(to, 0, t);
    return { tabs };
  });
  schedulePersist();
}

export async function openPaths(paths: string[], opts: { line?: number; query?: string } = {}) {
  let lastId: string | null = null;
  const before = activeTab();
  for (const path of paths) {
    const existing = getState().tabs.find((t) => t.path === path);
    if (existing) {
      lastId = existing.id;
      touchRecent(path);
      continue;
    }
    try {
      const data = await platform().readTextFile(path);
      const kind = kindOf(path);
      const { initial, frontmatter } = contentFromFile(kind, data.content);
      const tab = makeTab({
        path,
        kind,
        initial,
        frontmatter,
        encoding: data.encoding,
        lineEnding: data.lineEnding,
        mtime: data.mtime,
        lossy: !!data.lossy,
      });
      setState((s) => ({ tabs: [...s.tabs, tab] }));
      lastId = tab.id;
      touchRecent(path);
    } catch (e) {
      toast(String(e), "erro");
    }
  }
  if (!lastId) return;
  if (isPristine(before) && before && before.id !== lastId) removeTab(before.id);
  if (opts.line || opts.query) {
    const h = handles.get(lastId);
    if (h) setTimeout(() => h.goToLine(opts.line ?? 1, opts.query), 30);
    else pendingJumps.set(lastId, { line: opts.line, query: opts.query });
  }
  activate(lastId);
}

export async function openWithDialog() {
  const paths = await platform().openFiles();
  if (paths.length) await openPaths(paths);
}

function removeTab(id: string) {
  const { tabs, activeId } = getState();
  const i = tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  const rest = tabs.filter((t) => t.id !== id);
  handles.delete(id);
  baselines.delete(id);
  const t = saveTimers.get(id);
  if (t) clearTimeout(t);
  saveTimers.delete(id);
  setState({ tabs: rest });
  if (activeId === id) {
    const next = rest[Math.min(i, rest.length - 1)];
    if (next) activate(next.id);
    else setState({ activeId: null });
  }
}

export async function closeTab(id: string): Promise<boolean> {
  const tab = getTab(id);
  if (!tab) return true;
  await flushTab(id);
  const fresh = getTab(id)!;
  const h = handles.get(id);
  const dirty = h ? h.getText() !== (baselines.get(id) ?? "") : fresh.dirty;
  if (dirty) {
    const choice = await askUser(
      "Salvar alterações?",
      `“${tabTitle(fresh)}” tem alterações que ainda não foram salvas em um arquivo.`,
      [
        { id: "cancel", label: "Cancelar", variant: "ghost" },
        { id: "discard", label: "Descartar", variant: "danger" },
        { id: "save", label: "Salvar", variant: "primary" },
      ],
    );
    if (choice === "cancel") return false;
    if (choice === "save" && !(await saveTab(id))) return false;
  }
  if (fresh.path) {
    setState((s) => ({
      closed: [{ path: fresh.path!, kind: fresh.kind }, ...s.closed.filter((c) => c.path !== fresh.path)].slice(0, 20),
    }));
  }
  removeTab(id);
  if (!getState().tabs.length) newTab();
  schedulePersist();
  return true;
}

export async function closeOthers(id: string) {
  for (const t of getState().tabs.filter((t) => t.id !== id)) {
    if (!(await closeTab(t.id))) return;
  }
}

export async function reopenClosed() {
  const [first, ...rest] = getState().closed;
  if (!first) return;
  setState({ closed: rest });
  await openPaths([first.path]);
}

/* ------------------------------------------------------------ salvar */

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const saveLocks = new Map<string, Promise<unknown>>();
const lastEditTouch = new Map<string, number>();

function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = saveLocks.get(id) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  saveLocks.set(
    id,
    next.catch(() => undefined),
  );
  return next;
}

function suggestedName(tab: Tab): string {
  const h = handles.get(tab.id);
  const text = h?.getText() ?? "";
  const first = text
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").replace(/[*_=`~<>[\]]/g, "").trim())
    .find(Boolean);
  const clean = (first ?? "").replace(/[\\/:*?"|]/g, "").slice(0, 60).trim();
  return clean || tabTitle(tab);
}

/**
 * Salva a aba. Por padrão só grava se o arquivo no disco ainda for a versão que
 * o app leu; `force` grava mesmo assim (depois que o usuário escolheu).
 */
export async function saveTab(id: string, opts: { as?: boolean; force?: boolean; auto?: boolean } = {}): Promise<boolean> {
  return withLock(id, async () => {
    const tab = getTab(id);
    const h = handles.get(id);
    if (!tab || !h) return false;
    let path = tab.path;
    const ext = tab.kind === "txt" ? "txt" : "md";
    if (!path || opts.as) {
      const base = path ? dirname(path) : (getState().documents ?? getState().home ?? "");
      const dest = await platform().saveDialog(
        joinPath(base, `${suggestedName(tab)}.${ext}`),
        [ext === "txt" ? { name: "Texto", extensions: ["txt"] } : { name: "Markdown", extensions: ["md", "markdown"] }],
      );
      if (!dest) return false;
      path = /\.(md|markdown|txt)$/i.test(dest) ? dest : `${dest}.${ext}`;
    }
    const samePath = path === tab.path;
    if (samePath && tab.lossy && !opts.force) {
      if (opts.auto) return false;
      const choice = await askUser(
        "Salvar este arquivo?",
        "Alguns caracteres deste arquivo não puderam ser lidos e aparecem como “�”. Salvar vai gravá-los assim.",
        [
          { id: "cancel", label: "Cancelar", variant: "ghost" },
          { id: "save", label: "Salvar mesmo assim", variant: "danger" },
        ],
      );
      if (choice !== "save") return false;
    }
    const expected = samePath && !opts.force && tab.mtime ? tab.mtime : null;
    const text = h.getText();
    updateTab(id, { status: "saving" });
    try {
      const stat = await platform().writeTextFile(path, text, tab.encoding, tab.lineEnding, expected);
      baselines.set(id, text);
      const stillSame = h.getText() === text;
      if (stat.encoding && tab.encoding !== stat.encoding && stat.encoding === "utf-8") {
        toast("Alguns caracteres não cabiam na codificação original — o arquivo foi salvo em UTF-8.");
      }
      updateTab(id, {
        path,
        mtime: stat.mtime,
        encoding: stat.encoding || tab.encoding,
        dirty: !stillSame,
        status: "saved",
        error: null,
        missing: false,
        externalChange: false,
        lossy: false,
        untitledIndex: 0,
      });
      touchRecent(path);
      if (getState().activeId === id) setLastPosition(path, getTab(id)?.stats.line ?? 1);
      updateWindowTitle();
      schedulePersist();
      return true;
    } catch (e) {
      const msg = String(e);
      if (msg.includes("CONFLITO")) {
        // o arquivo mudou (ou sumiu) fora do app: nada foi gravado; o usuário decide
        const gone = !(await platform().fileStat(path));
        updateTab(id, { status: "idle", externalChange: !gone, missing: gone });
        toast(gone ? `“${tabTitle(tab)}” não existe mais no disco.` : `“${tabTitle(tab)}” foi alterado fora do Blocos. Escolha qual versão manter.`, "erro");
        return false;
      }
      updateTab(id, { status: "error", error: msg });
      toast(msg, "erro");
      return false;
    }
  });
}

/** Chamado pelos editores a cada alteração do documento. */
export function notifyChange(id: string) {
  const tab = getTab(id);
  if (!tab) return;
  const now = Date.now();
  const last = lastEditTouch.get(id) ?? 0;
  if (!tab.dirty || now - last > 3000) {
    lastEditTouch.set(id, now);
    updateTab(id, { dirty: true, lastEdited: now, status: tab.status === "error" ? "error" : "idle" });
  }
  const prev = saveTimers.get(id);
  if (prev) clearTimeout(prev);
  saveTimers.set(
    id,
    setTimeout(() => {
      saveTimers.delete(id);
      void checkAndAutosave(id);
    }, 700),
  );
}

async function checkAndAutosave(id: string) {
  const tab = getTab(id);
  const h = handles.get(id);
  if (!tab || !h) return;
  const text = h.getText();
  const dirty = text !== (baselines.get(id) ?? "");
  if (!dirty) {
    if (tab.dirty) updateTab(id, { dirty: false });
  } else if (tab.path && getState().library.prefs.autosave && !tab.externalChange && !tab.missing && !tab.lossy) {
    await saveTab(id, { auto: true });
  } else if (!tab.dirty) {
    updateTab(id, { dirty: true });
  }
  schedulePersist();
}

/** Salva já o que estiver pendente numa aba. */
export async function flushTab(id: string) {
  const t = saveTimers.get(id);
  if (t) {
    clearTimeout(t);
    saveTimers.delete(id);
    await checkAndAutosave(id);
  }
  await (saveLocks.get(id) ?? Promise.resolve());
}

export async function flushAll() {
  for (const t of getState().tabs) await flushTab(t.id);
  await persistNow();
  await saveLibraryNow();
}

/* ------------------------------------------------ mudanças fora do app */

let checking = false;
export async function checkExternalChanges() {
  if (checking) return;
  checking = true;
  try {
    for (const tab of getState().tabs) {
      if (!tab.path) continue;
      const st = await platform().fileStat(tab.path);
      if (!st) {
        if (!tab.missing) updateTab(tab.id, { missing: true });
        continue;
      }
      if (tab.missing) updateTab(tab.id, { missing: false });
      if (st.mtime === tab.mtime || tab.externalChange) continue;
      await flushTab(tab.id);
      const h = handles.get(tab.id);
      const dirty = h ? h.getText() !== (baselines.get(tab.id) ?? "") : tab.dirty;
      if (!dirty) await reloadFromDisk(tab.id, true);
      else updateTab(tab.id, { externalChange: true });
    }
  } finally {
    checking = false;
  }
}

export async function reloadFromDisk(id: string, silent = false) {
  const tab = getTab(id);
  if (!tab?.path) return;
  try {
    const data = await platform().readTextFile(tab.path);
    const { initial, frontmatter } = contentFromFile(tab.kind, data.content);
    baselines.delete(id);
    const view = handles.get(id)?.getViewState();
    updateTab(id, {
      initial,
      frontmatter,
      encoding: data.encoding,
      lineEnding: data.lineEnding,
      mtime: data.mtime,
      version: tab.version + 1,
      dirty: false,
      externalChange: false,
      missing: false,
      lossy: !!data.lossy,
      selection: view?.selection ?? tab.selection,
      scrollTop: view?.scrollTop ?? tab.scrollTop,
    });
    if (!silent) toast(`“${tabTitle(tab)}” foi recarregado do disco.`);
    else toast(`“${tabTitle(tab)}” mudou fora do Blocos e foi atualizado.`);
  } catch (e) {
    toast(String(e), "erro");
  }
}

export async function keepMine(id: string) {
  const tab = getTab(id);
  if (!tab?.path) return;
  updateTab(id, { externalChange: false });
  await saveTab(id, { force: true });
}

/** Grava de novo um arquivo que foi apagado do disco (escolha do usuário). */
export async function saveAgain(id: string) {
  updateTab(id, { missing: false });
  await saveTab(id, { force: true });
}

/** Libera o salvamento de um arquivo lido com perdas (escolha do usuário). */
export async function saveLossyAnyway(id: string) {
  await saveTab(id, { force: true });
}

/* --------------------------------------------------------- conversões */

export async function convertTxtToMd(id: string) {
  const tab = getTab(id);
  const h = handles.get(id);
  if (!tab || !h || tab.kind !== "txt") return;
  await flushTab(id);
  const text = h.getText();
  let path: string | null = null;
  let mtime = 0;
  if (tab.path) {
    const base = stripExt(tab.path);
    path = `${base}.md`;
    for (let i = 2; await platform().fileStat(path); i++) path = `${base} (${i}).md`;
    try {
      const st = await platform().writeTextFile(path, text, "utf-8", tab.lineEnding);
      mtime = st.mtime;
    } catch (e) {
      toast(String(e), "erro");
      return;
    }
  }
  baselines.delete(id);
  updateTab(id, {
    kind: "md",
    path,
    mtime,
    encoding: "utf-8",
    initial: { type: "markdown", text },
    frontmatter: null,
    version: tab.version + 1,
    dirty: !path && text.length > 0,
  });
  if (path) {
    touchRecent(path);
    toast(`Criado “${basename(path)}”. O .txt original continua no mesmo lugar.`);
  }
  updateWindowTitle();
  schedulePersist();
}

export async function insertImageFromDialog() {
  const tab = activeTab();
  const editor = tab ? handles.get(tab.id)?.editor : undefined;
  if (!tab || !editor) return;
  const src = await platform().openImage();
  if (!src) return;
  try {
    const finalSrc = /^(https?:|data:)/.test(src) ? src : await platform().importImage(src, tab.path);
    editor.chain().focus().setImage({ src: finalSrc, alt: stripExt(basename(src)) }).run();
  } catch (e) {
    toast(String(e), "erro");
  }
}

/* --------------------------------------------------------- biblioteca */

function setLibrary(patch: Partial<Library> | ((l: Library) => Partial<Library>)) {
  setState((s) => ({ library: { ...s.library, ...(typeof patch === "function" ? patch(s.library) : patch) } }));
  scheduleLibrarySave();
}

export function touchRecent(path: string) {
  setLibrary((l) => ({ recents: [{ path, at: Date.now() }, ...l.recents.filter((r) => r.path !== path)].slice(0, 15) }));
}

export function forgetRecent(path: string) {
  setLibrary((l) => ({ recents: l.recents.filter((r) => r.path !== path) }));
}

export function togglePin(path: string) {
  setLibrary((l) => ({ pinned: l.pinned.includes(path) ? l.pinned.filter((p) => p !== path) : [...l.pinned, path] }));
}

export async function addFolder() {
  const dir = await platform().pickFolder();
  if (!dir) return;
  setLibrary((l) => ({ folders: l.folders.includes(dir) ? l.folders : [...l.folders, dir] }));
}

export function removeFolder(path: string) {
  setLibrary((l) => ({ folders: l.folders.filter((f) => f !== path) }));
}

let lastPosTimer: ReturnType<typeof setTimeout> | null = null;
export function setLastPosition(path: string, line: number) {
  if (lastPosTimer) clearTimeout(lastPosTimer);
  lastPosTimer = setTimeout(() => setLibrary({ lastPosition: { path, line, at: Date.now() } }), 400);
}

export function setPrefsAndSave(patch: Partial<Library["prefs"]>) {
  setLibrary((l) => ({ prefs: { ...l.prefs, ...patch } }));
}

let libTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleLibrarySave() {
  if (libTimer) clearTimeout(libTimer);
  libTimer = setTimeout(() => void saveLibraryNow(), 500);
}

async function saveLibraryNow() {
  if (libTimer) clearTimeout(libTimer);
  libTimer = null;
  if (!getState().ready) return;
  const { library } = getState();
  try {
    await platform().saveState("biblioteca", JSON.stringify({ version: 1, ...library }));
  } catch (e) {
    console.error(e);
  }
}

/* ------------------------------------------------------------ sessão */

let persistTimer: ReturnType<typeof setTimeout> | null = null;
export function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => void persistNow(), 1200);
}

interface SavedTab {
  path: string | null;
  kind: DocKind;
  untitledIndex?: number;
  dirty?: boolean;
  encoding?: string;
  lineEnding?: "lf" | "crlf";
  mtime?: number;
  frontmatter?: string | null;
  selection?: { anchor: number; head: number } | null;
  scrollTop?: number;
  lastEdited?: number | null;
  content?: InitialContent;
}

interface SavedSession {
  version: number;
  activeIndex?: number;
  activePath?: string;
  tabs: SavedTab[];
  closed?: { path: string; kind: DocKind }[];
}

export function sessionSnapshot(): SavedSession {
  const { tabs, activeId, closed } = getState();
  return {
    version: 1,
    activeIndex: Math.max(0, tabs.findIndex((t) => t.id === activeId)),
    closed,
    tabs: tabs.map((t): SavedTab => {
      const h = handles.get(t.id);
      const view = h?.getViewState();
      const keepContent = t.dirty || !t.path;
      return {
        path: t.path,
        kind: t.kind,
        untitledIndex: t.untitledIndex,
        dirty: t.dirty,
        encoding: t.encoding,
        lineEnding: t.lineEnding,
        mtime: t.mtime,
        frontmatter: t.frontmatter,
        selection: view?.selection ?? t.selection,
        scrollTop: view?.scrollTop ?? t.scrollTop,
        lastEdited: t.lastEdited,
        content: keepContent ? (h ? h.getSnapshot() : t.initial) : undefined,
      };
    }),
  };
}

export async function persistNow() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  if (!getState().ready) return;
  try {
    await platform().saveState("sessao", JSON.stringify(sessionSnapshot()));
  } catch (e) {
    console.error(e);
  }
}

function isEmptyContent(c: InitialContent | undefined): boolean {
  if (!c) return true;
  if (c.type === "text" || c.type === "markdown") return !c.text.trim();
  const json = c.json as { content?: { type?: string; content?: unknown[] }[] };
  // conta como conteúdo qualquer bloco que não seja parágrafo/título vazio (imagem, divisor, tabela…)
  return !json?.content?.some((n) => (n.content && n.content.length) || !["paragraph", "heading"].includes(n.type ?? ""));
}

async function restoreSession(raw: string | null): Promise<Tab[]> {
  if (!raw) return [];
  let saved: SavedSession;
  try {
    saved = JSON.parse(raw);
  } catch {
    return [];
  }
  const tabs: Tab[] = [];
  const missing: string[] = [];
  for (const s of saved.tabs ?? []) {
    const common = {
      kind: s.kind,
      encoding: s.encoding ?? "utf-8",
      lineEnding: s.lineEnding ?? "lf",
      frontmatter: s.frontmatter ?? null,
      selection: s.selection ?? null,
      scrollTop: s.scrollTop ?? 0,
      lastEdited: s.lastEdited ?? null,
    };
    if (s.path && !s.dirty) {
      try {
        const data = await platform().readTextFile(s.path);
        const { initial, frontmatter } = contentFromFile(s.kind, data.content);
        tabs.push(
          makeTab({
            ...common,
            path: s.path,
            initial,
            frontmatter,
            encoding: data.encoding,
            lineEnding: data.lineEnding,
            mtime: data.mtime,
            lossy: !!data.lossy,
          }),
        );
      } catch {
        missing.push(basename(s.path));
      }
    } else if (s.path && s.content) {
      const st = await platform().fileStat(s.path);
      tabs.push(
        makeTab({
          ...common,
          path: s.path,
          initial: s.content,
          mtime: s.mtime ?? 0,
          dirty: true,
          missing: !st,
          externalChange: !!st && !!s.mtime && st.mtime !== s.mtime,
        }),
      );
    } else if (!s.path && s.content && !isEmptyContent(s.content)) {
      tabs.push(makeTab({ ...common, path: null, initial: s.content, untitledIndex: s.untitledIndex || 1, dirty: true }));
    }
  }
  if (missing.length) toast(`Não encontrei mais: ${missing.join(", ")}`, "erro");
  let active = tabs[0]?.id ?? null;
  if (saved.activePath) active = tabs.find((t) => t.path === saved.activePath)?.id ?? active;
  else if (typeof saved.activeIndex === "number" && tabs.length) {
    // o índice salvo considera também abas que podem ter sumido; ajusta pelo caminho quando possível
    const savedActive = saved.tabs[saved.activeIndex];
    const match = savedActive?.path
      ? tabs.find((t) => t.path === savedActive.path)
      : tabs.filter((t) => !t.path)[0];
    active = match?.id ?? tabs[Math.min(saved.activeIndex, tabs.length - 1)].id;
  }
  setState({ activeId: active, closed: saved.closed ?? [] });
  return tabs;
}

function parseLibrary(raw: string | null, documents: string | null): Library {
  const base: Library = { pinned: [], recents: [], folders: [], lastPosition: null, prefs: { ...DEFAULT_PREFS } };
  if (raw) {
    try {
      const l = JSON.parse(raw);
      base.pinned = Array.isArray(l.pinned) ? l.pinned : [];
      base.recents = Array.isArray(l.recents) ? l.recents : [];
      base.folders = Array.isArray(l.folders) ? l.folders : [];
      base.lastPosition = l.lastPosition ?? null;
      base.prefs = { ...DEFAULT_PREFS, ...(l.prefs ?? {}) };
    } catch {
      /* usa padrão */
    }
  } else if (documents) {
    base.folders = [documents];
  }
  return base;
}

export function updateWindowTitle() {
  const t = activeTab();
  void platform()
    .setTitle(t ? `${tabTitle(t)} — Blocos` : "Blocos")
    .catch(() => undefined);
}

let booted = false;
export async function bootstrap() {
  if (booted) return;
  booted = true;
  const p = await initPlatform();
  const dirs = await p.appDirs();
  const [libRaw, sesRaw] = await Promise.all([p.loadState("biblioteca"), p.loadState("sessao")]);
  const library = parseLibrary(libRaw, dirs.documents);
  setState({ native: p.native, home: dirs.home, documents: dirs.documents, library });

  const tabs = await restoreSession(sesRaw);
  setState({ tabs });
  for (const t of tabs) if (!t.path || t.dirty) baselines.set(t.id, t.path ? "\u0000desconhecido" : "");

  const launch = await p.takeLaunchPaths();
  setState({ ready: true });
  if (launch.length) await openPaths(launch);
  if (!getState().tabs.length) newTab();
  if (!getState().activeId) setState({ activeId: getState().tabs[0].id });
  updateWindowTitle();

  await p.onOpenPaths((paths) => void openPaths(paths));
  await p.onWindowFocus(() => void checkExternalChanges());
  await p.onCloseRequested(() => flushAll());
  setInterval(() => void persistNow(), 30000);

  // abas restauradas com alterações pendentes: salva assim que possível
  for (const t of getState().tabs) {
    if (t.path && t.dirty && !t.externalChange && !t.missing && library.prefs.autosave) {
      setTimeout(() => notifyChange(t.id), 800);
    }
  }
}
