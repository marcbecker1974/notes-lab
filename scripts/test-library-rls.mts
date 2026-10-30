// Two-account tests for the Wikipedia library (migration 20261030183957) and the add /
// refresh / remove logic on top of it.
//
//   npm run test:library-rls -- --dry-run   offline: checks configuration NAMES, lists the tests
//   npm run test:library-rls -- --run       runs against the linked Supabase project
//
// --run WRITES disposable pages titled "ZZ-LIB-<run>" with the two email/password test
// accounts and deletes them again at the end. Wikipedia and OpenRouter are never contacted:
// fetch is replaced for wikipedia.org (every other host, i.e. Supabase, passes through) and
// embeddings use the CHAT_TEST_STUB fake. Configuration is read at run time and never
// printed; only the publishable key is used.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "server-only"
      ? "next/dist/compiled/server-only/empty.js" : specifier, context);
  },
});

const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL", "TEST_USER_A_PASSWORD", "TEST_USER_B_EMAIL", "TEST_USER_B_PASSWORD",
] as const;
for (const file of [".env.local", ".env.test.local"]) {
  try { process.loadEnvFile(file); } catch { /* reported below, by name only */ }
}
const RUN = Date.now().toString(36);
const TITLE = `ZZ-LIB-${RUN}`;
const url = (suffix: string) => `https://en.wikipedia.org/wiki/${TITLE}${suffix}`;

type Res = { data: unknown; error: { code?: string } | null };
const code = (r: Res) => r.error?.code ?? "none";
const denied = (r: Res) => r.error !== null && ["42501", "PGRST301", "401", "403"].includes(code(r));
const rows = (r: Res) => { assert.equal(r.error, null, `unexpected error ${code(r)}`); return (r.data ?? []) as Record<string, unknown>[]; };

// One-hot vectors: a query equal to e(i) has similarity 1 with chunk i and 0 with the others.
const e = (i: number) => Array.from({ length: 1536 }, (_, j) => (j === i ? 1 : 0));

const tests: { name: string; fn: () => Promise<void> }[] = [];
const t = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const s = {} as { anon: SupabaseClient; a: SupabaseClient; b: SupabaseClient; aId: string; bId: string; pageA: number; pageB: number };
const mk = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string, { auth: { persistSession: false, autoRefreshToken: false } });
const docs = async (c: SupabaseClient, pageId: number) =>
  rows((await c.from("documents").select("chunk_index, content, user_id").eq("page_id", pageId).order("chunk_index")) as Res);
const pagesByUrl = async (c: SupabaseClient, u: string) =>
  rows((await c.from("pages").select("id, title, url, user_id, last_fetched_at").eq("url", u)) as Res);
const match = async (c: SupabaseClient, v: number[], threshold: number, count: number) =>
  rows((await c.rpc("match_documents", { query_embedding: JSON.stringify(v), match_threshold: threshold, match_count: count })) as Res);

// Loaded after the hooks and the environment are in place (dry run never needs them).
const lib = {} as {
  store: typeof import("../lib/library/library-store.ts");
  refresh: typeof import("../lib/library/refresh.ts");
  ingest: typeof import("../lib/library/ingest.ts");
  parse: typeof import("../lib/library/parse-input.ts");
};

// Fake Wikipedia: answers the API call for the title in the request.
let wiki: (title: string) => { title: string; extract: string; fullurl: string } | null = () => null;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const u = new URL(String(input));
  if (u.hostname.endsWith("wikipedia.org")) {
    const page = wiki(u.searchParams.get("titles") ?? "");
    return new Response(JSON.stringify({ query: { pages: [page ? { ns: 0, ...page } : { title: "x", missing: true }] } }));
  }
  if (u.hostname === "openrouter.ai") throw new Error("OpenRouter must not be contacted in this test");
  return realFetch(input, init);
}) as typeof fetch;

