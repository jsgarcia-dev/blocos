import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { platform } from "../lib/platform";
import { useApp, setState } from "../store/store";
import { activate, closeOthers, closeTab, moveTab, newTab, tabTitle, togglePin } from "../store/actions";
import type { Tab } from "../store/types";
import { MI } from "./MockIcons";

function TabPill({ tab, active }: { tab: Tab; active: boolean }) {
  const pinned = useApp((s) => !!tab.path && s.library.pinned.includes(tab.path));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
  return (
    <div
      ref={ref}
      className={`pt${active ? " on" : ""}`}
      title={tab.path ?? tabTitle(tab)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/x-blocos-tab", tab.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("text/x-blocos-tab")) e.preventDefault();
      }}
      onDrop={(e) => {
        const from = e.dataTransfer.getData("text/x-blocos-tab");
        if (from) moveTab(from, tab.id);
      }}
      onMouseDown={(e) => {
        if (e.button === 0) activate(tab.id);
      }}
      onAuxClick={(e) => {
        if (e.button === 1) void closeTab(tab.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setState({
          menu: {
            x: e.clientX,
            y: e.clientY,
            items: [
              ...(tab.path
                ? [
                    { label: pinned ? "Desafixar" : "Fixar na lateral", action: () => togglePin(tab.path!) },
                    { label: "Mostrar na pasta", action: () => void platform().revealInDir(tab.path!) },
                    { label: "Copiar caminho", action: () => void navigator.clipboard.writeText(tab.path!) },
                    { label: "", action: () => undefined, separator: true },
                  ]
                : []),
              { label: "Fechar", action: () => void closeTab(tab.id) },
              { label: "Fechar as outras", action: () => void closeOthers(tab.id) },
            ],
          },
        });
      }}
    >
      <MI name="file" size={14} />
      <span className="nm">{tabTitle(tab)}</span>
      {tab.kind === "txt" && <span className="badge">TXT</span>}
      {tab.dirty ? (
        <span
          className="dot"
          title="Alterações não salvas"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => void closeTab(tab.id)}
        />
      ) : (
        <i
          className="x"
          title="Fechar (Ctrl+W)"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => void closeTab(tab.id)}
        >
          <MI name="x" size={12} />
        </i>
      )}
    </div>
  );
}

export function Titlebar() {
  const tabs = useApp((s) => s.tabs);
  const activeId = useApp((s) => s.activeId);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let off: (() => void) | undefined;
    const sync = () =>
      void platform()
        .windowIsMaximized()
        .then((m) => {
          setMaximized(m);
          setState({ maximized: m });
        });
    sync();
    void platform()
      .onWindowResized(sync)
      .then((u) => (off = u));
    return () => off?.();
  }, []);

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="logo" data-tauri-drag-region>
        b
      </div>
      <div className="ptabs" onWheel={(e) => (e.currentTarget.scrollLeft += e.deltaY)}>
        {tabs.map((t) => (
          <TabPill key={t.id} tab={t} active={t.id === activeId} />
        ))}
        <div className="pt add" title="Nova aba (Ctrl+T)" onClick={() => newTab()}>
          <MI name="plus" size={14} />
        </div>
      </div>
      <div className="drag-fill" data-tauri-drag-region />
      <div className="wc">
        <i title="Minimizar" onClick={() => void platform().windowMinimize()}>
          <MI name="minus" size={11} strokeWidth={2.5} />
        </i>
        <i title={maximized ? "Restaurar" : "Maximizar"} onClick={() => void platform().windowToggleMaximize()}>
          {maximized ? <Copy size={10} strokeWidth={2.5} /> : <MI name="square" size={11} strokeWidth={2.5} />}
        </i>
        <i className="close" title="Fechar" onClick={() => void platform().windowClose()}>
          <MI name="x" size={11} strokeWidth={2.5} />
        </i>
      </div>
    </header>
  );
}
