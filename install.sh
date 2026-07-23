#!/usr/bin/env bash
#
# Maple Team installer for Claude Code.
# Installs the maple-* subagents (and the security audit guide) into Claude's
# agents directory so they're available to the `Agent` tool.
#
# Usage:
#   ./install.sh                 # install to ~/.claude/agents (copy)
#   ./install.sh --link          # symlink instead of copy (edits in repo propagate)
#   ./install.sh --dest DIR      # install into a custom agents dir
#   ./install.sh --dry-run       # show what would happen, change nothing
#   ./install.sh --uninstall     # remove the installed maple-* files
#   ./install.sh -h | --help
#
set -euo pipefail

# --- resolve this script's own directory (source of the agent files) ---------
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
SRC_DIR="$SCRIPT_DIR/agents"

# --- defaults / args ---------------------------------------------------------
DEST="${CLAUDE_AGENTS_DIR:-$HOME/.claude/agents}"
MODE="copy"        # copy | link
DRY_RUN=0
UNINSTALL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --link)       MODE="link" ;;
    --dest)       DEST="${2:?--dest needs a directory}"; shift ;;
    --dry-run)    DRY_RUN=1 ;;
    --uninstall)  UNINSTALL=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed '1d'
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

GUIDE_NAME="maple-security-audit-guide.md"

say()  { printf '%s\n' "$*"; }
run()  { if [ "$DRY_RUN" -eq 1 ]; then say "  [dry-run] $*"; else eval "$*"; fi; }

# --- sanity ------------------------------------------------------------------
if [ ! -d "$SRC_DIR" ]; then
  echo "Error: source agents dir not found: $SRC_DIR" >&2
  exit 1
fi

FILES=("$SRC_DIR"/maple-*.md)
if [ ! -e "${FILES[0]}" ]; then
  echo "Error: no maple-*.md files in $SRC_DIR" >&2
  exit 1
fi

# --- uninstall ---------------------------------------------------------------
if [ "$UNINSTALL" -eq 1 ]; then
  say "Uninstalling maple-* from: $DEST"
  for f in "$SRC_DIR"/maple-*.md; do
    base="$(basename "$f")"
    target="$DEST/$base"
    if [ -e "$target" ] || [ -L "$target" ]; then
      run "rm -f '$target'"
      say "  removed $base"
    fi
  done
  say "Done."
  exit 0
fi

# --- install -----------------------------------------------------------------
say "Maple Team → Claude"
say "  source: $SRC_DIR"
say "  dest:   $DEST"
say "  mode:   $MODE"
[ "$DRY_RUN" -eq 1 ] && say "  (dry-run — no changes)"
say ""

run "mkdir -p '$DEST'"

for f in "$SRC_DIR"/maple-*.md; do
  base="$(basename "$f")"
  target="$DEST/$base"
  [ -e "$target" ] && say "  overwriting $base" || say "  installing  $base"
  if [ "$MODE" = "link" ]; then
    run "ln -sfn '$f' '$target'"
  else
    run "cp -f '$f' '$target'"
  fi
done

# --- rewrite the guide path inside maple-security.md -------------------------
# The security agent points at the audit guide by absolute path. Make that
# reference match wherever we just installed the guide (skip when symlinked —
# the file is shared with the repo copy and shouldn't be rewritten in place).
GUIDE_PATH="$DEST/$GUIDE_NAME"
SEC="$DEST/maple-security.md"
if [ "$MODE" = "copy" ] && [ -f "$SEC" ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    say ""
    say "  [dry-run] would point maple-security.md guide ref at: $GUIDE_PATH"
  else
    # replace any `...maple-security-audit-guide.md` backtick-wrapped path
    tmp="$(mktemp)"
    sed -E "s#\`[^\`]*${GUIDE_NAME}\`#\`${GUIDE_PATH}\`#g" "$SEC" > "$tmp" && mv "$tmp" "$SEC"
    say ""
    say "  linked maple-security.md → $GUIDE_PATH"
  fi
fi

say ""
say "Installed. Restart Claude Code (or reload) to pick up the new agents."
say "The maple-* agents are read-only critics/advisors except the engineers;"
say "invoke them explicitly by name. See README.md for the team + flow."
