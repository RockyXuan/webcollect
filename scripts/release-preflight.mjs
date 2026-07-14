import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function git(args, fallback = "") {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trimEnd();
  } catch {
    return fallback;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readExport(source, name) {
  return source.match(new RegExp(`export const ${name} = ["']([^"']+)["']`))?.[1] || "";
}

export function expectedReleaseTag({ packageVersion, releaseDate }) {
  return `webcollect-${releaseDate}-v${packageVersion}`;
}

export function parsePorcelainPaths(output) {
  return String(output || "")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3));
}

export function validateReleaseState(state, { allowPrerelease = false } = {}) {
  const errors = [];
  if (state.branch !== "main") errors.push("release must run from the main branch");
  if (state.dirtyPaths.length > 0) errors.push(`worktree must be clean: ${state.dirtyPaths.join(", ")}`);
  if (!state.remoteMain || state.head !== state.remoteMain) {
    errors.push("HEAD must exactly match the fetched origin/main commit");
  }

  const versions = [state.packageVersion, state.manifestVersion, state.appVersion];
  if (versions.some((version) => !version) || new Set(versions).size !== 1) {
    errors.push(`product versions must match: ${versions.join(" / ")}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.releaseDate)) {
    errors.push("release date must use YYYY-MM-DD");
  }

  const expectedTag = expectedReleaseTag(state);
  const validTag = allowPrerelease
    ? new RegExp(`^${expectedTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-rc\\.[1-9]\\d*$`).test(state.tag)
    : state.tag === expectedTag;
  if (!validTag) {
    errors.push(`release tag must be ${allowPrerelease ? `${expectedTag}-rc.N` : expectedTag}`);
  }
  if (state.existingTagCommit && state.existingTagCommit !== state.head) {
    errors.push(`existing release tag points to another commit: ${state.existingTagCommit}`);
  }
  if (state.staticArtifactExists) {
    errors.push("public/extension-dist is a stale generated artifact and must not be released");
  }
  if (state.builtManifestVersion !== null && state.builtManifestVersion !== state.packageVersion) {
    errors.push(`built extension version must match ${state.packageVersion}`);
  }
  return errors;
}

export function collectReleaseState({ tag, requireBuilt = false } = {}) {
  const packageVersion = readJson("package.json").version || "";
  const manifestVersion = readJson("extension/manifest.json").version || "";
  const versionSource = readFileSync("src/lib/app-version.ts", "utf8");
  const appVersion = readExport(versionSource, "APP_VERSION");
  const releaseDate = readExport(versionSource, "APP_RELEASE_DATE");
  const resolvedTag = tag || expectedReleaseTag({ packageVersion, releaseDate });
  const dirtyPaths = parsePorcelainPaths(git(["status", "--porcelain", "--untracked-files=all"]));
  let builtManifestVersion = null;
  if (requireBuilt) {
    builtManifestVersion = existsSync("extension/dist/manifest.json")
      ? readJson("extension/dist/manifest.json").version || ""
      : "";
  }

  return {
    branch: git(["branch", "--show-current"]),
    dirtyPaths,
    head: git(["rev-parse", "HEAD"]),
    remoteMain: git(["rev-parse", "refs/remotes/origin/main"]),
    packageVersion,
    manifestVersion,
    appVersion,
    releaseDate,
    tag: resolvedTag,
    existingTagCommit: git(["rev-list", "-n", "1", resolvedTag]),
    staticArtifactExists: existsSync("public/extension-dist"),
    builtManifestVersion,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  const requireBuilt = args.includes("--built");
  const printTag = args.includes("--print-tag");
  const allowPrerelease = args.includes("--prerelease");
  const tag = args.find((arg) => !arg.startsWith("--"));
  const state = collectReleaseState({ tag, requireBuilt });
  if (printTag) {
    console.log(state.tag);
    return;
  }
  const errors = validateReleaseState(state, { allowPrerelease });
  if (errors.length > 0) {
    console.error("Release preflight failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Release preflight passed for ${state.tag} at ${state.head}`);
}

if (process.argv[1]?.endsWith("release-preflight.mjs")) runCli();
