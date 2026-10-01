import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Local demo database is unavailable. Run npm run demo:setup before starting the app."
    );
  }

  return drizzle(env.DB, { schema });
}
