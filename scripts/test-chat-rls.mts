// Two-account isolation tests for the chat tables (migration 20261030140000).
//
//   npm run test:chat-rls -- --dry-run   offline: checks configuration NAMES, lists the tests
//   npm run test:chat-rls -- --run       runs against the linked Supabase project
//
// --run WRITES disposable rows titled "ZZ-CHAT-<run>" with the two email/password test
// accounts and deletes them again at the end (an owner may delete their own conversation;
// its messages go with it by cascade). Run it only AFTER the chat migrations are applied
// and the owner has approved the run.
// Configuration is read at run time and never printed; only the publishable key is used.
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL", "TEST_USER_A_PASSWORD", "TEST_USER_B_EMAIL", "TEST_USER_B_PASSWORD",
] as const;
for (const file of [".env.local", ".env.test.local"]) {
  try { process.loadEnvFile(file); } catch { /* reported below, by name only */ }
}
const TITLE = `ZZ-CHAT-${Date.now().toString(36)}`;

type Res = { data: unknown; error: { code?: string } | null };
const code = (r: Res) => r.error?.code ?? "none";
// An explicit value for the GENERATED ALWAYS identity column "id" is refused while the
// statement is analysed (428C9), before the privilege check; accepted only for that case.
const IDENTITY_REFUSAL = "428C9";
const denied = (r: Res) => r.error !== null && ["42501", "PGRST301", "401", "403"].includes(code(r));
const rows = (r: Res) => { assert.equal(r.error, null, `unexpected error ${code(r)}`); return (r.data ?? []) as Record<string, unknown>[]; };

const tests: { name: string; fn: () => Promise<void> }[] = [];
const t = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const s = {} as { anon: SupabaseClient; a: SupabaseClient; b: SupabaseClient; aId: string; conv: number; msgs: number };
const mk = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string, { auth: { persistSession: false, autoRefreshToken: false } });

t("anonymous: no access to either table", async () => {
  for (const table of ["conversations", "messages"]) {
    assert.ok(denied((await s.anon.from(table).select("id").limit(1)) as Res), `${table} read`);
  }
  assert.ok(denied((await s.anon.from("conversations").insert({ title: TITLE })) as Res));
});
t("A creates a conversation; the database sets the owner", async () => {
  const r = rows((await s.a.from("conversations").insert({ title: TITLE }).select("id, user_id")) as Res)[0];
  assert.equal(r.user_id, s.aId);
  s.conv = r.id as number;
});
t("A cannot set user_id, id or created_at on insert", async () => {
  for (const extra of [{ user_id: s.aId }, { id: 999999999 }, { created_at: "2000-01-01" }]) {
    const r = (await s.a.from("conversations").insert({ title: TITLE, ...extra })) as Res;
    const identity = "id" in extra && code(r) === IDENTITY_REFUSAL;
    assert.ok(denied(r) || identity, `${JSON.stringify(Object.keys(extra))}: got ${code(r)}`);
  }
});
t("A saves a user and an assistant message in order", async () => {
  const r = rows((await s.a.from("messages").insert([
    { conversation_id: s.conv, role: "user", content: `${TITLE} q` },
    { conversation_id: s.conv, role: "assistant", content: `${TITLE} a` },
  ]).select("id, role")) as Res);
  assert.deepEqual(r.map((x) => x.role), ["user", "assistant"]);
  assert.ok((r[0].id as number) < (r[1].id as number));
  s.msgs = r.length;
});
t("B cannot see A's conversation or messages", async () => {
  assert.equal(rows((await s.b.from("conversations").select("id").eq("id", s.conv)) as Res).length, 0);
  assert.equal(rows((await s.b.from("messages").select("id").eq("conversation_id", s.conv)) as Res).length, 0);
});
t("B cannot append a message to A's conversation", async () => {
  const r = (await s.b.from("messages").insert({ conversation_id: s.conv, role: "user", content: `${TITLE} intruder` })) as Res;
  assert.ok(r.error !== null, "insert into a foreign conversation must fail");
  const seen = rows((await s.a.from("messages").select("id").eq("conversation_id", s.conv)) as Res).length;
  assert.equal(seen, s.msgs, "A's conversation is unchanged");
});
t("nobody can update chat rows or delete single messages (no grants)", async () => {
  for (const c of [s.a, s.b]) {
    assert.ok(denied((await c.from("messages").update({ content: "x" }).eq("conversation_id", s.conv)) as Res));
    assert.ok(denied((await c.from("messages").delete().eq("conversation_id", s.conv)) as Res));
    assert.ok(denied((await c.from("conversations").update({ title: "x" }).eq("id", s.conv)) as Res));
  }
});
t("B cannot delete A's conversation (no row is visible to B)", async () => {
  const r = (await s.b.from("conversations").delete().eq("id", s.conv).select("id")) as Res;
  assert.equal(r.error, null);
  assert.equal(rows(r).length, 0, "nothing deleted");
  assert.equal(rows((await s.a.from("conversations").select("id").eq("id", s.conv)) as Res).length, 1, "still there");
});
t("the table refuses unknown roles and empty content", async () => {
  assert.equal(code((await s.a.from("messages").insert({ conversation_id: s.conv, role: "system", content: "x" })) as Res), "23514");
  assert.equal(code((await s.a.from("messages").insert({ conversation_id: s.conv, role: "user", content: "" })) as Res), "23514");
});

