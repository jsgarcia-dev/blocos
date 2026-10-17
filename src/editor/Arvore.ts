import { Extension } from "@tiptap/core";
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Indicações em árvore: uma seção recolhível do tipo "arvore" (<details class="arvore">) com
 * uma lista recuada dentro — cada item é uma conta e os itens recuados embaixo dele são as contas
 * que ela convidou. Aqui só a aparência (linhas, seta para recolher cada galho, quantas convidou,
 * código da conta em negrito); o arquivo continua uma lista comum.
 */

const LISTS = new Set(["bulletList", "orderedList"]);
const isItem = (n: PMNode) => n.type.name === "listItem" || n.type.name === "taskItem";
// código da conta no começo da linha: "A1", "G12", "T3 -"…
const CODE_RE = /^\s*([\p{L}]{1,4}\d{1,4})(?=$|\s|[-–—:·])/u;

/** A posição está dentro de uma árvore de indicações? */
export function inTree($pos: ResolvedPos): boolean {
  for (let d = $pos.depth; d > 0; d--) {
    const n = $pos.node(d);
    if (n.type.name === "details") return n.attrs.variant === "arvore";
  }
  return false;
}

/** Quantas contas e quantos níveis a árvore tem. */
export function treeStats(details: PMNode): { contas: number; niveis: number } {
  let contas = 0;
  let niveis = 0;
  const walk = (node: PMNode, level: number) => {
    node.forEach((child) => {
      if (isItem(child)) {
        contas++;
        niveis = Math.max(niveis, level);
        walk(child, level + 1);
      } else if (LISTS.has(child.type.name) || child.type.name === "detailsContent") {
        walk(child, level);
      }
    });
  };
  walk(details, 1);
  return { contas, niveis };
}

/** Selo ao lado do nome da árvore: "8 contas · 4 níveis". */
export function treeLabel(details: PMNode): string {
  const { contas, niveis } = treeStats(details);
  if (!contas) return "";
  return `${contas} ${contas === 1 ? "conta" : "contas"} · ${niveis} ${niveis === 1 ? "nível" : "níveis"}`;
}

/** Contas convidadas diretamente por um item (os itens da lista logo abaixo dele). */
export function directKids(item: PMNode): number {
  let n = 0;
  item.forEach((c) => {
    if (LISTS.has(c.type.name)) c.forEach((i) => void (isItem(i) && n++));
  });
  return n;
}

function decorations(doc: PMNode, collapsed: readonly number[]): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "details" || node.attrs.variant !== "arvore") return true;
    node.descendants((child, rel) => {
      if (!isItem(child)) return true;
      const at = pos + 1 + rel;
      const $at = doc.resolve(at);
      const root = $at.node($at.depth - 1).type.name === "detailsContent";
      const kids = directKids(child);
      const attrs: Record<string, string> = {};
      if (root) attrs.class = "arv-raiz";
      if (kids) attrs["data-galho"] = collapsed.includes(at) ? "fechado" : "aberto";
      if (Object.keys(attrs).length) decos.push(Decoration.node(at, at + child.nodeSize, attrs));
      const para = child.firstChild;
      // "2 convidadas": o selo é desenhado no fim do texto, então o atributo vai no parágrafo
      if (kids && para?.type.name === "paragraph") {
        const label = root ? `${kids} ${kids === 1 ? "convidada" : "convidadas"}` : String(kids);
        decos.push(Decoration.node(at + 1, at + 1 + para.nodeSize, { "data-kids": label }));
      }
      // código da conta em negrito (a primeira palavra, se tiver o jeito de "A1", "G12")
      const code = para?.type.name === "paragraph" ? CODE_RE.exec(para.textContent) : null;
      if (code && para!.firstChild?.isText && para!.firstChild.text!.length >= code[0].length) {
        const start = at + 2 + code[0].length - code[1].length;
        decos.push(Decoration.inline(start, start + code[1].length, { class: "arv-cod" }));
      }
      return true;
    });
    return false;
  });
  return DecorationSet.create(doc, decos);
}

interface TreeState {
  /** Posições dos itens com o galho recolhido (só nesta sessão; o arquivo não guarda). */
  collapsed: number[];
  decos: DecorationSet;
}

const key = new PluginKey<TreeState>("blocosArvore");

export const Arvore = Extension.create({
  name: "arvore",

  addProseMirrorPlugins() {
    return [
      new Plugin<TreeState>({
        key,
        state: {
          init: (_, state) => ({ collapsed: [], decos: decorations(state.doc, []) }),
          apply(tr, old) {
            const toggle = tr.getMeta(key) as { toggle: number } | undefined;
            if (!tr.docChanged && !toggle) return old;
            let collapsed = old.collapsed
              .map((p) => tr.mapping.mapResult(p, 1))
              .filter((r) => !r.deleted)
              .map((r) => r.pos);
            if (toggle) {
              collapsed = collapsed.includes(toggle.toggle) ? collapsed.filter((p) => p !== toggle.toggle) : [...collapsed, toggle.toggle];
            }
            return { collapsed, decos: decorations(tr.doc, collapsed) };
          },
        },
        props: {
          decorations: (state) => key.getState(state)?.decos,
          handleDOMEvents: {
            // a seta de cada galho é desenhada pelo CSS antes do texto: clique ali recolhe/abre
            mousedown(view, event) {
              const li = (event.target as HTMLElement | null)?.closest?.("li[data-galho]") as HTMLElement | null;
              if (!li || !li.closest(".arvore")) return false;
              const p = li.querySelector(":scope > p");
              if (!p) return false;
              const r = p.getBoundingClientRect();
              const lineHeight = parseFloat(getComputedStyle(p).lineHeight) || 26;
              if (event.clientX >= r.left || event.clientX < r.left - 22 || event.clientY > r.top + lineHeight) return false;
              const pos = view.posAtDOM(li, 0) - 1;
              view.dispatch(view.state.tr.setMeta(key, { toggle: pos }));
              event.preventDefault();
              return true;
            },
          },
        },
      }),
    ];
  },
});
