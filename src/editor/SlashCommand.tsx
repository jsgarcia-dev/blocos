import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { exitSuggestion, type SuggestionProps } from "@tiptap/suggestion";
import { createRoot, type Root } from "react-dom/client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { filterBlocks, type BlockItem } from "./blocks";

export const slashKey = new PluginKey("blocosSlash");

interface MenuProps {
  items: BlockItem[];
  command: (item: BlockItem) => void;
}

export interface MenuHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

const SlashMenu = forwardRef<MenuHandle, MenuProps>(({ items, command }, ref) => {
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => setIndex(0), [items]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (!items.length) return false;
      const move = (d: number) => setIndex((i) => (i + d + items.length) % items.length);
      if (e.key === "ArrowDown") return move(2), true;
      if (e.key === "ArrowUp") return move(-2), true;
      if (e.key === "ArrowRight") return move(1), true;
      if (e.key === "ArrowLeft") return move(-1), true;
      if (e.key === "Enter" || e.key === "Tab") {
        command(items[index]);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="slash" onMouseDown={(e) => e.preventDefault()}>
      <div className="hd">INSERIR BLOCO</div>
      {items.length ? (
        <div className="opts" ref={listRef}>
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                data-i={i}
                className={`opt${i === index ? " on" : ""}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => command(item)}
              >
                <i className="oi">
                  <Icon size={16} strokeWidth={2} />
                </i>
                <div>
                  <b>{item.title}</b>
                  <span>{item.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty">Nenhum bloco encontrado</div>
      )}
      <div className="ft">
        <span>↑↓ navegar</span>
        <span>Enter inserir</span>
        <span>Esc fechar</span>
      </div>
    </div>
  );
});

export const SlashCommand = Extension.create({
  name: "blocosSlash",

  addProseMirrorPlugins() {
    return [
      Suggestion<BlockItem, BlockItem>({
        editor: this.editor,
        pluginKey: slashKey,
        char: "/",
        allowSpaces: false,
        decorationClass: "slash-query",
        decorationContent: "Filtrar blocos…",
        decorationEmptyClass: "is-empty",
        placement: "bottom-start",
        offset: { mainAxis: 3, crossAxis: 0 },
        items: ({ query }) => filterBlocks(query),
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          return $from.parent.type.name !== "codeBlock" && !$from.parent.type.spec.code;
        },
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: BlockItem }) => {
          props.run(editor, range);
        },
        render: () => {
          let root: Root | null = null;
          let el: HTMLDivElement | null = null;
          let unmount: (() => void) | null = null;
          const handle: { current: MenuHandle | null } = { current: null };
          const draw = (props: SuggestionProps<BlockItem, BlockItem>) => {
            root?.render(<SlashMenu ref={(h) => void (handle.current = h)} items={props.items} command={props.command} />);
          };
          return {
            onStart: (props) => {
              try {
                el = document.createElement("div");
                el.className = "slash-host";
                root = createRoot(el);
                draw(props);
                const host = el;
                // como no mock: alinhado à esquerda da linha, 4px abaixo dela (ou acima, se não couber)
                const place = () => {
                  const line = props.editor.view.dom.querySelector(".slash-query")?.closest("p, li, h1, h2, h3, td, th, summary") as HTMLElement | null;
                  if (!line) return;
                  const r = line.getBoundingClientRect();
                  const area = (line.closest(".canvas") as HTMLElement | null)?.getBoundingClientRect();
                  const bottom = area ? area.bottom : window.innerHeight;
                  const topLimit = area ? area.top : 0;
                  const h = host.offsetHeight;
                  const below = r.bottom + 4;
                  // abre embaixo; só sobe se faltar bastante espaço e couber em cima
                  const top = below + h > bottom + 12 && r.top - 4 - h >= topLimit ? r.top - 4 - h : below;
                  Object.assign(host.style, { position: "absolute", left: `${r.left}px`, top: `${top}px` });
                };
                unmount = props.mount(el, { onPosition: place });
                requestAnimationFrame(place);
              } catch (e) {
                console.error("[slash] falhou", e);
              }
            },
            onUpdate: (props) => draw(props),
            onKeyDown: ({ event, view }) => {
              if (event.key === "Escape") {
                exitSuggestion(view, slashKey);
                return true;
              }
              return handle.current?.onKeyDown(event) ?? false;
            },
            onExit: () => {
              unmount?.();
              const r = root;
              root = null;
              setTimeout(() => r?.unmount());
              el?.remove();
              el = null;
            },
          };
        },
      }),
    ];
  },
});
