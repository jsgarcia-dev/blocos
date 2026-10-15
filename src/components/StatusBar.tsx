import { AlertTriangle, Circle, Loader2 } from "lucide-react";
import { formatNumber } from "../lib/format";
import { setPrefsAndSave } from "../store/actions";
import { useApp } from "../store/store";
import { MI } from "./MockIcons";

export function StatusBar() {
  const tab = useApp((s) => s.tabs.find((t) => t.id === s.activeId));
  const zoom = useApp((s) => s.library.prefs.zoom);
  const autosave = useApp((s) => s.library.prefs.autosave);
  if (!tab) return <footer className="sbar" />;
  const words = tab.stats.words;
  const minutes = Math.max(1, Math.round(words / 200));

  let status: React.ReactNode;
  if (tab.status === "error") {
    status = (
      <span className="err" title={tab.error ?? ""}>
        <AlertTriangle size={13} />
        Erro ao salvar
      </span>
    );
  } else if (tab.status === "saving") {
    status = (
      <span>
        <Loader2 size={13} className="spin" />
        Salvando…
      </span>
    );
  } else if (tab.dirty) {
    status = (
      <span className="pending" title={tab.path ? (autosave ? "Salvando em instantes" : "Ctrl+S para salvar") : "Ctrl+S para escolher onde salvar"}>
        <Circle size={9} fill="currentColor" />
        {tab.path ? "Não salvo" : "Ainda sem arquivo"}
      </span>
    );
  } else {
    status = (
      <span className="ok">
        <MI name="check" size={13} />
        Salvo
      </span>
    );
  }

  return (
    <footer className="sbar">
      {/* cada texto em um só nó: o navegador não ajusta o espaço entre letras de nós diferentes */}
      <span>{`${formatNumber(words)} ${words === 1 ? "palavra" : "palavras"}`}</span>
      {words > 0 && <span>{`~${minutes} min de leitura`}</span>}
      <span className="r">{status}</span>
      <span title={tab.kind === "txt" ? `Codificação: ${tab.encoding.toUpperCase()}` : undefined}>
        {tab.kind === "txt" ? `Texto puro · ${tab.encoding.toUpperCase()}` : "Markdown"}
      </span>
      <button className="zoom" title="Tamanho do texto (Ctrl + / Ctrl − / Ctrl 0)" onClick={() => setPrefsAndSave({ zoom: 100 })}>
        {`${zoom}%`}
      </button>
    </footer>
  );
}