t("anonymous: no access to either table or to match_documents", async () => {
  for (const table of ["pages", "documents"]) {
    assert.ok(denied((await s.anon.from(table).select("id").limit(1)) as Res), `${table} read`);
  }
  assert.ok(denied((await s.anon.from("pages").insert({ title: TITLE, url: url("") })) as Res));
  assert.ok(denied((await s.anon.rpc("match_documents", { query_embedding: JSON.stringify(e(0)) })) as Res));
});
t("A saves a page with 3 chunks; the database sets the owner", async () => {
  const out = await lib.store.savePage(s.a, { title: TITLE, url: url("") }, ["alpha", "beta", "gamma"], [e(0), e(1), e(2)]);
  assert.equal(out.replaced, false);
  const [page] = await pagesByUrl(s.a, url(""));
  assert.equal(page.user_id, s.aId);
  s.pageA = page.id as number;
  const d = await docs(s.a, s.pageA);
  assert.deepEqual(d.map((x) => x.content), ["alpha", "beta", "gamma"]);
  assert.ok(d.every((x) => x.user_id === s.aId));
});
t("A cannot set user_id, id or created_at on a page, or the owner of a chunk", async () => {
  for (const extra of [{ user_id: s.bId }, { created_at: "2000-01-01" }]) {
    assert.ok(denied((await s.a.from("pages").insert({ title: TITLE, url: url("-x"), ...extra })) as Res), JSON.stringify(Object.keys(extra)));
  }
  assert.ok(denied((await s.a.from("documents").insert({ page_id: s.pageA, chunk_index: 9, content: "x", embedding: JSON.stringify(e(9)), user_id: s.bId })) as Res));
});
t("B cannot see A's page or chunks", async () => {
  assert.equal((await pagesByUrl(s.b, url(""))).length, 0);
  assert.equal((await docs(s.b, s.pageA)).length, 0);
});
t("B cannot add a chunk to A's page, change it, or delete it", async () => {
  const ins = (await s.b.from("documents").insert({ page_id: s.pageA, chunk_index: 7, content: `${TITLE} intruder`, embedding: JSON.stringify(e(7)) })) as Res;
  assert.ok(ins.error !== null, "insert into a foreign page must fail");
  const upd = (await s.b.from("pages").update({ title: "hijacked" }).eq("id", s.pageA).select("id")) as Res;
  assert.equal(rows(upd).length, 0, "no foreign page updated");
  assert.equal(rows((await s.b.from("pages").delete().eq("id", s.pageA).select("id")) as Res).length, 0);
  assert.equal(rows((await s.b.from("documents").delete().eq("page_id", s.pageA).select("id")) as Res).length, 0);
  assert.equal((await docs(s.a, s.pageA)).length, 3, "A's chunks are untouched");
  assert.equal((await pagesByUrl(s.a, url("")))[0].title, TITLE);
});
t("adding an existing link again refreshes it: one page, chunks replaced", async () => {
  const before = (await pagesByUrl(s.a, url("")))[0];
  const out = await lib.store.savePage(s.a, { title: `${TITLE} v2`, url: url("") }, ["new one", "new two"], [e(3), e(4)]);
  assert.equal(out.replaced, true);
  const after = await pagesByUrl(s.a, url(""));
  assert.equal(after.length, 1, "no duplicate page");
  assert.equal(after[0].id, before.id);
  assert.equal(after[0].title, `${TITLE} v2`);
  assert.ok(new Date(after[0].last_fetched_at as string) >= new Date(before.last_fetched_at as string));
  assert.deepEqual((await docs(s.a, s.pageA)).map((x) => x.content), ["new one", "new two"], "old chunks are gone");
});
t("adding the same article by title through the full flow does not duplicate it", async () => {
  wiki = () => ({ title: `${TITLE} flow`, extract: "First paragraph. ".repeat(80), fullurl: url("-flow") });
  const [entry] = lib.parse.parseEntries(`${TITLE}-flow`).entries;
  const first = await lib.ingest.addArticle(s.a, entry);
  const second = await lib.ingest.addArticle(s.a, entry);
  assert.equal(first.status, "saved", first.message);
  assert.equal(second.status, "updated", second.message);
  const pages = await pagesByUrl(s.a, url("-flow"));
  assert.equal(pages.length, 1);
  const n = (await docs(s.a, pages[0].id as number)).length;
  assert.ok(n >= 2, "the article is split into several chunks");
  // 1280 characters in, so chunk indices run 0..n-1 with no leftovers from the first save
  assert.deepEqual((await docs(s.a, pages[0].id as number)).map((x) => x.chunk_index), Array.from({ length: n }, (_, i) => i));
});
t("Refresh replaces the old chunks with the latest text", async () => {
  const [page] = await pagesByUrl(s.a, url("-flow"));
  wiki = () => ({ title: `${TITLE} flow`, extract: "Completely rewritten article.", fullurl: url("-flow") });
  const out = await lib.refresh.refreshArticle(s.a, page.id as number);
  assert.equal(out.status, "updated", out.message);
  assert.match(out.message, /^Refreshed 1 chunk/);
  assert.equal((await pagesByUrl(s.a, url("-flow"))).length, 1);
  assert.deepEqual((await docs(s.a, page.id as number)).map((x) => x.content), ["Completely rewritten article."]);
});
t("Refresh of a moved article keeps it once under the new link", async () => {
  const [page] = await pagesByUrl(s.a, url("-flow"));
  wiki = () => ({ title: `${TITLE} moved`, extract: "Moved article text.", fullurl: url("-moved") });
  const out = await lib.refresh.refreshArticle(s.a, page.id as number);
  assert.equal(out.status, "saved", out.message);
  assert.equal((await pagesByUrl(s.a, url("-flow"))).length, 0, "old link removed");
  assert.equal((await pagesByUrl(s.a, url("-moved"))).length, 1);
  assert.equal((await docs(s.a, page.id as number)).length, 0, "old chunks removed with the old page");
});
t("a failed refresh (page gone from Wikipedia) leaves the saved article intact", async () => {
  const [page] = await pagesByUrl(s.a, url("-moved"));
  const before = await docs(s.a, page.id as number);
  wiki = () => null;
  const out = await lib.refresh.refreshArticle(s.a, page.id as number);
  assert.equal(out.status, "missing");
  assert.deepEqual(await docs(s.a, page.id as number), before);
});
t("B cannot refresh or remove A's page through the same functions", async () => {
  const [page] = await pagesByUrl(s.a, url("-moved"));
  wiki = () => ({ title: `${TITLE} moved`, extract: "Intruder text.", fullurl: url("-moved") });
  const out = await lib.refresh.refreshArticle(s.b, page.id as number);
  assert.equal(out.status, "missing", "B does not see A's page");
  assert.equal(await lib.store.deletePage(s.b, page.id as number), false);
  assert.deepEqual((await docs(s.a, page.id as number)).map((x) => x.content), ["Moved article text."]);
});
t("B saves the same link independently (links are unique per user, not globally)", async () => {
  await lib.store.savePage(s.b, { title: `${TITLE} B`, url: url("") }, ["bravo"], [e(0)]);
  const [pageB] = await pagesByUrl(s.b, url(""));
  assert.equal(pageB.user_id, s.bId);
  s.pageB = pageB.id as number;
  assert.equal((await pagesByUrl(s.a, url(""))).length, 1, "A still sees only the own page");
  assert.notEqual(pageB.id, s.pageA);
});
t("match_documents returns only the caller's chunks, best first, with title and link", async () => {
  const forA = await match(s.a, e(3), -1, 10);
  assert.ok(forA.length >= 2 && forA.every((r) => r.page_id !== s.pageB));
  assert.ok(!forA.some((r) => r.content === "bravo"), "B's chunk never reaches A");
  assert.equal(forA[0].content, "new one");
  assert.equal(forA[0].page_title, `${TITLE} v2`);
  assert.equal(forA[0].page_url, url(""));
  assert.equal(forA[0].similarity, 1);
  const sims = forA.map((r) => r.similarity as number);
  assert.deepEqual(sims, [...sims].sort((x, y) => y - x), "ranked by similarity");
  const forB = await match(s.b, e(0), -1, 10);
  assert.deepEqual(forB.map((r) => r.content), ["bravo"]);
});
t("match_documents honours the threshold and the result limit", async () => {
  assert.deepEqual((await match(s.a, e(3), 0.5, 10)).map((r) => r.content), ["new one"]);
  assert.equal((await match(s.a, e(3), 1.01, 10)).length, 0);
  assert.equal((await match(s.a, e(3), -1, 1)).length, 1);
});
t("Remove deletes the page and all its chunks; B's page is untouched", async () => {
  const [page] = await pagesByUrl(s.a, url(""));
  assert.equal(await lib.store.deletePage(s.a, page.id as number), true);
  assert.equal((await pagesByUrl(s.a, url(""))).length, 0);
  assert.equal((await docs(s.a, page.id as number)).length, 0, "chunks went with the page");
  assert.equal(await lib.store.deletePage(s.a, page.id as number), false, "second remove finds nothing");
  assert.equal((await docs(s.b, s.pageB)).length, 1, "B's chunk remains");
});
t("cleanup: both users remove their remaining test pages", async () => {
  for (const c of [s.a, s.b]) {
    const left = rows((await c.from("pages").select("id").like("title", `${TITLE}%`)) as Res);
    for (const p of left) await lib.store.deletePage(c, p.id as number);
    assert.equal(rows((await c.from("pages").select("id").like("title", `${TITLE}%`)) as Res).length, 0);
  }
  assert.equal(rows((await s.a.from("documents").select("id").like("content", `${TITLE}%`)) as Res).length, 0);
});

