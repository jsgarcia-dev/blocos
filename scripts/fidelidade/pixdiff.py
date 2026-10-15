import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert("RGB")
b = Image.open(sys.argv[2]).convert("RGB")
w, h = a.size
d = ImageChops.difference(a, b).convert("L")
mask = d.point(lambda v: 255 if v > 40 else 0)
px = mask.load()
total = sum(1 for y in range(h) for x in range(w) if px[x, y])
print(f"pixels diferentes (mais de 40 de 255): {total} de {w*h} ({100*total/(w*h):.2f}%)")
dpx = d.load()
faint = sum(1 for y in range(h) for x in range(w) if dpx[x, y] > 10)
print(f"diferenças leves (mais de 10 de 255): {faint}")
# regiões: grade de 20px com algum pixel diferente, agrupadas
cell = 20
cells = set()
for cy in range(0, h, cell):
    for cx in range(0, w, cell):
        n = 0
        for y in range(cy, min(cy + cell, h)):
            for x in range(cx, min(cx + cell, w)):
                if px[x, y]:
                    n += 1
        if n >= 6:
            cells.add((cx // cell, cy // cell))
seen, regions = set(), []
for c in sorted(cells):
    if c in seen:
        continue
    stack, comp = [c], []
    seen.add(c)
    while stack:
        x, y = stack.pop()
        comp.append((x, y))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (x + dx, y + dy)
                if n in cells and n not in seen:
                    seen.add(n)
                    stack.append(n)
    xs = [p[0] for p in comp]; ys = [p[1] for p in comp]
    regions.append((min(xs) * cell, min(ys) * cell, (max(xs) + 1) * cell, (max(ys) + 1) * cell))
for r in sorted(regions, key=lambda r: (r[1], r[0])):
    print("região", r)
over = Image.blend(b, Image.new("RGB", b.size, (255, 255, 255)), 0.6)
red = Image.new("RGB", b.size, (230, 0, 60))
over.paste(red, mask=mask)
over.save(sys.argv[3])
