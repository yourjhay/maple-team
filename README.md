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
| `maple-researcher` | sonnet | Cited answers — how the codebase works, plus web research. Findings + citations, never verdicts/plans/code. Read-only, no ask-first gate. |
| `maple-advisor` | opus | Deep second opinion — hard trade-offs, plan sanity checks. Read-only. |
| `maple-architect` | opus | Brainstorm + spec + written plan before any code. Read-only. |
| `maple-engineer` | sonnet | Execute the plan, write code. Default engineer. |
| `maple-engineer-hard` | opus | Same, for gnarly / high-stakes / subtle work. Escalate here. |
| `maple-qa` | sonnet | Review output (code + visual/E2E via Playwright) against the plan. Fast **Core** review by default (PASS / CONDITIONAL PASS / FAIL); opt-in **Full audit** adds extra dimensions, docs/ADR, round tracking, persisted reports. Read-only on code — reports findings (`QA-n`), never fixes. |
| `maple-security` | opus | Adversarial security audit (OWASP Top 10 + more). Read-only critic — reports findings (`SEC-n`), never fixes. |

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

0. `maple-researcher` (optional, no permission needed) → cited facts on unfamiliar code or
   external APIs, so the architect plans against reality. Feed its findings into step 1.
1. `maple-architect` → spec + plan (consult `maple-advisor` on hard trade-offs).
2. **Isolate — ask first.** Before any code is written, ask the user how to isolate the work and
   explain the trade-off:
   - **Git worktree (isolated):** a separate working directory + branch; the user's main checkout
     stays untouched, so they can keep using it. Slightly more setup (fresh dir, may need its own
     dependency install).
   - **Separate branch (same checkout):** a new branch in the current working tree — lighter, no
     new dir, deps already present, but it switches the working tree to the branch (affects
     uncommitted work / open files; the main tree isn't free for other use meanwhile).
   Set up the chosen one (worktree: `EnterWorktree` / `superpowers:using-git-worktrees`; branch:
   `git switch -c`), then dispatch the engineer telling it which mode. All team work — engineer
   edits, QA, security — happens on that worktree/branch. Engineers refuse to edit the default
   branch of the main checkout (no isolation).
3. `maple-engineer` executes → escalate to `maple-engineer-hard` if genuinely hard.
4. `maple-qa` (correctness) and `maple-security` (vulnerabilities) review vs the plan before
   anything is called done — dispatch both in parallel on the same diff. **They report only:**
   read-only critics, findings numbered `QA-n` / `SEC-n`. A FAIL is information, not an
   instruction — no engineer gets dispatched off the back of a report.
5. **Triage — ask first.** Relay both reports intact (verdicts, then every finding by id with
   severity + `file:line`), then ask the user what to do: fix all / fix selected ids / fix
   blockers only (Critical–High) / record everything for later — plus "proceed to merge-ask"
   from round 2 on. Nothing is fixed without that answer; no answer = record, fix nothing.
   Findings the user doesn't pick become **accepted-open findings**, appended by the main
   thread to `docs/qa-reports/<branch-slug>/open-findings.md` on the worktree/branch (same
   branch slug maple-qa uses for its reports, so both land together). If fixes were
   authorized, the engineer applies only the picked ids, QA (told it's a re-review) and
   security re-run on the final diff, and the flow returns here with the new reports. A clean
   re-review goes straight to step 6 without another ask; by round 3 the orchestrator says the
   loop isn't converging and recommends recording the rest.
6. **Stop and ask the user's permission before merging back** — gated on an explicit yes, not on
   the verdicts; shipping with findings open is the user's call. Show the branch, a diff summary,
   both latest verdicts, and the accepted-open findings. Never merge, rebase, or push to the base
   branch without that yes. On yes → `superpowers:finishing-a-development-branch`,
   then remove the worktree. No answer = work stays on its branch in the worktree.

## Destructive commands — ask first, always

No agent — and not the orchestrating main thread either — runs a destructive command on its own
authority. Isolation limits blast radius; it does not grant permission.

**Destructive** = it deletes, overwrites, or discards work, state, or data that isn't trivially
recoverable, or it reaches outside the current checkout: `rm -rf` / recursive or wildcard `rm`,
`mv` over an existing path, `chmod -R`/`chown -R`, `find … -delete`; `git reset --hard`,
`clean -f[dx]`, `checkout -- .`, `branch -D`, any `push` (especially `--force`), `rebase`/`merge`
onto a base branch, `stash drop|clear`, `worktree remove --force`; DB `DROP`/`TRUNCATE`/`DELETE`
without a narrow `WHERE`, `migrate reset`, `db push --accept-data-loss`; `killall`/`pkill`, or
`kill` on a PID the agent didn't start; `npm publish`, `gh release`, `gh pr merge`, deploy/infra
CLIs.

**Not destructive** (no ask): read-only commands, tests/build/lint, edits inside the isolated
worktree/branch, removing a file the agent itself created, `kill <pid>` for a process it started.

Every Bash-holding member (both engineers, `maple-qa`, `maple-security`, `maple-researcher`) stops
rather than running one — and is told not to work around it with a `--force` variant, a scripted
equivalent, or smaller steps — and hands control back with:

```
BLOCKED — DESTRUCTIVE COMMAND
Command: <the exact command, verbatim>
Why needed: <one line>
Blast radius: <what gets destroyed; recoverable? how>
Safer alternative: <the non-destructive path, or "none">
```

The main thread must not execute it on the agent's say-so: it shows the user the exact command,
blast radius, and alternative, and runs it only on an explicit yes — exactly as approved. For QA
and security, anything left unverified because of a block is reported as a coverage gap, never a
PASS.

## Activation — ask first, never auto-route

These agents are opt-in. On a coding task, ask before routing work through the team; engage
only after a yes. Trivial tasks: handle solo.

**Exception: `maple-researcher`.** Read-only with no blast radius, so the main thread may
dispatch it without asking whenever a question needs real digging. Every other member stays
ask-first.

## Claude Code constraints

- Subagents cannot call other subagents. The **main thread** orchestrates all routing and
  passes context (the plan, the diff) between agents.
- An agent's model is fixed at spawn. To change model, route to a different agent
  (`maple-engineer` → `maple-engineer-hard`).
- `maple-researcher` reports facts, not judgment. Needs a verdict → `maple-advisor`; needs a
  plan → `maple-architect`.
- `maple-qa` bundles Playwright browser tools (`mcp__plugin_playwright_playwright__*` — needs
  the `playwright` Claude Code plugin installed) for visual/E2E review. It is round-aware via
  `docs/qa-reports/`, and cannot ask questions mid-run — relay its "Clarifications Needed"
  section to the user.
- `maple-qa` and `maple-security` are reporters, not gates. Their verdicts authorize nothing on
  their own — no fix, no re-run, no merge. Only the user's triage answer (step 5) does.

## CLAUDE.md

`CLAUDE-maple-team.md` holds the team block to drop into your `CLAUDE.md` so Claude knows the
team exists and how to route — `~/.claude/CLAUDE.md` for a user install, the repo's
`./CLAUDE.md` for a project install. The installer does not touch `CLAUDE.md` — paste it in
yourself to avoid duplicates.
