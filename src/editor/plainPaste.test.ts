import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { schemaExtensions } from "./schema";
import { htmlToPlainText, pastePlainText } from "./plainPaste";

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function make(html: string) {
  editor = new Editor({ element: document.createElement("div"), extensions: schemaExtensions(), content: html });
  return editor;
}

/** JSON do documento, só com o que os testes olham. */
type J = { type: string; text?: string; content?: J[] };
const doc = (ed: Editor) => ed.getJSON() as J;

/** Põe o cursor logo depois do texto `after`. */
function cursorAfter(ed: Editor, after: string) {
  let at = -1;
  ed.state.doc.descendants((n, pos) => {
    if (at < 0 && n.isText && n.text!.includes(after)) at = pos + n.text!.indexOf(after) + after.length;
    return at < 0;
  });
  ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, at)));
}

/** Marcas (negrito, destaque…) presentes no documento. */
function marks(ed: Editor, text: string): string[] {
  const out = new Set<string>();
  ed.state.doc.descendants((n) => {
    if (n.isText && n.text!.includes(text)) n.marks.forEach((m) => out.add(m.type.name));
    return true;
  });
  return [...out];
}

describe("pastePlainText", () => {
  it("não traz a formatação do ponto onde o cursor está (destaque, negrito)", () => {
    const ed = make('<p><mark data-color="#FFE066">fundo <strong>forte</strong></mark></p>');
    cursorAfter(ed, "forte");
    pastePlainText(ed.view, " colado");
    expect(ed.state.doc.textContent).toBe("fundo forte colado");
    expect(marks(ed, "colado")).toEqual([]);
  });

  it("várias linhas viram parágrafos, sem as vazias", () => {
    const ed = make("<p>início</p>");
    cursorAfter(ed, "início");
    pastePlainText(ed.view, " A\r\n\r\nB\nC\n");
    const paras = (doc(ed).content ?? []).map((p) => (p.content ?? []).map((t) => t.text).join(""));
    expect(paras).toEqual(["início A", "B", "C"]);
  });

  it("numa lista, cada linha vira um item", () => {
    const ed = make("<ul><li><p></p></li></ul>");
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 3)));
    pastePlainText(ed.view, "um\ndois\ntrês");
    const items = doc(ed).content![0].content!.map((li) => li.content![0].content![0].text);
    expect(items).toEqual(["um", "dois", "três"]);
  });

  it("dentro de código cola exatamente como veio", () => {
    const ed = make("<pre><code>x</code></pre>");
    cursorAfter(ed, "x");
    pastePlainText(ed.view, "\n  linha 2\n\n  linha 4");
    expect(ed.state.doc.textContent).toBe("x\n  linha 2\n\n  linha 4");
  });

  it("HTML sem versão em texto vira texto com quebras de linha", () => {
    expect(htmlToPlainText('<p style="background:yellow">um</p><div>dois<br>três</div>').split("\n").filter(Boolean)).toEqual([
      "um",
      "dois",
      "três",
    ]);
  });
});

describe("cor do texto sobre código", () => {
  it("a cor escolhida na barra pega também em texto com destaque de código", () => {
    const ed = make("<p><code>11900000001</code> Ana</p>");
    ed.chain().setTextSelection({ from: 1, to: 12 }).setColor("#1C7ED6").run();
    expect(marks(ed, "11900000001").sort()).toEqual(["code", "textStyle"]);
  });
});
