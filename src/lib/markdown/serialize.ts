import { MarkdownSerializer, MarkdownSerializerState } from "prosemirror-markdown";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import { TableMap } from "@tiptap/pm/tables";
import { isDefaultHighlight, toHex } from "../colors";
import { KNOWN_TAGS } from "./parse";

const KNOWN_TAG_RE = new RegExp(`<(?=/?(?:${[...KNOWN_TAGS].join("|")})(?![a-zA-Z0-9-]))`, "gi");

/*
 * O escape padrão é conservador demais para notas do dia a dia: transforma
 * "[CONTA Y]" em "\[CONTA Y\]" e "nome_sobrenome" em "nome\_sobrenome".
 * Aqui só mantemos o escape quando o texto realmente viraria outra coisa.
 */
const originalEsc = MarkdownSerializerState.prototype.esc;
MarkdownSerializerState.prototype.esc = function (str: string, startOfLine = false) {
  let out = originalEsc.call(this, str, startOfLine);
  const couldBeLink = /\]\s*[([:]/.test(str);
  const couldBeTask = startOfLine && /^\[[ xX]\]/.test(str);
  if (!couldBeLink && !couldBeTask) out = out.replace(/\\([[\]])/g, "$1");
  // sublinhado no meio de palavras não vira itálico
  out = out.replace(/([\p{L}\p{N}])\\_(?=[\p{L}\p{N}])/gu, "$1_");
  // til sozinho não vira tachado (só "~~" vira)
  out = out.replace(/\\~/g, (m, i: number, s: string) => (s[i - 1] === "~" || s.slice(i + 2, i + 4) === "\\~" ? m : "~"));
  // "<" só precisa de escape quando abriria uma tag que o editor entende ou um link automático
  out = out
    .replace(KNOWN_TAG_RE, "\\<")
    .replace(/<(?=[a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*>)/g, "\\<")
    .replace(/<(?=[^\s<>@]+@[^\s<>]+>)/g, "\\<");
  // "1) texto" no começo da linha viraria lista numerada
  if (startOfLine) out = out.replace(/^(\s*\d+)\)/, "$1\\)");
  return out;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Uma marca (negrito, cor, destaque…) em HTML, em volta de `inner`. */
function markToHtml(mark: Mark, inner: string): string {
  const a = mark.attrs;
  switch (mark.type.name) {
    case "bold":
      return `<strong>${inner}</strong>`;
    case "italic":
      return `<em>${inner}</em>`;
    case "underline":
      return `<u>${inner}</u>`;
    case "strike":
      return `<s>${inner}</s>`;
    case "code":
      return `<code>${inner}</code>`;
    case "highlight":
      return isDefaultHighlight(a.color) ? `<mark>${inner}</mark>` : `<mark style="background-color: ${toHex(a.color)}">${inner}</mark>`;
    case "textStyle":
      return a.color ? `<span style="color: ${toHex(a.color)}">${inner}</span>` : inner;
    case "link":
      return a.href ? `<a href="${String(a.href).replace(/"/g, "&quot;")}">${inner}</a>` : inner;
    default:
      return inner;
  }
}

/**
 * Texto com formatação em HTML: usado no nome das seções recolhíveis, que fica dentro de
 * <summary>, onde o Markdown não vale (antes só o texto era gravado e a cor/destaque se perdiam).
 */
function inlineToHtml(node: PMNode): string {
  let out = "";
  node.forEach((child) => {
    if (!child.isText) return;
    let html = escapeHtml(child.text ?? "");
    // as marcas vêm da mais de fora para a mais de dentro: embrulha de dentro para fora
    for (const mark of [...child.marks].reverse()) html = markToHtml(mark, html);
    out += html;
  });
  return out;
}

/** Link "solto" (o texto é o próprio endereço): gravamos só o texto, como foi digitado. */
function isPlainUrl(link: Mark, parent: PMNode, index: number): boolean {
  const href: string = link.attrs.href ?? "";
  if (link.attrs.title || !/^https?:\/\/|^mailto:/.test(href)) return false;
  const content = parent.child(index);
  const text = content.text ?? "";
  const same = text === href || href === `mailto:${text}` || href === `http://${text}` || href === `https://${text}`;
  if (!content.isText || !same || content.marks[content.marks.length - 1] !== link) return false;
  return index === parent.childCount - 1 || !link.isInSet(parent.child(index + 1).marks);
}

let serializer: MarkdownSerializer;

/** Converte o conteúdo de uma célula de tabela numa linha só de Markdown. */
function cellToMarkdown(cell: PMNode): string {
  const doc = cell.type.schema.topNodeType.create(null, cell.content);
  return serializer
    .serialize(doc, { tightLists: true })
    .trim()
    .replace(/\n+/g, "<br>")
    .replace(/\|/g, "\\|");
}

function renderTable(state: MarkdownSerializerState, node: PMNode) {
  // GFM não tem células mescladas: cada célula vai para a posição da grade que
  // ocupa (canto superior esquerdo) e as posições cobertas ficam vazias.
  let map: TableMap;
  try {
    map = TableMap.get(node);
  } catch {
    return;
  }
  const rows: string[][] = Array.from({ length: map.height }, () => Array.from({ length: map.width }, () => ""));
  const seen = new Set<number>();
  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      const pos = map.map[r * map.width + c];
      if (seen.has(pos)) continue;
      seen.add(pos);
      const cell = node.nodeAt(pos);
      if (cell) rows[r][c] = cellToMarkdown(cell);
    }
  }
  if (!rows.length) return;
  const cols = map.width;
  const widths = Array.from({ length: cols }, (_, c) => Math.max(3, ...rows.map((r) => r[c].length)));
  const line = (r: string[]) => "| " + r.map((c, i) => c.padEnd(widths[i])).join(" | ") + " |";
  const out = [line(rows[0]), "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |", ...rows.slice(1).map(line)];
  out.forEach((l, i) => {
    state.write(l);
    if (i < out.length - 1) state.ensureNewLine();
  });
  state.closeBlock(node);
}

