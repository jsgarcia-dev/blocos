import { Extension } from "@tiptap/core";
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Registros dentro das seções recolhíveis (ex.: um grupo por banco, uma linha por pessoa com
 * número, nome completo e CPF). Só muda a aparência: os números longos ganham o destaque
 * cinza do mock e um "·" antes do último; o texto salvo continua como foi digitado.
 * (Colar várias linhas numa lista, um item por linha, fica em plainPaste.ts.)
 */

/** Números com pelo menos tantos dígitos viram destaque (telefone, CPF, conta…). */
const MIN_DIGITS = 8;
// dígitos com . - / no meio e, opcionalmente, um DDD entre parênteses na frente
const NUMBER_RE = /(?:\(\d{2}\)\s?)?\d[\d.\-/]*\d/g;
// antes destes caracteres o "·" não aparece: a pessoa já separou do seu jeito
const SEPARATORS = /[·•\-–—|:;,/]$/;

export interface RecordToken {
  from: number;
  to: number;
  /** Mostra "·" antes (há texto antes e nenhum separador digitado). */
  sep: boolean;
}

/** Números de um trecho de texto que ganham destaque. */
export function recordTokens(text: string): RecordToken[] {
  const out: RecordToken[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const from = m.index ?? 0;
    const to = from + m[0].length;
    // não pega pedaço de palavra ("AB1234567890") nem de número maior
    if (/[\p{L}\d]/u.test(text[from - 1] ?? "") || /[\p{L}\d]/u.test(text[to] ?? "")) continue;
    if (m[0].replace(/\D/g, "").length < MIN_DIGITS) continue;
    out.push({ from, to, sep: false });
  }
  // "·" só antes do último número da linha, quando há texto (o nome) entre ele e o número anterior
  if (out.length) {
    const last = out[out.length - 1];
    const between = text.slice(out.length >= 2 ? out[out.length - 2].to : 0, last.from).trim();
    if (between && !SEPARATORS.test(between)) last.sep = true;
  }
  return out;
}

/** Item de lista dentro de uma seção recolhível? */
function inRecordsGroup($pos: ResolvedPos): boolean {
  let item = false;
  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name;
    if (name === "listItem") item = true;
    if (name === "detailsContent") return item;
  }
  return false;
}

/** A seção tem registros (algum item com número longo)? Usado no selo "N registros". */
export function hasRecords(details: PMNode): boolean {
  let found = false;
  details.descendants((n) => {
    if (found) return false;
    if (n.type.name === "listItem" && recordTokens(n.textContent).length) found = true;
    return !found;
  });
  return found;
}

/** Selo da seção ao lado do nome: "3 registros" (com números) ou "2 itens"; vazio sem itens. */
export function sectionLabel(details: PMNode): string {
  let n = 0;
  details.descendants((c) => {
    if (c.type.name === "listItem" || c.type.name === "taskItem") n++;
    return true;
  });
  if (!n) return "";
  const [um, varios] = hasRecords(details) ? ["registro", "registros"] : ["item", "itens"];
  return `${n} ${n === 1 ? um : varios}`;
}

function decorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    // selo com a contagem logo depois do nome da seção (dentro da linha do título)
    if (node.type.name === "details" && node.firstChild?.type.name === "detailsSummary") {
      const label = sectionLabel(node);
      if (label) {
        decos.push(
          Decoration.widget(
            pos + 2 + node.firstChild.content.size,
            () => {
              const s = document.createElement("span");
              s.className = "sec-count";
              s.textContent = label;
              s.contentEditable = "false";
              return s;
            },
            { side: 1, ignoreSelection: true, key: `sec-count:${label}` },
          ),
        );
      }
    }
    if (!node.isTextblock) return true;
    if (!inRecordsGroup(doc.resolve(pos + 1))) return false;
    // posição de cada caractere do texto do parágrafo no documento
    const text = node.textContent;
    const at: number[] = [];
    node.forEach((child, offset) => {
      const len = child.isText ? child.text!.length : 0;
      for (let i = 0; i < len; i++) at.push(pos + 1 + offset + i);
    });
    for (const t of recordTokens(text)) {
      const from = at[t.from];
      const to = at[t.to - 1] + 1;
      if (from === undefined || Number.isNaN(to)) continue;
      decos.push(Decoration.inline(from, to, { class: "reg-num" }));
      if (t.sep) {
        decos.push(
          Decoration.widget(
            from,
            () => {
              const s = document.createElement("span");
              s.className = "reg-dot";
              s.textContent = "·";
              s.contentEditable = "false";
              return s;
            },
            { side: -1, ignoreSelection: true, key: "reg-dot" },
          ),
        );
      }
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

const key = new PluginKey<DecorationSet>("blocosRegistros");

export const Registros = Extension.create({
  name: "registros",
  // antes do Enter da seção recolhível (que criaria uma linha solta no topo do grupo)
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      // Enter no nome do grupo (ex.: o banco) vai para a primeira linha da lista de registros
      Enter: ({ editor }) => {
        const { state, view } = editor;
        const { $head, empty } = state.selection;
        if (!empty || $head.parent.type.name !== "detailsSummary") return false;
        const detailsPos = $head.before($head.depth - 1);
        const details = state.doc.nodeAt(detailsPos);
        const dom = view.nodeDOM(detailsPos) as HTMLElement | null;
        if (!details || !dom?.classList.contains("is-open")) return false;
        const content = details.lastChild;
        const list = content?.firstChild;
        if (!content || content.type.name !== "detailsContent" || !list || list.type.name !== "bulletList") return false;
        // posição do primeiro item: detalhes > [resumo] conteúdo > lista > item > parágrafo
        const listPos = detailsPos + 1 + details.firstChild!.nodeSize + 1;
        const first = list.firstChild!;
        if (first.textContent === "" && first.firstChild?.type.name === "paragraph") {
          return editor.commands.setTextSelection(listPos + 3);
        }
        const { listItem, paragraph } = state.schema.nodes;
        const tr = state.tr.insert(listPos + 1, listItem.create(null, paragraph.create()));
        tr.setSelection(TextSelection.create(tr.doc, listPos + 3)).scrollIntoView();
        view.dispatch(tr);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => decorations(state.doc),
          apply: (tr, old) => (tr.docChanged ? decorations(tr.doc) : old),
        },
        props: {
          decorations: (state) => key.getState(state),
        },
      }),
    ];
  },
});
