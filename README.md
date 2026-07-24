# 🍁 Maple Team

> 🍁 A guild of specialist Claude Code subagents. Inspired by **BOFURI** — *I Don't Want
> Broken Code, So I'll Max Out My Defense.* Architect plans, Engineers build, QA + Security
> guard the gate.

> *"Why dodge bugs when you can just tank them?"* — Maple Team is a full-defense guild of
> Claude Code subagents. The Architect scouts the dungeon, the Engineers grind the build, and
> QA + Security stand as the wall no regression or CVE gets past. **Absolute Defense** for
> your codebase.

A set of specialist subagents for structured dev work in Claude Code. Each is a Markdown
file with YAML frontmatter that Claude loads as a callable agent type.

## The team

| Agent | Model | Role |
|-------|-------|------|
| `maple-advisor` | opus | Deep second opinion — hard trade-offs, plan sanity checks. Read-only. |
| `maple-architect` | opus | Brainstorm + spec + written plan before any code. Read-only. |
| `maple-engineer` | sonnet | Execute the plan, write code. Default engineer. |
| `maple-engineer-hard` | opus | Same, for gnarly / high-stakes / subtle work. Escalate here. |
| `maple-qa` | sonnet | Review output (code + visual/E2E via Playwright) against the plan. Fast **Core** review by default (PASS / CONDITIONAL PASS / FAIL); opt-in **Full audit** adds extra dimensions, docs/ADR, round tracking, persisted reports. Read-only on code. |
| `maple-security` | opus | Adversarial security audit (OWASP Top 10 + more). Read-only critic. |

`maple-security-audit-guide.md` and `maple-qa-rules-guide.md` are not agents — they're the
authoritative playbooks the security and QA agents read first (operating modes, checklists,
severity rubrics, output formats). The QA guide is adapted from
[oh-my-agent QA_RULES v2](https://github.com/yourjhay/oh-my-agent/blob/main/rules/QA_RULES.md).

## Install

Run `./install.sh` and it asks how to install:

- **User** (`~/.claude/agents`) — personal, available in all your projects.
- **Project** (`<repo>/.claude/agents`) — checked into a specific repo so your team shares
  the agents via version control. It prompts for the repo path and validates it (must exist;
  warns if it isn't a git repo).

```bash
./install.sh                 # ask user-vs-project, then copy the agents
./install.sh --user          # user install (~/.claude/agents)
./install.sh --project [DIR] # project install into DIR/.claude/agents (prompts + validates if DIR omitted)
./install.sh --dest DIR      # custom agents dir (user-style absolute paths)
./install.sh --link          # symlink instead of copy (local dev only — don't commit symlinks)
./install.sh --dry-run       # preview, change nothing
./install.sh --uninstall     # remove installed maple-* files
```

Restart / reload Claude Code afterward so it picks up the new agent types.

The installer rewrites the guide-playbook paths inside `maple-security.md` and `maple-qa.md`
to match where it installed the guides. A **project** install writes them as repo-relative
paths (`.claude/agents/…`) so they stay valid when committed and cloned to a teammate's
machine; a **user**/`--dest` install writes absolute paths.

## Flow (once activated)

1. `maple-architect` → spec + plan (consult `maple-advisor` on hard trade-offs).
2. **Isolate** — create + enter a git worktree for the task before any code is written
   (`EnterWorktree` tool or `superpowers:using-git-worktrees`). All subsequent team work —
   engineer edits, QA, security — runs inside it; subagents inherit the main thread's cwd.
   Engineers hard-refuse to edit the main working copy.
3. `maple-engineer` executes → escalate to `maple-engineer-hard` if genuinely hard.
4. `maple-qa` (correctness) and `maple-security` (vulnerabilities) review vs the plan before
   anything is called done — dispatch both in parallel on the same diff. If fixes change the
   diff, re-run `maple-security` on the final code.
5. Only after both pass: **stop and ask the user's permission before merging back** — show
   the branch, a diff summary, and both verdicts. Never merge, rebase, or push to the base
   branch without an explicit yes. On yes → `superpowers:finishing-a-development-branch`,
   then remove the worktree. No answer = work stays on its branch in the worktree.

## Activation — ask first, never auto-route

These agents are opt-in. On a coding task, ask before routing work through the team; engage
only after a yes. Trivial tasks: handle solo.

## Claude Code constraints

- Subagents cannot call other subagents. The **main thread** orchestrates all routing and
  passes context (the plan, the diff) between agents.
- An agent's model is fixed at spawn. To change model, route to a different agent
  (`maple-engineer` → `maple-engineer-hard`).
- `maple-qa` bundles Playwright browser tools (`mcp__plugin_playwright_playwright__*` — needs
  the `playwright` Claude Code plugin installed) for visual/E2E review. It is round-aware via
  `docs/qa-reports/`, and cannot ask questions mid-run — relay its "Clarifications Needed"
  section to the user.

## CLAUDE.md

`CLAUDE-maple-team.md` holds the team block to drop into your `CLAUDE.md` so Claude knows the
team exists and how to route — `~/.claude/CLAUDE.md` for a user install, the repo's
`./CLAUDE.md` for a project install. The installer does not touch `CLAUDE.md` — paste it in
yourself to avoid duplicates.
