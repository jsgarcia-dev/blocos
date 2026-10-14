import { useEffect, useRef, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import { GripVertical, Plus } from "lucide-react";

interface Hover {
  node: PMNode;
  pos: number;
  dom: HTMLElement;
  top: number;
}

interface DragState {
  from: number;
  node: PMNode;
  dom: HTMLElement;
  startY: number;
  moved: boolean;
  /** Índice (entre os blocos de nível superior) onde o bloco vai entrar. */
  target: number | null;
}

/** Blocos de nível superior com sua posição e elemento na tela. */
function topBlocks(editor: Editor) {
  const out: { node: PMNode; pos: number; dom: HTMLElement }[] = [];
  editor.state.doc.forEach((node, pos) => {
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (dom && dom.nodeType === 1) out.push({ node, pos, dom });
  });
  return out;
}

/**
 * Alça à esquerda de cada bloco: "+" insere um bloco abaixo (abre o menu "/"),
 * e a alça pontilhada arrasta o bloco para outro lugar (com o mouse, sem
 * depender do arrastar-e-soltar do sistema, que varia entre Linux e Windows).
 */
export function BlockHandle({ editor, sheet }: { editor: Editor; sheet: RefObject<HTMLDivElement | null> }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [lineTop, setLineTop] = useState<number | null>(null);
  const current = useRef<Hover | null>(null);
  const drag = useRef<DragState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toSheetY = (clientY: number) => {
    const root = sheet.current!;
    const base = root.getBoundingClientRect();
    const zoom = root.offsetWidth ? base.width / root.offsetWidth : 1;
    return (clientY - base.top) / zoom;
  };

  useEffect(() => {
    const root = sheet.current;
    if (!root) return;

    const mark = (h: Hover | null) => {
      if (current.current?.dom !== h?.dom) {
        current.current?.dom.classList.remove("is-hovered");
        h?.dom.classList.add("is-hovered");
      }
      current.current = h;
      setHover(h);
    };

    const onMove = (e: MouseEvent) => {
      if (drag.current || !editor.isEditable) return;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if ((e.target as HTMLElement).closest(".block-handle")) return;
      const y = e.clientY;
      const found = topBlocks(editor).find(({ dom }) => {
        const r = dom.getBoundingClientRect();
        return y >= r.top - 6 && y <= r.bottom + 6;
      });
      if (found) mark({ ...found, top: toSheetY(found.dom.getBoundingClientRect().top) });
    };
    const onLeave = () => {
      if (drag.current) return;
      hideTimer.current = setTimeout(() => mark(null), 250);
    };
    const onChange = () => {
      const h = current.current;
      if (h && !h.dom.isConnected) mark(null);
    };

    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    editor.on("update", onChange);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      editor.off("update", onChange);
      current.current?.dom.classList.remove("is-hovered");
    };
  }, [editor, sheet]);

  const addBelow = () => {
    if (!hover) return;
    const { node, pos } = hover;
    if (node.type.name === "paragraph" && node.childCount === 0) {
      editor.chain().focus().setTextSelection(pos + 1).insertContent("/").run();
      return;
    }
    const at = pos + node.nodeSize;
    editor
      .chain()
      .focus()
      .insertContentAt(at, { type: "paragraph", content: [{ type: "text", text: "/" }] })
      .setTextSelection(at + 2)
      .run();
  };

  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0 || !hover) return;
    e.preventDefault();
    const state: DragState = { from: hover.pos, node: hover.node, dom: hover.dom, startY: e.clientY, moved: false, target: null };
    drag.current = state;
    const canvas = sheet.current?.closest(".canvas") as HTMLElement | null;
    let lastY = e.clientY;
    let scrollTimer: ReturnType<typeof setInterval> | null = null;

    const computeTarget = (clientY: number) => {
      const blocks = topBlocks(editor);
      let index = blocks.length;
      let y = blocks.length ? blocks[blocks.length - 1].dom.getBoundingClientRect().bottom + 4 : clientY;
      for (let i = 0; i < blocks.length; i++) {
        const r = blocks[i].dom.getBoundingClientRect();
        if (clientY < r.top + r.height / 2) {
          index = i;
          y = r.top - 4;
          break;
        }
      }
      state.target = index;
      setLineTop(toSheetY(y));
    };

    const onMove = (ev: MouseEvent) => {
      lastY = ev.clientY;
      if (!state.moved && Math.abs(ev.clientY - state.startY) < 4) return;
      if (!state.moved) {
        state.moved = true;
        state.dom.classList.add("is-dragging");
        document.body.classList.add("dragging-block");
      }
      computeTarget(ev.clientY);
    };
    // rola a página quando o mouse encosta em cima ou embaixo
    scrollTimer = setInterval(() => {
      if (!state.moved || !canvas) return;
      const r = canvas.getBoundingClientRect();
      const step = lastY < r.top + 40 ? -14 : lastY > r.bottom - 40 ? 14 : 0;
      if (step) {
        canvas.scrollTop += step;
        computeTarget(lastY);
      }
    }, 30);

    const finish = (commit: boolean) => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
      window.removeEventListener("keydown", onKey, true);
      if (scrollTimer) clearInterval(scrollTimer);
      state.dom.classList.remove("is-dragging");
      document.body.classList.remove("dragging-block");
      setLineTop(null);
      drag.current = null;
      if (!commit || !state.moved || state.target === null) return;
      moveBlock(state.from, state.node, state.target);
    };
    const onUp = () => finish(true);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        finish(false);
      }
    };
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
    window.addEventListener("keydown", onKey, true);
  };

  /** Move o bloco que começa em `from` para antes do bloco de índice `targetIndex`. */
  const moveBlock = (from: number, node: PMNode, targetIndex: number) => {
    const { state, view } = editor;
    const blocks: number[] = [];
    state.doc.forEach((_n, pos) => blocks.push(pos));
    const sourceIndex = blocks.indexOf(from);
    if (sourceIndex < 0 || targetIndex === sourceIndex || targetIndex === sourceIndex + 1) return;
    const targetPos = targetIndex < blocks.length ? blocks[targetIndex] : state.doc.content.size;
    const tr = state.tr.delete(from, from + node.nodeSize);
    const insertAt = tr.mapping.map(targetPos);
    tr.insert(insertAt, node);
    try {
      tr.setSelection(NodeSelection.create(tr.doc, insertAt));
    } catch {
      /* mantém a seleção */
    }
    view.dispatch(tr.scrollIntoView());
    view.focus();
  };

  return (
    <>
      {hover && (
        <div
          className="block-handle"
          style={{ top: hover.top }}
          onMouseEnter={() => hideTimer.current && clearTimeout(hideTimer.current)}
        >
          <i title="Adicionar bloco abaixo" onMouseDown={(e) => e.preventDefault()} onClick={addBelow}>
            <Plus size={15} strokeWidth={2} />
          </i>
          <i title="Arraste para mover" onMouseDown={startDrag}>
            <GripVertical size={15} strokeWidth={2} />
          </i>
        </div>
      )}
      {lineTop !== null && <div className="drop-line" style={{ top: lineTop }} />}
    </>
  );
}
