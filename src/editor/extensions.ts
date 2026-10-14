import type { AnyExtension } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { schemaExtensions } from "./schema";
import { DocMeta } from "./DocMeta";
import { SlashCommand } from "./SlashCommand";
import { SearchHighlight } from "./SearchHighlight";
import { platform } from "../lib/platform";
import { dirname, isAbsolute, joinPath } from "../lib/paths";

export function resolveImageSrc(src: string, docPath: string | null): string {
  if (!src) return src;
  if (/^(https?:|data:|blob:|asset:|tauri:|http:)/i.test(src)) return src;
  let path = src;
  try {
    path = decodeURI(src);
  } catch {
    /* mantém */
  }
  const abs = isAbsolute(path) ? path : docPath ? joinPath(dirname(docPath), path) : path;
  return platform().assetUrl(abs);
}

export interface BuildOptions {
  getDocPath: () => string | null;
  getEdited: () => number | null;
  onSearch: (s: { current: number; total: number }) => void;
}

export function buildExtensions(o: BuildOptions): AnyExtension[] {
  return [
    ...schemaExtensions({ resolveImageSrc: (src) => resolveImageSrc(src, o.getDocPath()) }),
    Placeholder.configure({
      showOnlyCurrent: true,
      includeChildren: true,
      placeholder: ({ node, editor, pos }) => {
        if (node.type.name === "heading") return node.attrs.level === 1 && pos === 0 ? "Título" : `Título ${node.attrs.level}`;
        if (node.type.name === "detailsSummary") return "Nome da seção";
        if (node.type.name !== "paragraph") return "";
        const parent = editor.state.doc.resolve(pos).parent.type.name;
        return ["doc", "detailsContent", "callout"].includes(parent) ? "Digite “/” para inserir blocos…" : "";
      },
    }),
    DocMeta.configure({ getEdited: o.getEdited }),
    SlashCommand,
    SearchHighlight.configure({ onChange: o.onSearch }),
  ];
}
