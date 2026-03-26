import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function run(command) {
  return execSync(command, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

function safeRun(command, fallback = "") {
  try {
    return run(command);
  } catch {
    return fallback;
  }
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      bodyPreview: text.slice(0, 300),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      bodyPreview: String(error),
    };
  }
}

const deployedBase = process.env.DEPLOYED_BASE_URL || process.env.MMW_BASE_URL || "";
const generatedAt = new Date().toISOString();

const statusShort = safeRun("git status --short", "");
const branch = safeRun("git branch --show-current", "unknown");
const commit = safeRun("git rev-parse HEAD", "unknown");
const commitShort = safeRun("git rev-parse --short HEAD", "unknown");
const remote = safeRun("git remote get-url origin", "unknown");
const localAheadBehind = safeRun("git rev-list --left-right --count @{upstream}...HEAD", "0 0");
const counts = localAheadBehind
  .split(/\s+/)
  .map((part) => Number(part))
  .filter((value) => Number.isFinite(value));
const behindRaw = counts[0] ?? 0;
const aheadRaw = counts[1] ?? 0;

const report = {
  generatedAt,
  local: {
    branch,
    commit,
    commitShort,
    workingTreeClean: statusShort.length === 0,
    uncommittedChanges: statusShort ? statusShort.split(/\r?\n/) : [],
  },
  git: {
    origin: remote,
    aheadBy: aheadRaw,
    behindBy: behindRaw,
  },
  deploy: {
    baseUrl: deployedBase || null,
    events: null,
    pulse: null,
  },
};

if (deployedBase) {
  const base = deployedBase.replace(/\/$/, "");
  report.deploy.events = await fetchJson(`${base}/api/events`);
  report.deploy.pulse = await fetchJson(`${base}/api/pulse`);
}

report.syncHealthy =
  report.local.workingTreeClean &&
  report.git.aheadBy === 0 &&
  report.git.behindBy === 0 &&
  (!report.deploy.baseUrl || (report.deploy.events?.ok && report.deploy.pulse?.ok));

mkdirSync(resolve("logs"), { recursive: true });
writeFileSync(resolve("logs", "sync-awareness-latest.json"), `${JSON.stringify(report, null, 2)}\n`);

// Persist to deployment_sync_state via admin endpoint if base URL + key are available
const persistBase = deployedBase || process.env.MMW_BASE_URL || "";
const adminKey = process.env.INGEST_ADMIN_KEY || "";
if (persistBase && adminKey) {
  const base = persistBase.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/admin/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ingest-key": adminKey,
      },
      body: JSON.stringify(report),
    });
    const persisted = { ok: res.ok, status: res.status };
    report.persisted = persisted;
    writeFileSync(resolve("logs", "sync-awareness-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  } catch (err) {
    report.persisted = { ok: false, status: 0, error: String(err) };
    writeFileSync(resolve("logs", "sync-awareness-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
}

console.log(JSON.stringify(report, null, 2));
