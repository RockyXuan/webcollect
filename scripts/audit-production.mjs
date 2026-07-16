import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_REGISTRY = "https://registry.npmjs.org";
const SEVERITY_ORDER = ["info", "low", "moderate", "high", "critical"];

function addVersion(inventory, name, version) {
  if (
    typeof name !== "string" ||
    typeof version !== "string" ||
    version.startsWith("link:") ||
    version.startsWith("file:")
  ) {
    return;
  }

  const versions = inventory.get(name) ?? new Set();
  versions.add(version);
  inventory.set(name, versions);
}

function visitDependencies(inventory, dependencies) {
  if (!dependencies || typeof dependencies !== "object") return;

  for (const [name, dependency] of Object.entries(dependencies)) {
    if (!dependency || typeof dependency !== "object") continue;
    addVersion(inventory, name, dependency.version);
    visitDependencies(inventory, dependency.dependencies);
    visitDependencies(inventory, dependency.optionalDependencies);
  }
}

export function collectPackageVersions(projects) {
  const inventory = new Map();

  for (const project of Array.isArray(projects) ? projects : []) {
    visitDependencies(inventory, project.dependencies);
    visitDependencies(inventory, project.optionalDependencies);
  }

  return Object.fromEntries(
    [...inventory.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, versions]) => [name, [...versions].sort()])
  );
}

export function summarizeAdvisories(payload, threshold = "high") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("npm Bulk Advisory API returned an invalid payload");
  }

  const advisories = [];
  const counts = Object.fromEntries(SEVERITY_ORDER.map((severity) => [severity, 0]));

  for (const [packageName, packageAdvisories] of Object.entries(payload)) {
    if (!Array.isArray(packageAdvisories)) {
      throw new Error(`npm returned invalid advisories for ${packageName}`);
    }

    for (const advisory of packageAdvisories) {
      const severity = String(advisory?.severity ?? "unknown").toLowerCase();
      advisories.push({ packageName, ...advisory, severity });
      counts[severity] = (counts[severity] ?? 0) + 1;
    }
  }

  const thresholdIndex = SEVERITY_ORDER.indexOf(threshold);
  if (thresholdIndex < 0) throw new Error(`Unsupported audit threshold: ${threshold}`);

  const blocking = advisories.filter(
    (advisory) => SEVERITY_ORDER.indexOf(advisory.severity) >= thresholdIndex
  );

  return { advisories, blocking, counts };
}

function listProductionDependencies() {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const args = npmExecPath
    ? [npmExecPath, "list", "--prod", "--json", "--depth", "Infinity"]
    : ["list", "--prod", "--json", "--depth", "Infinity"];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to list installed production dependencies");
  }

  return JSON.parse(result.stdout);
}

function auditEndpoint() {
  const registry = (process.env.NPM_AUDIT_REGISTRY || DEFAULT_REGISTRY).replace(/\/+$/, "");
  return `${registry}/-/npm/v1/security/advisories/bulk`;
}

async function run() {
  const inventory = collectPackageVersions(listProductionDependencies());
  const packageCount = Object.keys(inventory).length;
  if (packageCount === 0) throw new Error("Production dependency inventory is empty");

  const response = await fetch(auditEndpoint(), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "WebCollect production audit",
    },
    body: JSON.stringify(inventory),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`npm Bulk Advisory API returned HTTP ${response.status}`);
  }

  const summary = summarizeAdvisories(await response.json(), "high");
  const countText = SEVERITY_ORDER.map(
    (severity) => `${severity}=${summary.counts[severity] ?? 0}`
  ).join(" ");

  if (summary.blocking.length > 0) {
    for (const advisory of summary.blocking) {
      console.error(
        `[${advisory.severity}] ${advisory.packageName}: ${advisory.title ?? "Untitled advisory"} ${advisory.url ?? ""}`.trim()
      );
    }
    throw new Error(`Production dependency audit failed: ${countText}`);
  }

  console.log(`Production dependency audit passed for ${packageCount} packages: ${countText}`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
