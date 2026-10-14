#!/usr/bin/env bash
# Instala o Blocos só para o seu usuário (em ~/.local), sem precisar de senha.
# Uso: ./scripts/instalar.sh            -> instala e define como app padrão para .md e .txt
#      ./scripts/instalar.sh --sem-padrao -> instala sem mudar o app padrão
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$RAIZ/src-tauri/target/release/blocos"
ICONES="$RAIZ/src-tauri/icons"
PADRAO=1
[[ "${1:-}" == "--sem-padrao" ]] && PADRAO=0

if [[ ! -x "$BIN" ]]; then
  echo "Binário não encontrado. Rode antes: npm run tauri build" >&2
  exit 1
fi

mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications"
install -m 755 "$BIN" "$HOME/.local/bin/blocos"

for tam in 32 64 128 256 512; do
  case $tam in
    32) src="$ICONES/32x32.png" ;;
    64) src="$ICONES/64x64.png" ;;
    128) src="$ICONES/128x128.png" ;;
    256) src="$ICONES/128x128@2x.png" ;;
    512) src="$ICONES/icon.png" ;;
  esac
  [[ -f "$src" ]] || continue
  dest="$HOME/.local/share/icons/hicolor/${tam}x${tam}/apps"
  mkdir -p "$dest"
  install -m 644 "$src" "$dest/blocos.png"
done

cat > "$HOME/.local/share/applications/blocos.desktop" <<EOF
[Desktop Entry]
Categories=Utility;TextEditor;
Comment=Editor de notas em Markdown
Exec=$HOME/.local/bin/blocos %F
StartupWMClass=blocos
Icon=blocos
Name=Blocos
GenericName=Editor de notas
Keywords=markdown;notas;texto;editor;md;txt;
Terminal=false
Type=Application
StartupNotify=true
MimeType=text/markdown;text/x-markdown;text/plain;
EOF

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

if [[ $PADRAO == 1 ]]; then
  xdg-mime default blocos.desktop text/markdown text/x-markdown text/plain
  echo "Blocos definido como app padrão para .md e .txt."
  echo "Para voltar ao editor anterior: xdg-mime default org.x.editor.desktop text/plain"
fi

echo "Blocos instalado em $HOME/.local/bin/blocos — procure por \"Blocos\" no menu."
