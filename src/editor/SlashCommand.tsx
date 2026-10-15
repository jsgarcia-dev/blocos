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
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => setIndex(0), [items]);
  // a lista não tem rolagem nativa (veja o CSS): só ela rola, sem mexer na página
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-i="${index}"]`);
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
    }
  }, [index, items]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      const list = listRef.current;
      if (!list) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? list.clientHeight : 1;
      list.scrollTop += e.deltaY * unit;
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, []);

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
    <div className="slash" ref={rootRef} onMouseDown={(e) => e.preventDefault()}>
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
        offset: { mainAxis: 4, crossAxis: 0 },
        container: ".pane.active .sheet",
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
                // o menu fica dentro da página (como no mock): rola junto com o texto
                const place = () => {
                  const line = props.editor.view.dom.querySelector(".slash-query")?.closest("p, li, h1, h2, h3, td, th, summary") as HTMLElement | null;
                  const sheet = host.parentElement;
                  if (!line || !sheet) return;
                  const r = line.getBoundingClientRect();
                  const s = sheet.getBoundingClientRect();
                  const zoom = sheet.offsetWidth ? s.width / sheet.offsetWidth : 1;
                  const area = (line.closest(".canvas") as HTMLElement | null)?.getBoundingClientRect();
                  const bottom = area ? area.bottom : window.innerHeight;
                  const topLimit = area ? area.top : 0;
                  const h = host.offsetHeight * zoom;
                  // abre embaixo; só sobe se faltar bastante espaço e couber em cima
                  const up = r.bottom + 4 * zoom + h > bottom + 12 && r.top - 4 * zoom - h >= topLimit;
                  const top = up ? (r.top - s.top) / zoom - 4 - host.offsetHeight : (r.bottom - s.top) / zoom + 4;
                  Object.assign(host.style, { position: "absolute", left: `${(r.left - s.left) / zoom}px`, top: `${top}px` });
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
