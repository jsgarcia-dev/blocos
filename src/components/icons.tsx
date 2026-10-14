import type { SVGProps } from "react";

/** Ícone do divisor exatamente como no mock (três traços). */
export function DividerIcon({ size = 17, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12h18" />
      <path d="M8 6h8" />
      <path d="M8 18h8" />
    </svg>
  );
}
