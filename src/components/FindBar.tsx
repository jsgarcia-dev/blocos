import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, ChevronRight, X } from "lucide-react";
import { handles } from "../lib/handles";
import { getState, setState, useApp } from "../store/store";

function current() {
  const id = getState().activeId;
  return id ? handles.get(id) : undefined;
}

export function closeFind() {
  current()?.search?.setQuery("");
  setState((s) => ({ find: { ...s.find, open: false, current: 0, total: 0 } }));
  current()?.focus();
}

export function openFind(replace = false) {
  const h = current();
  let query = getState().find.query;
  const sel = h?.editor
    ? h.editor.state.doc.textBetween(h.editor.state.selection.from, h.editor.state.selection.to, " ")
    : h?.textarea
      ? h.textarea.value.slice(h.textarea.selectionStart, h.textarea.selectionEnd)
      : "";
  if (sel && sel.length < 80 && !sel.includes("\n")) query = sel;
  setState((s) => ({ find: { ...s.find, open: true, replace: replace || s.find.replace, query, focusTick: s.find.focusTick + 1 } }));
  h?.search?.setQuery(query);
}

export function FindBar() {
  const find = useApp((s) => s.find);
  const activeId = useApp((s) => s.activeId);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (find.open) {
      input.current?.focus();
      input.current?.select();
    }
  }, [find.open, find.focusTick]);

  // ao trocar de aba com a busca aberta, refaz a busca no novo documento
  useEffect(() => {
    if (find.open) current()?.search?.setQuery(getState().find.query);
  }, [activeId]);

  if (!find.open) return null;
  const set = (patch: Partial<typeof find>) => setState((s) => ({ find: { ...s.find, ...patch } }));

  return (
    <div className="findbar" onMouseDown={(e) => e.stopPropagation()}>
      <div className="row">
        <button className={`fb-toggle${find.replace ? " open" : ""}`} title="Substituir (Ctrl+H)" onClick={() => set({ replace: !find.replace })}>
          <ChevronRight size={14} />
        </button>
        <input
          ref={input}
          value={find.query}
          placeholder="Buscar no documento"
          onChange={(e) => {
            set({ query: e.target.value });
            current()?.search?.setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              current()?.search?.step(e.shiftKey ? -1 : 1);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              closeFind();
            }
          }}
        />
        <span className="count">{find.query ? `${find.current}/${find.total}` : ""}</span>
        <button title="Anterior (Shift+Enter)" onClick={() => current()?.search?.step(-1)}>
          <ArrowUp size={14} />
        </button>
        <button title="Próximo (Enter)" onClick={() => current()?.search?.step(1)}>
          <ArrowDown size={14} />
        </button>
        <button title="Fechar (Esc)" onClick={closeFind}>
          <X size={14} />
        </button>
      </div>
      {find.replace && (
        <div className="row">
          <span className="fb-pad" />
          <input
            value={find.replacement}
            placeholder="Substituir por"
            onChange={(e) => set({ replacement: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                current()?.search?.replace(find.replacement);
              }
              if (e.key === "Escape") closeFind();
            }}
          />
          <button className="txt" onClick={() => current()?.search?.replace(find.replacement)}>
            Substituir
          </button>
          <button className="txt" onClick={() => current()?.search?.replaceAll(find.replacement)}>
            Todos
          </button>
        </div>
      )}
    </div>
  );
}
