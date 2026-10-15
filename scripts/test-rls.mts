// Two-account isolation tests for the secure RLS migration (Sprint 2, Feature 7).
//
//   npm run test:rls -- --dry-run   offline: checks the configuration NAMES and lists the tests
//   npm run test:rls -- --run       runs against the linked Supabase project (see below)
//
// --run WRITES disposable rows (prefix "ZZ-F7-") through the public API with the two
// email/password test accounts, and deletes them again. Run it only AFTER the owner-access
// migration has been applied and the owner has approved the run. It refuses to write
// anything unless the anonymous role has first been shown to be locked out.
//
// Configuration, read at run time and never printed:
//   .env.local       NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (existing)
//   .env.test.local  TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL,
//                    TEST_USER_B_PASSWORD (git-ignored; only the publishable key is used,
//                    never a service-role or secret key)
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
] as const;
const SHARED_TAG = "zz-f7-shared"; // reused across runs: tags cannot be deleted by clients
const RUN = Date.now().toString(36);
const PREFIX = `ZZ-F7-${RUN}`;

for (const file of [".env.local", ".env.test.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // a missing file is reported below, by variable name only
  }
}

type Res = {
  data: unknown;
  error: { code?: string; message?: string } | null;
  status?: number;
};
type User = { name: "A" | "B"; client: SupabaseClient; id: string };
type Ids = { notes: number[]; collections: number[]; tag?: number };

