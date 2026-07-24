#!/usr/bin/env bash
#
# Maple Team installer for Claude Code.
# Installs the maple-* subagents (and their guide playbooks) into Claude's
# agents directory so they're available to the `Agent` tool.
#
# Scope (asked interactively if not given):
#   user     ~/.claude/agents        personal, available in all your projects
#   project  ./.claude/agents        checked into THIS repo, shared with your
#                                     team via version control
#
# Usage:
#   ./install.sh                 # ask user-vs-project, then install (copy)
#   ./install.sh --user          # install for your user (~/.claude/agents)
#   ./install.sh --project [DIR] # install into DIR/.claude/agents; prompts for and
#                                #   validates the repo path if DIR is omitted
#   ./install.sh --dest DIR      # install into a custom agents dir (implies user-style paths)
#   ./install.sh --link          # symlink instead of copy (edits in repo propagate; local only)
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
SCOPE=""              # user | project | custom  (empty = ask)
CUSTOM_DEST=""        # from --dest
PROJECT_DIR=""        # project repo root (from --project DIR or prompt)
DEST=""               # resolved below
MODE="copy"           # copy | link
DRY_RUN=0
UNINSTALL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --user)       SCOPE="user" ;;
    --project)
      SCOPE="project"
      # optional inline path: --project /path/to/repo
      if [ $# -ge 2 ] && [ "${2#-}" = "$2" ]; then PROJECT_DIR="$2"; shift; fi ;;
    --dest)       CUSTOM_DEST="${2:?--dest needs a directory}"; SCOPE="custom"; shift ;;
    --link)       MODE="link" ;;
    --dry-run)    DRY_RUN=1 ;;
    --uninstall)  UNINSTALL=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed '1d'
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

# agent:guide pairs — each agent references its guide playbook by path
GUIDE_PAIRS=(
  "maple-security.md:maple-security-audit-guide.md"
  "maple-qa.md:maple-qa-rules-guide.md"
)

say()  { printf '%s\n' "$*"; }
run()  { if [ "$DRY_RUN" -eq 1 ]; then say "  [dry-run] $*"; else eval "$*"; fi; }

# Validate a candidate project repo path. On success sets PROJECT_DIR to the
# canonical absolute path and returns 0; otherwise prints why and returns 1.
# Directory-must-exist is a hard requirement; a non-git dir is a soft warning
# (project agents are meant to be committed) — confirmable when interactive.
resolve_project_dir() {
  local d="$1"
  case "$d" in
    "~")    d="$HOME" ;;
    "~/"*)  d="$HOME/${d#\~/}" ;;
  esac
  if [ -z "$d" ]; then say "  ✗ empty path"; return 1; fi
  if [ ! -d "$d" ]; then say "  ✗ not a directory: $d"; return 1; fi
  d="$(cd "$d" 2>/dev/null && pwd)" || { say "  ✗ cannot access: $d"; return 1; }
  if ! git -C "$d" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    say "  ⚠ $d is not a git repository — project agents are meant to be committed to version control."
    if [ -t 0 ]; then
      printf '    install here anyway? [y/N]: '
      read -r yn || yn=""
      case "$yn" in y|Y|yes|Yes) : ;; *) return 1 ;; esac
    else
      return 1
    fi
  fi
  PROJECT_DIR="$d"
  return 0
}

# --- resolve scope + destination ---------------------------------------------
# CLAUDE_AGENTS_DIR (if set) is treated as an explicit user-style destination.
if [ -z "$SCOPE" ] && [ -n "${CLAUDE_AGENTS_DIR:-}" ]; then
  SCOPE="user"
fi

if [ -z "$SCOPE" ]; then
  if [ -t 0 ]; then
    say "Install Maple Team as:"
    say "  [1] User     ~/.claude/agents   — personal, available in all your projects"
    say "  [2] Project  <repo>/.claude/agents  — checked into your specified repo, shared with your team"
    printf 'Choose [1/2] (default 1): '
    read -r ans || ans=""
    case "$ans" in
      2|p|P|project|Project) SCOPE="project" ;;
      *)                     SCOPE="user" ;;
    esac
    say ""
  else
    SCOPE="user"
    say "No scope flag and not interactive — defaulting to user. Use --user/--project to be explicit."
  fi
fi

