#!/usr/bin/env bash
# Compara pixel a pixel a janela do mock aprovado (variação C) com o app no mesmo estado.
# Requer Google Chrome e Python com Pillow. Uso: ./scripts/fidelidade/comparar.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${TMPDIR:-/tmp}/blocos-fidelidade"; mkdir -p "$OUT"
cd "$RAIZ"
(npx vite --port 1420 --strictPort >/dev/null 2>&1 &) ; (cd docs/fidelidade && python3 -m http.server 1430 --bind 127.0.0.1 >/dev/null 2>&1 &)
sleep 3
CH=(google-chrome --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1180,700
    --default-background-color=000000ff --virtual-time-budget=9000 --user-data-dir="$OUT/perfil")
"${CH[@]}" --screenshot="$OUT/mock.png" "http://127.0.0.1:1430/mock-janela-c.html" 2>/dev/null
"${CH[@]}" --screenshot="$OUT/app.png" "http://localhost:1420/?demo=mock" 2>/dev/null
python3 scripts/fidelidade/pixdiff.py "$OUT/mock.png" "$OUT/app.png" "$OUT/diferencas.png"
for p in 1420 1430; do kill "$(lsof -ti tcp:$p)" 2>/dev/null || true; done
echo "Imagens em $OUT"
