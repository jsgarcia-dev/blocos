import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/** Painel flutuante ancorado num botão; fecha ao clicar fora ou com Esc. */
export function Popover({
  anchor,
  open,
  onClose,
  children,
  align = "start",
  className = "",
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const r = anchor.current.getBoundingClientRect();
    const w = ref.current?.offsetWidth ?? 0;
    let left = align === "end" ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    setPos({ left, top: r.bottom + 6 });
  }, [open, anchor, align]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      className={`popover ${className}`}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      // não tira o foco do editor (a seleção continua), exceto em campos de digitar (busca, cor)
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest("input, textarea, select")) e.preventDefault();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
