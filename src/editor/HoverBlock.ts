import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Destaque do bloco sob o mouse (o fundo bege do mock), como decoração do editor. */
export const hoverKey = new PluginKey<number | null>("blocosHover");

export const HoverBlock = Extension.create({
  name: "blocosHover",
  addProseMirrorPlugins() {
    return [
      new Plugin<number | null>({
        key: hoverKey,
        state: {
          init: () => null,
          apply(tr, prev) {
            const meta = tr.getMeta(hoverKey);
            if (meta !== undefined) return meta as number | null;
            if (prev === null || !tr.docChanged) return prev;
            const mapped = tr.mapping.mapResult(prev);
            return mapped.deleted ? null : mapped.pos;
          },
        },
        props: {
          decorations(state) {
            const pos = hoverKey.getState(state);
            if (pos === null || pos === undefined) return null;
            const node = state.doc.nodeAt(pos);
            if (!node || !node.isBlock) return null;
            return DecorationSet.create(state.doc, [Decoration.node(pos, pos + node.nodeSize, { class: "is-hovered" })]);
          },
        },
      }),
    ];
  },
});
