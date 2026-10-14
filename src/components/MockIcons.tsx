/**
 * Ícones com os mesmos traços do mock aprovado (gerado a partir de
 * docs/fidelidade/mock-original.html). Usados em tudo que aparece no mock.
 */
import type { CSSProperties } from "react";

const PATHS: Record<string, string> = {
  "file": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"M16 13H8\"/><path d=\"M16 17H8\"/><path d=\"M10 9H8\"/>",
  "files": "<path d=\"M20 7h-3a2 2 0 0 1-2-2V2\"/><path d=\"M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z\"/><path d=\"M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8\"/>",
  "folder": "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/>",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/>",
  "x": "<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>",
  "plus": "<path d=\"M5 12h14\"/><path d=\"M12 5v14\"/>",
  "minus": "<path d=\"M5 12h14\"/>",
  "square": "<rect width=\"14\" height=\"14\" x=\"5\" y=\"5\" rx=\"2\"/>",
  "chev-r": "<path d=\"m9 18 6-6-6-6\"/>",
  "chev-d": "<path d=\"m6 9 6 6 6-6\"/>",
  "check": "<path d=\"M20 6 9 17l-5-5\"/>",
  "list": "<path d=\"M8 6h13\"/><path d=\"M8 12h13\"/><path d=\"M8 18h13\"/><path d=\"M3 6h.01\"/><path d=\"M3 12h.01\"/><path d=\"M3 18h.01\"/>",
  "list-ol": "<path d=\"M10 6h11\"/><path d=\"M10 12h11\"/><path d=\"M10 18h11\"/><path d=\"M4 6h1v4\"/><path d=\"M4 10h2\"/><path d=\"M6 18H4c0-1 2-2 2-3s-1-1.5-2-1\"/>",
  "checks": "<path d=\"m3 17 2 2 4-4\"/><path d=\"m3 7 2 2 4-4\"/><path d=\"M13 6h8\"/><path d=\"M13 12h8\"/><path d=\"M13 18h8\"/>",
  "bold": "<path d=\"M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8\"/>",
  "italic": "<path d=\"M19 4h-9\"/><path d=\"M14 20H5\"/><path d=\"M15 4 9 20\"/>",
  "underline": "<path d=\"M6 4v6a6 6 0 0 0 12 0V4\"/><path d=\"M4 20h16\"/>",
  "strike": "<path d=\"M16 4H9a3 3 0 0 0-2.83 4\"/><path d=\"M14 12a4 4 0 0 1 0 8H6\"/><path d=\"M4 12h16\"/>",
  "highlighter": "<path d=\"m9 11-6 6v3h9l3-3\"/><path d=\"m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4\"/>",
  "type": "<path d=\"M4 7V4h16v3\"/><path d=\"M9 20h6\"/><path d=\"M12 4v16\"/>",
  "link": "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/>",
  "ext": "<path d=\"M15 3h6v6\"/><path d=\"M10 14 21 3\"/><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/>",
  "pen": "<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z\"/>",
  "table": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M12 3v18\"/><path d=\"M3 9h18\"/><path d=\"M3 15h18\"/>",
  "image": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21\"/>",
  "code": "<path d=\"m16 18 6-6-6-6\"/><path d=\"m8 6-6 6 6 6\"/>",
  "quote": "<path d=\"M7 7h4v4c0 3-1.6 5-4 6\"/><path d=\"M15 7h4v4c0 3-1.6 5-4 6\"/>",
  "eye": "<path d=\"M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  "columns": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M12 3v18\"/>",
  "more": "<circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/><circle cx=\"5\" cy=\"12\" r=\"1\"/>",
  "moon": "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>",
  "focus": "<path d=\"M8 3H5a2 2 0 0 0-2 2v3\"/><path d=\"M21 8V5a2 2 0 0 0-2-2h-3\"/><path d=\"M3 16v3a2 2 0 0 0 2 2h3\"/><path d=\"M16 21h3a2 2 0 0 0 2-2v-3\"/>",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 6v6l4 2\"/>",
  "restore": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/>",
  "hash": "<path d=\"M4 9h16\"/><path d=\"M4 15h16\"/><path d=\"M10 3 8 21\"/><path d=\"m16 3-2 18\"/>",
  "star": "<path d=\"m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z\"/>",
  "settings": "<path d=\"M21 4h-7\"/><path d=\"M10 4H3\"/><path d=\"M21 12h-9\"/><path d=\"M8 12H3\"/><path d=\"M21 20h-5\"/><path d=\"M12 20H3\"/><path d=\"M14 2v4\"/><path d=\"M8 10v4\"/><path d=\"M16 18v4\"/>",
  "command": "<path d=\"M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3\"/>",
  "download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><path d=\"m7 10 5 5 5-5\"/><path d=\"M12 15V3\"/>",
  "pin": "<path d=\"M12 17v5\"/><path d=\"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z\"/>",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>",
  "grip": "<circle cx=\"9\" cy=\"5\" r=\"1\"/><circle cx=\"9\" cy=\"12\" r=\"1\"/><circle cx=\"9\" cy=\"19\" r=\"1\"/><circle cx=\"15\" cy=\"5\" r=\"1\"/><circle cx=\"15\" cy=\"12\" r=\"1\"/><circle cx=\"15\" cy=\"19\" r=\"1\"/>",
  "undo": "<path d=\"M3 7v6h6\"/><path d=\"M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13\"/>",
  "redo": "<path d=\"M21 7v6h-6\"/><path d=\"M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7\"/>",
  "collapse": "<path d=\"m3 10 2.5-2.5L3 5\"/><path d=\"m3 19 2.5-2.5L3 14\"/><path d=\"M10 6h11\"/><path d=\"M10 12h11\"/><path d=\"M10 18h11\"/>",
  "callout": "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>",
  "divider": "<path d=\"M3 12h18\"/><path d=\"M8 6h8\"/><path d=\"M8 18h8\"/>"
};

export type MockIconName = keyof typeof PATHS;

export function MI({
  name,
  size = 16,
  strokeWidth = 2,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`ic ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] ?? "" }}
    />
  );
}

/** Componente de ícone com nome fixo (para listas como o menu "/"). */
export const mockIcon = (name: string) => {
  const Icon = ({ size = 16, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) => (
    <MI name={name} size={size} strokeWidth={strokeWidth} />
  );
  Icon.displayName = `MockIcon(${name})`;
  return Icon;
};
