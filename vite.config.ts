import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig(async () => {
  // Tool state stays inside this public demo folder.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    server: { host: "127.0.0.1", port: 3000, strictPort: true, watch: { ignored: ["**/artifacts/**", "**/.wrangler/**"] } },
    plugins: [vinext(), cloudflare({ configPath: "wrangler.jsonc", viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } })],
  };
});
