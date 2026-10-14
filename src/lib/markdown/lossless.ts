import MarkdownIt from "markdown-it";
import type { Node as PMNode } from "@tiptap/pm/model";
import { serializeNode } from "./serialize";

/**
 * Salvamento "sem perdas": cada bloco do documento que o usuário não mexeu é
 * gravado exatamente como estava no arquivo (mesmos marcadores de lista, linhas
 * em branco, espaços, definições de link…). Só os blocos editados ou novos são
 * convertidos de novo para Markdown.
 *
 * Funciona porque o ProseMirror reaproveita os mesmos objetos para os blocos que
 * não mudaram: basta lembrar qual objeto veio de qual trecho do arquivo.
 */

const tokenizer = new MarkdownIt({ html: true, linkify: true, breaks: true });

export interface SourceMap {
  /** Texto antes do primeiro bloco. */
  prefix: string;
  /** Texto exato de cada bloco de nível superior (sem a quebra de linha final). */
  blocks: string[];
  /** seps[i] = texto entre blocks[i] e blocks[i + 1]. */
  seps: string[];
  /** Texto depois do último bloco. */
  suffix: string;
}

/** Divide o Markdown nos mesmos blocos de nível superior que o editor cria. */
export function buildSourceMap(src: string): SourceMap {
  const tokens = tokenizer.parse(src, {});
  const ranges: [number, number][] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.level !== 0 || !t.map || t.nesting === -1) {
      i++;
      continue;
    }
    let [start, end] = t.map;
    // <details> … </details> vira um bloco só no editor
    if (t.type === "html_block" && /^<details\b/i.test(t.content.trim())) {
      let depth = (t.content.match(/<details\b/gi) ?? []).length - (t.content.match(/<\/details>/gi) ?? []).length;
      let j = i + 1;
      while (depth > 0 && j < tokens.length) {
        const u = tokens[j];
        if (u.level === 0 && u.map) end = Math.max(end, u.map[1]);
        if (u.type === "html_block") {
          depth += (u.content.match(/<details\b/gi) ?? []).length - (u.content.match(/<\/details>/gi) ?? []).length;
        }
        j++;
      }
      ranges.push([start, end]);
      i = j;
      continue;
    }
    // pula os tokens internos deste bloco
    let j = i + 1;
    if (t.nesting === 1) {
      let depth = 1;
      while (j < tokens.length && depth > 0) {
        depth += tokens[j].nesting;
        j++;
      }
    }
    ranges.push([start, end]);
    i = j;
  }

  // posições de início de cada linha
  const lineStart: number[] = [0];
  for (let k = 0; k < src.length; k++) if (src[k] === "\n") lineStart.push(k + 1);
  const lines = src.split("\n");
  const lineEnd = (line: number) => lineStart[line] + lines[line].length;

  const blocks: string[] = [];
  const bounds: [number, number][] = [];
  for (const [start, endExcl] of ranges) {
    let last = Math.min(endExcl, lines.length) - 1;
    while (last > start && !lines[last].trim()) last--;
    const from = lineStart[start];
    const to = lineEnd(last);
    bounds.push([from, to]);
    blocks.push(src.slice(from, to));
  }
  const seps: string[] = [];
  for (let k = 0; k + 1 < bounds.length; k++) seps.push(src.slice(bounds[k][1], bounds[k + 1][0]));
  return {
    prefix: bounds.length ? src.slice(0, bounds[0][0]) : src,
    blocks,
    seps,
    suffix: bounds.length ? src.slice(bounds[bounds.length - 1][1]) : "",
  };
}

export interface Lossless {
  serialize(doc: PMNode, frontmatter: string | null): string;
}

/**
 * Prepara o salvamento sem perdas para o documento recém-aberto.
 * `parseBlock` converte um trecho de Markdown no documento do editor; é usado
 * para conferir que cada trecho realmente produz o mesmo bloco (senão o bloco é
 * convertido normalmente, por segurança).
 */
export function createLossless(doc: PMNode, body: string, parseBlock: (md: string) => PMNode): Lossless | null {
  const map = buildSourceMap(body);
  if (map.blocks.length !== doc.childCount) return null;
  const index = new Map<PMNode, number>();
  doc.forEach((child, _offset, i) => index.set(child, i));
  const verified = new Map<number, boolean>();
  const isVerified = (i: number, node: PMNode) => {
    let ok = verified.get(i);
    if (ok === undefined) {
      try {
        const parsed = parseBlock(map.blocks[i]);
        ok = parsed.childCount === 1 && parsed.firstChild!.eq(node);
      } catch {
        ok = false;
      }
      verified.set(i, ok);
    }
    return ok;
  };

  return {
    serialize(current, frontmatter) {
      const parts: { text: string; orig: number | null }[] = [];
      current.forEach((child) => {
        const i = index.get(child);
        if (i !== undefined && isVerified(i, child)) parts.push({ text: map.blocks[i], orig: i });
        else {
          const text = serializeNode(child);
          if (text) parts.push({ text, orig: null });
        }
      });
      const fm = frontmatter ?? "";
      if (!parts.length) return fm;

      const usedSeps = new Set<number>();
      let out = parts[0].orig === 0 ? map.prefix : "";
      parts.forEach((p, k) => {
        if (k > 0) {
          const prev = parts[k - 1];
          if (prev.orig !== null && p.orig === prev.orig + 1) {
            out += map.seps[prev.orig];
            usedSeps.add(prev.orig);
          } else out += "\n\n";
        }
        out += p.text;
      });
      // definições de link e outros textos que ficavam entre blocos removidos não se perdem
      const leftovers: string[] = [];
      if (parts[0].orig !== 0 && map.prefix.trim()) leftovers.push(map.prefix.trim());
      map.seps.forEach((s, i) => {
        if (!usedSeps.has(i) && s.trim()) leftovers.push(s.trim());
      });
      const last = parts[parts.length - 1];
      if (last.orig !== map.blocks.length - 1 && map.suffix.trim()) leftovers.push(map.suffix.trim());
      if (leftovers.length) out += "\n\n" + leftovers.join("\n\n") + "\n";
      else out += last.orig === map.blocks.length - 1 ? map.suffix : "\n";
      return fm + out;
    },
  };
}
