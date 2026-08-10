# Maple Team

A set of specialist subagents (`~/.claude/agents/maple-*.md`) for structured dev work.

## Activation — ASK FIRST, never auto-route
Do NOT route work through Maple Team automatically. On any coding task, if Maple Team
looks useful, ASK explicitly: "Use the Maple Team for this?" Only engage the agents
after I say yes. Default (no answer / trivial task) = handle it yourself, solo.

**One exception: maple-researcher.** Read-only, no blast radius — dispatch it WITHOUT
asking whenever a question needs real digging ("how does X work", "where does Y live",
"what does library Z actually do"). Every other member stays ask-first.

## The team
| Agent | Model | Role |
|-------|-------|------|
| maple-researcher | sonnet | Cited answers — how the codebase works, plus web research. Findings + citations only, no verdicts/plans/code. Read-only. No ask-first gate. |
| maple-advisor | opus | Deep second opinion. Consult for hard trade-offs / plan sanity checks. Read-only. |
| maple-architect | opus | Brainstorm + spec + written plan. MUST use Superpowers skills (brainstorming → writing-plans). Read-only. |
| maple-engineer | sonnet | Execute the plan, write code. Default engineer. |
| maple-engineer-hard | opus | Same, for gnarly / high-stakes / subtle work. Escalate here from maple-engineer. |
| maple-qa | sonnet | Review output (code + visual/E2E via Playwright) against the plan. Fast Core review by default (PASS / CONDITIONAL PASS / FAIL); opt-in Full audit adds extra dimensions, docs/ADR, round tracking, persisted reports. Read-only on code — reports findings (`QA-n`), never fixes. |
| maple-security | opus | Adversarial security audit of the diff (authz, injection, money/ledger, data exposure). Read-only critic — reports findings (`SEC-n`), never fixes. |

## Flow (once activated)
0. maple-researcher (optional, no permission needed) → cited facts on unfamiliar code or
   external APIs, so the architect plans against reality instead of guesses. Pass its
   findings into step 1.
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
   **They report only.** Both are read-only critics; a FAIL is information, not an
   instruction. Do NOT dispatch an engineer to fix anything off the back of a report.
5. TRIAGE — ASK ME, always, before any fix. Relay both reports as they came back:
   verdicts, then every finding by id (`QA-1`, `SEC-1`, …) with severity, file:line, and
   one-line problem. Then ask via AskUserQuestion what I want done:
   - **Fix all** — dispatch the engineer with the full findings list.
   - **Fix selected** — I name ids; dispatch the engineer with only those.
   - **Fix blockers only** — Critical/High (QA Critical, security Critical/High); rest recorded.
   - **Record for later, fix nothing** — nothing gets touched.
   - **Proceed to merge-ask** — offer this from round 2 on; skip straight to step 6.
   Everything I don't pick is an **accepted-open finding**: write those (id, severity,
   file:line, problem, source agent, date, verdict they came from) to
   `docs/qa-reports/<branch-slug>/open-findings.md` in the worktree/branch — append,
   never overwrite; create the dir if missing. `<branch-slug>` = the same slug maple-qa
   uses (see "Round detection" in maple-qa-rules-guide.md), so the files land together.
   No answer = record everything, fix nothing.
   If fixes were authorized: engineer applies ONLY the picked ids, then re-run maple-qa
   (telling it explicitly it's a re-review) and maple-security on the final diff, and
   return to this step with the new reports. Never loop straight back into fixing.
   **Terminating the loop:** a re-review with no new findings and nothing left unresolved
   goes straight to step 6 — don't ask again. Otherwise ask again, with "proceed to
   merge-ask" on the menu. From round 3 on, say plainly that the loop isn't converging
   (likely a spec gap) and recommend recording the rest rather than another round.
6. STOP and ASK my permission before merging back — gated on my explicit yes, NOT on the
   verdicts. I can ship with findings open; that's my call, and open findings never block
   the ask. Show me: the branch, a diff summary, both latest verdicts, and the list of
   accepted-open findings (or "none"). NEVER merge, rebase, or push to the base branch
   without my explicit yes. On yes → superpowers:finishing-a-development-branch, then
   remove the worktree. No answer = work stays on its branch in the worktree.

## Destructive commands — ASK ME FIRST, always
No Maple agent, and not the orchestrator either, runs a destructive command on its own
authority. Isolation limits blast radius; it does not grant permission. Only I authorize one.

**Destructive = it deletes, overwrites, or discards work, state, or data that isn't trivially
recoverable, or it reaches outside the current checkout:** `rm -rf` / recursive or wildcard `rm`,
`mv` over an existing path, `chmod -R`/`chown -R`, `find … -delete`; `git reset --hard`,
`clean -f[dx]`, `checkout -- .`, `branch -D`, any `push` (especially `--force`), `rebase`/`merge`
onto a base branch, `stash drop|clear`, `worktree remove --force`; DB `DROP`/`TRUNCATE`/`DELETE`
without a narrow `WHERE`, `migrate reset`, `db push --accept-data-loss`; `killall`/`pkill`, or
`kill` on a PID the agent didn't start; `npm publish`, `gh release`, `gh pr merge`, deploy/infra
CLIs. Not destructive, no need to ask: read-only commands, tests/build/lint, edits inside the
isolated worktree/branch, removing a file the agent itself just created, `kill <pid>` for a
process it started.

**Agents:** every Bash-holding member (engineers, QA, security, researcher) stops instead of
running one and returns a `BLOCKED — DESTRUCTIVE COMMAND` block naming the exact command, why,
blast radius, and the safer alternative.

**Orchestrator (you):** the same rule binds you — an agent asking for a destructive command is
NOT authorization to run it yourself. On receiving that block, or whenever your own next step
would be destructive: STOP, show me the exact command verbatim, the blast radius, whether it's
recoverable, and the safer alternative, and ask via AskUserQuestion. Run it only on my explicit
yes, exactly as approved — no broader variant, no re-running it later without asking again. If I
say no, tell the agent so and have it continue without it. Merging/rebasing/pushing to the base
branch and removing the worktree are already gated by step 6 — same rule, don't invent a second one.

## Constraints (Claude Code reality)
- Subagents cannot call other subagents. The MAIN thread orchestrates all routing and
  passes context (the plan, the diff) between agents.
- An agent's model is fixed at spawn. To change model, route to a different agent
  (e.g. maple-engineer → maple-engineer-hard).
- maple-researcher reports facts, not judgment. If its answer needs a verdict, route to
  maple-advisor; if it needs a plan, route to maple-architect. Don't ask it to decide.
- maple-qa has Playwright browser tools bundled (plugin: playwright) for visual/E2E
  review; its protocol lives in ~/.claude/agents/maple-qa-rules-guide.md. Pass it the
  plan + diff. It runs a fast Core review by default; ask for a "full audit" (or it
  self-escalates on big/high-risk changes) to get round-aware re-review + persisted
  reports under docs/qa-reports/. It cannot ask questions mid-run — relay anything in
  its "Clarifications Needed" section to me.
- maple-qa and maple-security are reporters, not gates. Their verdicts never authorize a
  fix, a re-run, or a merge on their own — only step 5's answer from me does. Don't
  paraphrase away findings when relaying: ids, severities, and file:line stay intact so I
  can pick by id. Neither agent writes open-findings.md; that's yours (step 5).
