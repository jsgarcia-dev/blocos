import { Node, mergeAttributes } from "@tiptap/core";

export type CalloutVariant = "note" | "tip" | "important" | "warning" | "caution";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Envolve os blocos selecionados numa caixa de destaque (ou insere uma vazia). */
      setCallout: (variant?: CalloutVariant) => ReturnType;
      toggleCallout: (variant?: CalloutVariant) => ReturnType;
    };
  }
}

/** Caixa de destaque, gravada como alerta do GitHub: `> [!NOTE]`. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: "note",
        parseHTML: (el) => (el.getAttribute("data-variant") as CalloutVariant) || "note",
        renderHTML: (attrs) => ({ "data-variant": attrs.variant }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout", class: "callout" }),
      ["span", { class: "callout-icon", contenteditable: "false" }],
      ["div", { class: "callout-body" }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (variant = "note") =>
        ({ commands }) =>
          commands.wrapIn(this.name, { variant }),
      toggleCallout:
        (variant = "note") =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { variant }),
    };
  },
});
