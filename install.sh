#!/usr/bin/env bash
# One-command macOS/Linux install. Keeps runtime and personal data in this folder.
set -euo pipefail
DEST="${KONNECTIVITY_INSTALL_DIR:-$HOME/Konnectivity}"
if [ -e "$DEST" ]; then
  [ -f "$DEST/start.sh" ] || { echo "Destination exists and is not a Konnectivity installation: $DEST" >&2; exit 1; }
  echo "Starting the existing installation; personal data is unchanged."
else
  command -v tar >/dev/null || { echo "tar is required." >&2; exit 1; }
  TASK_TMP="$(mktemp -d)"
  trap 'rm -rf "$TASK_TMP"' EXIT
  URL="https://github.com/shivam-aggarwal-git/Konnectivity/archive/refs/heads/10.02.tar.gz"
  if command -v curl >/dev/null; then curl -fL --retry 3 "$URL" -o "$TASK_TMP/source.tar.gz";
  elif command -v wget >/dev/null; then wget -O "$TASK_TMP/source.tar.gz" "$URL";
  else echo "curl or wget is required." >&2; exit 1; fi
  mkdir "$TASK_TMP/app"
  tar -xzf "$TASK_TMP/source.tar.gz" --strip-components=1 -C "$TASK_TMP/app"
  [ -f "$TASK_TMP/app/start.sh" ] || { echo "Invalid source archive." >&2; exit 1; }
  mkdir -p "$(dirname "$DEST")"
  mv "$TASK_TMP/app" "$DEST"
  rm -rf "$TASK_TMP"
  trap - EXIT
fi
cd "$DEST"
exec bash ./start.sh --local "$@"
