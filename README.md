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
| `maple-qa` | sonnet | Review output (code + visual) against the plan. Read-only critic. |
| `maple-security` | opus | Adversarial security audit (OWASP Top 10 + more). Read-only critic. |

`maple-security-audit-guide.md` is not an agent — it's the authoritative playbook the
security agent reads first (operating modes, checklist, severity rubric, output format).

## Install

```bash
./install.sh                 # copy agents into ~/.claude/agents
./install.sh --link          # symlink instead (repo edits propagate live)
./install.sh --dest DIR      # custom agents dir
./install.sh --dry-run       # preview, change nothing
./install.sh --uninstall     # remove installed maple-* files
```

Restart / reload Claude Code afterward so it picks up the new agent types.

The installer rewrites the audit-guide path inside `maple-security.md` to match wherever it
installed the guide, so a `--dest` install stays self-consistent.

## Flow (once activated)

1. `maple-architect` → spec + plan (consult `maple-advisor` on hard trade-offs).
2. `maple-engineer` executes → escalate to `maple-engineer-hard` if genuinely hard.
3. `maple-qa` (correctness) and `maple-security` (vulnerabilities) review vs the plan before
   anything is called done — dispatch both in parallel on the same diff. If fixes change the
   diff, re-run `maple-security` on the final code.

## Activation — ask first, never auto-route

These agents are opt-in. On a coding task, ask before routing work through the team; engage
only after a yes. Trivial tasks: handle solo.

## Claude Code constraints

- Subagents cannot call other subagents. The **main thread** orchestrates all routing and
  passes context (the plan, the diff) between agents.
- An agent's model is fixed at spawn. To change model, route to a different agent
  (`maple-engineer` → `maple-engineer-hard`).
- `maple-qa` needs browser tools (`mcp__claude-in-chrome__*` or Playwright) granted for
  visual review; it will ask when needed.

## CLAUDE.md

`CLAUDE-maple-team.md` holds the team block to drop into your global or project
`CLAUDE.md` (e.g. `~/.claude/CLAUDE.md`) so Claude knows the team exists and how to route.
The installer does not touch `CLAUDE.md` — paste it in yourself to avoid duplicates.
