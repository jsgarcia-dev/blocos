#!/usr/bin/env bash
# Gera o instalador do Blocos para Windows (x64) a partir do Linux, sem precisar de sudo.
#
# Na primeira vez baixa (dos repositórios oficiais do Ubuntu, via apt-get download)
# o compilador MinGW-w64 e o NSIS e descompacta em ~/.local/opt/blocos-wintools.
# Se você já tiver `mingw-w64` e `nsis` instalados no sistema, eles são usados.
#
# Resultado: src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/Blocos_*_x64-setup.exe
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
W="$HOME/.local/opt/blocos-wintools"

if ! command -v x86_64-w64-mingw32-gcc >/dev/null || ! command -v makensis >/dev/null; then
  if [[ ! -x "$W/bin/x86_64-w64-mingw32-gcc" ]]; then
    echo "Baixando MinGW-w64 e NSIS para $W ..."
    mkdir -p "$W/debs" "$W/bin"
    (cd "$W/debs" && apt-get download binutils-mingw-w64-x86-64 gcc-mingw-w64-base gcc-mingw-w64-x86-64-win32 \
      gcc-mingw-w64-x86-64-win32-runtime mingw-w64-common mingw-w64-x86-64-dev nsis nsis-common)
    for d in "$W"/debs/*.deb; do dpkg-deb -x "$d" "$W/root"; done
    for t in gcc cpp gcc-ar gcc-nm gcc-ranlib; do
      ln -sf "$W/root/usr/bin/x86_64-w64-mingw32-$t-win32" "$W/bin/x86_64-w64-mingw32-$t"
    done
    for t in ld as ar dlltool windres nm objcopy strip ranlib objdump; do
      ln -sf "$W/root/usr/bin/x86_64-w64-mingw32-$t" "$W/bin/x86_64-w64-mingw32-$t"
    done
  fi
  # o makensis descompactado precisa saber onde estão seus arquivos (o Tauri não repassa NSISDIR)
  printf '#!/bin/sh\nNSISDIR="%s/root/usr/share/nsis" exec "%s/root/usr/bin/makensis" "$@"\n' "$W" "$W" > "$W/bin/makensis"
  chmod +x "$W/bin/makensis"
  export PATH="$W/bin:$PATH"
fi

# shellcheck disable=SC1091
[[ -f "$HOME/.cargo/env" ]] && . "$HOME/.cargo/env"
rustup target add x86_64-pc-windows-gnu >/dev/null

export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc
export CC_x86_64_pc_windows_gnu=x86_64-w64-mingw32-gcc
export AR_x86_64_pc_windows_gnu=x86_64-w64-mingw32-ar

cd "$RAIZ"
npx tauri build --target x86_64-pc-windows-gnu --bundles nsis
ls -la src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/
