import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { DOMParser as PMDOMParser, Node as PMNode } from "@tiptap/pm/model";
import { schemaExtensions } from "../../editor/schema";
import { PARSE_OPTIONS, createLossless, docToMarkdown, markdownToHtml, splitFrontmatter } from "./index";

const extensions = schemaExtensions();
const schema = getSchema(extensions);

// mesmo jeito que o editor lê o HTML (opção parseOptions do editor)
function htmlToDoc(html: string): PMNode {
  const el = document.createElement("div");
  el.innerHTML = html;
  return PMDOMParser.fromSchema(schema).parse(el, PARSE_OPTIONS);
}
function toDoc(md: string): PMNode {
  return htmlToDoc(markdownToHtml(md));
}
function roundTrip(md: string): string {
  return docToMarkdown(toDoc(md));
}

describe("ida e volta sem perder nada", () => {
  const cases: Record<string, string> = {
    títulos: "# Controle de clientes\n\n## Banco Alfa — Equipe Norte\n\n### Tarefas\n",
    "código com cor e negrito": "- <span style=\"color: #E5484D\">`11900000001`</span> Ana **`x`** `y`\n",
    "nome da seção com cor, destaque e negrito": "<details>\n<summary><span style=\"color: #1C7ED6\"><mark style=\"background-color: #C3F0C8\">Pic</mark></span><strong>Pay</strong> <mark>&lt;novo&gt;</mark></summary>\n\n- item\n\n</details>\n",
    "negrito, itálico, tachado e código": "Texto **forte**, *leve*, ~~riscado~~ e `AB1`.\n",
    sublinhado: "Um <u>sublinhado</u> aqui.\n",
    "destaque amarelo": "Status: ==conferir documento==\n",
    "destaque colorido": 'Status: <mark style="background-color: #C3F0C8">ok</mark>\n',
    "cor do texto": 'Atenção: <span style="color: #E5484D">urgente</span>\n',
    "lista simples": "- AB1 — Ana Ribeiro\n- AB2 — Bruno Matos\n  - Observação: só pela manhã\n",
    "lista numerada": "1. primeiro\n2. segundo\n3. terceiro\n",
    "lista de tarefas": "- [x] Atualizar cadastros\n- [ ] Enviar relatório\n",
    link: "Veja o [Portal do cliente](https://portal.exemplo.com).\n",
    "link solto": "Acesse https://exemplo.com hoje\n",
    "e-mail e www soltos": "Contato: fulano@exemplo.com ou www.exemplo.com.br\n",
    citação: "> uma citação\n",
    "caixa de destaque": "> [!NOTE]\n> Tudo é salvo como .md.\n",
    "caixa de aviso": "> [!WARNING]\n> Cuidado com isto.\n",
    "bloco de código": "```js\nconst a = 1 < 2;\n```\n",
    divisor: "antes\n\n---\n\ndepois\n",
    imagem: "![logo](imagens/logo.png)\n",
    tabela: "| Grupo      | Registros |\n| ---------- | --------- |\n| Banco Alfa | 3         |\n| Banco Beta | 2         |\n",
    "seção recolhível":
      "<details>\n<summary>Banco Beta — Equipe Sul</summary>\n\n- AC1 — Diego Prado\n- AC2 — Elisa Torres\n\n</details>\n",
    "quebra de linha simples": "linha um\nlinha dois\nlinha três\n",
  };
  for (const [name, md] of Object.entries(cases)) {
    it(name, () => {
      expect(roundTrip(md)).toBe(md);
    });
  }
});

