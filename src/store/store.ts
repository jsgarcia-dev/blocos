import { create } from "zustand";
import { DEFAULT_HIGHLIGHT } from "../lib/colors";
import type {
  ConfirmButton,
  ConfirmRequest,
  ContextMenuState,
  Library,
  Prefs,
  Tab,
  Toast,
} from "./types";

export const DEFAULT_PREFS: Prefs = {
  theme: "claro",
  autosave: true,
  zoom: 100,
  sidebar: true,
  spellcheck: false,
  editorAlign: "esquerda",
  editorWidth: "normal",
  lineSpacing: "confortavel",
  letterSpacing: "normal",
  background: "pontos",
  backgroundColor: "#0b0b0c",
  backgroundImage: null,
  backgroundVeil: 55,
};

export interface FindState {
  open: boolean;
  replace: boolean;
  query: string;
  replacement: string;
  current: number;
  total: number;
  /** Incrementa para pedir foco no campo de busca. */
  focusTick: number;
}

export interface AppState {
  ready: boolean;
  tabs: Tab[];
  activeId: string | null;
  closed: { path: string; kind: Tab["kind"] }[];
  library: Library;
  home: string | null;
  documents: string | null;
  quickSearch: boolean;
  preferences: boolean;
  find: FindState;
  confirm: ConfirmRequest | null;
  toasts: Toast[];
  menu: ContextMenuState | null;
  lastTextColor: string;
  lastHighlight: string;
  maximized: boolean;
  native: boolean;
  /** Tema escuro em uso (já resolvido quando o tema é "Do sistema"). */
  dark: boolean;
}

export const useApp = create<AppState>(() => ({
  ready: false,
  tabs: [],
  activeId: null,
  closed: [],
  library: { pinned: [], recents: [], folders: [], lastPosition: null, prefs: { ...DEFAULT_PREFS } },
  home: null,
  documents: null,
  quickSearch: false,
  preferences: false,
  find: { open: false, replace: false, query: "", replacement: "", current: 0, total: 0, focusTick: 0 },
  confirm: null,
  toasts: [],
  menu: null,
  lastTextColor: "#E5484D",
  lastHighlight: DEFAULT_HIGHLIGHT,
  maximized: false,
  native: false,
  dark: false,
}));

export const getState = useApp.getState;
export const setState = useApp.setState;

export function getTab(id: string | null | undefined): Tab | undefined {
  if (!id) return undefined;
  return getState().tabs.find((t) => t.id === id);
}

export function activeTab(): Tab | undefined {
  return getTab(getState().activeId);
}

export function updateTab(id: string, patch: Partial<Tab> | ((t: Tab) => Partial<Tab>)) {
  setState((s) => ({
    tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)),
  }));
}

export function updatePrefs(patch: Partial<Prefs>) {
  setState((s) => ({ library: { ...s.library, prefs: { ...s.library.prefs, ...patch } } }));
}

let toastId = 0;
export function toast(text: string, kind: Toast["kind"] = "info") {
  const id = ++toastId;
  setState((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
  setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === "erro" ? 6000 : 3200);
}

export function askUser(title: string, message: string, buttons: ConfirmButton[]): Promise<string> {
  return new Promise((resolve) => {
    setState({
      confirm: {
        title,
        message,
        buttons,
        resolve: (id) => {
          setState({ confirm: null });
          resolve(id);
        },
      },
    });
  });
}
