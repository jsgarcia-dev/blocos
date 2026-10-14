export interface Swatch {
  name: string;
  value: string | null;
}

/** Cores de texto (null = cor padrão). */
export const TEXT_COLORS: Swatch[] = [
  { name: "Padrão", value: null },
  { name: "Vermelho", value: "#E5484D" },
  { name: "Laranja", value: "#F76B15" },
  { name: "Verde", value: "#2F9E44" },
  { name: "Azul", value: "#1C7ED6" },
  { name: "Roxo", value: "#7048E8" },
  { name: "Cinza", value: "#868E96" },
];

/** Cores de destaque. O amarelo é o padrão e vira `==texto==` no Markdown. */
export const DEFAULT_HIGHLIGHT = "#FFE066";
export const HIGHLIGHT_COLORS: Swatch[] = [
  { name: "Amarelo", value: DEFAULT_HIGHLIGHT },
  { name: "Verde", value: "#C3F0C8" },
  { name: "Azul", value: "#D0E2FF" },
  { name: "Rosa", value: "#FFD1DC" },
  { name: "Laranja", value: "#FFD8BF" },
  { name: "Roxo", value: "#E5DBFF" },
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
