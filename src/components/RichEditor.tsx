import { memo, useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { buildExtensions } from "../editor/extensions";
import { findMatches } from "../editor/SearchHighlight";
import { PARSE_OPTIONS, createLossless, docToMarkdown, htmlToDoc, markdownToHtml, type Lossless } from "../lib/markdown";
import { baselines, handles, pendingJumps } from "../lib/handles";
import { platform } from "../lib/platform";
import { countWords } from "../lib/format";
import { getState, getTab, setState, toast, updateTab, useApp } from "../store/store";
import { notifyChange, setLastPosition } from "../store/actions";
import { registerEditor, unregisterEditor } from "../store/editors";
import type { InitialContent } from "../store/types";
import { LinkBubble, TableBubble } from "./Bubbles";
import { BlockHandle } from "./BlockHandle";

function initialToContent(c: InitialContent) {
  if (c.type === "json") return c.json as object;
  if (c.type === "markdown") return markdownToHtml(c.text);
  return markdownToHtml(c.text);
}

const MD_HINT = /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```|\|.+\|)|\*\*[^*]+\*\*|==[^=]+==|\[[^\]]+\]\([^)]+\)/;

/** Número da "linha" (bloco de texto) que contém a posição. */
function lineAt(doc: PMNode, pos: number): number {
  let n = 0;
  let found = 1;
  doc.descendants((node, p) => {
    if (node.isTextblock) {
      n++;
      if (p <= pos) found = n;
      return false;
    }
    return p <= pos;
  });
  return found;
}

function posOfLine(doc: PMNode, line: number): number {
  let n = 0;
  let at = 1;
  doc.descendants((node, p) => {
    if (n >= line) return false;
    if (node.isTextblock) {
      n++;
      at = p + 1;
      return false;
    }
    return true;
  });
  return at;
}

async function insertImageFiles(editor: Editor, files: File[], docPath: string | null, at?: number) {
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg").replace("svg+xml", "svg");
      const name = file.name && file.name !== "image.png" ? file.name : `imagem-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`;
      const src = await platform().saveImageBytes(bytes, name, docPath);
      const chain = editor.chain().focus();
      if (typeof at === "number") chain.insertContentAt(at, { type: "image", attrs: { src, alt: "" } }).run();
      else chain.setImage({ src, alt: "" }).run();
    } catch (e) {
      toast(String(e), "erro");
    }
  }
}

function RichEditorImpl({ id, active }: { id: string; active: boolean }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const spellcheck = useApp((s) => s.library.prefs.spellcheck);

  const editor = useEditor({
    extensions: buildExtensions({
      getDocPath: () => getTab(id)?.path ?? null,
      getEdited: () => {
        const t = getTab(id);
        return t ? t.lastEdited ?? (t.mtime || null) : null;
      },
      onSearch: ({ current, total }) => {
        if (getState().activeId === id) setState((s) => ({ find: { ...s.find, current, total } }));
      },
    }),
    content: initialToContent(getTab(id)!.initial),
    parseOptions: PARSE_OPTIONS,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: "doc", spellcheck: "false" },
      handlePaste: (view, event) => {
        const ed = handles.get(id)?.editor;
        if (!ed) return false;
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length) {
          event.preventDefault();
          void insertImageFiles(ed, files, getTab(id)?.path ?? null);
          return true;
        }
        const html = event.clipboardData?.getData("text/html");
        const text = event.clipboardData?.getData("text/plain");
        if (!html && text && MD_HINT.test(text) && !view.state.selection.$from.parent.type.spec.code) {
          event.preventDefault();
          ed.chain().focus().insertContent(markdownToHtml(text), { parseOptions: PARSE_OPTIONS }).run();
          return true;
        }
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const ed = handles.get(id)?.editor;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!ed || !files.length) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImageFiles(ed, files, getTab(id)?.path ?? null, at);
        return true;
      },
      handleClick: (view, pos, event) => {
        if (!(event.ctrlKey || event.metaKey)) return false;
        const $pos = view.state.doc.resolve(pos);
        const link = $pos.marks().find((m) => m.type.name === "link");
        if (link?.attrs.href) {
          void platform().openUrl(link.attrs.href);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ transaction }) => {
      if (transaction.docChanged) notifyChange(id);
      scheduleStats();
    },
    onSelectionUpdate: () => scheduleStats(),
  });

  function scheduleStats() {
    if (statsTimer.current) clearTimeout(statsTimer.current);
    statsTimer.current = setTimeout(() => {
      const ed = handles.get(id)?.editor;
      const t = getTab(id);
      if (!ed || !t || ed.isDestroyed) return;
      const doc = ed.state.doc;
      const words = countWords(doc.textBetween(0, doc.content.size, " ", " "));
      const line = lineAt(doc, ed.state.selection.from);
      if (words !== t.stats.words || line !== t.stats.line) updateTab(id, { stats: { words, line } });
      if (t.path && getState().activeId === id) setLastPosition(t.path, line);
    }, 250);
  }

  useEffect(() => {
    if (!editor) return;
    const t = getTab(id)!;
    const ed = editor;
    // blocos não editados são gravados exatamente como estavam no arquivo
    let lossless: Lossless | null = null;
    if (t.initial.type === "markdown") {
      const body = t.initial.text;
      try {
        lossless = createLossless(ed.state.doc, body, (md) => htmlToDoc(markdownToHtml(md), ed.schema));
      } catch {
        lossless = null;
      }
    }
    const serialize = () => {
      const fm = getTab(id)?.frontmatter ?? null;
      return lossless ? lossless.serialize(ed.state.doc, fm) : docToMarkdown(ed.state.doc, fm);
    };
    const canvas = canvasRef.current;
    handles.set(id, {
      kind: "md",
      editor: ed,
      getText: serialize,
      getSnapshot: () => ({ type: "json", json: ed.getJSON() }),
      focus: () => {
        if (!ed.isDestroyed) ed.commands.focus(undefined, { scrollIntoView: false });
      },
      goToLine: (line, query) => {
        let from = posOfLine(ed.state.doc, line);
        let to = from;
        if (query) {
          const m = findMatches(ed.state.doc, query);
          // a linha da busca é do arquivo Markdown, não do editor: usa a primeira ocorrência
          const near = m[0];
          if (near) ({ from, to } = near);
        }
        ed.chain().focus().setTextSelection({ from, to }).run();
        requestAnimationFrame(() => {
          const c = canvasRef.current;
          if (!c) return;
          const coords = ed.view.coordsAtPos(from);
          const r = c.getBoundingClientRect();
          c.scrollTop += coords.top - r.top - r.height / 3;
        });
      },
      getViewState: () => ({
        selection: { anchor: ed.state.selection.anchor, head: ed.state.selection.head },
        scrollTop: canvasRef.current?.scrollTop ?? 0,
      }),
      search: {
        setQuery: (q) => {
          ed.commands.setSearchQuery(q);
          if (q) ed.commands.searchStep(0);
        },
        step: (dir) => void ed.commands.searchStep(dir),
        replace: (r) => {
          ed.commands.replaceCurrent(r);
          ed.commands.searchStep(0);
        },
        replaceAll: (r) => void ed.commands.replaceAll(r),
      },
    });
    registerEditor(id, ed);
    if (!t.dirty || !baselines.has(id)) {
      if (!t.dirty) baselines.set(id, serialize());
    }
    // restaura cursor e rolagem
    const size = ed.state.doc.content.size;
    if (t.selection) {
      const clamp = (n: number) => Math.max(1, Math.min(n, size));
      try {
        ed.commands.setTextSelection({ from: clamp(t.selection.anchor), to: clamp(t.selection.head) });
      } catch {
        /* posição inválida */
      }
    }
    requestAnimationFrame(() => {
      if (canvas) canvas.scrollTop = t.scrollTop;
      const jump = pendingJumps.get(id);
      if (jump) {
        pendingJumps.delete(id);
        handles.get(id)?.goToLine(jump.line ?? 1, jump.query);
      }
      if (getState().activeId === id) handles.get(id)?.focus();
    });
    scheduleStats();
    return () => {
      if (handles.get(id)?.editor === ed) handles.delete(id);
      unregisterEditor(id, ed);
    };
  }, [editor, id]);

  useEffect(() => {
    editor?.view.dom.setAttribute("spellcheck", spellcheck ? "true" : "false");
  }, [editor, spellcheck]);

  useEffect(() => {
    if (active && editor) scheduleStats();
  }, [active, editor]);

  if (!editor) return null;
  return (
    <div className="canvas" ref={canvasRef}>
      <div className="sheet" ref={sheetRef}>
        <BlockHandle editor={editor} sheet={sheetRef} />
        <EditorContent editor={editor} />
        <LinkBubble editor={editor} />
        <TableBubble editor={editor} />
      </div>
    </div>
  );
}

/** Só re-renderiza ao trocar de aba ativa — digitar não deve re-renderizar o editor. */
export const RichEditor = memo(RichEditorImpl);
