/**
 * API route that provides Supabase configuration to the browser client.
 * This avoids exposing NEXT_PUBLIC_ env vars (which would be baked into the build).
 * The anon key is safe to expose — it's designed for client-side use with RLS.
 */

import { NextResponse } from "next/server";

// Reuse the loadEnv logic from the server-side supabase-client template
// This loads COZE_SUPABASE_URL and COZE_SUPABASE_ANON_KEY from the workload identity
let envLoaded = false;

function loadEnv(): void {
  if (envLoaded) return;
  if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
    envLoaded = true;
    return;
  }

  try {
    const { execSync } = require('child_process');
    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }

    envLoaded = true;
  } catch {
    // Silently fail
  }
}

export async function GET() {
  loadEnv();

  const url = process.env.COZE_SUPABASE_URL || "";
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY || "";

  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  return NextResponse.json({ url, anonKey });
}
