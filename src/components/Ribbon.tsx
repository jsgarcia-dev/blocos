import { useRef, useState } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { Check, FileCode, FolderOpen, Printer, Save, Type } from "lucide-react";
import { HIGHLIGHT_COLORS, TEXT_COLORS, toHex } from "../lib/colors";
import { handles } from "../lib/handles";
import { platform } from "../lib/platform";
import { activeTab, setState, useApp } from "../store/store";
import { useEditors } from "../store/editors";
import { insertImageFromDialog, saveTab } from "../store/actions";
import { insertCallout, insertDetails } from "../editor/blocks";
import { exportHtml } from "../lib/exporter";
import { openLinkEditor } from "./Bubbles";
import { Popover } from "./Popover";
import { FontList } from "./FontPicker";
import { familyFromStack, fontStack } from "../lib/fonts";
import { MI } from "./MockIcons";

const BLOCK_STYLES = [
  { id: "p", label: "Texto" },
  { id: "h1", label: "Título 1" },
  { id: "h2", label: "Título 2" },
  { id: "h3", label: "Título 3" },
  { id: "quote", label: "Citação" },
  { id: "code", label: "Código" },
] as const;

type BlockStyle = (typeof BLOCK_STYLES)[number]["id"];

function currentBlock(editor: Editor): BlockStyle {
  if (editor.isActive("codeBlock")) return "code";
  for (const l of [1, 2, 3] as const) if (editor.isActive("heading", { level: l })) return `h${l}` as BlockStyle;
  if (editor.isActive("blockquote")) return "quote";
  return "p";
}

function applyBlock(editor: Editor, id: BlockStyle) {
  const c = editor.chain().focus();
  if (id === "p") c.setParagraph().run();
  else if (id === "h1") c.setHeading({ level: 1 }).run();
  else if (id === "h2") c.setHeading({ level: 2 }).run();
  else if (id === "h3") c.setHeading({ level: 3 }).run();
  else if (id === "quote") c.toggleBlockquote().run();
  else c.toggleCodeBlock().run();
}

const EMPTY = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  bullet: false,
  ordered: false,
  task: false,
  link: false,
  callout: false,
  details: false,
  textColor: null as string | null,
  fontFamily: null as string | null,
  highlight: null as string | null,
  block: "p" as BlockStyle,
  canUndo: false,
  canRedo: false,
};

