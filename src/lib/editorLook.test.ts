import { describe, expect, it } from "vitest";
import { canvasLook, luminance } from "./editorLook";
import { DEFAULT_PREFS } from "../store/store";
import type { Prefs } from "../store/types";

const url = (p: string) => `asset://${p}`;
const prefs = (patch: Partial<Prefs>): Prefs => ({ ...DEFAULT_PREFS, ...patch });
const vars = (p: Prefs, dark = false) => canvasLook(p, dark, url).style as Record<string, string>;

describe("luminance", () => {
  it("vai de 0 (preto) a 1 (branco)", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#fff")).toBeCloseTo(1);
    expect(luminance("#0b0b0c")).toBeLessThan(0.05);
  });
  it("trata cor inválida como clara", () => {
    expect(luminance("azul")).toBe(1);
  });
});

describe("canvasLook", () => {
  it("padrão: texto à esquerda, largura normal, linhas confortáveis, pontilhado", () => {
    const look = canvasLook(DEFAULT_PREFS, false, url);
    expect(look.className).toBe("canvas fundo-pontos alinha-esquerda");
    expect(look.tema).toBe("claro");
    expect(vars(DEFAULT_PREFS)).toMatchObject({ "--sheet-w": "740px", "--lh": "1.75", "--lh-li": "1.75", "--ls": "normal" });
  });

  it("centralizado, tela inteira, compacto (como no mock) e letras largas", () => {
    const p = prefs({ editorAlign: "centro", editorWidth: "inteira", lineSpacing: "compacto", letterSpacing: "largo" });
    expect(canvasLook(p, false, url).className).toContain("alinha-centro");
    expect(vars(p)).toMatchObject({ "--sheet-w": "100%", "--lh": "1.5", "--lh-li": "1.55", "--ls": "0.04em" });
  });

  it("fundo preto no tema claro usa as cores de texto do tema escuro", () => {
    const p = prefs({ background: "cor", backgroundColor: "#0b0b0c" });
    const look = canvasLook(p, false, url);
    expect(look.tema).toBe("escuro");
    expect(look.className).toContain("fundo-cor");
    expect(vars(p).backgroundColor).toBe("#0b0b0c");
  });

  it("fundo branco no tema escuro usa as cores de texto do tema claro", () => {
    expect(canvasLook(prefs({ background: "cor", backgroundColor: "#ffffff" }), true, url).tema).toBe("claro");
  });

  it("imagem: véu da cor do tema por cima da imagem", () => {
    const p = prefs({ background: "imagem", backgroundImage: "/dados/imagens/praia.jpg", backgroundVeil: 40 });
    expect(vars(p, true).backgroundImage).toBe(
      'linear-gradient(rgba(17, 17, 19, 0.4), rgba(17, 17, 19, 0.4)), url("asset:///dados/imagens/praia.jpg")',
    );
  });

  it("imagem sem arquivo escolhido volta ao pontilhado", () => {
    const look = canvasLook(prefs({ background: "imagem", backgroundImage: null }), false, url);
    expect(look.className).toContain("fundo-pontos");
    expect((look.style as Record<string, string>).backgroundImage).toBeUndefined();
  });

  it("aspas no caminho da imagem não quebram o CSS", () => {
    const p = prefs({ background: "imagem", backgroundImage: '/a/"b".png', backgroundVeil: 0 });
    expect(vars(p).backgroundImage).toContain('url("asset:///a/\\"b\\".png")');
  });
});
