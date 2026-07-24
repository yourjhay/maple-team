# Maple Run Viewer

A local, dependency-free viewer that replays a Maple Team run on the landing-page
node diagram — which agent ran, in what order, what each one did, and its verdict —
by reading Claude Code's own session transcripts. No hooks required.

Inspired by [agent-flow](https://github.com/patoles/agent-flow); this is a slim,
Maple-branded take that drives the existing 8-node diagram.

## Run it

```bash
cd viewer
node fixtures/build-sample.mjs                       # once, to generate the demo run

node server.mjs                                      # watch THIS repo's runs
node server.mjs --project /path/to/your/repo         # watch another project's runs
# → http://127.0.0.1:4757
```

**Which project?** The viewer follows the Claude Code session whose working
directory is `--project`. If you're running the team in a different repo (say
`~/web/sample-portfolio`), point the viewer there:

```bash
node server.mjs --project ~/web/sample-portfolio
```

Without `--project` it defaults to this repo (the viewer's parent dir), **not** the
directory you launched from — so `npm run viewer` alone watches maple-team's own runs.
If no session matches, the viewer says so ("no runs found in …") instead of sitting blank.

Pick a run from the dropdown (the built-in **Sample maple run** is always there),
then press ▶ — or hit **● Live** to follow the running session. Scrub the timeline,
change speed, restart. The activity ticker logs every tool call per agent.

Flags: `--port N` (default 4757), `--project DIR` (repo whose runs to show; defaults to
this repo), `--root DIR` (transcripts dir; defaults to `~/.claude/projects`).

## How it works

Claude Code writes each session to `~/.claude/projects/<encoded-project>/`:

| File | Contents |
|------|----------|
| `<session>.jsonl` | main thread — turns + tool calls, incl. the `Agent`/`Task` dispatch |
| `<session>/subagents/agent-<id>.jsonl` | each subagent's own tool calls, timestamped |
| `<session>/subagents/agent-<id>.meta.json` | `{agentType, description, toolUseId, spawnDepth}` |
| `<session>/tool-results/*.txt` | full tool outputs |

The subagent meta's `toolUseId` joins back to the dispatch in the main transcript,
so spawns can be ordered and every tool call attributed to the right agent.

- `parse.mjs` — reads a session into a flat, timestamp-sorted event stream
  (`run_start | main_tool | agent_spawn | agent_tool | agent_result`) and lists
  runs for a repo by matching each transcript's `cwd` (no path-encoding assumptions).
- `server.mjs` — serves the UI and the parsed runs. Bound to `127.0.0.1` (it exposes
  file contents and tool output — never expose it off-host).
- `viewer.html` — maps the six `maple-*` agents onto the fixed diagram nodes and
  replays the event stream, **paced by sequence** (not wall-clock — real runs have
  long idle gaps). Non-maple agents surface in the ticker under the orchestrator node.

## Status

- **Replay** (done) — pick any past run and play it back.
- **Live** (done) — click **● Live** to follow the running session. The server tails
  the newest transcript for the project and pushes a fresh snapshot over SSE
  (`/events`) on every write; the client jumps to the current state, then animates
  each new event as the team works. Snapshot-per-change (rather than a sequence diff)
  keeps it correct when subagent files interleave by timestamp.

## Notes

- Needs a real multi-agent run to look its best; until then the sample fixture stands
  in for a full architect→advisor→engineer→hard→qa→security flow.
- Token-level "thinking" is not available — granularity is per tool call, which is
  what the transcripts record.
