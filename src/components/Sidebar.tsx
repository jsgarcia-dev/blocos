import { useCallback, useEffect, useState } from "react";
import { ChevronRight, FileText, Folder, FolderOpen, Pin, PinOff, Plus, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { platform, type FolderEntry } from "../lib/platform";
import { basename, extname, stripExt } from "../lib/paths";
import { formatAgo } from "../lib/format";
import { activeTab, setState, useApp } from "../store/store";
import { addFolder, forgetRecent, openPaths, removeFolder, togglePin } from "../store/actions";

function FileItem({ path, icon, onContext }: { path: string; icon: "pin" | "file"; onContext?: (e: React.MouseEvent) => void }) {
  const current = useApp((s) => s.tabs.find((t) => t.id === s.activeId)?.path === path);
  const pinned = useApp((s) => s.library.pinned.includes(path));
  const isTxt = extname(path) === "txt";
  return (
    <div
      className={`it${current ? " on" : ""}`}
      title={path}
      onClick={() => void openPaths([path])}
      onContextMenu={(e) => {
        e.preventDefault();
        onContext?.(e);
      }}
    >
      {icon === "pin" ? <Pin className="ic" size={15} /> : <FileText className="ic" size={15} />}
      <span className="nm">{stripExt(basename(path))}</span>
      {isTxt && <span className="badge">TXT</span>}
      <button
        className="hover-act"
        title={pinned ? "Desafixar" : "Fixar"}
        onClick={(e) => {
          e.stopPropagation();
          togglePin(path);
        }}
      >
        {pinned ? <PinOff size={13} /> : <Pin size={13} />}
      </button>
    </div>
  );
}

function Tree({ entry, depth }: { entry: FolderEntry; depth: number }) {
  const [open, setOpen] = useState(false);
  if (!entry.isDir) {
    return (
      <div style={{ paddingLeft: 8 + depth * 14 }} className="tree-file">
        <FileItem path={entry.path} icon="file" />
      </div>
    );
  }
  return (
    <div>
      <div className="it tree-dir" style={{ paddingLeft: 8 + depth * 14 }} onClick={() => setOpen(!open)}>
        <ChevronRight className={`chev${open ? " open" : ""}`} size={13} />
        <span className="nm">{entry.name}</span>
        <span className="c">{entry.count}</span>
      </div>
      {open && entry.children.map((c) => <Tree key={c.path} entry={c} depth={depth + 1} />)}
    </div>
  );
}

function FolderRow({ path, tick }: { path: string; tick: number }) {
  const [entry, setEntry] = useState<FolderEntry | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    platform()
      .listFolder(path)
      .then((e) => {
        if (!alive) return;
        setEntry(e);
        setError(false);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [path, tick]);
  return (
    <div>
      <div
        className={`it${open ? " open" : ""}`}
        title={path}
        onClick={() => setOpen(!open)}
        onContextMenu={(e) => {
          e.preventDefault();
          setState({
            menu: {
              x: e.clientX,
              y: e.clientY,
              items: [
                { label: "Mostrar na pasta", action: () => void platform().revealInDir(path) },
                { label: "Remover da lista", action: () => removeFolder(path), danger: true },
              ],
            },
          });
        }}
      >
        {open ? <FolderOpen className="ic" size={15} /> : <Folder className="ic" size={15} />}
        <span className="nm">{basename(path)}</span>
        <span className="c">{error ? "—" : entry ? entry.count : ""}</span>
      </div>
      {open && entry && (
        <div className="tree">
          {entry.children.length ? (
            entry.children.map((c) => <Tree key={c.path} entry={c} depth={1} />)
          ) : (
            <div className="tree-empty">Nenhuma nota aqui</div>
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const library = useApp((s) => s.library);
  const [, force] = useState(0);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const pinned = library.pinned;
  const recents = library.recents.filter((r) => !pinned.includes(r.path)).slice(0, 5);
  const last = library.lastPosition;

  return (
    <aside className="side">
      <button className="search" onClick={() => setState({ quickSearch: true })}>
        <Search className="ic" size={14} />
        Buscar em tudo
        <kbd>Ctrl P</kbd>
      </button>

      <div className="side-scroll">
        {last && (
          <button
            className="resume"
            onClick={() => {
              const cur = activeTab();
              void openPaths([last.path], cur?.path === last.path ? { line: last.line } : { line: last.line });
            }}
          >
            <div className="rt">
              <RotateCcw size={12} strokeWidth={2.5} />
              Continuar de onde parou
            </div>
            <b>{basename(last.path)}</b>
            <span>
              Linha {last.line} · {formatAgo(last.at)}
            </span>
          </button>
        )}

        <div className="sec">FIXADOS</div>
        {pinned.length ? (
          pinned.map((p) => (
            <FileItem
              key={p}
              path={p}
              icon="pin"
              onContext={(e) =>
                setState({
                  menu: {
                    x: e.clientX,
                    y: e.clientY,
                    items: [
                      { label: "Desafixar", action: () => togglePin(p) },
                      { label: "Mostrar na pasta", action: () => void platform().revealInDir(p) },
                    ],
                  },
                })
              }
            />
          ))
        ) : (
          <div className="hint">Fixe arquivos pelo menu da aba ou passando o mouse em Recentes.</div>
        )}

        <div className="sec">RECENTES</div>
        {recents.length ? (
          recents.map((r) => (
            <FileItem
              key={r.path}
              path={r.path}
              icon="file"
              onContext={(e) =>
                setState({
                  menu: {
                    x: e.clientX,
                    y: e.clientY,
                    items: [
                      { label: "Fixar", action: () => togglePin(r.path) },
                      { label: "Mostrar na pasta", action: () => void platform().revealInDir(r.path) },
                      { label: "Remover dos recentes", action: () => forgetRecent(r.path) },
                    ],
                  },
                })
              }
            />
          ))
        ) : (
          <div className="hint">Os arquivos que você abrir aparecem aqui.</div>
        )}

        <div className="sec with-act">
          PASTAS
          <button title="Adicionar pasta" onClick={() => void addFolder().then(refresh)}>
            <Plus size={13} />
          </button>
        </div>
        {library.folders.map((f) => (
          <FolderRow key={f} path={f} tick={tick} />
        ))}
      </div>

      <div className="it prefs" onClick={() => setState({ preferences: true })}>
        <SlidersHorizontal className="ic" size={15} />
        Preferências
      </div>
    </aside>
  );
}
