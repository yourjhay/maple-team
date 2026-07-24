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
const PROJECTS_ROOT = join(process.env.HOME, ".claude", "projects");
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
