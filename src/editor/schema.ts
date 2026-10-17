import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { BulletList, OrderedList, TaskList, TaskItem } from "@tiptap/extension-list";
import CodeBlock from "@tiptap/extension-code-block";
import { TableKit } from "@tiptap/extension-table";
import { Details, DetailsSummary, DetailsContent } from "@tiptap/extension-details";
import { Callout } from "./Callout";
import { BlocosImage } from "./BlocosImage";

export interface SchemaOptions {
  resolveImageSrc?: (src: string) => string;
}

/* triângulo ▸ (vira ▾ quando a seção abre), como na opção A do mock de registros */
const CHEVRON = '<svg viewBox="0 0 24 24"><path d="M9 6.5 16.5 12 9 17.5Z" fill="currentColor"/></svg>';

/* Guardam o marcador usado no arquivo, para regravar igual (- * +, 1. 1), ``` ~~~). */
const BlocosBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      bullet: {
        default: "-",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-bullet") || "-",
        renderHTML: (attrs: Record<string, any>) => (attrs.bullet && attrs.bullet !== "-" ? { "data-bullet": attrs.bullet } : {}),
      },
    };
  },
});

const BlocosOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      delim: {
        default: ".",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-delim") || ".",
        renderHTML: (attrs: Record<string, any>) => (attrs.delim === ")" ? { "data-delim": ")" } : {}),
      },
    };
  },
});

const BlocosCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fence: {
        default: "```",
        parseHTML: (el: HTMLElement) => el.closest("pre")?.getAttribute("data-fence") || el.getAttribute("data-fence") || "```",
        renderHTML: (attrs: Record<string, any>) => (attrs.fence === "~~~" ? { "data-fence": "~~~" } : {}),
      },
    };
  },
});

/** Extensões que definem o documento. Usadas pelo editor e pelos testes. */
export function schemaExtensions(opts: SchemaOptions = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: null, class: "lnk" },
      },
      dropcursor: { color: "#FF5A1F", width: 2 },
      bulletList: false,
      orderedList: false,
      codeBlock: false,
    }),
    BlocosBulletList,
    BlocosOrderedList,
    BlocosCodeBlock,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Details.configure({
      persist: false,
      HTMLAttributes: { class: "toggle-block" },
      // a contagem ("3 registros") fica ao lado do nome, desenhada por Registros.ts
      renderToggleButton: ({ element, isOpen }) => {
        element.className = "toggle-btn";
        element.setAttribute("aria-label", isOpen ? "Recolher seção" : "Expandir seção");
        if (!element.firstChild) element.innerHTML = CHEVRON;
      },
    }),
    DetailsSummary,
    DetailsContent,
    Callout,
    BlocosImage.configure({ resolveSrc: opts.resolveImageSrc ?? ((s: string) => s) }),
  ];
}
