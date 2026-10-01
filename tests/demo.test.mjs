import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { demoRole, demoEmail, localDemoRequestAllowed } from "../lib/demo.ts";
import { sendEmailWithRuntime } from "../lib/email.ts";
import { POST as squareWebhook } from "../app/api/webhooks/square/route.ts";
import { buildDemoSeedSql } from "../scripts/seed-data.mjs";

test("外部ホスト・別サイト・不正Hostのアクセスを拒否する", () => {
  assert.equal(localDemoRequestAllowed(new Request("http://127.0.0.1:3000/")), true);
  assert.equal(localDemoRequestAllowed(new Request("http://localhost:3000/")), true);
  assert.equal(localDemoRequestAllowed(new Request("https://portfolio.example.com/")), false);
  assert.equal(localDemoRequestAllowed(new Request("http://127.0.0.1:3000/", { headers: { host: "evil.example" } })), false);
  assert.equal(localDemoRequestAllowed(new Request("http://127.0.0.1:3000/api/trials", { headers: { origin: "https://evil.example" } })), false);
  assert.equal(localDemoRequestAllowed(new Request("http://127.0.0.1:3000/demo?role=admin", { headers: { "sec-fetch-site": "cross-site" } })), false);
});

test("デモ利用者は架空の先生と会員だけに限定する", () => {
  assert.equal(demoRole(null), null);
  assert.equal(demoRole("juicy-demo-role=root"), null);
  assert.equal(demoRole("other=admin"), null);
  assert.equal(demoRole("other=1; juicy-demo-role=member"), "member");
  assert.equal(demoEmail("admin"), "teacher@example.com");
});

test("メール設定が渡されても送信せず、決済通知も拒否する", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("外部送信は禁止"); };
  try {
    const result = await sendEmailWithRuntime({ RESEND_API_KEY: "provided", EMAIL_FROM: "demo@example.com" }, { to: "member@example.com", subject: "test", html: "test" });
    assert.equal(result.status, "skipped");
    assert.equal((await squareWebhook()).status, 403);
  } finally { globalThis.fetch = originalFetch; }
});

test("初期化は月末でも架空会員を作り、再実行で予約や回数を上書きしない", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const migrations = (await readdir(new URL("../drizzle/", import.meta.url))).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const migration of migrations) db.exec(await readFile(new URL("../drizzle/" + migration, import.meta.url), "utf8"));
  const seed = buildDemoSeedSql(new Date("2026-10-31T12:00:00+09:00"));
  db.exec(seed);
  const before = db.prepare("SELECT reserved FROM monthly_credits WHERE id = 'credit-member-2026-11'").get();
  assert.equal(before.reserved, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM accounts").get().count, 3);
  db.exec(seed);
  assert.deepEqual(db.prepare("SELECT reserved FROM monthly_credits WHERE id = 'credit-member-2026-11'").get(), before);
  assert.equal(db.prepare("SELECT count(*) AS count FROM bookings").get().count, 2);
  db.close();
});