const args = new Set(process.argv.slice(2));
const missing = NEEDED.filter((k) => !process.env[k]);
if (args.has("--dry-run")) {
  console.log("test:library-rls dry run (offline: nothing is read from or written to the database)");
  for (const k of NEEDED) console.log(`  ${process.env[k] ? "set    " : "MISSING"} ${k}`);
  console.log(`\n${tests.length} tests would run (disposable rows are titled ZZ-LIB-…):`);
  tests.forEach((x, i) => console.log(`  ${i + 1}. ${x.name}`));
  process.exit(missing.length ? 1 : 0);
}
if (!args.has("--run")) { console.error("Usage: npm run test:library-rls -- --dry-run | --run"); process.exit(2); }
if (missing.length) { console.error(`Missing configuration (names only): ${missing.join(", ")}`); process.exit(1); }

process.env.CHAT_TEST_STUB = "1"; // fake embeddings: no key, no network
lib.store = await import("../lib/library/library-store.ts");
lib.refresh = await import("../lib/library/refresh.ts");
lib.ingest = await import("../lib/library/ingest.ts");
lib.parse = await import("../lib/library/parse-input.ts");

s.anon = mk(); s.a = mk(); s.b = mk();
const signIn = async (c: SupabaseClient, who: "A" | "B") => {
  const r = await c.auth.signInWithPassword({ email: process.env[`TEST_USER_${who}_EMAIL`] as string, password: process.env[`TEST_USER_${who}_PASSWORD`] as string });
  assert.equal(r.error, null, `sign-in ${who} failed`);
  return r.data.user!.id;
};
s.aId = await signIn(s.a, "A"); s.bId = await signIn(s.b, "B");
let failed = 0;
for (const x of tests) {
  try { await x.fn(); console.log(`ok   ${x.name}`); }
  catch (err) { failed++; console.error(`FAIL ${x.name}: ${(err as Error).message}`); }
}
if (failed) {
  // A failed run must not leave its rows behind (chunks go with their pages by cascade).
  for (const c of [s.a, s.b]) await c.from("pages").delete().like("title", `${TITLE}%`);
}
console.log(`\n${tests.length - failed}/${tests.length} passed.`);
process.exit(failed ? 1 : 0);
