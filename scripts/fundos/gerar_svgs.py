"""Gera os desenhos (SVG) dos fundos do editor, nas versões clara e escura.

Uso: python3 scripts/fundos/gerar_svgs.py   (grava em src/assets/fundos/)

Os fundos feitos só com CSS (pontilhado, grade técnica, isométrico, aurora) ficam em
src/styles/fundos.css; aqui ficam os que precisam de desenho: cruzes, colmeia, relevo,
fluxo e papel.
"""
import math
from pathlib import Path

DEST = Path(__file__).resolve().parents[2] / "src" / "assets" / "fundos"

# traço: marrom quente discreto no tema claro, branco bem transparente no escuro
TRACO = {"claro": ("#827054", 0.24), "escuro": ("#ffffff", 0.075)}


def svg(w: int, h: int, body: str, view: str | None = None) -> str:
    vb = f" viewBox='{view}'" if view else ""
    return f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}'{vb}>{body}</svg>\n"


def stroke(tema: str, width: float = 1.0) -> str:
    cor, op = TRACO[tema]
    return f"fill='none' stroke='{cor}' stroke-opacity='{op}' stroke-width='{width}' stroke-linecap='round'"


def cruzes(tema: str) -> str:
    return svg(32, 32, f"<path d='M16 12.5v7M12.5 16h7' {stroke(tema, 1.2)}/>")


def colmeia(tema: str) -> str:
    s = stroke(tema)
    return svg(56, 100, f"<path d='M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100' {s}/><path d='M28 0L28 34L0 50L0 84L28 100L56 84L56 50L28 34' {s}/>")


def fluxo(tema: str) -> str:
    paths = []
    for i in range(-2, 18):
        pts = []
        for x in range(0, 1241, 20):
            y = i * 52 + 22 * math.sin(x / 190 + i * 0.45) + 9 * math.sin(x / 67 + i * 1.7)
            pts.append(f"{x} {y:.1f}")
        paths.append("M" + " L".join(pts))
    return svg(1240, 900, f"<path d='{' '.join(paths)}' {stroke(tema, 1.1)}/>", "0 0 1240 900")


def relevo(tema: str) -> str:
    paths = []
    for cx, cy, n, ph in ((300, 260, 11, 0.0), (980, 700, 13, 1.7)):
        for k in range(1, n + 1):
            r0 = 18 + k * 30
            pts = []
            for a in range(0, 360, 6):
                t = math.radians(a)
                r = r0 * (1 + 0.13 * math.sin(3 * t + k * 0.35 + ph) + 0.07 * math.sin(5 * t + 1.1 + ph) + 0.04 * math.sin(2 * t + k * 0.2))
                pts.append(f"{cx + r * math.cos(t):.1f} {cy + r * math.sin(t) * 0.82:.1f}")
            paths.append("M" + " L".join(pts) + "Z")
    return svg(1240, 900, f"<path d='{' '.join(paths)}' {stroke(tema, 1.1)}/>", "0 0 1240 900")


def papel(tema: str) -> str:
    # grão fino: ruído em tom de papel, quase transparente (a cor de fundo vem do CSS)
    op = 0.16 if tema == "claro" else 0.22
    return svg(
        160,
        160,
        "<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/>"
        f"<feColorMatrix values='0 0 0 0 .5  0 0 0 0 .42  0 0 0 0 .3  0 0 0 {op} 0'/></filter>"
        "<rect width='100%' height='100%' filter='url(#g)'/>",
    )


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    for nome, fn in (("cruzes", cruzes), ("colmeia", colmeia), ("fluxo", fluxo), ("relevo", relevo), ("papel", papel)):
        for tema in ("claro", "escuro"):
            (DEST / f"{nome}-{tema}.svg").write_text(fn(tema))
    print("SVGs gravados em", DEST)


if __name__ == "__main__":
    main()
