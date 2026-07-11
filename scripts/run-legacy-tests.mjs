import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "..");
const scriptsDir = join(projectRoot, "scripts");
const testFiles = readdirSync(scriptsDir)
  .filter((fileName) => /^test-.*\.ts$/.test(fileName))
  .sort();

for (const fileName of testFiles) {
  const result = spawnSync(process.execPath, ["--import", "tsx", join(scriptsDir, fileName)], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`Legacy test failed: ${fileName}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`All ${testFiles.length} legacy script tests passed.`);
