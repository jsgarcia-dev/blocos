import { describe, expect, it } from "vitest";
import { DEFAULT_FONT, SYSTEM_UI, fontLabel, fontStack } from "./fonts";

describe("fontStack", () => {
  it("padrão e fontes com reserva do tipo certo", () => {
    expect(fontStack(DEFAULT_FONT)).toBe('"Bricolage Grotesque", sans-serif');
    expect(fontStack("Literata")).toBe('"Literata", serif');
    expect(fontStack("JetBrains Mono")).toBe('"JetBrains Mono", monospace');
    expect(fontStack("DejaVu Sans")).toBe('"DejaVu Sans", sans-serif');
    expect(fontStack("Liberation Serif")).toBe('"Liberation Serif", serif');
  });
  it("fonte do sistema", () => {
    expect(fontStack(SYSTEM_UI)).toBe('system-ui, "Segoe UI", sans-serif');
    expect(fontLabel(SYSTEM_UI)).toBe("Fonte do sistema");
    expect(fontLabel("Inter")).toBe("Inter");
  });
  it("nome estranho não quebra o CSS", () => {
    expect(fontStack('Fonte"; color: red')).toBe('"Fonte color: red", sans-serif');
    expect(fontStack('""')).toBe('"Bricolage Grotesque", sans-serif');
  });
});