describe("leitura", () => {
  it("entende tarefas e caixas de destaque", () => {
    const doc = toDoc("- [x] feito\n- [ ] falta\n\n> [!TIP]\n> dica\n").toJSON();
    expect(doc.content[0].type).toBe("taskList");
    expect(doc.content[0].content[0].attrs.checked).toBe(true);
    expect(doc.content[1].type).toBe("callout");
    expect(doc.content[1].attrs.variant).toBe("tip");
  });

  it("lista mista continua lista comum", () => {
    expect(toDoc("- [ ] tarefa\n- item\n").toJSON().content[0].type).toBe("bulletList");
  });

  it("seção recolhível guarda resumo e conteúdo", () => {
    const doc = toDoc("<details>\n<summary>Grupo</summary>\n\n- a\n- b\n\n</details>\n").toJSON();
    expect(doc.content[0].type).toBe("details");
    expect(doc.content[0].content[0].type).toBe("detailsSummary");
    expect(doc.content[0].content[1].type).toBe("detailsContent");
  });

  it("separa e devolve o frontmatter", () => {
    const { frontmatter, body } = splitFrontmatter("---\ntitle: x\n---\n# Oi\n");
    expect(frontmatter).toBe("---\ntitle: x\n---\n");
    expect(docToMarkdown(toDoc(body), frontmatter)).toBe("---\ntitle: x\n---\n# Oi\n");
  });
});

describe("escrita segura", () => {
  it("texto com < e == não vira HTML nem destaque", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("a <b> c == d")])]);
    const md = docToMarkdown(doc);
    expect(roundTrip(md)).toBe(md);
    expect(toDoc(md).textContent).toBe("a <b> c == d");
  });

  it("texto que parece Markdown é escapado", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("# não é título *nem* lista")])]);
    expect(toDoc(docToMarkdown(doc)).firstChild?.type.name).toBe("paragraph");
    expect(toDoc(docToMarkdown(doc)).textContent).toBe("# não é título *nem* lista");
  });

  it("não suja o texto com escapes desnecessários", () => {
    const md = "[BANCO A]\nAB1 - nome_sobrenome ~ aprox.\n";
    expect(roundTrip(md)).toBe(md);
    const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("[CONTA Y] arquivo_final.txt")])]);
    expect(docToMarkdown(doc)).toBe("[CONTA Y] arquivo_final.txt\n");
  });

  it("colchetes que formariam link continuam escapados", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("[texto](http://x.com)")])]);
    const md = docToMarkdown(doc);
    expect(toDoc(md).textContent).toBe("[texto](http://x.com)");
    expect(toDoc(md).firstChild?.firstChild?.marks.length ?? 0).toBe(0);
  });

  it("documento vazio vira arquivo vazio", () => {
    expect(docToMarkdown(schema.node("doc", null, [schema.node("paragraph")]))).toBe("");
  });

  it("estrutura completa do mock sobrevive", () => {
    const md = [
      "# Controle de clientes",
      "",
      "## Banco Alfa — Equipe Norte",
      "",
      "- `AB1` Ana Ribeiro · (11) 90000-0001 · ==conferir documento==",
      "- `AB2` Bruno Matos · (11) 90000-0002",
      '- `AB3` Carla Nunes · (21) 90000-0003 · <mark style="background-color: #C3F0C8">ok</mark>',
      "",
      "<details>",
      "<summary>Banco Beta — Equipe Sul</summary>",
      "",
      "- `AC1` Diego Prado",
      "- `AC2` Elisa Torres",
      "",
      "</details>",
      "",
      "> [!NOTE]",
      "> Tudo é salvo como .md.",
      "",
    ].join("\n");
    expect(roundTrip(md)).toBe(md);
  });
});

