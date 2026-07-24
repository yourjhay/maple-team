// Parse a Claude Code session transcript into a normalized Maple event stream.
//
// Data model (verified against ~/.claude/projects/<proj>/):
//   <session>.jsonl                         main thread turns + tool calls
//   <session>/subagents/agent-<id>.jsonl    each subagent's own tool calls
//   <session>/subagents/agent-<id>.meta.json {agentType, description, toolUseId, spawnDepth}
//
// The subagent meta's `toolUseId` joins back to the `Agent`/`Task` tool_use in
// the main transcript, so we can order spawns and attribute activity per agent.
//
// Output: a flat, timestamp-sorted array of events the viewer replays:
//   { seq, t, kind, agent, agentType, tool, target, text }
// kinds: run_start | main_tool | agent_spawn | agent_tool | agent_result | main_text

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename, dirname } from "node:path";

const MAPLE_NODES = new Set([
  "maple-architect", "maple-advisor", "maple-engineer",
  "maple-engineer-hard", "maple-qa", "maple-security",
]);

function readJsonl(path) {
  const out = [];
  let raw;
  try { raw = readFileSync(path, "utf8"); } catch { return out; }
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { /* skip partial/corrupt line */ }
  }
  return out;
}

// Best-effort human label for what a tool call is acting on.
function toolTarget(name, input) {
  if (!input || typeof input !== "object") return "";
  switch (name) {
    case "Read": case "Edit": case "Write": case "NotebookEdit":
      return input.file_path ? basename(input.file_path) : "";
    case "Bash":
      return input.description || (input.command || "").split("\n")[0].slice(0, 60);
    case "Grep":
      return input.pattern ? `/${input.pattern}/` : "";
    case "Glob":
      return input.pattern || "";
    case "WebFetch": case "WebSearch":
      try { return input.url ? new URL(input.url).host : (input.query || ""); }
      catch { return input.query || input.url || ""; }
    case "Agent": case "Task":
      return input.subagent_type || input.description || "";
    case "Skill":
      return input.skill || "";
    default:
      return input.file_path ? basename(input.file_path) : (input.description || "");
  }
}

function toolBlocks(entry) {
  const msg = entry.message;
  if (!msg || typeof msg !== "object" || !Array.isArray(msg.content)) return [];
  return msg.content.filter((b) => b && b.type === "tool_use");
}

function firstText(entry) {
  const msg = entry.message;
  if (!msg || !Array.isArray(msg.content)) return "";
  const t = msg.content.find((b) => b && b.type === "text");
  return t ? (t.text || "").trim() : "";
}

// Resolve the main-session jsonl path + its per-session sidecar dir from an id
// or a direct path.
export function resolveSession(idOrPath, projectsRoot) {
  let mainPath = idOrPath;
  if (!existsSync(mainPath)) mainPath = join(projectsRoot, `${idOrPath}.jsonl`);
  if (!existsSync(mainPath)) throw new Error(`session transcript not found: ${idOrPath}`);
  const id = basename(mainPath).replace(/\.jsonl$/, "");
  const sidecar = join(dirname(mainPath), id);
  return { id, mainPath, subagentsDir: join(sidecar, "subagents") };
}

// Cheap scan: pull the first (or last) value of a top-level field from a jsonl
// without fully parsing every line's structure.
function fieldFromJsonl(path, field, { last = false } = {}) {
  let raw;
  try { raw = readFileSync(path, "utf8"); } catch { return ""; }
  let found = "";
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s || !s.includes(`"${field}"`)) continue;
    try {
      const d = JSON.parse(s);
      if (d[field]) { found = d[field]; if (!last) return found; }
    } catch { /* skip */ }
  }
  return found;
}

// Light metadata for a run listing (no event parsing).
export function sessionSummary(mainPath) {
  const id = basename(mainPath).replace(/\.jsonl$/, "");
  const cwd = fieldFromJsonl(mainPath, "cwd");
  const title = fieldFromJsonl(mainPath, "aiTitle", { last: true })
    || fieldFromJsonl(mainPath, "slug", { last: true }) || id.slice(0, 8);
  let mtime = 0;
  try { mtime = statSync(mainPath).mtimeMs; } catch { /* ignore */ }
  return { id, cwd, title, mtime, path: mainPath };
}

