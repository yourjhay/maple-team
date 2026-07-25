// Generates a realistic Maple Team run in parse.mjs's output shape, so the
// viewer can be developed against a full architect→…→security flow without
// waiting on a real multi-agent run. Re-run: `node fixtures/build-sample.mjs`.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// scenario: "Add token-bucket rate limiting to the public API"
// compact rows: [kind, agentType, tool, target, text]
const rows = [
  ["run_start", "orchestrator", "", "", "Add token-bucket rate limiting to the public API"],
  ["main_tool", "orchestrator", "TodoWrite", "", ""],

  ["agent_spawn", "maple-researcher", "Agent", "maple-researcher", "How does the current API middleware work?"],
  ["agent_tool", "maple-researcher", "Grep", "/app.use\\(/", ""],
  ["agent_tool", "maple-researcher", "Read", "api/middleware/index.ts", ""],
  ["agent_tool", "maple-researcher", "Bash", "git log -- api/middleware", ""],
  ["agent_tool", "maple-researcher", "WebFetch", "redis.io/docs/rate-limiting", ""],
  ["agent_result", "maple-researcher", "", "", "middleware chain mapped, 4 cited sources"],

  ["agent_spawn", "maple-architect", "Agent", "maple-architect", "Spec + plan for rate limiting"],
  ["agent_tool", "maple-architect", "Read", "api/router.ts", ""],
  ["agent_tool", "maple-architect", "Grep", "/middleware/", ""],
  ["agent_tool", "maple-architect", "WebSearch", "token bucket vs sliding window", ""],
  ["agent_tool", "maple-architect", "TodoWrite", "", ""],
  ["agent_result", "maple-architect", "", "", "plan written"],

  ["agent_spawn", "maple-advisor", "Agent", "maple-advisor", "Redis vs in-memory trade-off"],
  ["agent_tool", "maple-advisor", "Read", "plan.md", ""],
  ["agent_tool", "maple-advisor", "Grep", "/deploy/", ""],
  ["agent_result", "maple-advisor", "", "", "verdict: Redis, multi-instance"],

  ["agent_spawn", "maple-engineer", "Agent", "maple-engineer", "Implement the plan"],
  ["agent_tool", "maple-engineer", "Read", "api/router.ts", ""],
  ["agent_tool", "maple-engineer", "Write", "rateLimiter.test.ts", ""],
  ["agent_tool", "maple-engineer", "Bash", "npm test — 3 failing", ""],
  ["agent_tool", "maple-engineer", "Write", "rateLimiter.ts", ""],
  ["agent_tool", "maple-engineer", "Edit", "router.ts", ""],
  ["agent_tool", "maple-engineer", "Bash", "npm test — all pass", ""],
  ["agent_result", "maple-engineer", "", "", "escalating: concurrent token refill race"],

  ["agent_spawn", "maple-engineer-hard", "Agent", "maple-engineer-hard", "Fix refill race under concurrency"],
  ["agent_tool", "maple-engineer-hard", "Read", "rateLimiter.ts", ""],
  ["agent_tool", "maple-engineer-hard", "Edit", "rateLimiter.ts", ""],
  ["agent_tool", "maple-engineer-hard", "Bash", "npm test -- --stress", ""],
  ["agent_result", "maple-engineer-hard", "", "", "atomic Lua refill, race gone"],

  ["agent_spawn", "maple-qa", "Agent", "maple-qa", "Verify vs plan"],
  ["agent_tool", "maple-qa", "Read", "rateLimiter.ts", ""],
  ["agent_tool", "maple-qa", "Bash", "npm test — 42 pass", ""],
  ["agent_tool", "maple-qa", "Bash", "npm run build", ""],
  ["agent_result", "maple-qa", "", "", "PASS"],

  ["agent_spawn", "maple-security", "Agent", "maple-security", "Audit the diff"],
  ["agent_tool", "maple-security", "Read", "rateLimiter.ts", ""],
  ["agent_tool", "maple-security", "Grep", "/req.ip|X-Forwarded-For/", ""],
  ["agent_result", "maple-security", "", "", "PASS — no bypass via spoofed header"],

  ["main_tool", "orchestrator", "Bash", "git diff --stat", ""],
];

const base = Date.parse("2026-07-25T09:00:00Z");
const events = rows.map(([kind, agentType, tool, target, text], i) => ({
  seq: i,
  t: new Date(base + i * 4000).toISOString(),   // 4s apart; viewer paces by seq anyway
  kind,
  agent: agentType,
  agentType,
  ...(tool ? { tool } : {}),
  ...(target ? { target } : {}),
  ...(text ? { text } : {}),
}));

const agents = [...new Set(events.filter(e => e.agentType !== "orchestrator").map(e => e.agentType))];
const out = {
  id: "sample-maple-run",
  title: "Add rate limiting to the public API",
  isMapleRun: true,
  agents,
  count: events.length,
  events,
};

const path = join(here, "maple-sample.json");
writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${path} — ${events.length} events, agents: ${agents.join(", ")}`);
