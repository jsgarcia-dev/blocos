export interface Swatch {
  name: string;
  value: string | null;
}

/** Cores de texto (null = cor padrão); legíveis nos temas claro e escuro. */
export const TEXT_COLORS: Swatch[] = [
  { name: "Padrão", value: null },
  { name: "Cinza-escuro", value: "#495057" },
  { name: "Cinza", value: "#868E96" },
  { name: "Marrom", value: "#9C6644" },
  { name: "Vermelho", value: "#E5484D" },
  { name: "Rosa", value: "#D6336C" },
  { name: "Laranja", value: "#F76B15" },
  { name: "Âmbar", value: "#E8A100" },
  { name: "Oliva", value: "#7C8B1E" },
  { name: "Verde", value: "#2F9E44" },
  { name: "Verde-água", value: "#0CA678" },
  { name: "Ciano", value: "#1098AD" },
  { name: "Azul", value: "#1C7ED6" },
  { name: "Índigo", value: "#4263EB" },
  { name: "Roxo", value: "#7048E8" },
  { name: "Violeta", value: "#AE3EC9" },
  { name: "Magenta", value: "#C2255C" },
  { name: "Azul-marinho", value: "#1B3A6B" },
];

/** Cores de destaque. O amarelo é o padrão e vira `==texto==` no Markdown. */
export const DEFAULT_HIGHLIGHT = "#FFE066";
export const HIGHLIGHT_COLORS: Swatch[] = [
  { name: "Amarelo", value: DEFAULT_HIGHLIGHT },
  { name: "Laranja", value: "#FFD8BF" },
  { name: "Vermelho", value: "#FFC9C9" },
  { name: "Rosa", value: "#FFD1DC" },
  { name: "Lilás", value: "#F3D9FA" },
  { name: "Roxo", value: "#E5DBFF" },
  { name: "Índigo", value: "#DBE4FF" },
  { name: "Azul", value: "#D0E2FF" },
  { name: "Ciano", value: "#C5F6FA" },
  { name: "Verde-água", value: "#C3FAE8" },
  { name: "Verde", value: "#C3F0C8" },
  { name: "Lima", value: "#E9FAC8" },
  { name: "Areia", value: "#F1E7D0" },
  { name: "Cinza", value: "#E9ECEF" },
];

/** Normaliza `rgb(…)`, `#abc` e `#aabbcc` para `#AABBCC`. */
export function toHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const c = color.trim();
  const rgb = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return (
      "#" +
      [rgb[1], rgb[2], rgb[3]]
        .map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  }
  const short = c.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return ("#" + short[1] + short[1] + short[2] + short[2] + short[3] + short[3]).toUpperCase();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
  return c;
}

export function isDefaultHighlight(color: string | null | undefined): boolean {
  return !color || toHex(color) === DEFAULT_HIGHLIGHT;
}
