import { memo, useEffect, useLayoutEffect, useRef } from "react";
import { FileText, Wand2 } from "lucide-react";
import { baselines, handles, pendingJumps } from "../lib/handles";
import { countWords, fold } from "../lib/format";
import { getState, getTab, setState, updateTab, useApp } from "../store/store";
import { convertTxtToMd, notifyChange, setLastPosition } from "../store/actions";

function foldIndexable(s: string): string {
  return s
    .split("")
    .map((c) => {
      const f = fold(c);
      return f.length === 1 ? f : c;
    })
    .join("");
}

function findAll(text: string, query: string): number[] {
  const q = fold(query);
  if (!q) return [];
  const hay = foldIndexable(text);
  const out: number[] = [];
  let i = hay.indexOf(q);
  while (i >= 0) {
    out.push(i);
    i = hay.indexOf(q, i + q.length);
  }
  return out;
}

function PlainEditorImpl({ id, active }: { id: string; active: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const search = useRef({ query: "", current: 0, matches: [] as number[] });
  const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spellcheck = useApp((s) => s.library.prefs.spellcheck);

  const autosize = () => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  };

  const report = () => {
    if (getState().activeId !== id) return;
    const s = search.current;
    setState((st) => ({ find: { ...st.find, current: s.matches.length ? s.current + 1 : 0, total: s.matches.length } }));
  };

  const selectMatch = () => {
    const ta = ref.current;
    const s = search.current;
    if (!ta || !s.matches.length) return report();
    const at = s.matches[s.current];
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(at, at + s.query.length);
    scrollToOffset(at);
    report();
  };

  const scrollToOffset = (offset: number) => {
    const ta = ref.current;
    const c = canvasRef.current;
    if (!ta || !c) return;
    const lines = ta.value.slice(0, offset).split("\n").length;
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 24;
    const y = ta.offsetTop + (lines - 1) * lh;
    c.scrollTop = Math.max(0, y - c.clientHeight / 3);
  };

  const scheduleStats = () => {
    if (statsTimer.current) clearTimeout(statsTimer.current);
    statsTimer.current = setTimeout(() => {
      const ta = ref.current;
      const t = getTab(id);
      if (!ta || !t) return;
      const words = countWords(ta.value);
      const line = ta.value.slice(0, ta.selectionStart).split("\n").length;
      if (words !== t.stats.words || line !== t.stats.line) updateTab(id, { stats: { words, line } });
      if (t.path && getState().activeId === id) setLastPosition(t.path, line);
    }, 250);
  };

  useLayoutEffect(() => {
    const ta = ref.current!;
    const t = getTab(id)!;
    ta.value = t.initial.type === "json" ? "" : t.initial.text;
    autosize();
    if (!t.dirty) baselines.set(id, ta.value);
    handles.set(id, {
      kind: "txt",
      textarea: ta,
      getText: () => ta.value,
      getSnapshot: () => ({ type: "text", text: ta.value }),
      focus: () => ta.focus({ preventScroll: true }),
      goToLine: (line, query) => {
        const lines = ta.value.split("\n");
        let offset = lines.slice(0, Math.max(0, line - 1)).reduce((n, l) => n + l.length + 1, 0);
        let end = offset;
        if (query) {
          const all = findAll(ta.value, query);
          const near = all.find((i) => i >= offset) ?? all[0];
          if (near !== undefined) {
            offset = near;
            end = near + query.length;
          }
        }
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(offset, end);
        scrollToOffset(offset);
      },
      getViewState: () => ({
        selection: { anchor: ta.selectionStart, head: ta.selectionEnd },
        scrollTop: canvasRef.current?.scrollTop ?? 0,
      }),
    });
    const sel = t.selection;
    if (sel) ta.setSelectionRange(Math.min(sel.anchor, ta.value.length), Math.min(sel.head, ta.value.length));
    requestAnimationFrame(() => {
      if (canvasRef.current) canvasRef.current.scrollTop = t.scrollTop;
      const jump = pendingJumps.get(id);
      if (jump) {
        pendingJumps.delete(id);
        handles.get(id)?.goToLine(jump.line ?? 1, jump.query);
      } else if (getState().activeId === id) ta.focus({ preventScroll: true });
    });
    scheduleStats();
    return () => {
      if (handles.get(id)?.textarea === ta) handles.delete(id);
    };
  }, [id]);

  // busca e substituição vindas da barra de busca
  useEffect(() => {
    const h = handles.get(id);
    if (!h) return;
    h.search = {
      setQuery: (q: string) => {
        search.current = { query: q, current: 0, matches: findAll(ref.current?.value ?? "", q) };
        if (q) selectMatch();
        else report();
      },
      step: (dir: 1 | -1) => {
        const s = search.current;
        if (!s.matches.length) return;
        s.current = (s.current + dir + s.matches.length) % s.matches.length;
        selectMatch();
      },
      replace: (rep: string) => {
        const ta = ref.current;
        const s = search.current;
        if (!ta || !s.matches.length) return;
        const at = s.matches[s.current];
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(at, at + s.query.length);
        document.execCommand("insertText", false, rep);
        s.matches = findAll(ta.value, s.query);
        s.current = Math.min(s.current, Math.max(0, s.matches.length - 1));
        selectMatch();
      },
      replaceAll: (rep: string) => {
        const ta = ref.current;
        const s = search.current;
        if (!ta || !s.matches.length) return;
        ta.focus({ preventScroll: true });
        ta.select();
        let out = "";
        let last = 0;
        for (const at of s.matches) {
          out += ta.value.slice(last, at) + rep;
          last = at + s.query.length;
        }
        out += ta.value.slice(last);
        document.execCommand("insertText", false, out);
        s.matches = findAll(ta.value, s.query);
        s.current = 0;
        report();
      },
    };
  });

  useEffect(() => {
    if (active) scheduleStats();
  }, [active]);

  return (
    <div className="canvas" ref={canvasRef}>
      <div className="sheet plain">
        <div className="plain-banner">
          <FileText size={16} />
          <div>
            <b>Texto puro (.txt).</b> A formatação fica desativada para o arquivo continuar simples.
          </div>
          <button onClick={() => void convertTxtToMd(id)}>
            <Wand2 size={14} />
            Converter para .md
          </button>
        </div>
        <textarea
          ref={ref}
          className="plain-text"
          spellCheck={spellcheck}
          wrap="soft"
          onInput={() => {
            autosize();
            notifyChange(id);
            scheduleStats();
            if (search.current.query) {
              search.current.matches = findAll(ref.current!.value, search.current.query);
              report();
            }
          }}
          onSelect={scheduleStats}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !e.ctrlKey && !e.altKey) {
              e.preventDefault();
              document.execCommand("insertText", false, "\t");
            }
          }}
        />
      </div>
    </div>
  );
}

export const PlainEditor = memo(PlainEditorImpl);
