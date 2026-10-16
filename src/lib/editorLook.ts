/**
 * Aparência da área de edição (Preferências → Editor): posição e largura da coluna
 * de texto, espaço entre linhas e entre letras, e o fundo.
 */
import type { CSSProperties } from "react";
import type { EditorBackground, EditorWidth, LetterSpacing, LineSpacing, Prefs } from "../store/types";

export const WIDTHS: Record<EditorWidth, string> = { normal: "740px", larga: "1000px", inteira: "100%" };

/** Altura de linha dos parágrafos e dos itens de lista (os itens são um pouco mais altos no "compacto", como no mock). */
export const LINE_HEIGHTS: Record<LineSpacing, { p: number; li: number }> = {
  compacto: { p: 1.5, li: 1.55 },
  confortavel: { p: 1.75, li: 1.75 },
  amplo: { p: 2, li: 2 },
};

export const LETTER_SPACINGS: Record<LetterSpacing, string> = { normal: "normal", leve: "0.015em", largo: "0.04em" };

export const BACKGROUNDS: { id: EditorBackground; label: string }[] = [
  { id: "pontos", label: "Pontilhado" },
  { id: "quadriculado", label: "Quadriculado" },
  { id: "linhas", label: "Caderno" },
  { id: "liso", label: "Liso" },
  { id: "cor", label: "Cor" },
  { id: "imagem", label: "Imagem" },
];

export const COLOR_PRESETS: { color: string; label: string }[] = [
  { color: "#0b0b0c", label: "Preto" },
  { color: "#1c1c21", label: "Grafite" },
  { color: "#111a2e", label: "Azul-noite" },
  { color: "#17241c", label: "Verde-musgo" },
  { color: "#ffffff", label: "Branco" },
  { color: "#f6f1e4", label: "Creme" },
  { color: "#e9eef5", label: "Azul-claro" },
  { color: "#ece9f6", label: "Lavanda" },
];

/** Fundo da área de edição de cada tema (usado no véu sobre a imagem). */
const CANVAS_RGB = { claro: "242, 240, 234", escuro: "17, 17, 19" };

/** Luminância relativa (0 = preto, 1 = branco) de uma cor "#rrggbb" ou "#rgb". */
export function luminance(hex: string): number {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return 1;
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export interface CanvasLook {
  className: string;
  style: CSSProperties;
  /** Cores do texto na área de edição: as do tema, ou as do tema oposto quando a cor de fundo pede. */
  tema: "claro" | "escuro";
}

/**
 * Classes, variáveis CSS e cores da área de edição para as preferências dadas.
 * `assetUrl` converte o caminho da imagem de fundo num endereço que a página consegue carregar.
 */
export function canvasLook(prefs: Prefs, dark: boolean, assetUrl: (path: string) => string): CanvasLook {
  let tema: CanvasLook["tema"] = dark ? "escuro" : "claro";
  const lh = LINE_HEIGHTS[prefs.lineSpacing] ?? LINE_HEIGHTS.confortavel;
  const style: Record<string, string> = {
    "--sheet-w": WIDTHS[prefs.editorWidth] ?? WIDTHS.normal,
    "--lh": String(lh.p),
    "--lh-li": String(lh.li),
    "--ls": LETTER_SPACINGS[prefs.letterSpacing] ?? "normal",
  };
  let background = prefs.background;
  if (background === "imagem" && !prefs.backgroundImage) background = "pontos";
  if (background === "cor") {
    style.backgroundColor = prefs.backgroundColor;
    // texto claro em fundo escuro e vice-versa, qualquer que seja o tema
    tema = luminance(prefs.backgroundColor) < 0.35 ? "escuro" : "claro";
  } else if (background === "imagem" && prefs.backgroundImage) {
    const veil = Math.min(90, Math.max(0, prefs.backgroundVeil)) / 100;
    const rgba = `rgba(${CANVAS_RGB[tema]}, ${veil})`;
    const url = assetUrl(prefs.backgroundImage).replace(/["\\]/g, "\\$&");
    style.backgroundImage = `linear-gradient(${rgba}, ${rgba}), url("${url}")`;
  }
  const className = `canvas fundo-${background} alinha-${prefs.editorAlign === "centro" ? "centro" : "esquerda"}`;
  return { className, style: style as CSSProperties, tema };
}
