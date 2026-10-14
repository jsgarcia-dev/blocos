import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";
import {
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Check,
  ExternalLink,
  Link2Off,
  Pencil,
  Rows2,
  Columns2,
  Trash2,
} from "lucide-react";
import { platform } from "../lib/platform";

/** Qual editor está com o campo de link aberto. */
export const useLinkUi = create<{ editor: Editor | null }>(() => ({ editor: null }));

export function openLinkEditor(editor: Editor | undefined) {
  if (!editor) return;
  useLinkUi.setState({ editor });
  editor.view.dispatch(editor.state.tr.setMeta("linkUi", true));
}

function closeLinkEditor(editor: Editor) {
  useLinkUi.setState({ editor: null });
  if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta("linkUi", false));
}

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith("#") || v.startsWith("/")) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  return `https://${v}`;
}

function LinkForm({ editor, initial }: { editor: Editor; initial: string }) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTimeout(() => input.current?.focus(), 0);
  }, []);
  const apply = () => {
    const href = normalizeUrl(value);
    const chain = editor.chain().focus();
    if (!href) chain.extendMarkRange("link").unsetLink().run();
    else if (editor.state.selection.empty && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text: value.trim(), marks: [{ type: "link", attrs: { href } }] }).run();
    } else chain.extendMarkRange("link").setLink({ href }).run();
    closeLinkEditor(editor);
  };
  return (
    <div className="bubble link-form" onMouseDown={(e) => e.stopPropagation()}>
      <input
        ref={input}
        value={value}
        placeholder="Cole ou digite um endereço…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            closeLinkEditor(editor);
            editor.commands.focus();
          }
        }}
      />
      <button className="bb primary" onClick={apply} title="Aplicar">
        <Check size={15} />
      </button>
    </div>
  );
}

type ShowProps = { editor: Editor };
const LINK_OPTIONS = { placement: "bottom-start" as const, offset: 8, flip: true };
const TABLE_OPTIONS = { placement: "top" as const, offset: 10, flip: true };
const showLink = ({ editor: ed }: ShowProps) =>
  useLinkUi.getState().editor === ed || (ed.isActive("link") && ed.isFocused && ed.state.selection.empty);
const showTable = ({ editor: ed }: ShowProps) => ed.isActive("table") && ed.isFocused && useLinkUi.getState().editor !== ed;

export function LinkBubble({ editor }: { editor: Editor }) {
  const editing = useLinkUi((s) => s.editor === editor);
  const href = useEditorState({
    editor,
    selector: (ctx) => (ctx.editor.isActive("link") ? (ctx.editor.getAttributes("link").href as string) : ""),
  });

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="linkBubble"
      updateDelay={0}
      options={LINK_OPTIONS}
      shouldShow={showLink}
    >
      {editing ? (
        <LinkForm key={href} editor={editor} initial={href} />
      ) : (
        <div className="bubble link-view">
          <span className="u" title={href}>
            {href}
          </span>
          <button className="bb" onClick={() => void platform().openUrl(href)} title="Abrir no navegador (Ctrl + clique)">
            <ExternalLink size={14} />
            Abrir
          </button>
          <button className="bb" onClick={() => openLinkEditor(editor)} title="Editar link">
            <Pencil size={14} />
            Editar
          </button>
          <button className="bb" onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()} title="Remover link">
            <Link2Off size={14} />
          </button>
        </div>
      )}
    </BubbleMenu>
  );
}

export function TableBubble({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableBubble"
      updateDelay={0}
      options={TABLE_OPTIONS}
      shouldShow={showTable}
    >
      <div className="bubble table-tools">
        <button className="bb" onClick={() => editor.chain().focus().addRowAfter().run()} title="Inserir linha abaixo">
          <BetweenHorizontalStart size={15} />
          Linha
        </button>
        <button className="bb" onClick={() => editor.chain().focus().addColumnAfter().run()} title="Inserir coluna à direita">
          <BetweenVerticalStart size={15} />
          Coluna
        </button>
        <span className="bsep" />
        <button className="bb" onClick={() => editor.chain().focus().deleteRow().run()} title="Excluir linha">
          <Rows2 size={15} />
        </button>
        <button className="bb" onClick={() => editor.chain().focus().deleteColumn().run()} title="Excluir coluna">
          <Columns2 size={15} />
        </button>
        <button className="bb danger" onClick={() => editor.chain().focus().deleteTable().run()} title="Excluir tabela">
          <Trash2 size={15} />
        </button>
      </div>
    </BubbleMenu>
  );
}
