export type DocKind = "md" | "txt";

export type InitialContent =
  | { type: "markdown"; text: string }
  | { type: "json"; json: unknown }
  | { type: "text"; text: string };

export interface TabStats {
  words: number;
  /** Linha (bloco de texto) onde está o cursor, a partir de 1. */
  line: number;
}

export interface Tab {
  id: string;
  path: string | null;
  kind: DocKind;
  /** Para abas sem arquivo: "Sem título", "Sem título 2"… */
  untitledIndex: number;
  dirty: boolean;
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
  encoding: string;
  lineEnding: "lf" | "crlf";
  /** Data de modificação no disco quando lemos/gravamos pela última vez. */
  mtime: number;
  frontmatter: string | null;
  /** Conteúdo usado para montar o editor; muda só ao recarregar (com `version`). */
  initial: InitialContent;
  version: number;
  selection: { anchor: number; head: number } | null;
  scrollTop: number;
  lastEdited: number | null;
  externalChange: boolean;
  missing: boolean;
  /** Arquivo com bytes que não puderam ser lidos: não salva sozinho. */
  lossy: boolean;
  stats: TabStats;
}

export type Theme = "claro" | "escuro" | "sistema";

export interface Prefs {
  theme: Theme;
  autosave: boolean;
  zoom: number;
  sidebar: boolean;
  spellcheck: boolean;
}

export interface Recent {
  path: string;
  at: number;
}

export interface LastPosition {
  path: string;
  line: number;
  at: number;
}

export interface Library {
  pinned: string[];
  recents: Recent[];
  folders: string[];
  lastPosition: LastPosition | null;
  prefs: Prefs;
}

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "erro";
}

export interface ConfirmButton {
  id: string;
  label: string;
  variant?: "primary" | "danger" | "ghost";
}

export interface ConfirmRequest {
  title: string;
  message: string;
  buttons: ConfirmButton[];
  resolve: (id: string) => void;
}

export interface ContextMenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
  separator?: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}
