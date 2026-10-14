import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { fold } from "../lib/format";

export interface Match {
  from: number;
  to: number;
}

interface SearchState {
  query: string;
  current: number;
  matches: Match[];
  decorations: DecorationSet;
}

export const searchKey = new PluginKey<SearchState>("blocosSearch");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blocosSearch: {
      setSearchQuery: (query: string) => ReturnType;
      searchStep: (dir: 1 | -1 | 0) => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
    };
  }
}

/** Procura sem diferenciar maiúsculas nem acentos; mapeia posições de volta ao documento. */
export function findMatches(doc: PMNode, query: string): Match[] {
  const q = fold(query);
  if (!q) return [];
  const out: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = "";
    const map: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) {
          text += child.text![i];
          map.push(pos + 1 + offset + i);
        }
      } else {
        text += "￼";
        map.push(pos + 1 + offset);
      }
    });
    // fold() remove acentos combinados; como trabalhamos caractere a caractere,
    // dobramos cada caractere isoladamente para manter o mapa de posições.
    const folded = text
      .split("")
      .map((c) => {
        const f = fold(c);
        return f.length === 1 ? f : c;
      })
      .join("");
    let i = folded.indexOf(q);
    while (i >= 0) {
      out.push({ from: map[i], to: map[i + q.length - 1] + 1 });
      i = folded.indexOf(q, i + q.length);
    }
    return false;
  });
  return out;
}

function build(state: EditorState, query: string, current: number): SearchState {
  const matches = findMatches(state.doc, query);
  const cur = matches.length ? Math.min(Math.max(current, 0), matches.length - 1) : 0;
  const decos = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, { class: i === cur ? "search-match current" : "search-match" }),
  );
  return { query, current: cur, matches, decorations: DecorationSet.create(state.doc, decos) };
}

export const SearchHighlight = Extension.create<{ onChange: (s: { current: number; total: number }) => void }>({
  name: "blocosSearch",

  addOptions() {
    return { onChange: () => undefined };
  },

  addProseMirrorPlugins() {
    const onChange = this.options.onChange;
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ query: "", current: 0, matches: [], decorations: DecorationSet.empty }),
          apply(tr, prev, _old, state) {
            const meta = tr.getMeta(searchKey) as { query?: string; current?: number } | undefined;
            if (meta) {
              const next = build(state, meta.query ?? prev.query, meta.current ?? prev.current);
              queueMicrotask(() => onChange({ current: next.matches.length ? next.current + 1 : 0, total: next.matches.length }));
              return next;
            }
            if (tr.docChanged && prev.query) {
              const next = build(state, prev.query, prev.current);
              queueMicrotask(() => onChange({ current: next.matches.length ? next.current + 1 : 0, total: next.matches.length }));
              return next;
            }
            return prev;
          },
        },
        props: {
          decorations: (state) => searchKey.getState(state)?.decorations,
        },
      }),
    ];
  },

  addCommands() {
    const reveal = (view: any, m: Match | undefined) => {
      if (!m) return;
      const dom = view.domAtPos(m.from)?.node as HTMLElement | undefined;
      const el = dom?.nodeType === 3 ? dom.parentElement : dom;
      // abre seções recolhidas que contenham o resultado
      el?.closest?.(".toggle-block:not(.is-open)")?.querySelector?.(".toggle-btn")?.dispatchEvent(new MouseEvent("click"));
      requestAnimationFrame(() => {
        const coords = view.coordsAtPos(m.from);
        const scroller = view.dom.closest(".canvas") as HTMLElement | null;
        if (scroller) {
          const r = scroller.getBoundingClientRect();
          if (coords.top < r.top + 80 || coords.bottom > r.bottom - 60) {
            scroller.scrollTop += coords.top - r.top - r.height / 3;
          }
        }
      });
    };
    return {
      setSearchQuery:
        (query) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(searchKey, { query, current: 0 });
          return true;
        },
      searchStep:
        (dir) =>
        ({ state, tr, dispatch, view }) => {
          const s = searchKey.getState(state);
          if (!s || !s.matches.length) return false;
          const current = (s.current + dir + s.matches.length) % s.matches.length;
          if (dispatch) {
            const m = s.matches[current];
            tr.setMeta(searchKey, { current });
            tr.setSelection(TextSelection.create(tr.doc, m.from, m.to));
            reveal(view, m);
          }
          return true;
        },
      replaceCurrent:
        (replacement) =>
        ({ state, tr, dispatch, view }) => {
          const s = searchKey.getState(state);
          const m = s?.matches[s.current];
          if (!s || !m) return false;
          if (dispatch) {
            if (replacement) tr.insertText(replacement, m.from, m.to);
            else tr.delete(m.from, m.to);
            tr.setMeta(searchKey, { current: s.current });
            const next = findMatches(tr.doc, s.query)[s.current];
            if (next) reveal(view, next);
          }
          return true;
        },
      replaceAll:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const s = searchKey.getState(state);
          if (!s || !s.matches.length) return false;
          if (dispatch) {
            for (let i = s.matches.length - 1; i >= 0; i--) {
              const m = s.matches[i];
              if (replacement) tr.insertText(replacement, m.from, m.to);
              else tr.delete(m.from, m.to);
            }
            tr.setMeta(searchKey, { current: 0 });
          }
          return true;
        },
    };
  },
});