describe("revisão: o texto do usuário nunca some nem muda", () => {
  const cases: Record<string, string> = {
    "texto entre < >": "Enviar para <nome do cliente> amanhã\n\nPrazo: <TODO>\n",
    "linha só com tag desconhecida": "<assinatura>\n",
    "comentário HTML": "antes\n\n<!-- nota -->\n\ndepois\n",
    "bloco HTML desconhecido": "<div class=\"x\">conteúdo</div>\n",
    "espaços repetidos e tabulação": "AB1    Ana Ribeiro\nAB2\tBruno\n",
    "títulos H4 a H6": "#### Seção\n\n##### Sub\n\n###### Mínimo\n",
  };
  for (const [name, md] of Object.entries(cases)) {
    it(name, () => {
      expect(roundTrip(md)).toBe(md);
    });
  }

  it("linhas depois de uma quebra simples continuam texto", () => {
    for (const second of ["---", "- x", "# x", "> x", "1. x", "==="]) {
      const doc = schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("Total"), schema.node("hardBreak"), schema.text(second)]),
      ]);
      const back = toDoc(docToMarkdown(doc));
      expect(back.childCount, second).toBe(1);
      expect(back.firstChild!.type.name, second).toBe("paragraph");
      expect(back.textContent, second).toBe("Total" + second);
    }
  });

  it("parágrafo começando com 1) não vira lista", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("1) Ligar")])]);
    const back = toDoc(docToMarkdown(doc));
    expect(back.firstChild!.type.name).toBe("paragraph");
    expect(back.textContent).toBe("1) Ligar");
  });

  it("título terminando com # mantém o #", () => {
    const doc = schema.node("doc", null, [schema.node("heading", { level: 2 }, [schema.text("Nota #")])]);
    expect(toDoc(docToMarkdown(doc)).textContent).toBe("Nota #");
  });

  it("tabela com células mescladas não desloca colunas", () => {
    const doc = htmlToDoc(
      "<table><tr><th>Nome</th><th>Qtd</th><th>Obs</th></tr><tr><td colspan='2'>222</td><td>x</td></tr><tr><td>a</td><td>b</td><td>c</td></tr></table>",
    );
    const md = docToMarkdown(doc);
    const rows = md.trim().split("\n").map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
    expect(rows[2]).toEqual(["222", "", "x"]);
    expect(rows[3]).toEqual(["a", "b", "c"]);
  });
});

describe("salvar sem perdas: o que você não editou fica idêntico", () => {
  function open(md: string) {
    const { frontmatter, body } = splitFrontmatter(md);
    const doc = toDoc(body);
    const ll = createLossless(doc, body, (m) => toDoc(m));
    expect(ll).not.toBeNull();
    return { doc, ll: ll!, frontmatter };
  }

  const files = [
    "* item um\n* item dois\n\n\n\nParágrafo   com  espaços  \ncontinuação\n\n[ref]: https://exemplo.com\n",
    "Título\n======\n\nTexto com __negrito__ e _itálico_\n\n+ mais\n+ itens\n\n1) um\n2) dois\n\n~~~\ncódigo\n~~~\n",
    "<details>\n<summary>Grupo</summary>\n\n* a\n* b\n\n</details>\n\n> [!NOTE]\n> nota\n",
    "sem quebra no fim",
    "\n\n# Começa com linhas vazias\n",
    "---\ntitulo: x\n---\n\n*   lista com recuo estranho\n*   outro\n\n| a | b |\n|---|---|\n| 1 | 2 |\n",
    "[BANCO A]\nAB1 - 11900000001  CONTA TESTE\n\n[BANCO B]\nAB2 - 11900000002\n",
  ];
  for (const f of files) {
    it(`abre e salva idêntico: ${JSON.stringify(f.slice(0, 30))}`, () => {
      const { doc, ll, frontmatter } = open(f);
      expect(ll.serialize(doc, frontmatter)).toBe(f);
    });
  }

  it("editar um bloco não muda os outros", () => {
    const f = "* item um\n* item dois\n\n\n\nParágrafo   original\n\n__forte__ aqui\n";
    const { doc, ll } = open(f);
    const para = schema.node("paragraph", null, [schema.text("Parágrafo editado")]);
    const edited = schema.node("doc", null, [doc.child(0), para, doc.child(2)]);
    expect(ll.serialize(edited, null)).toBe("* item um\n* item dois\n\nParágrafo editado\n\n__forte__ aqui\n");
  });

  it("lista editada mantém o marcador do arquivo", () => {
    const { doc, ll } = open("* um\n* dois\n");
    const list = doc.child(0);
    const item = schema.node("listItem", null, [schema.node("paragraph", null, [schema.text("três")])]);
    const edited = schema.node("doc", null, [schema.node("bulletList", list.attrs, [list.child(0), list.child(1), item])]);
    expect(ll.serialize(edited, null)).toBe("* um\n* dois\n* três\n");
  });

  it("apagar o último bloco não perde a definição de link que vinha depois", () => {
    const f = "Veja [site][r]\n\nOutro\n\n[r]: https://x.com\n";
    const { doc, ll } = open(f);
    const edited = schema.node("doc", null, [doc.child(0)]);
    const out = ll.serialize(edited, null);
    expect(out).toContain("[r]: https://x.com");
    expect(toDoc(out).textContent).toContain("Veja site");
  });
});
