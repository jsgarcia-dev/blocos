import { Fragment, Slice } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Colar sempre como texto puro: nada da formatação de onde o texto veio (cor, fundo, negrito,
 * links, títulos…) nem a do ponto onde o cursor está. Linhas viram parágrafos — ou itens, se
 * o cursor estiver numa lista (um registro por linha). Dentro de código, cola exatamente como veio.
 */

/** Linhas de um texto colado, sem as vazias e sem espaços no fim. */
export function pastedLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim());
}

/** Texto de um HTML colado, quando a área de transferência não traz a versão em texto. */
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, tr, blockquote, pre").forEach((el) => el.append("\n"));
  return doc.body.textContent ?? "";
}

export function pastePlainText(view: EditorView, text: string): boolean {
  const { state } = view;
  const { schema, selection } = state;
  const { $from, from, to } = selection;

  if ($from.parent.type.spec.code) {
    view.dispatch(state.tr.insertText(text.replace(/\r\n?/g, "\n"), from, to).scrollIntoView());
    return true;
  }

  const lines = pastedLines(text);
  if (!lines.length) return true;
  const plain = (s: string) => schema.text(s);

  // uma linha só, ou um lugar que só aceita uma linha (o nome de uma seção recolhível)
  if (lines.length === 1 || $from.parent.type.name === "detailsSummary") {
    const line = lines.length === 1 ? text.replace(/\r?\n$/, "").replace(/\r\n?|\n/g, " ") : lines.join(" ");
    view.dispatch(state.tr.replaceSelectionWith(plain(line), false).scrollIntoView());
    return true;
  }

  // numa lista: a primeira linha fica no item atual e cada uma das outras vira um item novo
  let d = $from.depth;
  while (d > 0 && $from.node(d).type.name !== "listItem") d--;
  if (d > 0 && $from.parent.type.name === "paragraph") {
    const { listItem, paragraph } = schema.nodes;
    const tr = state.tr.replaceWith(from, to, plain(lines[0]));
    const after = tr.mapping.map($from.after(d));
    const items = lines.slice(1).map((l) => listItem.create(null, paragraph.create(null, plain(l))));
    tr.insert(after, items);
    const end = after + items.reduce((s, n) => s + n.nodeSize, 0);
    tr.setSelection(TextSelection.near(tr.doc.resolve(end - 2), -1));
    view.dispatch(tr.scrollIntoView());
    return true;
  }

  // várias linhas: um parágrafo por linha (a primeira e a última se juntam ao texto em volta)
  const paragraphs = lines.map((l) => schema.nodes.paragraph.create(null, plain(l)));
  view.dispatch(state.tr.replaceSelection(new Slice(Fragment.from(paragraphs), 1, 1)).scrollIntoView());
  return true;
}
