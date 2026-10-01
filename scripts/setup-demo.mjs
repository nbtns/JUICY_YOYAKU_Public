import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDemoSeedSql } from "./seed-data.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const config = resolve(root, "wrangler.jsonc");
const localState = resolve(root, ".wrangler/state");
function wrangler(args) {
  const result = spawnSync(process.execPath, [cli, "d1", ...args, "--local", "--config", config, "--persist-to", localState], {
    cwd: root, stdio: "inherit", windowsHide: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG_PATH: resolve(root, ".wrangler/logs"), MINIFLARE_REGISTRY_PATH: resolve(root, ".wrangler/registry") },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// The --local flag is mandatory on both calls. No Cloudflare account is needed.
wrangler(["migrations", "apply", "juicy-public-demo"]);
await mkdir(resolve(root, ".wrangler"), { recursive: true });
const seedPath = resolve(root, ".wrangler/demo-seed.sql");
await writeFile(seedPath, buildDemoSeedSql(new Date()), "utf8");
wrangler(["execute", "juicy-public-demo", "--file", seedPath]);
console.log("架空のデモDBを準備しました。既存のデモ予約は保持しています。npm run dev で起動できます。");
