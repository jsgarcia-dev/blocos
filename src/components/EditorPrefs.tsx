import { ImageIcon, RotateCcw } from "lucide-react";
import { BACKGROUNDS, COLOR_PRESETS } from "../lib/editorLook";
import { platform } from "../lib/platform";
import { DEFAULT_PREFS, toast, useApp } from "../store/store";
import { setPrefsAndSave } from "../store/actions";
import type { EditorAlign, EditorWidth, LetterSpacing, LineSpacing, Prefs } from "../store/types";

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} className={value === o.id ? "on" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ALIGNS: { id: EditorAlign; label: string }[] = [
  { id: "esquerda", label: "À esquerda" },
  { id: "centro", label: "Centralizado" },
];
const WIDTHS: { id: EditorWidth; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "larga", label: "Larga" },
  { id: "inteira", label: "Tela inteira" },
];
const LINES: { id: LineSpacing; label: string }[] = [
  { id: "compacto", label: "Compacto" },
  { id: "confortavel", label: "Confortável" },
  { id: "amplo", label: "Amplo" },
];
const LETTERS: { id: LetterSpacing; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "leve", label: "Leve" },
  { id: "largo", label: "Largo" },
];

const EDITOR_KEYS = [
  "editorAlign",
  "editorWidth",
  "lineSpacing",
  "letterSpacing",
  "background",
  "backgroundColor",
  "backgroundImage",
  "backgroundVeil",
] as const satisfies readonly (keyof Prefs)[];

/** Seção "Editor" das Preferências: coluna de texto, espaçamentos e fundo. */
export function EditorPrefs() {
  const prefs = useApp((s) => s.library.prefs);

  const chooseImage = async () => {
    const src = await platform().openImage();
    if (!src) return;
    try {
      // guarda uma cópia na pasta do app: o fundo não some se o arquivo original for movido
      const stored = await platform().importImage(src, null);
      setPrefsAndSave({ background: "imagem", backgroundImage: stored });
    } catch (e) {
      toast(`Não consegui usar essa imagem: ${String(e)}`, "erro");
    }
  };

  const isDefault = EDITOR_KEYS.every((k) => prefs[k] === DEFAULT_PREFS[k]);
  const reset = () => setPrefsAndSave(Object.fromEntries(EDITOR_KEYS.map((k) => [k, DEFAULT_PREFS[k]])) as Partial<Prefs>);
  const imageUrl = prefs.backgroundImage ? platform().assetUrl(prefs.backgroundImage) : null;

  return (
    <>
      <div className="pref-sec">
        EDITOR
        {!isDefault && (
          <button className="link-btn" onClick={reset}>
            <RotateCcw size={12} />
            Voltar ao padrão
          </button>
        )}
      </div>

      <div className="pref">
        <div>
          <b>Posição do texto</b>
          <span>Começa na esquerda ou fica no meio da área de edição</span>
        </div>
        <Seg value={prefs.editorAlign} options={ALIGNS} onChange={(v) => setPrefsAndSave({ editorAlign: v })} />
      </div>

      <div className="pref">
        <div>
          <b>Largura do texto</b>
          <span>Até onde as linhas vão antes de quebrar</span>
        </div>
        <Seg value={prefs.editorWidth} options={WIDTHS} onChange={(v) => setPrefsAndSave({ editorWidth: v })} />
      </div>

      <div className="pref">
        <div>
          <b>Espaço entre linhas</b>
          <span>Distância entre uma linha e a de baixo</span>
        </div>
        <Seg value={prefs.lineSpacing} options={LINES} onChange={(v) => setPrefsAndSave({ lineSpacing: v })} />
      </div>

      <div className="pref">
        <div>
          <b>Espaço entre letras</b>
          <span>Deixa o texto mais solto</span>
        </div>
        <Seg value={prefs.letterSpacing} options={LETTERS} onChange={(v) => setPrefsAndSave({ letterSpacing: v })} />
      </div>

      <div className="pref col">
        <div>
          <b>Fundo</b>
          <span>Atrás do texto, na área de edição</span>
        </div>
        <div className="bg-tiles">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              className={`bg-tile${prefs.background === b.id ? " on" : ""}`}
              onClick={() => (b.id === "imagem" && !prefs.backgroundImage ? void chooseImage() : setPrefsAndSave({ background: b.id }))}
            >
              <i
                className={`bg-prev fundo-${b.id}`}
                style={
                  b.id === "cor"
                    ? { backgroundColor: prefs.backgroundColor }
                    : b.id === "imagem" && imageUrl
                      ? { backgroundImage: `url("${imageUrl.replace(/["\\]/g, "\\$&")}")` }
                      : undefined
                }
              >
                {b.id === "imagem" && !imageUrl && <ImageIcon size={16} />}
              </i>
              {b.label}
            </button>
          ))}
        </div>

        {prefs.background === "cor" && (
          <div className="bg-extra">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.color}
                className={`swatch${prefs.backgroundColor.toLowerCase() === c.color ? " on" : ""}`}
                style={{ background: c.color }}
                title={c.label}
                aria-label={c.label}
                onClick={() => setPrefsAndSave({ backgroundColor: c.color })}
              />
            ))}
            <label className="swatch custom" title="Outra cor">
              <input type="color" value={prefs.backgroundColor} onChange={(e) => setPrefsAndSave({ backgroundColor: e.target.value })} />
            </label>
          </div>
        )}

        {prefs.background === "imagem" && (
          <div className="bg-extra">
            <button className="btn ghost small" onClick={() => void chooseImage()}>
              <ImageIcon size={14} />
              {prefs.backgroundImage ? "Trocar imagem…" : "Escolher imagem…"}
            </button>
            <label className="veil">
              <em>Véu</em>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={prefs.backgroundVeil}
                onChange={(e) => setPrefsAndSave({ backgroundVeil: Number(e.target.value) })}
              />
              <em>{`${prefs.backgroundVeil}%`}</em>
            </label>
          </div>
        )}
      </div>
    </>
  );
}
