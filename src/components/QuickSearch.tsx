import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Pin, Search } from "lucide-react";
import { platform, type SearchHit } from "../lib/platform";
import { basename, dirname, prettyPath, stripExt, extname } from "../lib/paths";
import { fold } from "../lib/format";
import { getState, setState, useApp } from "../store/store";
import { activate, openPaths, tabTitle } from "../store/actions";

/** Mostra a linha encontrada sem a marcação do Markdown. */
function cleanSnippet(s: string | null): string | null {
  if (!s) return s;
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/^\s*(#{1,6}\s+|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+|>\s*(\[![A-Z]+\]\s*)?)/, "")
    .replace(/(\*\*|__|==|~~|`)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

interface Row {
  key: string;
  title: string;
  sub: string;
  snippet?: string | null;
  pinned?: boolean;
  isTxt?: boolean;
  run: () => void;
}

export function QuickSearch() {
  const open = useApp((s) => s.quickSearch);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const home = useApp((s) => s.home);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setIndex(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const { library, tabs } = getState();
      const extra = [...library.pinned, ...library.recents.map((r) => r.path), ...tabs.map((t) => t.path).filter(Boolean)] as string[];
      try {
        const r = await platform().searchFiles(library.folders, [...new Set(extra)], query);
        setHits(r);
      } catch {
        setHits([]);
      }
      setLoading(false);
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const close = () => setState({ quickSearch: false });

  const rows: Row[] = useMemo(() => {
    const { tabs, library } = getState();
    const f = fold(q.trim());
    const out: Row[] = [];
    const seen = new Set<string>();
    const openMatches = tabs.filter((t) => !f || fold(tabTitle(t)).includes(f));
    for (const t of openMatches) {
      if (t.path) seen.add(t.path);
      out.push({
        key: `tab:${t.id}`,
        title: tabTitle(t),
        sub: t.path ? `Aberto · ${prettyPath(dirname(t.path), home)}` : "Aberto · sem arquivo",
        isTxt: t.kind === "txt",
        run: () => activate(t.id),
      });
    }
    if (!f) {
      for (const p of [...library.pinned, ...library.recents.map((r) => r.path)]) {
        if (seen.has(p)) continue;
        seen.add(p);
        out.push({
          key: `p:${p}`,
          title: stripExt(basename(p)),
          sub: prettyPath(dirname(p), home),
          pinned: library.pinned.includes(p),
          isTxt: extname(p) === "txt",
          run: () => void openPaths([p]),
        });
      }
    }
    for (const h of hits) {
      if (seen.has(h.path) && !h.line) continue;
      out.push({
        key: `h:${h.path}:${h.line}`,
        title: stripExt(h.name),
        sub: prettyPath(dirname(h.path), home) + (h.line ? ` · linha ${h.line}` : ""),
        snippet: cleanSnippet(h.snippet),
        isTxt: extname(h.path) === "txt",
        run: () => void openPaths([h.path], h.line ? { line: h.line, query: q.trim() } : {}),
      });
    }
    return out;
  }, [q, hits, home, open]);

  useEffect(() => setIndex(0), [rows.length, q]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const choose = (r: Row | undefined) => {
    if (!r) return;
    close();
    r.run();
  };

  return (
    <div className="overlay" onMouseDown={close}>
      <div className="qs" onMouseDown={(e) => e.stopPropagation()}>
        <div className="qs-in">
          <Search size={17} />
          <input
            ref={input}
            value={q}
            placeholder="Buscar arquivos e conteúdo…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, rows.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(rows[index]);
              } else if (e.key === "Escape") close();
            }}
          />
          {loading && <span className="qs-loading" />}
          <kbd>Esc</kbd>
        </div>
        <div className="qs-list" ref={list}>
          {rows.length ? (
            rows.map((r, i) => (
              <div
                key={r.key}
                data-i={i}
                className={`qs-row${i === index ? " on" : ""}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(r)}
              >
                <i className="qi">{r.pinned ? <Pin size={15} /> : <FileText size={15} />}</i>
                <div className="qt">
                  <div>
                    <b>{r.title}</b>
                    {r.isTxt && <span className="badge">TXT</span>}
                  </div>
                  {r.snippet ? <span className="snip">{r.snippet}</span> : <span>{r.sub}</span>}
                </div>
                {r.snippet && <span className="where">{r.sub}</span>}
              </div>
            ))
          ) : (
            <div className="qs-empty">{q.trim().length < 2 ? "Digite para buscar nos arquivos das suas pastas." : loading ? "Buscando…" : "Nada encontrado."}</div>
          )}
        </div>
        <div className="qs-ft">
          <span>↑↓ navegar</span>
          <span>Enter abrir</span>
          <span>Busca nos nomes e no conteúdo de .md e .txt das suas pastas</span>
        </div>
      </div>
    </div>
  );
}