serializer = new MarkdownSerializer(
  {
    doc(state, node) {
      state.renderContent(node);
    },
    paragraph(state, node) {
      // parágrafos vazios não existem em Markdown; ignorá-los evita linhas em branco acumuladas
      if (node.childCount === 0) return;
      state.renderInline(node);
      state.closeBlock(node);
    },
    text(state, node, parent, index) {
      // texto logo depois de uma quebra simples começa uma linha nova no arquivo
      if (index > 0 && parent.child(index - 1).type.name === "hardBreak") (state as any).atBlockStart = true;
      state.text(node.text ?? "", !(state as any).inAutolink);
    },
    heading(state, node) {
      if (node.childCount === 0) return;
      state.write(state.repeat("#", node.attrs.level) + " ");
      const start = (state as any).out.length;
      state.renderInline(node, false);
      // "Nota #": um # no fim do título seria lido como fechamento do título
      const out: string = (state as any).out;
      if (/\s#+\s*$/.test(out.slice(start))) (state as any).out = out.replace(/(\s)(#+)(\s*)$/, "$1\\$2$3");
      state.closeBlock(node);
    },
    blockquote(state, node) {
      state.wrapBlock("> ", null, node, () => state.renderContent(node));
    },
    callout(state, node) {
      state.wrapBlock("> ", null, node, () => {
        state.write(`[!${String(node.attrs.variant || "note").toUpperCase()}]`);
        state.ensureNewLine();
        state.renderContent(node);
      });
    },
    codeBlock(state, node) {
      const text = node.textContent.replace(/\n$/, "");
      const backticks = text.match(/`{3,}/gm);
      const tilde = node.attrs.fence === "~~~" && !/~{3,}/.test(text);
      const fence = tilde ? "~~~" : backticks ? backticks.sort().slice(-1)[0] + "`" : "```";
      state.write(fence + (node.attrs.language || "") + "\n");
      state.text(text, false);
      state.write("\n");
      state.write(fence);
      state.closeBlock(node);
    },
    horizontalRule(state, node) {
      state.write("---");
      state.closeBlock(node);
    },
    bulletList(state, node) {
      const bullet = ["-", "*", "+"].includes(node.attrs.bullet) ? node.attrs.bullet : "-";
      state.renderList(node, "  ", () => `${bullet} `);
    },
    orderedList(state, node) {
      const start = node.attrs.start ?? 1;
      const maxW = String(start + node.childCount - 1).length;
      const space = state.repeat(" ", maxW + 2);
      const delim = node.attrs.delim === ")" ? ")" : ".";
      state.renderList(node, space, (i) => {
        const nStr = String(start + i);
        return state.repeat(" ", maxW - nStr.length) + nStr + delim + " ";
      });
    },
    listItem(state, node) {
      state.renderContent(node);
    },
    taskList(state, node) {
      state.renderList(node, "  ", (i) => (node.child(i).attrs.checked ? "- [x] " : "- [ ] "));
    },
    taskItem(state, node) {
      state.renderContent(node);
    },
    hardBreak(state) {
      // Quebra simples: com `breaks: true` na leitura ela volta a ser uma quebra visível.
      state.write("\n");
    },
    image(state, node) {
      const src: string = node.attrs.src || "";
      const dest = /[\s()]/.test(src) ? `<${src}>` : src;
      const title = node.attrs.title ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"` : "";
      state.write(`![${state.esc(node.attrs.alt || "")}](${dest}${title})`);
      state.closeBlock(node);
    },
    table(state, node) {
      renderTable(state, node);
    },
    tableRow() {},
    tableCell() {},
    tableHeader() {},
    details(state, node) {
      const summary = node.firstChild?.type.name === "detailsSummary" ? node.firstChild : null;
      state.write("<details>");
      state.ensureNewLine();
      state.write(`<summary>${summary && summary.textContent.trim() ? inlineToHtml(summary) : "Detalhes"}</summary>`);
      state.closeBlock(node.firstChild ?? node);
      node.forEach((child) => {
        if (child.type.name === "detailsContent") state.renderContent(child);
      });
      state.write("</details>");
      state.closeBlock(node);
    },
    detailsSummary() {},
    detailsContent(state, node) {
      state.renderContent(node);
    },
  },
  {
    bold: { open: "**", close: "**", mixable: true, expelEnclosingWhitespace: true },
    italic: { open: "*", close: "*", mixable: true, expelEnclosingWhitespace: true },
    strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
    underline: { open: "<u>", close: "</u>", mixable: true, expelEnclosingWhitespace: true },
    highlight: {
      open: (_s, mark) => (isDefaultHighlight(mark.attrs.color) ? "==" : `<mark style="background-color: ${toHex(mark.attrs.color)}">`),
      close: (_s, mark) => (isDefaultHighlight(mark.attrs.color) ? "==" : "</mark>"),
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    textStyle: {
      open: (_s, mark) => (mark.attrs.color ? `<span style="color: ${toHex(mark.attrs.color)}">` : ""),
      close: (_s, mark) => (mark.attrs.color ? "</span>" : ""),
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    link: {
      open(state, mark, parent, index) {
        const plain = isPlainUrl(mark, parent, index);
        (state as any).inAutolink = plain;
        return plain ? "" : "[";
      },
      close(state, mark) {
        const plain = (state as any).inAutolink;
        (state as any).inAutolink = undefined;
        if (plain) return "";
        const href = String(mark.attrs.href || "").replace(/[()"]/g, "\\$&");
        const title = mark.attrs.title ? ` "${String(mark.attrs.title).replace(/"/g, '\\"')}"` : "";
        return `](${href}${title})`;
      },
      mixable: true,
    },
    code: {
      open(_state, _mark, parent, index) {
        return backticksFor(parent.child(index), -1);
      },
      close(_state, _mark, parent, index) {
        return backticksFor(parent.child(index - 1), 1);
      },
      escape: false,
    },
  },
  {
    hardBreakNodeName: "hardBreak",
    // `==` viraria destaque ao reabrir (o `<` é tratado no esc acima).
    escapeExtraCharacters: /==/g,
    strict: false,
  },
);

function backticksFor(node: PMNode, side: number): string {
  const ticks = /`+/g;
  let m: RegExpExecArray | null;
  let len = 0;
  if (node.isText) while ((m = ticks.exec(node.text ?? ""))) len = Math.max(len, m[0].length);
  let result = len > 0 && side > 0 ? " `" : "`";
  for (let i = 0; i < len; i++) result += "`";
  if (len > 0 && side < 0) result += " ";
  return result;
}

/** Um bloco de nível superior → Markdown (sem quebra de linha no fim). */
export function serializeNode(node: PMNode): string {
  const doc = node.type.schema.topNodeType.create(null, node);
  return serializer.serialize(doc, { tightLists: true }).replace(/\s+$/, "");
}

/** Documento do editor → Markdown (sempre terminando com uma quebra de linha). */
export function docToMarkdown(doc: PMNode, frontmatter: string | null = null): string {
  const body = serializer.serialize(doc, { tightLists: true }).replace(/\s+$/, "");
  const fm = frontmatter ?? "";
  if (!body) return fm;
  return fm + body + "\n";
}