t("A deletes the own conversation and its messages go with it (cleanup)", async () => {
  const r = (await s.a.from("conversations").delete().eq("id", s.conv).select("id")) as Res;
  assert.equal(rows(r).length, 1);
  assert.equal(rows((await s.a.from("conversations").select("id").eq("id", s.conv)) as Res).length, 0);
  assert.equal(rows((await s.a.from("messages").select("id").eq("conversation_id", s.conv)) as Res).length, 0, "cascade");
});

const args = new Set(process.argv.slice(2));
const missing = NEEDED.filter((k) => !process.env[k]);
if (args.has("--dry-run")) {
  console.log("test:chat-rls dry run (offline: nothing is read from or written to the database)");
  for (const k of NEEDED) console.log(`  ${process.env[k] ? "set    " : "MISSING"} ${k}`);
  console.log(`\n${tests.length} tests would run (disposable rows are titled ZZ-CHAT-…):`);
  tests.forEach((x, i) => console.log(`  ${i + 1}. ${x.name}`));
  process.exit(missing.length ? 1 : 0);
}
if (!args.has("--run")) { console.error("Usage: npm run test:chat-rls -- --dry-run | --run"); process.exit(2); }
if (missing.length) { console.error(`Missing configuration (names only): ${missing.join(", ")}`); process.exit(1); }

s.anon = mk(); s.a = mk(); s.b = mk();
const signIn = async (c: SupabaseClient, who: "A" | "B") => {
  const r = await c.auth.signInWithPassword({ email: process.env[`TEST_USER_${who}_EMAIL`] as string, password: process.env[`TEST_USER_${who}_PASSWORD`] as string });
  assert.equal(r.error, null, `sign-in ${who} failed`);
  return r.data.user!.id;
};
s.aId = await signIn(s.a, "A"); await signIn(s.b, "B");
let failed = 0;
for (const x of tests) {
  try { await x.fn(); console.log(`ok   ${x.name}`); }
  catch (e) { failed++; console.error(`FAIL ${x.name}: ${(e as Error).message}`); }
}
if (failed && s.conv) {
  // A failed run must not leave its rows behind: delete by the recorded id and the run's title.
  await s.a.from("conversations").delete().eq("id", s.conv);
  await s.a.from("conversations").delete().like("title", `${TITLE}%`);
}
console.log(`\n${tests.length - failed}/${tests.length} passed.`);
process.exit(failed ? 1 : 0);
