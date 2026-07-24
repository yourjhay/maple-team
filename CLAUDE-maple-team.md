# Maple Team

A set of specialist subagents (`~/.claude/agents/maple-*.md`) for structured dev work.

## Activation — ASK FIRST, never auto-route
Do NOT route work through Maple Team automatically. On any coding task, if Maple Team
looks useful, ASK explicitly: "Use the Maple Team for this?" Only engage the agents
after I say yes. Default (no answer / trivial task) = handle it yourself, solo.

## The team
| Agent | Model | Role |
|-------|-------|------|
| maple-advisor | opus | Deep second opinion. Consult for hard trade-offs / plan sanity checks. Read-only. |
| maple-architect | opus | Brainstorm + spec + written plan. MUST use Superpowers skills (brainstorming → writing-plans). Read-only. |
| maple-engineer | sonnet | Execute the plan, write code. Default engineer. |
| maple-engineer-hard | opus | Same, for gnarly / high-stakes / subtle work. Escalate here from maple-engineer. |
| maple-qa | sonnet | Review output (code + visual/E2E via Playwright) against the plan. Fast Core review by default (PASS / CONDITIONAL PASS / FAIL); opt-in Full audit adds extra dimensions, docs/ADR, round tracking, persisted reports. Read-only on code. |
| maple-security | opus | Adversarial security audit of the diff (authz, injection, money/ledger, data exposure). Read-only critic. |

## Flow (once activated)
1. maple-architect → spec + plan (consult maple-advisor on hard trade-offs)
2. ISOLATE — ASK ME FIRST, before any code is written. Ask how to isolate the work and
   explain the trade-off:
   - **Git worktree (isolated):** a separate working directory + branch. My main checkout
     stays untouched, so I can keep using it while the team works. Slightly more setup —
     a fresh dir that may need its own dependency install.
   - **Separate branch (same checkout):** a new branch in the current working tree. Lighter —
     no new dir, deps already present — but it switches my working tree to the branch, so
     uncommitted changes / open files are affected and the main tree isn't free for other use.
   Set up the chosen one (worktree: EnterWorktree / superpowers:using-git-worktrees; branch:
   git switch -c <name>), then dispatch the engineer, telling it which mode. ALL team work —
   engineer edits, QA, security — happens on that worktree/branch. Engineers refuse to edit
   the default branch of the main checkout (no isolation).
3. maple-engineer executes → escalate to maple-engineer-hard if genuinely hard
4. maple-qa (correctness) and maple-security (vulnerabilities) review vs the plan
   before anything is called done — dispatch both in parallel on the same diff.
   If either triggers code changes, re-run maple-security on the final diff.
5. Only after both pass: STOP and ASK my permission before merging back — show me the
   branch, a diff summary, and both verdicts. NEVER merge, rebase, or push to the base
   branch without my explicit yes. On yes → superpowers:finishing-a-development-branch,
   then remove the worktree. No answer = work stays on its branch in the worktree.

## Constraints (Claude Code reality)
- Subagents cannot call other subagents. The MAIN thread orchestrates all routing and
  passes context (the plan, the diff) between agents.
- An agent's model is fixed at spawn. To change model, route to a different agent
  (e.g. maple-engineer → maple-engineer-hard).
- maple-qa has Playwright browser tools bundled (plugin: playwright) for visual/E2E
  review; its protocol lives in ~/.claude/agents/maple-qa-rules-guide.md. Pass it the
  plan + diff. It runs a fast Core review by default; ask for a "full audit" (or it
  self-escalates on big/high-risk changes) to get round-aware re-review + persisted
  reports under docs/qa-reports/. It cannot ask questions mid-run — relay anything in
  its "Clarifications Needed" section to me.
