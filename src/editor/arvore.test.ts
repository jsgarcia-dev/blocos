import { describe, expect, it } from "vitest";
import { Editor, getSchema } from "@tiptap/core";
import { schemaExtensions } from "./schema";
import { htmlToDoc, markdownToHtml } from "../lib/markdown";
import { directKids, treeLabel, treeStats } from "./Arvore";
import { DocMeta } from "./DocMeta";

const schema = getSchema(schemaExtensions());
const doc = (md: string) => htmlToDoc(markdownToHtml(md), schema);

const TREE = `<details class="arvore">
<summary>Indicações</summary>

- A1 11900000001
  - G1 11900000002
    - G2 11900000003
      - G3 11900000004
    - G5 21900000005
  - G4 21900000006
- B1 41900000007
  - H1 47900000008

</details>
`;

describe("árvore de indicações", () => {
  it("lê o tipo árvore do arquivo", () => {
    expect(doc(TREE).firstChild!.attrs.variant).toBe("arvore");
    expect(doc("<details>\n<summary>x</summary>\n\n- a\n\n</details>\n").firstChild!.attrs.variant).toBeNull();
  });

  it("conta as contas e os níveis", () => {
    const details = doc(TREE).firstChild!;
    expect(treeStats(details)).toEqual({ contas: 8, niveis: 4 });
    expect(treeLabel(details)).toBe("8 contas · 4 níveis");
  });

  it("quantas cada conta convidou diretamente", () => {
    const list = doc(TREE).firstChild!.lastChild!.firstChild!;
    const a1 = list.child(0);
    const g1 = a1.child(1).child(0);
    expect(directKids(a1)).toBe(2);
    expect(directKids(g1)).toBe(2);
    expect(directKids(list.child(1))).toBe(1);
    expect(directKids(g1.child(1).child(1))).toBe(0);
  });
});

describe("selos abaixo do título", () => {
  it("a árvore conta em contas, não em grupos e registros", () => {
    const md = `# Notas\n\n<details>\n<summary>Banco Alfa</summary>\n\n- 11900000001 Ana 11122233344\n\n</details>\n\n${TREE}`;
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [...schemaExtensions(), DocMeta],
      content: markdownToHtml(md),
    });
    const chips = [...editor.view.dom.querySelectorAll(".doc-meta .chip")].map((c) => c.textContent);
    editor.destroy();
    expect(chips).toEqual(["1 grupo", "1 registro", "8 contas"]);
  });
});
