import { useMemo } from "react";
import { canvasLook } from "../lib/editorLook";
import { platform } from "../lib/platform";
import { useApp } from "../store/store";

/** Propriedades da área de edição (`.canvas`) conforme Preferências → Editor. */
export function useCanvasLook() {
  const prefs = useApp((s) => s.library.prefs);
  const dark = useApp((s) => s.dark);
  return useMemo(() => {
    const look = canvasLook(prefs, dark, (p) => platform().assetUrl(p));
    return { className: look.className, style: look.style, "data-tema": look.tema };
  }, [prefs, dark]);
}
