import { create } from "zustand";
import type { Editor } from "@tiptap/core";

/** Editores ricos vivos, por aba (reativo, para a barra de formatação). */
export const useEditors = create<{ map: Record<string, Editor> }>(() => ({ map: {} }));

export function registerEditor(id: string, editor: Editor) {
  useEditors.setState((s) => ({ map: { ...s.map, [id]: editor } }));
}

export function unregisterEditor(id: string, editor: Editor) {
  useEditors.setState((s) => {
    if (s.map[id] !== editor) return s;
    const map = { ...s.map };
    delete map[id];
    return { map };
  });
}
