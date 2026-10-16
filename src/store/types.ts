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
export type EditorAlign = "esquerda" | "centro";
export type EditorWidth = "normal" | "larga" | "inteira";
export type LineSpacing = "compacto" | "confortavel" | "amplo";
export type LetterSpacing = "normal" | "leve" | "largo";
export type EditorBackground =
  | "pontos"
  | "cruzes"
  | "tecnica"
  | "isometrico"
  | "relevo"
  | "fluxo"
  | "aurora"
  | "papel"
  | "colmeia"
  | "liso"
  | "cor"
  | "imagem";

export interface Prefs {
  theme: Theme;
  /** Fonte de todo o app (menus, abas, lateral e texto); ver src/lib/fonts.ts. */
  fontFamily: string;
  autosave: boolean;
  zoom: number;
  sidebar: boolean;
  spellcheck: boolean;
  /** Onde a coluna de texto fica na área de edição. */
  editorAlign: EditorAlign;
  editorWidth: EditorWidth;
  lineSpacing: LineSpacing;
  letterSpacing: LetterSpacing;
  background: EditorBackground;
  /** Cor do fundo quando `background` é "cor". */
  backgroundColor: string;
  /** Cópia da imagem de fundo (na pasta de dados do app) quando `background` é "imagem". */
  backgroundImage: string | null;
  /** Véu sobre a imagem de fundo, de 0 a 90 (%), para o texto continuar legível. */
  backgroundVeil: number;
  /** Distância (px) entre o topo da área de edição e o texto. */
  marginTop: number;
  /** Distância (px) entre as laterais da coluna de texto e o texto. */
  marginSide: number;
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
