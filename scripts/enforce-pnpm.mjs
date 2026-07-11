const userAgent = process.env.npm_config_user_agent || "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("WebCollect dependencies must be installed with Corepack/pnpm 9.");
  console.error("Run: corepack pnpm@9.0.0 install");
  process.exit(1);
}
