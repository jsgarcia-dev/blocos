import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FolderOpen, Minus, Plus, X } from "lucide-react";
import { platform } from "../lib/platform";
import { prettyPath } from "../lib/paths";
import { setState, useApp } from "../store/store";
import { addFolder, removeFolder, setPrefsAndSave } from "../store/actions";
import type { Theme } from "../store/types";

export function ConfirmDialog() {
  const req = useApp((s) => s.confirm);
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (req) setTimeout(() => primary.current?.focus(), 0);
  }, [req]);
  if (!req) return null;
  const cancel = req.buttons.find((b) => b.variant === "ghost")?.id ?? req.buttons[0].id;
  return (
    <div className="overlay center" onMouseDown={() => req.resolve(cancel)}>
      <div
        className="dialog"
        role="dialog"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") req.resolve(cancel);
        }}
      >
        <h3>{req.title}</h3>
        <p>{req.message}</p>
        <div className="actions">
          {req.buttons.map((b) => (
            <button
              key={b.id}
              ref={b.variant === "primary" ? primary : undefined}
              className={`btn ${b.variant ?? ""}`}
              onClick={() => req.resolve(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function ContextMenu() {
  const menu = useApp((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    setPos({ left: Math.min(menu.x, window.innerWidth - w - 6), top: Math.min(menu.y, window.innerHeight - h - 6) });
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setState({ menu: null });
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", key);
    };
  }, [menu]);
  if (!menu) return null;
  return (
    <div ref={ref} className="ctx popover" style={pos} onMouseDown={(e) => e.stopPropagation()}>
      {menu.items.map((it, i) =>
        it.separator ? (
          <div key={i} className="msep" />
        ) : (
          <button
            key={i}
            className={`mi${it.danger ? " danger" : ""}`}
            onClick={() => {
              setState({ menu: null });
              it.action();
            }}
          >
            <span>{it.label}</span>
          </button>
        ),
      )}
    </div>
  );
}

const THEMES: { id: Theme; label: string }[] = [
  { id: "claro", label: "Claro" },
  { id: "escuro", label: "Escuro" },
  { id: "sistema", label: "Do sistema" },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={`toggle${on ? " on" : ""}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} />;
}

export function Preferences() {
  const open = useApp((s) => s.preferences);
  const prefs = useApp((s) => s.library.prefs);
  const folders = useApp((s) => s.library.folders);
  const home = useApp((s) => s.home);
  const native = useApp((s) => s.native);
  const [dataDir, setDataDir] = useState("");
  useEffect(() => {
    if (open) void platform().appDirs().then((d) => setDataDir(d.data));
  }, [open]);
  if (!open) return null;
  const close = () => setState({ preferences: false });
  return (
    <div className="overlay center" onMouseDown={close} onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="dialog prefs-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dh">
          <h3>Preferências</h3>
          <button className="icon-btn" onClick={close} title="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="pref">
          <div>
            <b>Tema</b>
            <span>Cores da página e da barra de formatação</span>
          </div>
          <div className="seg">
            {THEMES.map((t) => (
              <button key={t.id} className={prefs.theme === t.id ? "on" : ""} onClick={() => setPrefsAndSave({ theme: t.id })}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pref">
          <div>
            <b>Salvar automaticamente</b>
            <span>Grava no arquivo logo depois que você para de digitar</span>
          </div>
          <Toggle on={prefs.autosave} onChange={(v) => setPrefsAndSave({ autosave: v })} />
        </div>

        <div className="pref">
          <div>
            <b>Verificação ortográfica</b>
            <span>Sublinha palavras que o sistema não reconhece</span>
          </div>
          <Toggle on={prefs.spellcheck} onChange={(v) => setPrefsAndSave({ spellcheck: v })} />
        </div>

        <div className="pref">
          <div>
            <b>Tamanho do texto</b>
            <span>Também com Ctrl + e Ctrl −</span>
          </div>
          <div className="zoomer">
            <button onClick={() => setPrefsAndSave({ zoom: Math.max(70, prefs.zoom - 10) })}>
              <Minus size={14} />
            </button>
            <span>{`${prefs.zoom}%`}</span>
            <button onClick={() => setPrefsAndSave({ zoom: Math.min(200, prefs.zoom + 10) })}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="pref col">
          <div>
            <b>Pastas na lateral</b>
            <span>Onde a busca procura suas notas</span>
          </div>
          <div className="folder-list">
            {folders.map((f) => (
              <div key={f} className="folder-row">
                <FolderOpen size={14} />
                <span title={f}>{prettyPath(f, home)}</span>
                <button className="icon-btn" title="Remover da lista" onClick={() => removeFolder(f)}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <button className="btn ghost small" onClick={() => void addFolder()}>
              <Plus size={14} />
              Adicionar pasta
            </button>
          </div>
        </div>

        {native && (
          <div className="pref">
            <div>
              <b>Cópias de segurança</b>
              <span>Antes de sobrescrever um arquivo pela primeira vez, o Blocos guarda a versão anterior por 30 dias</span>
            </div>
            <button className="btn ghost small" onClick={() => void platform().revealInDir(`${dataDir}/backups`)}>
              Abrir pasta
            </button>
          </div>
        )}

        <div className="pref-foot">
          Atalhos: Ctrl+T nova aba · Ctrl+O abrir · Ctrl+S salvar · Ctrl+W fechar · Ctrl+Shift+T reabrir · Ctrl+P buscar · Ctrl+F localizar · Ctrl+H substituir · Ctrl+K link · Ctrl+\ lateral
        </div>
      </div>
    </div>
  );
}
