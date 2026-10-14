import { AlertTriangle, RefreshCw } from "lucide-react";
import { closeTab, keepMine, reloadFromDisk, saveAgain, saveLossyAnyway } from "../store/actions";
import type { Tab } from "../store/types";
import { PlainEditor } from "./PlainEditor";
import { RichEditor } from "./RichEditor";

export function EditorPane({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <div className={`pane${active ? " active" : ""}`} aria-hidden={!active}>
      {tab.externalChange && (
        <div className="notice">
          <RefreshCw size={15} />
          <span>Este arquivo foi alterado fora do Blocos.</span>
          <button onClick={() => void reloadFromDisk(tab.id)}>Recarregar do disco</button>
          <button className="ghost" onClick={() => void keepMine(tab.id)}>
            Manter a minha versão
          </button>
        </div>
      )}
      {tab.missing && !tab.externalChange && (
        <div className="notice warn">
          <AlertTriangle size={15} />
          <span>O arquivo não existe mais no disco.</span>
          <button onClick={() => void saveAgain(tab.id)}>Salvar de novo</button>
          <button className="ghost" onClick={() => void closeTab(tab.id)}>
            Fechar aba
          </button>
        </div>
      )}
      {tab.lossy && !tab.externalChange && !tab.missing && (
        <div className="notice warn">
          <AlertTriangle size={15} />
          <span>Alguns caracteres não puderam ser lidos — o Blocos não vai salvar sozinho.</span>
          <button onClick={() => void saveLossyAnyway(tab.id)}>Salvar mesmo assim</button>
        </div>
      )}
      {tab.kind === "txt" ? <PlainEditor id={tab.id} active={active} /> : <RichEditor id={tab.id} active={active} />}
    </div>
  );
}
