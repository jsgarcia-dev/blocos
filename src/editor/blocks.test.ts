import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { schemaExtensions } from "./schema";
import { wrapSelectionInDetails } from "./blocks";

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function make(html: string) {
  editor = new Editor({ element: document.createElement("div"), extensions: schemaExtensions(), content: html });
  return editor;
}

/** Seleciona do início do texto `a` até o fim do texto `b`. */
function select(ed: Editor, a: string, b: string) {
  let from = -1;
  let to = -1;
  ed.state.doc.descendants((n, pos) => {
    if (!n.isText) return true;
    if (from < 0 && n.text!.includes(a)) from = pos + n.text!.indexOf(a);
    if (n.text!.includes(b)) to = pos + n.text!.indexOf(b) + b.length;
    return true;
  });
  ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, from, to)));
}

/** JSON do documento, só com o que os testes olham. */
type J = { type: string; text?: string; content?: J[] };
const doc = (ed: Editor) => ed.getJSON() as J;

const shape = (n: J): unknown => (n.text !== undefined ? n.text : { [n.type]: (n.content ?? []).map(shape) });

describe("wrapSelectionInDetails (botão da barra com texto selecionado)", () => {
  it("põe as linhas selecionadas dentro da seção, uma por registro, e o nome fica vazio com o cursor nele", () => {
    const ed = make("<h1>Contas</h1><p>11900000001 Ana</p><p>41900000002 Bruno</p><p>79900000003 Carla</p><p>depois</p>");
    select(ed, "11900000001", "Carla");
    expect(wrapSelectionInDetails(ed)).toBe(true);
    const json = doc(ed);
    expect(json.content!.map((n) => n.type)).toEqual(["heading", "details", "paragraph"]);
    expect(shape(json.content![1])).toEqual({
      details: [
        { detailsSummary: [] },
        { detailsContent: [{ bulletList: [{ listItem: [{ paragraph: ["11900000001 Ana"] }] }, { listItem: [{ paragraph: ["41900000002 Bruno"] }] }, { listItem: [{ paragraph: ["79900000003 Carla"] }] }] }] },
      ],
    });
    expect(ed.state.selection.$from.parent.type.name).toBe("detailsSummary");
  });

  it("linhas quebradas dentro do mesmo parágrafo também viram um registro cada", () => {
    const ed = make("<p>um<br>dois<br><br>três</p>");
    select(ed, "um", "três");
    wrapSelectionInDetails(ed);
    const list = doc(ed).content![0].content![1].content![0];
    expect(list.content!.map((li) => li.content![0].content![0].text)).toEqual(["um", "dois", "três"]);
  });

  it("título, lista e outros blocos entram como estão", () => {
    const ed = make("<h2>Banco</h2><ul><li><p>item</p></li></ul>");
    select(ed, "Banco", "item");
    wrapSelectionInDetails(ed);
    const content = doc(ed).content![0].content![1].content!.map((n) => n.type);
    expect(content).toEqual(["heading", "bulletList"]);
  });

  it("sem seleção não faz nada (o botão cria uma seção vazia)", () => {
    const ed = make("<p>texto</p>");
    expect(wrapSelectionInDetails(ed)).toBe(false);
    expect(doc(ed).content![0].type).toBe("paragraph");
  });
});