const S = {
  anon: undefined as unknown as SupabaseClient,
  A: undefined as unknown as User,
  B: undefined as unknown as User,
  ids: {
    A: { notes: [], collections: [] } as Ids,
    B: { notes: [], collections: [] } as Ids,
  },
  // A's and B's fixtures (ids)
  a: { note: 0, collection: 0, tag: 0 },
  b: { note: 0, collection: 0, tag: 0 },
};

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const key = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;
const newClient = () =>
  createClient(url(), key(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

// Permission and RLS failures come back as 42501 (HTTP 401 or 403).
const denied = (r: Res) =>
  r.error !== null &&
  (r.error.code === "42501" || r.status === 401 || r.status === 403);
const code = (r: Res) => r.error?.code ?? (r.error ? "error" : "none");
// A protected-field attempt must be refused. Permission and RLS failures come back as 42501
// (HTTP 401 or 403). Writing an explicit value to the GENERATED ALWAYS identity column "id"
// is refused earlier, while the statement is analysed, with 428C9 (it never reaches the
// privilege check). That code is accepted ONLY for cases marked `identity`; any other error,
// and success, is a failure.
const IDENTITY_REFUSAL = "428C9";
const refused = (r: Res, identity: boolean) =>
  denied(r) ||
  (identity && r.error !== null && r.error.code === IDENTITY_REFUSAL);
const rows = (r: Res): Record<string, unknown>[] => {
  assert.equal(r.error, null, `unexpected error ${code(r)}`);
  return (r.data ?? []) as Record<string, unknown>[];
};
const one = (r: Res) => {
  const list = Array.isArray(r.data)
    ? (r.data as Record<string, unknown>[])
    : [r.data as Record<string, unknown>];
  assert.equal(r.error, null, `unexpected error ${code(r)}`);
  assert.ok(list[0], "no row returned");
  return list[0];
};
const noRows = (r: Res, what: string) => {
  assert.equal(r.error, null, `${what}: unexpected error ${code(r)}`);
  assert.deepEqual(r.data ?? [], [], `${what}: expected zero rows`);
};

const NOTE_COLS =
  "id, title, body, collection_id, user_id, created_at, updated_at";
const tests: { name: string; fn: () => Promise<void> }[] = [];
const t = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

async function makeFixtures(u: User, ids: Ids, label: "a" | "b") {
  const c = one(
    await u.client
      .from("collections")
      .insert({ name: `${PREFIX}-${u.name}`, color: "blue" })
      .select("id, user_id")
      .single(),
  );
  assert.equal(c.user_id, u.id, "the database sets the owner");
  ids.collections.push(c.id as number);
  const found = rows(
    await u.client.from("tags").select("id").eq("name", SHARED_TAG),
  );
  const tag =
    found[0] ??
    one(
      await u.client
        .from("tags")
        .insert({ name: SHARED_TAG, color: "teal" })
        .select("id")
        .single(),
    );
  const n = one(
    await u.client
      .from("notes")
      .insert({
        title: `${PREFIX}-${u.name}`,
        body: "disposable",
        collection_id: c.id,
      })
      .select(NOTE_COLS)
      .single(),
  );
  assert.equal(n.user_id, u.id, "the database sets the owner");
  ids.notes.push(n.id as number);
  one(
    await u.client
      .from("note_tags")
      .upsert(
        { note_id: n.id, tag_id: tag.id },
        { onConflict: "note_id,tag_id", ignoreDuplicates: true },
      )
      .select("note_id"),
  );
  S[label] = {
    note: n.id as number,
    collection: c.id as number,
    tag: tag.id as number,
  };
  ids.tag = tag.id as number;
}

// ---- anonymous access is denied ------------------------------------------------------------
t("anonymous: reading any of the four tables is denied", async () => {
  for (const table of ["notes", "collections", "tags", "note_tags"]) {
    const r = (await S.anon.from(table).select("*").limit(1)) as Res;
    assert.ok(denied(r), `${table}: expected denial, got ${code(r)}`);
  }
});
t("a signed-in client that signs out loses access", async () => {
  const c = newClient();
  const s = await c.auth.signInWithPassword({
    email: process.env.TEST_USER_A_EMAIL as string,
    password: process.env.TEST_USER_A_PASSWORD as string,
  });
  assert.equal(s.error, null, "sign-in failed");
  rows((await c.from("notes").select("id").limit(1)) as Res);
  await c.auth.signOut({ scope: "local" }); // local: do not revoke the other session of the same account
  const r = (await c.from("notes").select("id").limit(1)) as Res;
  assert.ok(denied(r), `expected denial after sign-out, got ${code(r)}`);
});

// ---- CRUD for authenticated users, and what each user sees ----------------------------------
t(
  "A: creates a collection, a tag, a note and a link; reads them back",
  async () => {
    await makeFixtures(S.A, S.ids.A, "a");
    const n = one(
      await S.A.client
        .from("notes")
        .select(NOTE_COLS)
        .eq("id", S.a.note)
        .single(),
    );
    assert.equal(n.collection_id, S.a.collection);
    assert.equal(
      rows(
        await S.A.client
          .from("note_tags")
          .select("note_id, tag_id")
          .eq("note_id", S.a.note),
      ).length,
      1,
    );
  },
);
t(
  "B: creates its own rows, including a tag with the same name as A's",
  async () => {
    await makeFixtures(S.B, S.ids.B, "b");
    assert.notEqual(S.b.tag, S.a.tag, "the same tag name exists once per user");
  },
);
t("anonymous: insert, update and delete are denied", async () => {
  const w = [
    (await S.anon.from("notes").insert({ title: `${PREFIX}-anon` })) as Res,
    (await S.anon
      .from("collections")
      .insert({ name: `${PREFIX}-anon` })) as Res,
    (await S.anon.from("tags").insert({ name: `${PREFIX}-anon` })) as Res,
    (await S.anon.from("note_tags").insert({ note_id: 1, tag_id: 1 })) as Res,
    (await S.anon
      .from("notes")
      .update({ title: "x" })
      .eq("id", S.a.note)) as Res,
    (await S.anon.from("notes").delete().eq("id", S.a.note)) as Res,
  ];
  w.forEach((r, i) =>
    assert.ok(denied(r), `write ${i}: expected denial, got ${code(r)}`),
  );
});
t("each user sees only their own rows", async () => {
  for (const [me, other, mine, theirs] of [
    [S.A, S.B, S.a, S.b],
    [S.B, S.A, S.b, S.a],
  ] as const) {
    const notes = rows(await me.client.from("notes").select("id, user_id"));
    assert.ok(
      notes.length >= 1 && notes.every((n) => n.user_id === me.id),
      `${me.name}: foreign note visible`,
    );
    assert.ok(!notes.some((n) => n.id === theirs.note));
    const cols = rows(
      await me.client.from("collections").select("id, user_id"),
    );
    assert.ok(
      cols.every((c) => c.user_id === me.id) &&
        !cols.some((c) => c.id === theirs.collection),
    );
    const tags = rows(await me.client.from("tags").select("id, user_id"));
    assert.ok(
      tags.every((g) => g.user_id === me.id) &&
        !tags.some((g) => g.id === theirs.tag),
    );
    const links = rows(
      await me.client.from("note_tags").select("note_id, tag_id"),
    );
    assert.ok(
      links.every((l) => l.note_id === mine.note) &&
        !links.some((l) => l.note_id === theirs.note),
    );
    void other;
  }
});
t("B cannot read A's rows by id", async () => {
  noRows(
    (await S.B.client.from("notes").select("id").eq("id", S.a.note)) as Res,
    "note",
  );
  noRows(
    (await S.B.client
      .from("collections")
      .select("id")
      .eq("id", S.a.collection)) as Res,
    "collection",
  );
  noRows(
    (await S.B.client.from("tags").select("id").eq("id", S.a.tag)) as Res,
    "tag",
  );
  noRows(
    (await S.B.client
      .from("note_tags")
      .select("note_id")
      .eq("note_id", S.a.note)) as Res,
    "link",
  );
});
t(
  "B cannot update A's note, collection or tag (zero rows); A's data is unchanged",
  async () => {
    noRows(
      (await S.B.client
        .from("notes")
        .update({ title: "hijacked" })
        .eq("id", S.a.note)
        .select("id")) as Res,
      "note update",
    );
    noRows(
      (await S.B.client
        .from("collections")
        .update({ color: "red" })
        .eq("id", S.a.collection)
        .select("id")) as Res,
      "collection update",
    );
    noRows(
      (await S.B.client
        .from("tags")
        .update({ color: "red" })
        .eq("id", S.a.tag)
        .select("id")) as Res,
      "tag update",
    );
    const n = one(
      await S.A.client
        .from("notes")
        .select("title")
        .eq("id", S.a.note)
        .single(),
    );
    assert.equal(n.title, `${PREFIX}-A`);
    const c = one(
      await S.A.client
        .from("collections")
        .select("color")
        .eq("id", S.a.collection)
        .single(),
    );
    assert.equal(c.color, "blue");
  },
);
t(
  "B cannot delete A's note, collection or link (zero rows); A's data is intact",
  async () => {
    noRows(
      (await S.B.client
        .from("notes")
        .delete()
        .eq("id", S.a.note)
        .select("id")) as Res,
      "note delete",
    );
    noRows(
      (await S.B.client
        .from("collections")
        .delete()
        .eq("id", S.a.collection)
        .select("id")) as Res,
      "collection delete",
    );
    noRows(
      (await S.B.client
        .from("note_tags")
        .delete()
        .eq("note_id", S.a.note)
        .select("note_id")) as Res,
      "link delete",
    );
    assert.equal(
      rows(await S.A.client.from("notes").select("id").eq("id", S.a.note))
        .length,
      1,
    );
    assert.equal(
      rows(
        await S.A.client
          .from("collections")
          .select("id")
          .eq("id", S.a.collection),
      ).length,
      1,
    );
    assert.equal(
      rows(
        await S.A.client
          .from("note_tags")
          .select("note_id")
          .eq("note_id", S.a.note),
      ).length,
      1,
    );
  },
);

// ---- cross-user references and ownership manipulation ---------------------------------------
t(
  "cross-user references are rejected (collection and note-tag links)",
  async () => {
    const x = [
      (await S.B.client.from("notes").insert({
        title: `${PREFIX}-xref`,
        collection_id: S.a.collection,
      })) as Res,
      (await S.B.client
        .from("notes")
        .update({ collection_id: S.a.collection })
        .eq("id", S.b.note)
        .select("id")) as Res,
      (await S.B.client
        .from("note_tags")
        .insert({ note_id: S.b.note, tag_id: S.a.tag })) as Res,
      (await S.B.client
        .from("note_tags")
        .insert({ note_id: S.a.note, tag_id: S.b.tag })) as Res,
      (await S.B.client
        .from("note_tags")
        .insert({ note_id: S.a.note, tag_id: S.a.tag })) as Res,
      (await S.A.client
        .from("note_tags")
        .insert({ note_id: S.a.note, tag_id: S.b.tag })) as Res,
      (await S.A.client
        .from("notes")
        .update({ collection_id: S.b.collection })
        .eq("id", S.a.note)
        .select("id")) as Res,
    ];
    x.forEach((r, i) =>
      assert.ok(denied(r), `reference ${i}: expected denial, got ${code(r)}`),
    );
    const n = one(
      await S.B.client
        .from("notes")
        .select("collection_id")
        .eq("id", S.b.note)
        .single(),
    );
    assert.equal(
      n.collection_id,
      S.b.collection,
      "B's note still points to B's collection",
    );
  },
);
t(
  "ownership and system-managed fields cannot be written by clients",
  async () => {
    type Case = {
      label: string;
      table: string;
      op: "insert" | "update";
      payload: Record<string, unknown>;
      id?: number; // the row an update targets
      identity?: boolean; // writes to the GENERATED ALWAYS "id" column
    };
    const old = "2000-01-01T00:00:00Z";
    const ins = (
      table: string,
      base: Record<string, unknown>,
      field: string,
      value: unknown,
    ): Case => ({
      label: `insert ${table}.${field}`,
      table,
      op: "insert",
      payload: { ...base, [field]: value },
      identity: field === "id",
    });
    const upd = (
      table: string,
      id: number,
      field: string,
      value: unknown,
    ): Case => ({
      label: `update ${table}.${field}`,
      table,
      op: "update",
      id,
      payload: { [field]: value },
      identity: field === "id",
    });
    const nb = { title: `${PREFIX}-own` };
    const cb = { name: `${PREFIX}-own` };
    const cases: Case[] = [
      ins("notes", nb, "user_id", S.B.id),
      ins("notes", nb, "id", 2147480000),
      ins("notes", nb, "created_at", old),
      ins("notes", nb, "updated_at", old),
      ins("collections", cb, "user_id", S.B.id),
      ins("collections", cb, "id", 2147480000),
      ins("collections", cb, "created_at", old),
      ins("tags", cb, "user_id", S.B.id),
      ins("tags", cb, "id", 2147480000),
      ins("tags", cb, "created_at", old),
      upd("notes", S.a.note, "user_id", S.B.id),
      upd("notes", S.a.note, "id", 2147480001),
      upd("notes", S.a.note, "created_at", old),
      upd("notes", S.a.note, "updated_at", old),
      upd("collections", S.a.collection, "user_id", S.B.id),
      upd("collections", S.a.collection, "id", 2147480001),
      upd("collections", S.a.collection, "name", `${PREFIX}-renamed`),
      upd("collections", S.a.collection, "created_at", old),
      upd("tags", S.a.tag, "user_id", S.B.id),
      upd("tags", S.a.tag, "id", 2147480001),
      upd("tags", S.a.tag, "name", `${PREFIX}-renamed`),
      upd("tags", S.a.tag, "created_at", old),
    ];
    // Every attempt is evaluated on its own: one unexpected result never hides the others.
    const failures: string[] = [];
    for (const c of cases) {
      let r: Res;
      try {
        r =
          c.op === "insert"
            ? ((await S.A.client
                .from(c.table)
                .insert(c.payload)
                .select("id")) as Res)
            : ((await S.A.client
                .from(c.table)
                .update(c.payload)
                .eq("id", c.id as number)
                .select("id")) as Res);
      } catch {
        failures.push(`${c.label}: request failed`);
        console.error(`     case FAIL ${c.label}: request failed`);
        continue;
      }
      const ok = refused(r, c.identity === true);
      if (!ok) failures.push(`${c.label}: got ${code(r)}`);
      console.log(
        `     case ${ok ? "ok  " : "FAIL"} ${c.label}: ${ok ? `refused (${code(r)})` : `NOT refused (${code(r)})`}`,
      );
    }
    // Nothing the attempts could have written may exist, and A's note is unchanged.
    for (const [table, column] of [
      ["notes", "title"],
      ["collections", "name"],
      ["tags", "name"],
    ] as const) {
      const made = rows(
        await S.A.client
          .from(table)
          .select("id")
          .like(column, `${PREFIX}-own%`),
      );
      if (made.length)
        failures.push(`${table}: ${made.length} probe row(s) were created`);
    }
    const n = one(
      await S.A.client
        .from("notes")
        .select("user_id, id")
        .eq("id", S.a.note)
        .single(),
    );
    if (!(n.user_id === S.A.id && n.id === S.a.note))
      failures.push("A's note changed ownership or id");
    assert.equal(
      failures.length,
      0,
      `${failures.length} of ${cases.length} case(s) failed: ${failures.join("; ")}`,
    );
  },
);
t(
  "tags cannot be deleted by clients (no DELETE grant, by design)",
  async () => {
    const r = (await S.A.client
      .from("tags")
      .delete()
      .eq("id", S.a.tag)
      .select("id")) as Res;
    assert.ok(denied(r), `expected denial, got ${code(r)}`);
  },
);

// ---- existing behaviour still works under RLS -------------------------------------------------
t(
  "duplicate names are rejected per user; the same name is allowed for two users",
  async () => {
    const dup = (await S.A.client
      .from("collections")
      .insert({ name: ` ${PREFIX}-a `.toUpperCase(), color: "blue" })) as Res;
    assert.equal(dup.error?.code, "23505", `expected 23505, got ${code(dup)}`);
    const dupTag = (await S.A.client
      .from("tags")
      .insert({ name: SHARED_TAG.toUpperCase(), color: "teal" })) as Res;
    assert.equal(
      dupTag.error?.code,
      "23505",
      `expected 23505, got ${code(dupTag)}`,
    );
  },
);
t("check constraints still apply (invalid colour, empty title)", async () => {
  const c = (await S.A.client
    .from("collections")
    .update({ color: "not-a-colour" })
    .eq("id", S.a.collection)
    .select("id")) as Res;
  assert.equal(c.error?.code, "23514", `expected 23514, got ${code(c)}`);
  const n = (await S.A.client
    .from("notes")
    .insert({ title: "   ", body: "x" })) as Res;
  assert.equal(n.error?.code, "23514", `expected 23514, got ${code(n)}`);
});
t(
  "notes: update works, updated_at advances (trigger), colours can be changed",
  async () => {
    const before = one(
      await S.A.client
        .from("notes")
        .select("updated_at")
        .eq("id", S.a.note)
        .single(),
    );
    await new Promise((r) => setTimeout(r, 1100));
    const after = one(
      await S.A.client
        .from("notes")
        .update({ title: `${PREFIX}-A`, body: "edited" })
        .eq("id", S.a.note)
        .select("title, body, updated_at")
        .single(),
    );
    assert.equal(after.body, "edited");
    assert.ok(
      new Date(after.updated_at as string) >
        new Date(before.updated_at as string),
      "updated_at advanced",
    );
    one(
      await S.A.client
        .from("collections")
        .update({ color: "green" })
        .eq("id", S.a.collection)
        .select("id")
        .single(),
    );
    one(
      await S.A.client
        .from("tags")
        .update({ color: "teal" })
        .eq("id", S.a.tag)
        .select("id")
        .single(),
    );
  },
);
t(
  "note-tag upsert (ignore duplicates) works twice; a link can be removed and re-added",
  async () => {
    const link = { note_id: S.a.note, tag_id: S.a.tag };
    for (let i = 0; i < 2; i++) {
      const r = (await S.A.client.from("note_tags").upsert(link, {
        onConflict: "note_id,tag_id",
        ignoreDuplicates: true,
      })) as Res;
      assert.equal(r.error, null, `upsert ${i}: ${code(r)}`);
    }
    assert.equal(
      rows(
        await S.A.client
          .from("note_tags")
          .select("note_id")
          .eq("note_id", S.a.note),
      ).length,
      1,
    );
    rows(
      (await S.A.client
        .from("note_tags")
        .delete()
        .eq("note_id", S.a.note)
        .eq("tag_id", S.a.tag)
        .select("note_id")) as Res,
    );
    assert.equal(
      rows(
        await S.A.client
          .from("note_tags")
          .select("note_id")
          .eq("note_id", S.a.note),
      ).length,
      0,
    );
    one(
      await S.A.client
        .from("note_tags")
        .insert(link)
        .select("note_id")
        .single(),
    );
  },
);
t(
  "deleting a collection keeps its note (unassigned, still owned); deleting a note removes its links",
  async () => {
    const c = one(
      await S.A.client
        .from("collections")
        .insert({ name: `${PREFIX}-A2`, color: "pink" })
        .select("id")
        .single(),
    );
    S.ids.A.collections.push(c.id as number);
    const n = one(
      await S.A.client
        .from("notes")
        .insert({ title: `${PREFIX}-A2`, body: "", collection_id: c.id })
        .select("id")
        .single(),
    );
    S.ids.A.notes.push(n.id as number);
    one(
      await S.A.client
        .from("note_tags")
        .insert({ note_id: n.id, tag_id: S.a.tag })
        .select("note_id")
        .single(),
    );
    one(
      await S.A.client
        .from("collections")
        .delete()
        .eq("id", c.id)
        .select("id")
        .single(),
    );
    const kept = one(
      await S.A.client
        .from("notes")
        .select("collection_id, user_id")
        .eq("id", n.id)
        .single(),
    );
    assert.ok(
      kept.collection_id === null && kept.user_id === S.A.id,
      "the note is unassigned and still owned by A",
    );
    one(
      await S.A.client
        .from("notes")
        .delete()
        .eq("id", n.id)
        .select("id")
        .single(),
    );
    assert.equal(
      rows(
        await S.A.client
          .from("note_tags")
          .select("note_id")
          .eq("note_id", n.id),
      ).length,
      0,
    );
  },
);
t(
  "data persists: a fresh sign-in (a reload at API level) sees the same rows",
  async () => {
    const c = newClient();
    const s = await c.auth.signInWithPassword({
      email: process.env.TEST_USER_A_EMAIL as string,
      password: process.env.TEST_USER_A_PASSWORD as string,
    });
    assert.equal(s.error, null, "sign-in failed");
    const n = one(
      await c
        .from("notes")
        .select("title, body, collection_id")
        .eq("id", S.a.note)
        .single(),
    );
    assert.deepEqual(
      [n.title, n.body, n.collection_id],
      [`${PREFIX}-A`, "edited", S.a.collection],
    );
    await c.auth.signOut({ scope: "local" }); // local: do not revoke the other session of the same account
  },
);

// ---- runner -----------------------------------------------------------------------------------
const args = new Set(process.argv.slice(2));
const missing = NEEDED.filter((k) => !process.env[k]);

if (args.has("--dry-run")) {
  console.log(
    "test:rls dry run (offline: no network, nothing is read from or written to the database)",
  );
  console.log(
    `configuration: ${NEEDED.length - missing.length}/${NEEDED.length} variables set`,
  );
  for (const k of NEEDED)
    console.log(`  ${process.env[k] ? "set    " : "MISSING"} ${k}`);
  console.log(
    `\n${tests.length} tests would run (disposable rows are prefixed ZZ-F7-):`,
  );
  tests.forEach((x, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${x.name}`),
  );
  process.exit(missing.length ? 1 : 0);
}
if (!args.has("--run")) {
  console.error(
    "Usage: npm run test:rls -- --dry-run | --run   (--run writes disposable rows; see the file header)",
  );
  process.exit(2);
}
if (missing.length) {
  console.error(`Missing configuration (names only): ${missing.join(", ")}`);
  process.exit(1);
}

let failed = 0;
async function cleanup() {
  for (const u of [S.A, S.B]) {
    if (!u) continue;
    const ids = S.ids[u.name];
    for (const [table, list] of [
      ["notes", ids.notes],
      ["collections", ids.collections],
    ] as const) {
      if (!list.length) continue;
      const r = (await u.client
        .from(table)
        .delete()
        .in("id", list)
        .select("id")) as Res;
      if (r.error) {
        failed++;
        console.error(
          `CLEANUP ${u.name} ${table}: ${code(r)}; leftover ids ${list.join(",")}`,
        );
      }
    }
    // Sweep: a test that expected a denial would otherwise leave its row behind if a
    // policy or grant were broken. Delete anything of this run by its prefix.
    for (const [table, column] of [
      ["notes", "title"],
      ["collections", "name"],
    ] as const) {
      const r = (await u.client
        .from(table)
        .delete()
        .like(column, `${PREFIX}%`)
        .select("id")) as Res;
      if (r.error) {
        failed++;
        console.error(`CLEANUP SWEEP ${u.name} ${table}: ${code(r)}`);
      } else if ((r.data as unknown[]).length) {
        console.error(
          `NOTE: sweep removed ${(r.data as unknown[]).length} untracked ${table} row(s) of this run for account ${u.name}`,
        );
      }
    }
  }
  // Clients cannot delete tags, so report exactly what is left (ids only; never credentials).
  if (S.A && S.B) {
    for (const u of [S.A, S.B]) {
      const keep = (await u.client
        .from("tags")
        .select("id")
        .eq("name", SHARED_TAG)) as Res;
      const odd = (await u.client
        .from("tags")
        .select("id")
        .like("name", `${PREFIX}%`)) as Res;
      const ids = (keep.data ?? []) as { id: number }[];
      const stray = (odd.data ?? []) as { id: number }[];
      console.log(
        `leftover by design, account ${u.name}: tag "${SHARED_TAG}" ids [${ids.map((x) => x.id).join(", ")}] (clients cannot delete tags)`,
      );
      if (stray.length) {
        failed++;
        console.error(
          `UNEXPECTED leftover tag(s) of this run for account ${u.name}: ids [${stray.map((x) => x.id).join(", ")}]`,
        );
      }
    }
  }
}

try {
  S.anon = newClient();
  // Safety gate 1: refuse to write anything while the database is still open to anon.
  const gate = (await S.anon.from("notes").select("id").limit(1)) as Res;
  if (!denied(gate)) {
    console.error(
      "ABORT: the anonymous role can still read notes (the owner-access migration has not been applied). Nothing was written.",
    );
    process.exit(3);
  }
  // Safety gate 2: both accounts must sign in before anything is written.
  for (const [name, mail, pass] of [
    ["A", "TEST_USER_A_EMAIL", "TEST_USER_A_PASSWORD"],
    ["B", "TEST_USER_B_EMAIL", "TEST_USER_B_PASSWORD"],
  ] as const) {
    const client = newClient();
    const s = await client.auth.signInWithPassword({
      email: process.env[mail] as string,
      password: process.env[pass] as string,
    });
    if (s.error || !s.data.user) {
      console.error(
        `ABORT: account ${name} could not sign in (${s.error?.code ?? "no user"}). Nothing was written.`,
      );
      process.exit(3);
    }
    S[name] = { name, client, id: s.data.user.id };
  }
  assert.notEqual(S.A.id, S.B.id, "the two accounts must be different users");
  console.log(
    `target: linked Supabase project (host not shown); run id ${RUN}; both accounts signed in\n`,
  );

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok   ${name}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${name}\n     ${(e as Error).message}`);
    }
  }
} finally {
  await cleanup();
}

if (failed) {
  console.error(`\n${failed} problem(s)`);
  process.exit(1);
}
console.log("\nall RLS isolation tests passed");
