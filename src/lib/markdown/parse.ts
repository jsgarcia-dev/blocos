import MarkdownIt from "markdown-it";
import markPlugin from "markdown-it-mark";
import { DOMParser as PMDOMParser, type Node as PMNode, type Schema } from "@tiptap/pm/model";

/**
 * Markdown → HTML que o TipTap entende.
 *
 * - `breaks: true`: uma quebra de linha simples vira quebra de linha visível,
 *   como em blocos de notas. Na volta ela é gravada como `\n` puro.
 * - HTML inline é permitido para cores (`<mark style>`, `<span style>`) e `<u>`.
 */
const md = new MarkdownIt({ html: true, linkify: true, breaks: true, typographer: false }).use(markPlugin);

/**
 * Tags HTML que o editor sabe representar. Qualquer outra coisa entre `<` e `>`
 * (ex.: "<nome do cliente>", "<TODO>", "<!-- nota -->") é mostrada como texto
 * comum — assim nada some ao abrir e salvar. O serializador usa a mesma lista
 * para decidir quando escapar `<`.
 */
export const KNOWN_TAGS = new Set([
  "u", "mark", "span", "br", "details", "summary", "img", "a", "b", "i", "s", "strong", "em", "del", "code",
]);

export function knownTag(html: string): boolean {
  const m = html.match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)/);
  return !!m && KNOWN_TAGS.has(m[1].toLowerCase());
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

md.renderer.rules.html_inline = (tokens, idx) => {
  const c = tokens[idx].content;
  return knownTag(c) ? c : escapeHtml(c);
};
md.renderer.rules.html_block = (tokens, idx) => {
  const c = tokens[idx].content;
  if (knownTag(c.trimStart())) return c;
  return `<p>${escapeHtml(c.replace(/\n+$/, "")).replace(/\n/g, "<br>")}</p>`;
};
// guarda o marcador usado no arquivo (- * + / . ) / ``` ~~~) para gravar igual
md.renderer.rules.bullet_list_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet("data-bullet", tokens[idx].markup);
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.ordered_list_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet("data-delim", tokens[idx].markup);
  return self.renderToken(tokens, idx, options);
};
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const html = defaultFence(tokens, idx, options, env, self);
  return tokens[idx].markup.startsWith("~") ? html.replace("<pre>", '<pre data-fence="~~~">') : html;
};
// sem "\n" depois das quebras: o editor lê o HTML preservando espaços
md.renderer.rules.softbreak = () => "<br>";
md.renderer.rules.hardbreak = () => "<br>";

const CALLOUT_RE = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;
const TASK_RE = /^\[( |x|X)\]\s+/;

export interface SplitResult {
  frontmatter: string | null;
  body: string;
}

/** Separa um bloco YAML inicial (`---`) para gravá-lo de volta intacto. */
export function splitFrontmatter(src: string): SplitResult {
  const m = src.match(/^---\n[\s\S]*?\n---\n?/);
  if (!m) return { frontmatter: null, body: src };
  return { frontmatter: m[0].endsWith("\n") ? m[0] : m[0] + "\n", body: src.slice(m[0].length) };
}

function firstTextNode(el: Element): Text | null {
  const walker = el.ownerDocument.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  let n = walker.nextNode() as Text | null;
  while (n && !n.data.trim()) n = walker.nextNode() as Text | null;
  return n;
}

function convertTaskLists(root: Element) {
  root.querySelectorAll("ul").forEach((ul) => {
    const items = Array.from(ul.children).filter((c) => c.tagName === "LI");
    if (!items.length) return;
    const markers = items.map((li) => {
      const t = firstTextNode(li);
      return t && TASK_RE.test(t.data.trimStart()) ? t : null;
    });
    if (markers.some((m) => !m)) return;
    ul.setAttribute("data-type", "taskList");
    items.forEach((li, i) => {
      const t = markers[i]!;
      const trimmed = t.data.trimStart();
      const checked = /^\[(x|X)\]/.test(trimmed);
      t.data = trimmed.replace(TASK_RE, "");
      li.setAttribute("data-type", "taskItem");
      li.setAttribute("data-checked", checked ? "true" : "false");
    });
  });
}

function convertCallouts(root: Element) {
  root.querySelectorAll("blockquote").forEach((bq) => {
    const p = bq.firstElementChild;
    if (!p || p.tagName !== "P") return;
    const t = firstTextNode(p);
    if (!t || t.parentNode !== p) return;
    const m = t.data.match(CALLOUT_RE);
    if (!m) return;
    t.data = t.data.slice(m[0].length);
    // remove a quebra de linha logo depois do marcador
    let next = t.nextSibling;
    while (next && next.nodeType === 3 && !(next as Text).data.trim()) next = next.nextSibling;
    if (!t.data.trim() && next && next.nodeName === "BR") next.remove();
    if (!t.data.trim()) t.remove();
    if (!p.textContent?.trim() && !p.querySelector("img")) p.remove();
    const div = root.ownerDocument.createElement("div");
    div.setAttribute("data-type", "callout");
    div.setAttribute("data-variant", m[1].toLowerCase());
    while (bq.firstChild) div.appendChild(bq.firstChild);
    if (!div.children.length) div.appendChild(root.ownerDocument.createElement("p"));
    bq.replaceWith(div);
  });
}

function convertDetails(root: Element) {
  root.querySelectorAll("details").forEach((details) => {
    let summary = Array.from(details.children).find((c) => c.tagName === "SUMMARY");
    if (!summary) {
      summary = root.ownerDocument.createElement("summary");
      summary.textContent = "Detalhes";
    }
    const content = root.ownerDocument.createElement("div");
    content.setAttribute("data-type", "detailsContent");
    Array.from(details.childNodes).forEach((n) => {
      if (n !== summary) content.appendChild(n);
    });
    if (!content.children.length) content.appendChild(root.ownerDocument.createElement("p"));
    details.innerHTML = "";
    details.appendChild(summary);
    details.appendChild(content);
  });
}

export function markdownToHtml(src: string): string {
  const html = md.render(src);
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const body = doc.body;
  // As quebras de linha entre as tags vêm só da formatação do HTML; com
  // preserveWhitespace elas virariam espaços. Removemos (exceto em blocos de código).
  const walker = doc.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */);
  const empty: Text[] = [];
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (n.parentElement?.closest("pre")) continue;
    if (n.data.includes("\n")) n.data = n.data.replace(/\n/g, "");
    if (!n.data) empty.push(n);
  }
  empty.forEach((n) => n.remove());
  // imagem sozinha num parágrafo vira bloco de imagem (evita parágrafo vazio antes dela)
  body.querySelectorAll("p").forEach((p) => {
    if (p.children.length === 1 && p.firstElementChild?.tagName === "IMG" && !p.textContent?.trim()) {
      p.replaceWith(p.firstElementChild);
    }
  });
  convertDetails(body);
  convertCallouts(body);
  convertTaskLists(body);
  return body.innerHTML;
}

/** Como o editor deve ler o HTML gerado (mantém espaços repetidos e tabulações). */
export const PARSE_OPTIONS = { preserveWhitespace: true } as const;

/** HTML → documento do editor, do mesmo jeito que o editor lê. */
export function htmlToDoc(html: string, schema: Schema): PMNode {
  const el = document.createElement("div");
  el.innerHTML = html;
  return PMDOMParser.fromSchema(schema).parse(el, PARSE_OPTIONS);
}
