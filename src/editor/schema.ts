import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle, Color, FontFamily } from "@tiptap/extension-text-style";
import { BulletList, OrderedList, TaskList, TaskItem } from "@tiptap/extension-list";
import CodeBlock from "@tiptap/extension-code-block";
import Code from "@tiptap/extension-code";
import { TableKit } from "@tiptap/extension-table";
import { Details, DetailsSummary, DetailsContent } from "@tiptap/extension-details";
import { Callout } from "./Callout";
import { BlocosImage } from "./BlocosImage";

export interface SchemaOptions {
  resolveImageSrc?: (src: string) => string;
}

/* triângulo ▸ (vira ▾ quando a seção abre), como na opção A do mock de registros */
const CHEVRON = '<svg viewBox="0 0 24 24"><path d="M9 6.5 16.5 12 9 17.5Z" fill="currentColor"/></svg>';

/* Seção recolhível com um tipo: "arvore" é o bloco de indicações (uma lista recuada desenhada
   como árvore). No arquivo vira <details class="arvore">; outros editores mostram a lista normal. */
const BlocosDetails = Details.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      variant: {
        default: null,
        parseHTML: (el: HTMLElement) => (el.classList.contains("arvore") ? "arvore" : null),
        renderHTML: (attrs: Record<string, unknown>) => (attrs.variant === "arvore" ? { class: "arvore" } : {}),
      },
    };
  },
});

/* No editor, o nome da seção é um bloco de texto comum: o <summary> de verdade o WebKit (app no
   Linux) trata como botão, e o clique duplo e a seleção falhavam. No arquivo .md e no HTML
   exportado continua <summary> (renderHTML não muda). */
const BlocosDetailsSummary = DetailsSummary.extend({
  addNodeView() {
    return () => {
      const dom = document.createElement("div");
      dom.className = "summary";
      dom.setAttribute("data-type", "detailsSummary");
      return { dom, contentDOM: dom };
    };
  },
});

/* Código no meio do texto que aceita cor, destaque, negrito etc. junto (o original descarta
   qualquer outro formato, então a cor escolhida na barra não pegava em números colados como código). */
const BlocosCode = Code.extend({ excludes: "" });

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
      code: false,
    }),
    BlocosCode,
    BlocosBulletList,
    BlocosOrderedList,
    BlocosCodeBlock,
    TextStyle,
    Color,
    // fonte escolhida para um trecho (botão "Fonte" da barra)
    FontFamily,
    Highlight.configure({ multicolor: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    BlocosDetails.configure({
      persist: false,
      HTMLAttributes: { class: "toggle-block" },
      // a contagem ("3 registros") fica ao lado do nome, desenhada por Registros.ts
      renderToggleButton: ({ element, isOpen }) => {
        element.className = "toggle-btn";
        element.setAttribute("aria-label", isOpen ? "Recolher seção" : "Expandir seção");
        if (!element.firstChild) element.innerHTML = CHEVRON;
      },
    }),
    BlocosDetailsSummary,
    DetailsContent,
    Callout,
    BlocosImage.configure({ resolveSrc: opts.resolveImageSrc ?? ((s: string) => s) }),
  ];
}
