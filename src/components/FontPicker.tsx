import { useEffect, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { BUNDLED_FONTS, fontLabel, fontStack } from "../lib/fonts";
import { fold } from "../lib/format";
import { platform } from "../lib/platform";
import { useApp } from "../store/store";
import { setPrefsAndSave } from "../store/actions";

function FontOption({ family, note, selected }: { family: string; note?: string; selected: boolean }) {
  return (
    <button className={`font-opt${selected ? " on" : ""}`} onClick={() => setPrefsAndSave({ fontFamily: family })}>
      {/* cada nome aparece na própria fonte */}
      <b style={{ fontFamily: fontStack(family) }}>{fontLabel(family)}</b>
      {note && <em>{note}</em>}
      {selected && <Check size={15} />}
    </button>
  );
}

/** Preferências → Fonte: a fonte de todo o app (menus, abas, lateral e texto). */
export function FontPicker() {
  const family = useApp((s) => s.library.prefs.fontFamily);
  const [open, setOpen] = useState(false);
  const [system, setSystem] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || system) return;
    let alive = true;
    platform()
      .listSystemFonts()
      .then((list) => alive && setSystem(list))
      .catch(() => alive && setSystem([]));
    return () => {
      alive = false;
    };
  }, [open, system]);

  const bundled = new Set(BUNDLED_FONTS.map((f) => f.family));
  const q = fold(query.trim());
  const fromSystem = (system ?? []).filter((n) => !bundled.has(n) && (!q || fold(n).includes(q)));

  return (
    <>
      <div className="pref">
        <div>
          <b>Fonte</b>
          <span>Usada no app inteiro: menus, abas, lateral e texto</span>
        </div>
        <button className={`font-btn${open ? " open" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          <span style={{ fontFamily: fontStack(family) }}>{fontLabel(family)}</span>
          <ChevronDown size={15} />
        </button>
      </div>

      {open && (
        <div className="font-panel">
          <div className="font-group">INCLUÍDAS NO BLOCOS</div>
          {BUNDLED_FONTS.map((f) => (
            <FontOption key={f.family} family={f.family} note={f.note} selected={family === f.family} />
          ))}

          <div className="font-group">
            DO COMPUTADOR
            {system && <em>{fromSystem.length}</em>}
          </div>
          <label className="font-search">
            <Search size={14} />
            <input placeholder="Buscar fonte instalada…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="font-list">
            {system === null ? (
              <div className="font-empty">Procurando as fontes do computador…</div>
            ) : fromSystem.length ? (
              fromSystem.map((n) => <FontOption key={n} family={n} selected={family === n} />)
            ) : (
              <div className="font-empty">{q ? "Nenhuma fonte com esse nome" : "Nenhuma outra fonte encontrada"}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
