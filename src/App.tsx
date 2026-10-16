import { useEffect } from "react";
import { Titlebar } from "./components/Titlebar";
import { Sidebar } from "./components/Sidebar";
import { Ribbon } from "./components/Ribbon";
import { StatusBar } from "./components/StatusBar";
import { EditorPane } from "./components/EditorPane";
import { FindBar, closeFind, openFind } from "./components/FindBar";
import { QuickSearch } from "./components/QuickSearch";
import { ConfirmDialog, ContextMenu, Preferences, Toasts } from "./components/Overlays";
import { openLinkEditor } from "./components/Bubbles";
import { handles } from "./lib/handles";
import { fontStack } from "./lib/fonts";
import { platform } from "./lib/platform";
import { activeTab, getState, setState, useApp } from "./store/store";
import {
  activateIndex,
  bootstrap,
  closeTab,
  cycleTab,
  newTab,
  openWithDialog,
  reopenClosed,
  saveTab,
  setPrefsAndSave,
} from "./store/actions";

function useTheme() {
  const theme = useApp((s) => s.library.prefs.theme);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "escuro" || (theme === "sistema" && mq.matches);
      document.documentElement.dataset.theme = dark ? "escuro" : "claro";
      setState({ dark });
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}

/** Fonte escolhida em Preferências → Fonte, aplicada no app inteiro. */
function useAppFont() {
  const family = useApp((s) => s.library.prefs.fontFamily);
  useEffect(() => {
    document.documentElement.style.setProperty("--font", fontStack(family));
  }, [family]);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (e.key === "F5" || (mod && key === "r")) {
        e.preventDefault();
        return;
      }
      if (!mod) return;
      const s = getState();
      if (s.confirm) return;
      const tab = activeTab();
      const hit = (fn: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      };
      if (key === "tab" || key === "pagedown" || key === "pageup") {
        return hit(() => cycleTab(key === "pageup" || (key === "tab" && e.shiftKey) ? -1 : 1));
      }
      if (e.shiftKey) {
        if (key === "t") return hit(() => void reopenClosed());
        if (key === "s") {
          // Ctrl+Shift+S é "salvar como" (o tachado continua no botão da barra)
          return hit(() => tab && void saveTab(tab.id, { as: true }));
        }
        if (key === "p") return hit(() => void platform().printPage());
        return;
      }
      if (e.altKey) return;
      switch (key) {
        case "t":
        case "n":
          return hit(() => newTab());
        case "o":
          return hit(() => void openWithDialog());
        case "s":
          return hit(() => tab && void saveTab(tab.id));
        case "w":
          return hit(() => tab && void closeTab(tab.id));
        case "p":
          return hit(() => setState({ quickSearch: true }));
        case "f":
          return hit(() => openFind(false));
        case "h":
          return hit(() => openFind(true));
        case "k":
          if (tab?.kind === "md") return hit(() => openLinkEditor(handles.get(tab.id)?.editor));
          return;
        case "\\":
          return hit(() => setPrefsAndSave({ sidebar: !s.library.prefs.sidebar }));
        case ",":
          return hit(() => setState({ preferences: true }));
        case "=":
        case "+":
          return hit(() => setPrefsAndSave({ zoom: Math.min(200, s.library.prefs.zoom + 10) }));
        case "-":
          return hit(() => setPrefsAndSave({ zoom: Math.max(70, s.library.prefs.zoom - 10) }));
        case "0":
          return hit(() => setPrefsAndSave({ zoom: 100 }));
      }
      if (/^[1-9]$/.test(key)) return hit(() => activateIndex(Number(key) - 1));
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const s = getState();
      if (s.preferences) return setState({ preferences: false });
      if (s.find.open && !s.quickSearch && !s.confirm) closeFind();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);
}

export default function App() {
  const ready = useApp((s) => s.ready);
  const tabs = useApp((s) => s.tabs);
  const activeId = useApp((s) => s.activeId);
  const sidebar = useApp((s) => s.library.prefs.sidebar);
  const zoom = useApp((s) => s.library.prefs.zoom);
  const maximized = useApp((s) => s.maximized);
  useTheme();
  useAppFont();
  useShortcuts();

  useEffect(() => {
    void bootstrap().catch((e) => {
      console.error(e);
      setState({ ready: true });
    });
  }, []);

  return (
    <div className={`app${maximized ? " maximized" : ""}`} style={{ ["--zoom" as string]: zoom / 100 }} onContextMenu={(e) => {
      // menu nativo só dentro do texto (copiar/colar/ortografia)
      const t = e.target as HTMLElement;
      if (!t.closest(".ProseMirror, textarea, input")) e.preventDefault();
    }}>
      <Titlebar />
      <div className="amain">
        {sidebar && <Sidebar />}
        <div className="work">
          <Ribbon />
          <div className="stack">
            {ready && tabs.map((t) => <EditorPane key={`${t.id}:${t.version}`} tab={t} active={t.id === activeId} />)}
            <FindBar />
          </div>
          <StatusBar />
        </div>
      </div>
      <QuickSearch />
      <Preferences />
      <ConfirmDialog />
      <ContextMenu />
      <Toasts />
    </div>
  );
}
