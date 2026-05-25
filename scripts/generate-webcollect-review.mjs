import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const reportDate = new Date().toISOString().slice(0, 10);
const reportDir = path.join(repoRoot, "docs", "reports");
const reportPath = path.join(reportDir, `webcollect-review-${reportDate}.md`);

function readOptional(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  if (!existsSync(fullPath)) return "";
  return readFileSync(fullPath, "utf8");
}

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    return `git ${args.join(" ")} failed: ${error.message}`;
  }
}

function extractHeadings(markdown, prefix) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.replace(/^#+\s*/, "").trim());
}

function recentCurrentTasks(todo) {
  return extractHeadings(todo, "## Current Task:")
    .slice(0, 12)
    .map((heading) => heading.replace("Current Task:", "").trim());
}

function lessonsSinceMay18(lessons) {
  return extractHeadings(lessons, "## 2026-05-18:")
    .map((heading) => heading.replace("2026-05-18:", "").trim());
}

const todo = readOptional("tasks/todo.md");
const lessons = readOptional("tasks/lessons.md");
const status = git(["status", "--short", "--branch"]);
const diffStat = git(["diff", "--stat"]);
const trackedChanges = git(["diff", "--name-only"]);

const knownMistakes = [
  "Manual versions were saved only to localforage, so deleting and reloading the extension could remove the version list.",
  "A fresh extension install could mark a default local layout as newer before cloud restore completed, which risked flattening sections into the homepage.",
  "Structure-only repair was treated as enough after the workspace had already collapsed; the safer path is a full healthy account snapshot.",
  "Homely data was briefly treated as a latest WebCollect recovery source even though it was only an early import/reference fixture.",
  "Several UI passes changed presentation while data ownership was still local-first, which made the save button feel trustworthy before it was account-backed.",
  "Some extension UI assets and CSS lived outside the extension build path, so changes could appear in Web but not in the loaded Chrome extension.",
];

const currentFixes = [
  "Added the account-scoped workspace_snapshots table with RLS and a user/kind/day uniqueness rule for daily system snapshots.",
  "Manual header saves now create a local fallback and, when logged in, persist the full workspace snapshot to Supabase.",
  "Automatic safety snapshots still stay local, and also upsert one system cloud snapshot per local day when a user is logged in.",
  "The rollback dialog now separates cloud manual saves, cloud daily automatic saves, and local fallback backups.",
  "Cloud snapshot restore writes back into local IndexedDB through the shared restore path, then marks the workspace changed so guarded sync can upload it.",
  "A deterministic review script now summarizes the recent mistakes, fixes, data contract, git status, and verification checklist.",
];

const dataContract = [
  "Primary workspace data lives in Supabase categories/cards plus user_preferences for sections, warehouse, recycle bin, and visual preferences.",
  "Account restore points live in Supabase workspace_snapshots and are not part of normal sync merge.",
  "Manual snapshots are permanent unless the user explicitly deletes them in a future UI.",
  "System cloud snapshots are deduplicated by user_id + kind + day_key, so each day keeps only the latest automatic version.",
  "Local snapshots remain a fast fallback, but they are not durable across extension deletion.",
];

const verification = [
  "corepack pnpm exec tsx scripts/test-cloud-snapshots.ts",
  "corepack pnpm ts-check",
  "corepack pnpm lint",
  "corepack pnpm build:ext",
  "git diff --check",
];

const report = `# WebCollect Review - ${reportDate}

## Summary

This report is generated from the repository state. It focuses on the data-loss and rollback work after the blue-glass UI phase.

## Root-Cause Mistakes

${knownMistakes.map((item) => `- ${item}`).join("\n")}

## Fixes Implemented In This Pass

${currentFixes.map((item) => `- ${item}`).join("\n")}

## Current Data Contract

${dataContract.map((item) => `- ${item}`).join("\n")}

## Recent Task Trail

${recentCurrentTasks(todo).map((item) => `- ${item}`).join("\n") || "- No task headings found."}

## Relevant Lessons

${lessonsSinceMay18(lessons).map((item) => `- ${item}`).join("\n") || "- No May 18 lessons found."}

## Git Status

\`\`\`text
${status || "(clean)"}
\`\`\`

## Changed Files

\`\`\`text
${trackedChanges || "(no tracked changes)"}
\`\`\`

## Diff Stat

\`\`\`text
${diffStat || "(no diff stat)"}
\`\`\`

## Verification Checklist

${verification.map((item) => `- [ ] \`${item}\``).join("\n")}
`;

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, report, "utf8");
console.log(reportPath);
