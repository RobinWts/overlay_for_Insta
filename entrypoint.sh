#!/bin/sh
set -e

APP_DIR="/app"

# Env mit Defaults
MEDIA_DIR="${OVERLAY_MEDIA_DIR:-/app/media}"
REELS_SUBDIR="${OVERLAY_REELS_SUBDIR:-reels}"
TMP_SUBDIR="${OVERLAY_TMP_SUBDIR:-tmp}"
BG_DIR="${OVERLAY_BG_DIR:-/app/assets/reels_bg}"

# Ziel-UID/GID vom node-User
NODE_UID="$(id -u node)"
NODE_GID="$(id -g node)"

ensure_dir() { mkdir -p "$1"; }
fix_owner() {
  dir="$1"
  [ -d "$dir" ] || return 0
  # Nur wenn nicht schon node:node, rekursiv anpassen (Named Volumes sind oft root:root)
  CUR_UID="$(stat -c %u "$dir" 2>/dev/null || echo -1)"
  CUR_GID="$(stat -c %g "$dir" 2>/dev/null || echo -1)"
  if [ "$CUR_UID" != "$NODE_UID" ] || [ "$CUR_GID" != "$NODE_GID" ]; then
    chown -R node:node "$dir" || true
  fi
}

# Verzeichnisse sicherstellen
ensure_dir "$MEDIA_DIR/$REELS_SUBDIR"
ensure_dir "$MEDIA_DIR/$TMP_SUBDIR"
ensure_dir "$BG_DIR"

# Ownership korrigieren (falls Volume root:root ist)
fix_owner "$MEDIA_DIR"
fix_owner "$BG_DIR"

echo "▶ Overlay starting"
echo "  Port: ${PORT:-${OVERLAY_PORT:-8080}}"
echo "  Media: $MEDIA_DIR (reels: $REELS_SUBDIR, tmp: $TMP_SUBDIR)"
echo "  BG dir: $BG_DIR"

# Als node starten (gosu macht sauberen UID/GID-Drop ohne neue Session)
exec gosu node:node node /app/server.js