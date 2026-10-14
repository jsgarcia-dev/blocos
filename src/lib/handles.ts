import type { Editor } from "@tiptap/core";
import type { InitialContent } from "../store/types";

/** Acesso ao editor de cada aba (fora do React, para salvar e restaurar). */
export interface DocHandle {
  kind: "md" | "txt";
  /** Conteúdo exatamente como deve ir para o disco. */
  getText(): string;
  /** Conteúdo para guardar na sessão. */
  getSnapshot(): InitialContent;
  focus(): void;
  goToLine(line: number, query?: string): void;
  /** Seleção e rolagem atuais, para restaurar na próxima sessão. */
  getViewState(): { selection: { anchor: number; head: number } | null; scrollTop: number };
  /** Busca e substituição dentro do documento. */
  search?: {
    setQuery(query: string): void;
    step(dir: 1 | -1): void;
    replace(replacement: string): void;
    replaceAll(replacement: string): void;
  };
  editor?: Editor;
  textarea?: HTMLTextAreaElement;
}

export const handles = new Map<string, DocHandle>();

/** Último conteúdo conhecido no disco (ou vazio, para abas sem arquivo). */
export const baselines = new Map<string, string>();

/** Pulos pedidos antes de o editor da aba existir (ex.: abrir resultado de busca). */
export const pendingJumps = new Map<string, { line?: number; query?: string }>();
