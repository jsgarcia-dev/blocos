/**
 * Fonte de todo o app (Preferências → Fonte): as que vêm com o Blocos (iguais no
 * Linux e no Windows, sem internet), a fonte do sistema ou qualquer fonte instalada.
 * O código e o texto puro (.txt) continuam com a fonte monoespaçada (--mono).
 */

/** Valor especial: a fonte da interface do sistema (Ubuntu/Cantarell no Linux, Segoe UI no Windows). */
export const SYSTEM_UI = "system-ui";
export const DEFAULT_FONT = "Bricolage Grotesque";

export const BUNDLED_FONTS: { family: string; note: string }[] = [
  { family: "Bricolage Grotesque", note: "Padrão do Blocos" },
  { family: SYSTEM_UI, note: "A mesma dos outros programas" },
  { family: "Inter", note: "Neutra e muito legível" },
  { family: "Atkinson Hyperlegible Next", note: "Feita para facilitar a leitura" },
  { family: "Literata", note: "Com serifa, para textos longos" },
  { family: "JetBrains Mono", note: "Monoespaçada" },
];

export const fontLabel = (family: string) => (family === SYSTEM_UI ? "Fonte do sistema" : family);

/** Nome da fonte a partir de um `font-family` ("\"Inter\", sans-serif" → "Inter"); null se vazio. */
export function familyFromStack(stack: string | null | undefined): string | null {
  if (!stack) return null;
  const first = stack.split(",")[0].replace(/["']/g, "").trim();
  if (!first) return null;
  return first === "system-ui" ? SYSTEM_UI : first;
}

/** Valor de `font-family` para a fonte escolhida (com reserva genérica para caracteres que ela não tenha). */
export function fontStack(family: string): string {
  if (family === SYSTEM_UI) return 'system-ui, "Segoe UI", sans-serif';
  // o nome vem de uma lista, mas não pode fechar a string do CSS
  const name = family.replace(/["\;{}<>]/g, "").trim();
  if (!name) return `"${DEFAULT_FONT}", sans-serif`;
  const generic = /mono|code|courier|consol/i.test(name) ? "monospace" : /serif|literata|georgia|times|garamond|merriweather/i.test(name) && !/sans/i.test(name) ? "serif" : "sans-serif";
  return `"${name}", ${generic}`;
}
