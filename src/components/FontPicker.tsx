import { useEffect, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { BUNDLED_FONTS, DEFAULT_FONT, fontLabel, fontStack } from "../lib/fonts";
import { fold } from "../lib/format";
import { platform } from "../lib/platform";
import { useApp } from "../store/store";
import { setPrefsAndSave } from "../store/actions";

function FontOption({
  family,
  label,
  note,
  selected,
  onPick,
}: {
  family: string | null;
  label?: string;
  note?: string;
  selected: boolean;
  onPick: (family: string | null) => void;
}) {
  return (
    <button className={`font-opt${selected ? " on" : ""}`} onClick={() => onPick(family)}>
      {/* cada nome aparece na própria fonte */}
      <b style={family ? { fontFamily: fontStack(family) } : undefined}>{label ?? fontLabel(family ?? "")}</b>
      {note && <em>{note}</em>}
      {selected && <Check size={15} />}
    </button>
  );
}

/**
 * Lista de fontes: as que vêm com o Blocos e as instaladas no computador (com busca).
 * `appDefault` acrescenta a opção "Fonte do app" (null), usada no botão "Fonte" da barra.
 */
export function FontList({
  selected,
  onPick,
  appDefault = false,
}: {
  selected: string | null;
  onPick: (family: string | null) => void;
  appDefault?: boolean;
}) {
  const [system, setSystem] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    platform()
      .listSystemFonts()
      .then((list) => alive && setSystem(list))
      .catch(() => alive && setSystem([]));
    return () => {
      alive = false;
    };
  }, []);

  const bundled = new Set(BUNDLED_FONTS.map((f) => f.family));
  const q = fold(query.trim());
  const fromSystem = (system ?? []).filter((n) => !bundled.has(n) && (!q || fold(n).includes(q)));

  return (
    <>
      <div className="font-group">INCLUÍDAS NO BLOCOS</div>
      {appDefault && <FontOption family={null} label="Fonte do app" note="A escolhida nas Preferências" selected={selected === null} onPick={onPick} />}
      {BUNDLED_FONTS.map((f) => (
        <FontOption key={f.family} family={f.family} note={f.note} selected={selected === f.family} onPick={onPick} />
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
          fromSystem.map((n) => <FontOption key={n} family={n} selected={selected === n} onPick={onPick} />)
        ) : (
          <div className="font-empty">{q ? "Nenhuma fonte com esse nome" : "Nenhuma outra fonte encontrada"}</div>
        )}
      </div>
    </>
  );
}

/** Preferências → Fonte: a fonte de todo o app (menus, abas, lateral e texto). */
export function FontPicker() {
  const family = useApp((s) => s.library.prefs.fontFamily);
  const [open, setOpen] = useState(false);

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
          <FontList selected={family} onPick={(f) => setPrefsAndSave({ fontFamily: f ?? DEFAULT_FONT })} />
        </div>
      )}
    </>
  );
}
