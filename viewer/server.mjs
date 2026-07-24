// Maple Team run viewer — local, dependency-free.
//
//   node viewer/server.mjs [--port N] [--project /path/to/repo]
//
// Serves the replay UI and reads Claude Code session transcripts from
// ~/.claude/projects. Runs are matched to the target repo by each transcript's
// `cwd` field (no path-encoding assumptions). Bound to 127.0.0.1 — it serves
// file contents and tool output, so it must not be reachable off-host.

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSession, listRuns } from "./parse.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const PORT = parseInt(arg("--port", process.env.PORT || "4757"), 10);
const PROJECT = arg("--project", process.cwd());
const PROJECTS_ROOT = arg("--root", join(process.env.HOME, ".claude", "projects"));
const SAMPLE = join(here, "fixtures", "maple-sample.json");

const MIME = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json" };

function sendJSON(res, obj, code = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}
function sendFile(res, path) {
  if (!existsSync(path)) { res.writeHead(404); res.end("not found"); return; }
  const body = readFileSync(path);
  res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  try {
    if (p === "/" || p === "/index.html") return sendFile(res, join(here, "viewer.html"));

    if (p === "/runs") {
      const runs = listRuns(PROJECT, PROJECTS_ROOT).map(r => ({
        id: r.id, title: r.title, mtime: r.mtime,
      }));
      // always offer the built-in sample first
      runs.unshift({ id: "sample", title: "▶ Sample maple run (demo)", mtime: Infinity });
      return sendJSON(res, { project: PROJECT, runs });
    }

    if (p.startsWith("/run/")) {
      const id = decodeURIComponent(p.slice("/run/".length));
      if (id === "sample") {
        if (!existsSync(SAMPLE)) return sendJSON(res, { error: "sample missing — run fixtures/build-sample.mjs" }, 404);
        return sendFile(res, SAMPLE);
      }
      // resolve id → full transcript path (it lives in a per-project subdir,
      // not directly under PROJECTS_ROOT)
      const match = listRuns(PROJECT, PROJECTS_ROOT).find(r => r.id === id);
      if (!match) return sendJSON(res, { error: `run not found: ${id}` }, 404);
      const parsed = parseSession(match.path, PROJECTS_ROOT);
      return sendJSON(res, parsed);
    }

    if (p === "/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
      });
      res.write(": connected\n\n");
      const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      const wanted = url.searchParams.get("run");   // optional pin to one run
      let lastRunId = null, lastMtime = -1;

      const tick = () => {
        let runs;
        try { runs = listRuns(PROJECT, PROJECTS_ROOT); } catch { return; }
        const run = wanted ? runs.find(r => r.id === wanted) : runs[0];
        if (!run) return;
        if (run.id !== lastRunId) {            // active run changed → reset client
          lastRunId = run.id; lastMtime = -1;
          send({ type: "run", id: run.id, title: run.title });
        }
        if (run.mtime === lastMtime) return;   // no new writes since last snapshot
        lastMtime = run.mtime;
        let parsed;
        try { parsed = parseSession(run.path, PROJECTS_ROOT); } catch { return; }
        send({ type: "snapshot", id: parsed.id, title: parsed.title, isMapleRun: parsed.isMapleRun, events: parsed.events });
      };

      const iv = setInterval(tick, 1000);
      const ka = setInterval(() => res.write(": ka\n\n"), 15000);
      tick();
      req.on("close", () => { clearInterval(iv); clearInterval(ka); });
      return;
    }

    res.writeHead(404); res.end("not found");
  } catch (err) {
    sendJSON(res, { error: String(err && err.message || err) }, 500);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Maple viewer → http://127.0.0.1:${PORT}`);
  console.log(`  project: ${PROJECT}`);
  console.log(`  transcripts: ${PROJECTS_ROOT}`);
  console.log(`  (Ctrl-C to stop)`);
});
