import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const extensionRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(extensionRoot, "..");
const viteBin = join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const distDir = join(extensionRoot, "dist");
const iconSourceDir = join(extensionRoot, "public", "icons");
const iconDistDir = join(distDir, "icons");

console.log("Building WebCollect Chrome Extension...");

const viteResult = spawnSync(
  process.execPath,
  [viteBin, "build", "--config", join(extensionRoot, "vite.config.ts")],
  {
    cwd: projectRoot,
    stdio: "inherit",
  }
);

if (viteResult.status !== 0) {
  process.exit(viteResult.status ?? 1);
}

cpSync(join(extensionRoot, "manifest.json"), join(distDir, "manifest.json"));
cpSync(join(extensionRoot, "background.js"), join(distDir, "background.js"));

mkdirSync(iconDistDir, { recursive: true });
if (existsSync(iconSourceDir)) {
  for (const fileName of readdirSync(iconSourceDir)) {
    if (fileName.endsWith(".png")) {
      cpSync(join(iconSourceDir, fileName), join(iconDistDir, fileName));
    }
  }
}

console.log(`Extension built successfully! Output: ${distDir}`);
console.log("Load this folder in chrome://extensions to install.");