function RB({
  on,
  disabled,
  title,
  onClick,
  children,
  className = "",
  btnRef,
}: {
  on?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  btnRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={btnRef}
      className={`rb${on ? " on" : ""} ${className}`}
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Ribbon() {
  const activeId = useApp((s) => s.activeId);
  const kind = useApp((s) => s.tabs.find((t) => t.id === s.activeId)?.kind);
  const lastText = useApp((s) => s.lastTextColor);
  const lastHl = useApp((s) => s.lastHighlight);
  const editor = useEditors((s) => (activeId ? s.map[activeId] : undefined)) ?? null;
  const st =
    useEditorState({
      editor,
      selector: ({ editor: e }) =>
        !e || e.isDestroyed
          ? EMPTY
          : {
              bold: e.isActive("bold"),
              italic: e.isActive("italic"),
              underline: e.isActive("underline"),
              strike: e.isActive("strike"),
              bullet: e.isActive("bulletList"),
              ordered: e.isActive("orderedList"),
              task: e.isActive("taskList"),
              link: e.isActive("link"),
              callout: e.isActive("callout"),
              details: e.isActive("details"),
              textColor: (e.getAttributes("textStyle").color as string) ?? null,
              fontFamily: familyFromStack(e.getAttributes("textStyle").fontFamily as string | undefined),
              highlight: e.isActive("highlight") ? ((e.getAttributes("highlight").color as string) ?? "#FFE066") : null,
              block: currentBlock(e),
              canUndo: e.can().undo(),
              canRedo: e.can().redo(),
            },
    }) ?? EMPTY;

  const isTxt = kind === "txt";
  const off = !editor || isTxt;
  const [styleOpen, setStyleOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const fontRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLButtonElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const styleRef = useRef<HTMLButtonElement>(null);
  const colorRef = useRef<HTMLButtonElement>(null);
  const exportRef = useRef<HTMLButtonElement>(null);

  const run = (fn: (e: Editor) => void) => () => {
    if (editor && !isTxt) fn(editor);
  };

  const undo = () => {
    if (isTxt) {
      const tab = activeTab();
      if (tab) handles.get(tab.id)?.textarea?.focus();
      document.execCommand("undo");
    } else editor?.chain().focus().undo().run();
  };
  const redo = () => {
    if (isTxt) {
      const tab = activeTab();
      if (tab) handles.get(tab.id)?.textarea?.focus();
      document.execCommand("redo");
    } else editor?.chain().focus().redo().run();
  };

  const applyTextColor = (color: string | null) => {
    if (!editor) return;
    if (color) {
      editor.chain().focus().setColor(color).run();
      setState({ lastTextColor: color });
    } else editor.chain().focus().unsetColor().run();
  };
  /** Fonte do trecho selecionado (null = volta à fonte do app). */
  const applyFont = (family: string | null) => {
    if (!editor) return;
    if (family) editor.chain().focus().setFontFamily(fontStack(family)).run();
    else editor.chain().focus().unsetFontFamily().run();
  };
  const applyHighlight = (color: string | null) => {
    if (!editor) return;
    if (color) {
      editor.chain().focus().setHighlight({ color }).run();
      setState({ lastHighlight: color });
    } else editor.chain().focus().unsetHighlight().run();
  };

  const label = BLOCK_STYLES.find((b) => b.id === st.block)?.label ?? "Texto";

  return (
    <div className={`ribbon${isTxt ? " is-plain" : ""}`}>
      <div className="grp">
        <RB title="Desfazer (Ctrl+Z)" disabled={!isTxt && !st.canUndo} onClick={undo}>
          <MI name="undo" size={17} />
        </RB>
        <RB title="Refazer (Ctrl+Shift+Z)" disabled={!isTxt && !st.canRedo} onClick={redo}>
          <MI name="redo" size={17} />
        </RB>
      </div>
      <div className="grp">
        <RB className="drop" title="Estilo do texto" disabled={off} btnRef={styleRef} onClick={() => setStyleOpen(!styleOpen)}>
          {isTxt ? "Texto puro" : label}
          <MI name="chev-d" size={14} />
        </RB>
        <RB title="Fonte do texto selecionado" on={fontOpen || !!st.fontFamily} disabled={off} btnRef={fontRef} onClick={() => setFontOpen(!fontOpen)}>
          <Type size={16} />
        </RB>
      </div>
      <div className="grp">
        <RB title="Negrito (Ctrl+B)" on={st.bold} disabled={off} onClick={run((e) => e.chain().focus().toggleBold().run())}>
          <MI name="bold" size={17} />
        </RB>
        <RB title="Itálico (Ctrl+I)" on={st.italic} disabled={off} onClick={run((e) => e.chain().focus().toggleItalic().run())}>
          <MI name="italic" size={17} />
        </RB>
        <RB title="Sublinhado (Ctrl+U)" on={st.underline} disabled={off} onClick={run((e) => e.chain().focus().toggleUnderline().run())}>
          <MI name="underline" size={17} />
        </RB>
        <RB title="Tachado (Ctrl+Shift+S)" on={st.strike} disabled={off} onClick={run((e) => e.chain().focus().toggleStrike().run())}>
          <MI name="strike" size={17} />
        </RB>
      </div>
      <div className="grp">
        <RB className="col" title="Cor do texto" disabled={off} btnRef={textRef} on={textOpen} onClick={() => setTextOpen(!textOpen)}>
          <span className="A">A</span>
          <span className="bar" style={{ background: lastText }} />
        </RB>
        <RB
          className="col"
          title="Destacar (Ctrl+Shift+H)"
          on={!!st.highlight}
          disabled={off}
          onClick={() => (st.highlight && toHex(st.highlight) === toHex(lastHl) ? applyHighlight(null) : applyHighlight(lastHl))}
        >
          <MI name="highlighter" size={16} />
          {/* no mock o amarelo padrão aparece mais vivo na barrinha (#FFD43B) */}
          <span className="bar" style={{ background: toHex(lastHl) === "#FFE066" ? "#FFD43B" : lastHl }} />
        </RB>
        <RB className="mini" title="Cores de destaque" disabled={off} btnRef={colorRef} onClick={() => setColorOpen(!colorOpen)}>
          <MI name="chev-d" size={17} />
        </RB>
      </div>
      <div className="grp">
        <RB title="Lista com marcadores" on={st.bullet} disabled={off} onClick={run((e) => e.chain().focus().toggleBulletList().run())}>
          <MI name="list" size={17} />
        </RB>
        <RB title="Lista numerada" on={st.ordered} disabled={off} onClick={run((e) => e.chain().focus().toggleOrderedList().run())}>
          <MI name="list-ol" size={17} />
        </RB>
        <RB title="Lista de tarefas" on={st.task} disabled={off} onClick={run((e) => e.chain().focus().toggleTaskList().run())}>
          <MI name="checks" size={17} />
        </RB>
      </div>
      <div className="grp last">
        <RB title="Link (Ctrl+K)" on={st.link} disabled={off} onClick={run((e) => openLinkEditor(e))}>
          <MI name="link" size={17} />
        </RB>
        <RB title="Tabela" disabled={off} onClick={run((e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>
          <MI name="table" size={17} />
        </RB>
        <RB title="Imagem" disabled={off} onClick={() => void insertImageFromDialog()}>
          <MI name="image" size={17} />
        </RB>
        <RB title="Caixa de destaque" on={st.callout} disabled={off} onClick={run((e) => insertCallout(e))}>
          <MI name="callout" size={17} />
        </RB>
        <RB title="Seção recolhível" on={st.details} disabled={off} onClick={run((e) => insertDetails(e))}>
          <MI name="collapse" size={17} />
        </RB>
        <RB title="Divisor" disabled={off} onClick={run((e) => e.chain().focus().setHorizontalRule().run())}>
          <MI name="divider" size={17} />
        </RB>
      </div>
      <RB className="export" title="Salvar e exportar" btnRef={exportRef} onClick={() => setExportOpen(!exportOpen)}>
        <MI name="download" size={14} />
        Exportar
        <MI name="chev-d" size={14} />
      </RB>

      <Popover anchor={styleRef} open={styleOpen} onClose={() => setStyleOpen(false)} className="menu-pop">
        {BLOCK_STYLES.map((b) => (
          <button
            key={b.id}
            className={`mi style-${b.id}${st.block === b.id ? " on" : ""}`}
            onClick={() => {
              if (editor) applyBlock(editor, b.id);
              setStyleOpen(false);
            }}
          >
            <span>{b.label}</span>
            {st.block === b.id && <Check size={14} />}
          </button>
        ))}
      </Popover>

      {/* fonte do trecho selecionado: as mesmas fontes das Preferências, mais "Fonte do app" */}
      <Popover anchor={fontRef} open={fontOpen} onClose={() => setFontOpen(false)} className="font-pop">
        <div className="cp-t">Fonte do texto</div>
        <FontList
          appDefault
          selected={st.fontFamily}
          onPick={(f) => {
            applyFont(f);
            setFontOpen(false);
          }}
        />
      </Popover>

      {/* cor do texto: o botão "A" abre as cores (o destaque tem as suas, na setinha do marca-texto) */}
      <Popover anchor={textRef} open={textOpen} onClose={() => setTextOpen(false)} className="color-pop">
        <div className="cp-t">Cor do texto</div>
        <div className="cp-row">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.name}
              title={c.name}
              className={`sw text${(toHex(st.textColor) ?? null) === c.value ? " on" : ""}`}
              style={{ color: c.value ?? "var(--ink)" }}
              onClick={() => {
                applyTextColor(c.value);
                setTextOpen(false);
              }}
            >
              A
            </button>
          ))}
          <label className="sw custom" title="Outra cor…">
            <input type="color" value={(toHex(st.textColor) ?? toHex(lastText) ?? "#E5484D").toLowerCase()} onChange={(e) => applyTextColor(e.target.value)} />
          </label>
        </div>
      </Popover>

      <Popover anchor={colorRef} open={colorOpen} onClose={() => setColorOpen(false)} className="color-pop">
        <div className="cp-t">Destaque</div>
        <div className="cp-row">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.name}
              title={c.name}
              className={`sw${st.highlight && toHex(st.highlight) === c.value ? " on" : ""}`}
              style={{ background: c.value ?? undefined }}
              onClick={() => {
                applyHighlight(c.value);
                setColorOpen(false);
              }}
            />
          ))}
          <button
            title="Sem destaque"
            className="sw none"
            onClick={() => {
              applyHighlight(null);
              setColorOpen(false);
            }}
          />
          <label className="sw custom" title="Outra cor…">
            <input type="color" value={(toHex(st.highlight) ?? toHex(lastHl) ?? "#FFE066").toLowerCase()} onChange={(e) => applyHighlight(e.target.value)} />
          </label>
        </div>
      </Popover>

      <Popover anchor={exportRef} open={exportOpen} onClose={() => setExportOpen(false)} align="end" className="menu-pop">
        <button
          className="mi"
          onClick={() => {
            setExportOpen(false);
            const t = activeTab();
            if (t) void saveTab(t.id);
          }}
        >
          <Save size={15} />
          <span>Salvar</span>
          <kbd>Ctrl S</kbd>
        </button>
        <button
          className="mi"
          onClick={() => {
            setExportOpen(false);
            const t = activeTab();
            if (t) void saveTab(t.id, { as: true });
          }}
        >
          <Save size={15} />
          <span>Salvar como…</span>
          <kbd>Ctrl Shift S</kbd>
        </button>
        <div className="msep" />
        <button
          className="mi"
          disabled={isTxt}
          onClick={() => {
            setExportOpen(false);
            void exportHtml();
          }}
        >
          <FileCode size={15} />
          <span>Exportar como HTML…</span>
        </button>
        <button
          className="mi"
          onClick={() => {
            setExportOpen(false);
            void platform().printPage();
          }}
        >
          <Printer size={15} />
          <span>Imprimir ou salvar PDF…</span>
          <kbd>Ctrl Shift P</kbd>
        </button>
        <div className="msep" />
        <button
          className="mi"
          disabled={!activeTab()?.path}
          onClick={() => {
            setExportOpen(false);
            const p = activeTab()?.path;
            if (p) void platform().revealInDir(p);
          }}
        >
          <FolderOpen size={15} />
          <span>Mostrar na pasta</span>
        </button>
      </Popover>
    </div>
  );
}
