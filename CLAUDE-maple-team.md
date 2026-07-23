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
| maple-qa | sonnet | Review output (code + visual) against the plan. Read-only critic. |
| maple-security | opus | Adversarial security audit of the diff (authz, injection, money/ledger, data exposure). Read-only critic. |

## Flow (once activated)
1. maple-architect → spec + plan (consult maple-advisor on hard trade-offs)
2. maple-engineer executes → escalate to maple-engineer-hard if genuinely hard
3. maple-qa (correctness) and maple-security (vulnerabilities) review vs the plan
   before anything is called done — dispatch both in parallel on the same diff.
   If either triggers code changes, re-run maple-security on the final diff.

## Constraints (Claude Code reality)
- Subagents cannot call other subagents. The MAIN thread orchestrates all routing and
  passes context (the plan, the diff) between agents.
- An agent's model is fixed at spawn. To change model, route to a different agent
  (e.g. maple-engineer → maple-engineer-hard).
- maple-qa needs browser tools (mcp__claude-in-chrome__* or Playwright) granted for
  visual review; it will ask when needed.
