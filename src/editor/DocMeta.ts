import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { formatEdited } from "../lib/format";

export interface DocMetaOptions {
  /** Momento da última edição (ou modificação no disco), se houver. */
  getEdited: () => number | null;
}

const CLOCK =
  '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';

/**
 * Mostra selos logo abaixo do título principal (H1): quando foi editado,
 * quantos grupos (títulos H2 e seções recolhíveis) e quantos registros (itens de lista).
 */
export const DocMeta = Extension.create<DocMetaOptions>({
  name: "docMeta",

  addOptions() {
    return { getEdited: () => null };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: new PluginKey("docMeta"),
        props: {
          decorations(state) {
            // "Banco Alfa — Equipe Norte": o trecho depois do travessão fica mais suave nos títulos
            const dims: Decoration[] = [];
            state.doc.descendants((n, pos) => {
              const isTitle = (n.type.name === "heading" && n.attrs.level >= 2) || n.type.name === "detailsSummary";
              if (!isTitle) return !n.isTextblock;
              const text = n.textContent;
              // o trecho suave começa no travessão; o espaço antes fica com o peso do título (como no mock)
              const i = text.indexOf(" — ") + 1;
              if (i > 1) {
                // converte o deslocamento no texto em posição do documento
                let offset = 0;
                let start = -1;
                n.forEach((child, childOffset) => {
                  if (start >= 0) return;
                  const len = child.isText ? child.text!.length : 1;
                  if (i < offset + len) start = pos + 1 + childOffset + (i - offset);
                  offset += len;
                });
                if (start >= 0) dims.push(Decoration.inline(start, pos + n.nodeSize - 1, { class: "dim" }));
              }
              return false;
            });
            const first = state.doc.firstChild;
            if (!first || first.type.name !== "heading" || first.attrs.level !== 1 || first.childCount === 0) {
              return dims.length ? DecorationSet.create(state.doc, dims) : null;
            }
            let groups = 0;
            let records = 0;
            state.doc.descendants((n) => {
              if ((n.type.name === "heading" && n.attrs.level === 2) || n.type.name === "details") groups++;
              if (n.type.name === "listItem" || n.type.name === "taskItem") records++;
              return true;
            });
            const chips: { icon?: string; text: string }[] = [];
            const edited = options.getEdited();
            if (edited) chips.push({ icon: CLOCK, text: `Editado ${formatEdited(edited)}` });
            if (groups) chips.push({ text: `${groups} ${groups === 1 ? "grupo" : "grupos"}` });
            if (records) chips.push({ text: `${records} ${records === 1 ? "registro" : "registros"}` });
            if (!chips.length) return dims.length ? DecorationSet.create(state.doc, dims) : null;
            const key = "meta:" + chips.map((c) => c.text).join("|");
            const widget = Decoration.widget(
              first.nodeSize,
              () => {
                const el = document.createElement("div");
                el.className = "doc-meta";
                el.contentEditable = "false";
                for (const c of chips) {
                  const chip = document.createElement("span");
                  chip.className = "chip";
                  chip.innerHTML = (c.icon ?? "") + `<span>${c.text}</span>`;
                  el.appendChild(chip);
                }
                return el;
              },
              { key, side: -1, ignoreSelection: true },
            );
            return DecorationSet.create(state.doc, [widget, ...dims]);
          },
        },
      }),
    ];
  },
});
