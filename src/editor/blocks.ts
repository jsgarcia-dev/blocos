import type { Editor, Range } from "@tiptap/core";
import type { ComponentType } from "react";
import { Heading1, Heading2, Heading3, Pilcrow } from "lucide-react";
import { fold } from "../lib/format";
import { insertImageFromDialog } from "../store/actions";
import { mockIcon } from "../components/MockIcons";

export interface BlockItem {
  id: string;
  title: string;
  description: string;
  keywords: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  run: (editor: Editor, range?: Range) => void;
}

const chain = (editor: Editor, range?: Range) => {
  const c = editor.chain().focus();
  return range ? c.deleteRange(range) : c;
};

export function insertDetails(editor: Editor, range?: Range) {
  chain(editor, range)
    .insertContent({
      type: "details",
      content: [
        { type: "detailsSummary" },
        { type: "detailsContent", content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] }] },
      ],
    })
    .run();
  // abre a seção recém-criada e põe o cursor no nome do grupo (ex.: o banco)
  requestAnimationFrame(() => {
    const { $from } = editor.state.selection;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === "details") {
        const start = $from.before(d);
        const dom = editor.view.nodeDOM(start) as HTMLElement | null;
        if (dom && !dom.classList.contains("is-open")) dom.querySelector<HTMLButtonElement>(".toggle-btn")?.click();
        editor.chain().focus().setTextSelection(start + 2).run();
        break;
      }
    }
  });
}

export function insertCallout(editor: Editor, range?: Range) {
  const c = chain(editor, range);
  if (editor.isActive("callout")) {
    c.lift("callout").run();
    return;
  }
  c.wrapIn("callout", { variant: "note" }).run();
}

export const BLOCKS: BlockItem[] = [
  { id: "texto", title: "Texto", description: "Parágrafo comum", keywords: "paragrafo texto normal", icon: Pilcrow, run: (e, r) => chain(e, r).setParagraph().run() },
  { id: "h1", title: "Título 1", description: "Título principal", keywords: "titulo heading h1 grande", icon: Heading1, run: (e, r) => chain(e, r).setHeading({ level: 1 }).run() },
  { id: "h2", title: "Título 2", description: "Título de grupo", keywords: "titulo heading h2 grupo secao", icon: Heading2, run: (e, r) => chain(e, r).setHeading({ level: 2 }).run() },
  { id: "h3", title: "Título 3", description: "Subtítulo", keywords: "titulo heading h3 subtitulo", icon: Heading3, run: (e, r) => chain(e, r).setHeading({ level: 3 }).run() },
  { id: "tabela", title: "Tabela", description: "Linhas e colunas", keywords: "tabela table grade colunas", icon: mockIcon("table"), run: (e, r) => chain(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: "tarefas", title: "Lista de tarefas", description: "Caixinhas para marcar", keywords: "tarefas todo checklist caixa", icon: mockIcon("checks"), run: (e, r) => chain(e, r).toggleTaskList().run() },
  { id: "recolhivel", title: "Seção recolhível", description: "Grupo de registros que abre e fecha", keywords: "recolhivel secao toggle details grupo esconder", icon: mockIcon("collapse"), run: (e, r) => insertDetails(e, r) },
  { id: "destaque", title: "Caixa de destaque", description: "Para avisos e lembretes", keywords: "destaque callout aviso nota lembrete", icon: mockIcon("callout"), run: (e, r) => insertCallout(e, r) },
  { id: "marcadores", title: "Lista com marcadores", description: "Itens com bolinha", keywords: "lista marcadores bullet", icon: mockIcon("list"), run: (e, r) => chain(e, r).toggleBulletList().run() },
  { id: "numerada", title: "Lista numerada", description: "Itens em ordem", keywords: "lista numerada ordenada numeros", icon: mockIcon("list-ol"), run: (e, r) => chain(e, r).toggleOrderedList().run() },
  { id: "citacao", title: "Citação", description: "Trecho recuado", keywords: "citacao quote", icon: mockIcon("quote"), run: (e, r) => chain(e, r).toggleBlockquote().run() },
  { id: "codigo", title: "Bloco de código", description: "Texto monoespaçado", keywords: "codigo code mono", icon: mockIcon("code"), run: (e, r) => chain(e, r).toggleCodeBlock().run() },
  { id: "divisor", title: "Divisor", description: "Linha separadora", keywords: "divisor linha separador hr", icon: mockIcon("divider"), run: (e, r) => chain(e, r).setHorizontalRule().run() },
  {
    id: "imagem",
    title: "Imagem",
    description: "De um arquivo do computador",
    keywords: "imagem foto figura",
    icon: mockIcon("image"),
    run: (e, r) => {
      chain(e, r).run();
      void insertImageFromDialog();
    },
  },
];

/** Ordem padrão do menu "/" (as quatro primeiras aparecem como no mock). */
const ORDER = ["tabela", "tarefas", "recolhivel", "destaque", "h1", "h2", "h3", "texto", "marcadores", "numerada", "citacao", "codigo", "divisor", "imagem"];

export function filterBlocks(query: string): BlockItem[] {
  const q = fold(query.trim());
  const sorted = ORDER.map((id) => BLOCKS.find((b) => b.id === id)!);
  if (!q) return sorted;
  return sorted.filter((b) => fold(b.title).includes(q) || b.keywords.includes(q));
}
