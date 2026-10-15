#!/usr/bin/env bash
# Compara pixel a pixel a janela do mock aprovado (variação C) com o app no mesmo estado.
# Requer Google Chrome, Node e Python com Pillow. Uso: ./scripts/fidelidade/comparar.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${TMPDIR:-/tmp}/blocos-fidelidade"; mkdir -p "$OUT"
cd "$RAIZ"
(npx vite --port 1420 --strictPort >/dev/null 2>&1 &) ; (cd docs/fidelidade && python3 -m http.server 1430 --bind 127.0.0.1 >/dev/null 2>&1 &)
sleep 3
# captura em tempo real pelo protocolo de depuração do Chrome (veja capturar.mjs)
node scripts/fidelidade/capturar.mjs "http://127.0.0.1:1430/mock-janela-c.html" "$OUT/mock.png"
node scripts/fidelidade/capturar.mjs "http://localhost:1420/?demo=mock" "$OUT/app.png"
python3 scripts/fidelidade/pixdiff.py "$OUT/mock.png" "$OUT/app.png" "$OUT/diferencas.png"
for p in 1420 1430; do kill "$(lsof -ti tcp:$p)" 2>/dev/null || true; done
echo "Imagens em $OUT"