// All runs whose transcript cwd matches repoPath. Scans one level of project
// dirs under projectsRoot; matches by cwd rather than any path-encoding rule.
export function listRuns(repoPath, projectsRoot) {
  const runs = [];
  let dirs = [];
  try { dirs = readdirSync(projectsRoot); } catch { return runs; }
  for (const d of dirs) {
    const full = join(projectsRoot, d);
    let st; try { st = statSync(full); } catch { continue; }
    if (!st.isDirectory()) continue;
    let files = [];
    try { files = readdirSync(full); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      const s = sessionSummary(join(full, f));
      if (!repoPath || s.cwd === repoPath) runs.push(s);
    }
  }
  runs.sort((a, b) => b.mtime - a.mtime);
  return runs;
}

export function parseSession(idOrPath, projectsRoot) {
  const { id, mainPath, subagentsDir } = resolveSession(idOrPath, projectsRoot);
  const events = [];
  const title = fieldFromJsonl(mainPath, "aiTitle", { last: true })
    || fieldFromJsonl(mainPath, "slug", { last: true }) || id.slice(0, 8);

  // --- subagent metadata, keyed by the spawning tool_use id --------------
  const byToolUse = new Map();   // toolUseId -> {agentType, file, entries}
  if (existsSync(subagentsDir)) {
    for (const f of readdirSync(subagentsDir)) {
      if (!f.endsWith(".meta.json")) continue;
      const agentId = f.replace(/\.meta\.json$/, "");
      let meta = {};
      try { meta = JSON.parse(readFileSync(join(subagentsDir, f), "utf8")); } catch { /* ignore */ }
      byToolUse.set(meta.toolUseId, {
        agentId,
        agentType: meta.agentType || "subagent",
        jsonl: join(subagentsDir, `${agentId}.jsonl`),
      });
    }
  }

  // --- main thread --------------------------------------------------------
  const main = readJsonl(mainPath);
  let started = false;
  for (const e of main) {
    const t = e.timestamp || "";
    if (!started && (e.type === "user" || e.type === "assistant")) {
      events.push({ t, kind: "run_start", agent: "orchestrator", agentType: "orchestrator" });
      started = true;
    }
    for (const b of toolBlocks(e)) {
      if (b.name === "Agent" || b.name === "Task") {
        const sub = byToolUse.get(b.id);
        const agentType = (sub && sub.agentType) || (b.input && b.input.subagent_type) || "subagent";
        events.push({
          t, kind: "agent_spawn", agent: agentType, agentType,
          tool: b.name, target: toolTarget(b.name, b.input),
          text: (b.input && (b.input.description || "")) || "",
        });
      } else {
        events.push({
          t, kind: "main_tool", agent: "orchestrator", agentType: "orchestrator",
          tool: b.name, target: toolTarget(b.name, b.input),
        });
      }
    }
  }

  // --- each subagent's own activity --------------------------------------
  for (const sub of byToolUse.values()) {
    const rows = readJsonl(sub.jsonl);
    let lastT = "";
    for (const e of rows) {
      const t = e.timestamp || "";
      if (t) lastT = t;
      for (const b of toolBlocks(e)) {
        events.push({
          t, kind: "agent_tool", agent: sub.agentType, agentType: sub.agentType,
          tool: b.name, target: toolTarget(b.name, b.input),
        });
      }
    }
    events.push({ t: lastT, kind: "agent_result", agent: sub.agentType, agentType: sub.agentType });
  }

  // --- order + number -----------------------------------------------------
  events.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  events.forEach((e, i) => { e.seq = i; });

  const agentsSeen = [...new Set(events.filter(e => e.agentType !== "orchestrator").map(e => e.agentType))];
  return {
    id,
    title,
    isMapleRun: agentsSeen.some((a) => MAPLE_NODES.has(a)),
    agents: agentsSeen,
    count: events.length,
    events,
  };
}

// CLI: node parse.mjs <session-id|path> [projectsRoot]  -> summary or full JSON
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , idOrPath, root] = process.argv;
  const projectsRoot = root || join(process.env.HOME, ".claude", "projects");
  if (!idOrPath) {
    console.error("usage: node parse.mjs <session-id|path-to.jsonl> [projectsRoot]");
    process.exit(2);
  }
  const r = parseSession(idOrPath, projectsRoot);
  if (process.env.FULL) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(`session ${r.id}  maple=${r.isMapleRun}  events=${r.count}`);
    console.log(`agents: ${r.agents.join(", ") || "(none)"}`);
    const k = {};
    for (const e of r.events) k[e.kind] = (k[e.kind] || 0) + 1;
    console.log("event kinds:", k);
    console.log("first 24:");
    for (const e of r.events.slice(0, 24)) {
      console.log(`  ${(e.t || "").slice(11, 19)}  ${e.kind.padEnd(12)} ${e.agentType.padEnd(18)} ${e.tool || ""} ${e.target || ""}`.trimEnd());
    }
  }
}