if [ "$SCOPE" = "project" ]; then
  # Ask for (and validate) the target repo path unless one was given inline.
  if [ -n "$PROJECT_DIR" ]; then
    resolve_project_dir "$PROJECT_DIR" || { echo "Error: invalid project path: $PROJECT_DIR" >&2; exit 1; }
  elif [ -t 0 ]; then
    while :; do
      printf 'Full path to the project repo [%s]: ' "$PWD"
      read -r p || p=""
      [ -z "$p" ] && p="$PWD"
      if resolve_project_dir "$p"; then break; fi
      say "  try again, or press Ctrl-C to abort."
    done
    say ""
  else
    resolve_project_dir "$PWD" || { echo "Error: --project needs a valid repo path (none given, stdin not a TTY)" >&2; exit 1; }
  fi

  # Guard: installing into the maple-team repo itself is almost never intended.
  if [ "$PROJECT_DIR" = "$SCRIPT_DIR" ]; then
    say "Note: that's the maple-team repo itself — you probably want the team in YOUR"
    say "      project, not the tool's own repo."
    if [ -t 0 ]; then
      printf 'Continue anyway? [y/N]: '
      read -r go || go=""
      case "$go" in y|Y|yes|Yes) : ;; *) say "Aborted."; exit 0 ;; esac
      say ""
    fi
  fi
fi

case "$SCOPE" in
  user)    DEST="${CLAUDE_AGENTS_DIR:-$HOME/.claude/agents}" ;;
  project) DEST="$PROJECT_DIR/.claude/agents" ;;
  custom)  DEST="$CUSTOM_DEST" ;;
esac

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
say "  scope:  $SCOPE"
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
    # remove first: cp -f onto a symlink pointing back at the repo source fails
    # ("are identical") and set -e would abort the install mid-loop
    run "rm -f '$target' && cp -f '$f' '$target'"
  fi
done

# --- rewrite guide paths inside the agents that reference one ----------------
# Some agents point at a companion guide playbook. Make each reference match
# where we just installed the guide:
#   - project scope → REPO-RELATIVE path (.claude/agents/<guide>) so the file
#     stays valid when committed and cloned to a teammate's machine
#   - user/custom   → ABSOLUTE path ($DEST/<guide>)
# Skip entirely when symlinked — the file is shared with the repo copy and must
# not be rewritten in place.
if [ "$MODE" = "copy" ]; then
  for pair in "${GUIDE_PAIRS[@]}"; do
    agent_name="${pair%%:*}"
    guide_name="${pair##*:}"
    agent_path="$DEST/$agent_name"
    # guard on the SOURCE so the dry-run preview shows even before files copy
    [ -f "$SRC_DIR/$agent_name" ] || continue
    if [ "$SCOPE" = "project" ]; then
      guide_ref=".claude/agents/$guide_name"
    else
      guide_ref="$DEST/$guide_name"
    fi
    if [ "$DRY_RUN" -eq 1 ]; then
      say ""
      say "  [dry-run] would point $agent_name guide ref at: $guide_ref"
    else
      # replace any backtick-wrapped path ending in <guide_name>
      tmp="$(mktemp)"
      sed -E "s#\`[^\`]*${guide_name}\`#\`${guide_ref}\`#g" "$agent_path" > "$tmp" && mv "$tmp" "$agent_path"
      say ""
      say "  linked $agent_name → $guide_ref"
    fi
  done
fi

# --- post-install guidance ---------------------------------------------------
say ""
say "Installed. Restart Claude Code (or reload) to pick up the new agents."
say "The maple-* agents are read-only critics/advisors except the engineers;"
say "invoke them explicitly by name. See README.md for the team + flow."
say ""
if [ "$SCOPE" = "project" ]; then
  say "Project install — to share with your team:"
  say "  1. Commit .claude/agents/ to version control."
  say "  2. Paste the block from CLAUDE-maple-team.md into this repo's ./CLAUDE.md"
  say "     so Claude knows the team exists and how to route."
  [ "$MODE" = "link" ] && say "  Note: --link uses absolute symlinks — fine locally, but DON'T commit them; use a copy install to share."
else
  say "User install — paste the block from CLAUDE-maple-team.md into ~/.claude/CLAUDE.md"
  say "so Claude knows the team exists and how to route."
fi
