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
| maple-qa | sonnet | Review output (code + visual/E2E via Playwright) against the plan, per the QA rules protocol. Verdicts PASS / CONDITIONAL PASS / FAIL; persists reports to docs/qa-reports/. Read-only on code. |
| maple-security | opus | Adversarial security audit of the diff (authz, injection, money/ledger, data exposure). Read-only critic. |

## Flow (once activated)
1. maple-architect → spec + plan (consult maple-advisor on hard trade-offs)
2. ISOLATE — create + enter a git worktree for the task BEFORE any code is written
   (EnterWorktree tool or superpowers:using-git-worktrees). ALL subsequent team work —
   engineer edits, QA, security — runs inside it; subagents inherit the main thread's
   cwd. Engineers hard-refuse to edit the main working copy.
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
  review; its protocol lives in ~/.claude/agents/maple-qa-rules-guide.md. It is
  round-aware: pass it the plan + diff; on re-review after fixes it tracks prior
  findings via docs/qa-reports/. It cannot ask questions mid-run — relay anything in
  its "Clarifications Needed" section to me.
