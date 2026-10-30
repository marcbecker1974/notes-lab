// Lightweight tests for the auth redirect logic. Run: npm run test:auth
// (Node strips the TypeScript types; no test framework needed.)
import assert from "node:assert/strict";
import {
  POST_LOGIN_PATH,
  handleOAuthCallback,
  resolveOAuthCallback,
} from "../lib/auth/oauth-callback.ts";
import { authErrorMessage } from "../lib/auth/messages.ts";
import { canonicalLocalUrl } from "../lib/auth/dev-origin.ts";
import {
  authEventAction,
  createLatestGate,
  identityAfterCheck,
} from "../lib/auth/latest.ts";
import { existsSync, readFileSync } from "node:fs";
import { markdownFilename, noteToMarkdown } from "../lib/note-markdown.ts";
import {
  LOGIN_PATH,
  hasVerifiedUser,
  isPublicPath,
} from "../lib/auth/protected-routes.ts";
import {
  createSessionLossGate,
  isSessionLossKind,
} from "../lib/auth/session-loss.ts";
import {
  PASSWORD_UPDATE_PATH,
  confirmRedirectPath,
  safeRedirectPath,
} from "../lib/auth/redirect.ts";

const ORIGIN = "http://127.0.0.1:3000";
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${name}\n     ${(e as Error).message}`);
  }
}

// --- safeRedirectPath ---------------------------------------------------
for (const good of ["/protected", "/notes?x=1#a", "/"]) {
  await test(`allows ${good}`, () =>
    assert.equal(safeRedirectPath(good, "/fb"), good));
}
const unsafe: [string, string | null | undefined][] = [
  ["absolute external URL", "https://evil.example/x"],
  ["absolute same-host URL (must be a path)", `${ORIGIN}/protected`],
  ["protocol-relative", "//evil.example"],
  ["protocol-relative with path", "//evil.example/protected"],
  ["backslash after slash", "/\\evil.example"],
  ["double backslash", "\\\\evil.example"],
  ["leading backslash", "\\evil.example"],
  ["slash-tab-slash", "/\t/evil.example"],
  ["slash-newline-slash", "/\n/evil.example"],
  ["dot-segment to protocol-relative", "/.//evil.example"],
  ["dot-dot-segment to protocol-relative", "/..//evil.example"],
  ["nested dot-dot-segment", "/a/..//evil.example"],
  ["encoded dot-dot-segment", "/%2e%2e//evil.example"],
  ["mixed encoded dot-segment", "/.%2e//evil.example"],
  ["javascript: scheme", "javascript:alert(1)"],
  ["relative path without slash", "protected"],
  ["empty", ""],
  ["null", null],
  ["undefined", undefined],
];
for (const [name, value] of unsafe) {
  await test(`rejects ${name}`, () =>
    assert.equal(safeRedirectPath(value, "/fb"), "/fb"));
}
await test("every accepted value is a single-slash path on our origin", () => {
  for (const v of [
    "/%5Cevil.example",
    "/a/../b",
    "/./x",
    "/protected?next=//x",
  ]) {
    const out = safeRedirectPath(v, "/fb");
    assert.ok(out.startsWith("/") && !out.startsWith("//"), `${v} -> ${out}`);
    assert.equal(new URL(out, ORIGIN).origin, ORIGIN);
  }
});

await test("post-login destination is /notes, not /protected", () =>
  assert.equal(POST_LOGIN_PATH, "/notes"));
await test("/auth/confirm-style fallback: absolute or foreign next -> /notes", () => {
  for (const bad of [
    `${ORIGIN}/auth/callback`,
    "//evil.example",
    "https://evil.example",
    null,
  ])
    assert.equal(safeRedirectPath(bad, POST_LOGIN_PATH), "/notes");
});

// --- resolveOAuthCallback -----------------------------------------------
const cb = (qs: string) => new URL(`${ORIGIN}/auth/callback${qs}`);
const ok = async () => ({ error: null });

await test("valid code -> /notes and code is exchanged", async () => {
  let seen = "";
  const path = await resolveOAuthCallback(cb("?code=abc"), async (c) => {
    seen = c;
    return { error: null };
  });
  assert.equal(path, "/notes");
  assert.equal(seen, "abc");
});
await test("ignores a ?next= parameter (fixed destination)", async () => {
  assert.equal(
    await resolveOAuthCallback(cb("?code=abc&next=https://evil.example"), ok),
    "/notes",
  );
});
await test("missing code -> oauth_missing_code, no exchange", async () => {
  let called = false;
  const path = await resolveOAuthCallback(cb(""), async () => {
    called = true;
    return { error: null };
  });
  assert.equal(path, "/auth/login?error=oauth_missing_code");
  assert.equal(called, false);
});
await test("empty code -> oauth_missing_code", async () =>
  assert.equal(
    await resolveOAuthCallback(cb("?code="), ok),
    "/auth/login?error=oauth_missing_code",
  ));
await test("invalid code (exchange error) -> oauth_failed", async () =>
  assert.equal(
    await resolveOAuthCallback(cb("?code=bad"), async () => ({
      error: new Error("invalid grant"),
    })),
    "/auth/login?error=oauth_failed",
  ));
await test("exchange throws -> oauth_failed", async () =>
  assert.equal(
    await resolveOAuthCallback(cb("?code=x"), async () => {
      throw new Error("network");
    }),
    "/auth/login?error=oauth_failed",
  ));
await test("provider access_denied -> oauth_cancelled, no exchange", async () => {
  let called = false;
  const path = await resolveOAuthCallback(
    cb(
      "?error=access_denied&error_code=unexpected_failure&error_description=x",
    ),
    async () => {
      called = true;
      return { error: null };
    },
  );
  assert.equal(path, "/auth/login?error=oauth_cancelled");
  assert.equal(called, false);
});
await test("other provider error -> oauth_failed, raw text not echoed", async () => {
  const path = await resolveOAuthCallback(
    cb("?error=server_error&error_description=<script>alert(1)</script>"),
    ok,
  );
  assert.equal(path, "/auth/login?error=oauth_failed");
});
await test("provider error wins over a present code", async () =>
  assert.equal(
    await resolveOAuthCallback(cb("?code=abc&error=access_denied"), ok),
    "/auth/login?error=oauth_cancelled",
  ));

// --- handleOAuthCallback (what the route returns) -----------------------
// Simulates a browser that already has a session (e.g. email/password): the
// exchange stub never looks at it, and a failed exchange must stay a failure.
const loc = (r: Response) => `${r.status} ${r.headers.get("location")}`;
await test("success -> 307 /notes (relative Location)", async () =>
  assert.equal(
    loc(await handleOAuthCallback(cb("?code=abc"), ok)),
    "307 /notes",
  ));
await test("replayed/used code with an existing session is NOT a success", async () => {
  const used = async () => ({ error: new Error("code already used") });
  assert.equal(
    loc(await handleOAuthCallback(cb("?code=used"), used)),
    "307 /auth/login?error=oauth_failed",
  );
});
await test("garbage code with an existing session is NOT a success", async () =>
  assert.equal(
    loc(
      await handleOAuthCallback(cb("?code=x"), async () => ({
        error: new Error("bad"),
      })),
    ),
    "307 /auth/login?error=oauth_failed",
  ));
await test("provider cancel with an existing session -> cancelled, no exchange", async () => {
  let called = false;
  const r = await handleOAuthCallback(cb("?error=access_denied"), async () => {
    called = true;
    return { error: null };
  });
  assert.equal(loc(r), "307 /auth/login?error=oauth_cancelled");
  assert.equal(called, false);
});
await test("Location is always relative", async () => {
  for (const qs of [
    "?code=abc",
    "",
    "?error=x",
    "?code=a&next=https://evil.example",
  ]) {
    const l = (await handleOAuthCallback(cb(qs), ok)).headers.get("location")!;
    assert.ok(l.startsWith("/") && !l.startsWith("//"), l);
  }
});

// --- canonicalLocalUrl ----------------------------------------------------
await test("localhost is mapped to 127.0.0.1; other hosts are left alone", () => {
  assert.equal(
    canonicalLocalUrl("http://localhost:3000/auth/login?a=1"),
    "http://127.0.0.1:3000/auth/login?a=1",
  );
  assert.equal(canonicalLocalUrl("http://127.0.0.1:3000/auth/login"), null);
  assert.equal(canonicalLocalUrl("https://example.com/"), null);
});

// --- messages -------------------------------------------------------------
await test("known codes map to messages; unknown/proto keys do not", () => {
  for (const c of [
    "oauth_cancelled",
    "oauth_failed",
    "oauth_missing_code",
    "link_expired",
  ]) {
    assert.ok(authErrorMessage(c));
  }
  assert.equal(authErrorMessage("nope"), null);
  assert.equal(authErrorMessage("toString"), null);
  assert.equal(authErrorMessage(undefined), null);
});

// --- email confirmation errors (same callback as Google) ------------------
await test("expired/used email link -> link_expired, no exchange", async () => {
  let called = false;
  const path = await resolveOAuthCallback(
    cb("?error=access_denied&error_code=otp_expired&error_description=x"),
    async () => {
      called = true;
      return { error: null };
    },
  );
  assert.equal(path, "/auth/login?error=link_expired");
  assert.equal(called, false);
});
await test("otp_expired wins even if a code is present, never a success", async () =>
  assert.equal(
    await resolveOAuthCallback(
      cb("?code=abc&error=access_denied&error_code=otp_expired"),
      ok,
    ),
    "/auth/login?error=link_expired",
  ));
await test("Google cancel (no otp_expired) still -> oauth_cancelled", async () =>
  assert.equal(
    await resolveOAuthCallback(cb("?error=access_denied"), ok),
    "/auth/login?error=oauth_cancelled",
  ));
await test("a spoofed error_code only selects text, other errors stay failures", async () => {
  assert.equal(
    await resolveOAuthCallback(
      cb("?error=server_error&error_code=whatever"),
      ok,
    ),
    "/auth/login?error=oauth_failed",
  );
  assert.equal(
    await resolveOAuthCallback(cb("?error_code=otp_expired"), ok),
    "/auth/login?error=oauth_missing_code",
  );
});
await test("failure messages are neutral about Google vs email", () => {
  assert.ok(!/google/i.test(authErrorMessage("oauth_failed") ?? "google"));
  assert.ok(
    /expired|already used/i.test(authErrorMessage("link_expired") ?? ""),
  );
});

// --- post-login destinations are wired everywhere -------------------------
const src = (f: string) =>
  readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
await test("login, update-password and /auth/confirm use POST_LOGIN_PATH, not /protected", () => {
  for (const f of [
    "components/login-form.tsx",
    "components/update-password-form.tsx",
    "app/auth/confirm/route.ts",
  ]) {
    const code = src(f);
    assert.ok(code.includes("POST_LOGIN_PATH"), `${f} lacks POST_LOGIN_PATH`);
    assert.ok(!code.includes("/protected"), `${f} still mentions /protected`);
  }
});
await test("sign-up confirmation returns through /auth/callback", () => {
  const code = src("components/sign-up-form.tsx");
  assert.ok(code.includes("/auth/callback") && !code.includes("/protected"));
});

// --- AuthStatus state handling (pure helpers) -----------------------------
await test("an outdated check cannot overwrite a newer one", () => {
  const gate = createLatestGate();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(first(), false);
  assert.equal(second(), true);
});
await test("sign-out invalidates a check still in flight", () => {
  const gate = createLatestGate();
  const inFlight = gate.begin();
  gate.invalidate();
  assert.equal(inFlight(), false);
});
await test("identity: user -> email, no email -> generic, definite no-session -> anonymous", () => {
  assert.equal(
    identityAfterCheck(undefined, { user: { email: "a@b.c" }, error: null }),
    "a@b.c",
  );
  assert.equal(
    identityAfterCheck(undefined, { user: {}, error: null }),
    "Signed in",
  );
  assert.equal(
    identityAfterCheck("a@b.c", {
      user: null,
      error: { name: "AuthSessionMissingError" },
    }),
    null,
  );
  assert.equal(
    identityAfterCheck("a@b.c", { user: null, error: { status: 401 } }),
    null,
  );
  assert.equal(identityAfterCheck("a@b.c", { user: null, error: null }), null);
});
await test("identity: a transient error keeps the previous state, else fails closed", () => {
  const net = {
    user: null,
    error: { name: "AuthRetryableFetchError", status: 0 },
  };
  assert.equal(identityAfterCheck("a@b.c", net), "a@b.c");
  assert.equal(identityAfterCheck(null, net), null);
  assert.equal(identityAfterCheck(undefined, net), null);
});

await test("auth events: focus re-emits SIGNED_IN for the verified user -> ignored", () => {
  const s = { user: { id: "u1" } };
  assert.equal(authEventAction("SIGNED_IN", s, "u1"), "ignore");
  assert.equal(authEventAction("INITIAL_SESSION", s, "u1"), "ignore");
  assert.equal(authEventAction("TOKEN_REFRESHED", s, "u1"), "ignore");
});
await test("auth events: first sign-in, another user, USER_UPDATED -> verify", () => {
  const s = { user: { id: "u1" } };
  assert.equal(authEventAction("INITIAL_SESSION", s, undefined), "verify");
  assert.equal(authEventAction("SIGNED_IN", s, undefined), "verify");
  assert.equal(
    authEventAction("SIGNED_IN", { user: { id: "u2" } }, "u1"),
    "verify",
  );
  assert.equal(authEventAction("USER_UPDATED", s, "u1"), "verify");
  assert.equal(authEventAction("SIGNED_IN", { user: {} }, "u1"), "verify");
});
await test("auth events: no session (sign-out here or in another tab) -> clear", () => {
  assert.equal(authEventAction("SIGNED_OUT", null, "u1"), "clear");
  assert.equal(authEventAction("INITIAL_SESSION", null, undefined), "clear");
});

// --- password recovery through /auth/confirm --------------------------------
await test("recovery link goes to the password form, with or without next", () => {
  for (const next of [null, "/notes", "//evil.example", "https://evil.example"])
    assert.equal(
      confirmRedirectPath("recovery", next, POST_LOGIN_PATH),
      PASSWORD_UPDATE_PATH,
    );
  assert.equal(PASSWORD_UPDATE_PATH, "/auth/update-password");
});
await test("email confirmation keeps its behaviour: safe next, else /notes", () => {
  for (const type of ["signup", "email", "invite", "magiclink", null]) {
    assert.equal(
      confirmRedirectPath(type, "/notes?x=1", POST_LOGIN_PATH),
      "/notes?x=1",
    );
    assert.equal(confirmRedirectPath(type, null, POST_LOGIN_PATH), "/notes");
    assert.equal(
      confirmRedirectPath(type, "//evil.example", POST_LOGIN_PATH),
      "/notes",
    );
    assert.equal(
      confirmRedirectPath(type, "https://evil.example", POST_LOGIN_PATH),
      "/notes",
    );
  }
});
await test("/auth/confirm routes its destination through confirmRedirectPath", () => {
  const code = src("app/auth/confirm/route.ts");
  assert.ok(
    code.includes("confirmRedirectPath") && !code.includes("/protected"),
  );
});

// --- Sprint 2 M1: server-side protection of /notes ----------------------
for (const path of [
  "/",
  "/auth",
  "/auth/login",
  "/auth/sign-up",
  "/auth/sign-up-success",
  "/auth/forgot-password",
  "/auth/update-password",
  "/auth/callback",
  "/auth/confirm",
  "/auth/error",
  "/login",
  "/login/anything",
]) {
  await test(`public path: ${path}`, () =>
    assert.equal(isPublicPath(path), true));
}
for (const path of [
  "/notes",
  "/notes/",
  "/notes/anything",
  "/notes?x=1",
  "/protected",
  "/protected/x",
  "/authors", // starts with /auth but is not under /auth/
  "/auth-notes",
  "/login-x",
  "/api/anything",
  "//notes",
  "//auth/login",
  "/Notes",
  "",
  "notes",
]) {
  await test(`protected path: ${JSON.stringify(path)}`, () =>
    assert.equal(isPublicPath(path), false));
}
await test("/notes is protected and is the post-login destination", () => {
  assert.equal(POST_LOGIN_PATH, "/notes");
  assert.equal(isPublicPath(POST_LOGIN_PATH), false);
  assert.equal(LOGIN_PATH, "/auth/login");
  assert.equal(isPublicPath(LOGIN_PATH), true);
});
await test("a public prefix cannot be used to reach /notes (dot-segments, encodings)", () => {
  for (const path of [
    "/auth/../notes",
    "/auth/./../notes",
    "/auth/..%2fnotes",
    "/auth/..%2Fnotes",
    "/auth/%2e%2e/notes",
    "/auth/%2E%2E%2Fnotes",
    "/auth/..%5cnotes",
    "/auth/..\\notes",
    "/auth/login%2f..%2f..%2fnotes",
    "/auth/\u0000notes",
    "/login/../notes",
  ]) {
    assert.equal(isPublicPath(path), false, path);
  }
  // The normalised form a URL parser produces is protected too.
  assert.equal(isPublicPath(new URL("/auth/../notes", ORIGIN).pathname), false);
});
await test("hasVerifiedUser accepts only real signed-in claims", () => {
  assert.equal(
    hasVerifiedUser({ sub: "00000000-0000-4000-8000-000000000001" }),
    true,
  );
  assert.equal(
    hasVerifiedUser({ sub: "u1", role: "authenticated", is_anonymous: false }),
    true,
  );
  for (const bad of [
    null,
    undefined,
    {},
    { sub: "" },
    { sub: 42 },
    { sub: null },
    { sub: "u1", is_anonymous: true },
    "sub",
    [],
    { role: "anon" },
  ]) {
    assert.equal(hasVerifiedUser(bad), false, JSON.stringify(bad));
  }
});
await test("the proxy uses the shared decision and has no /notes exemption", () => {
  const code = src("lib/supabase/proxy.ts");
  assert.ok(
    code.includes("isPublicPath(") && code.includes("hasVerifiedUser("),
  );
  assert.ok(code.includes("LOGIN_PATH"));
  assert.ok(!code.includes('"/notes"'), "the proxy must not mention /notes");
  assert.ok(!code.includes('startsWith("/auth")'), "no loose prefix check");
  // A redirect keeps the session cookie changes (for example a cleared expired session).
  assert.ok(code.includes("redirectResponse.cookies.set"));
});
await test("/notes verifies the user on the server before rendering the UI", () => {
  const page = src("app/notes/page.tsx");
  assert.ok(page.includes('from "@/lib/auth/require-user"'));
  assert.ok(
    page.includes("<Suspense"),
    "cacheComponents: runtime data needs Suspense",
  );
  const check = page.indexOf("await requireUser()");
  const ui = page.indexOf("<NotesApp />");
  assert.ok(
    check > -1 && ui > check,
    "requireUser() must run before <NotesApp />",
  );
  assert.ok(
    !page.includes('"use client"'),
    "the page must stay a Server Component",
  );
});
await test("requireUser verifies claims on the server and redirects to the sign-in page", () => {
  const code = src("lib/auth/require-user.ts");
  assert.ok(code.includes('import "server-only"'));
  assert.ok(code.includes("getClaims()"));
  assert.ok(
    code.includes("hasVerifiedUser(") && code.includes("redirect(LOGIN_PATH)"),
  );
  assert.ok(
    !code.includes("getSession"),
    "getSession() is not verified on the server",
  );
  assert.ok(
    !code.includes("try {"),
    "redirect() throws; it must not sit inside try/catch",
  );
});
await test("browser-side session state is not what protects /notes", () => {
  // The only browser-side session read in the notes UI is the display-only status.
  for (const f of [
    "components/notes/notes-app.tsx",
    "components/notes/use-notes-data.ts",
    "app/notes/page.tsx",
  ]) {
    const code = src(f);
    assert.ok(
      !code.includes("auth.getSession") && !code.includes("auth.getUser"),
      f,
    );
  }
});
await test("login, Google callback and password forms still end on /notes", () => {
  for (const f of [
    "components/login-form.tsx",
    "components/update-password-form.tsx",
    "app/auth/confirm/route.ts",
  ]) {
    assert.ok(src(f).includes("POST_LOGIN_PATH"), f);
  }
  assert.ok(
    src("lib/auth/oauth-callback.ts").includes('POST_LOGIN_PATH = "/notes"'),
  );
});

// --- Sprint 2 M1: session loss ---------------------------------------------
await test("only a refused request counts as a lost session", () => {
  assert.equal(isSessionLossKind("forbidden"), true);
  for (const kind of [
    "not_found",
    "duplicate",
    "invalid",
    "unknown",
    "",
    null,
    undefined,
  ]) {
    assert.equal(
      isSessionLossKind(kind as string | null | undefined),
      false,
      String(kind),
    );
  }
});
await test("session-loss gate refreshes once, then only after a reset", () => {
  let refreshes = 0;
  const gate = createSessionLossGate(() => {
    refreshes++;
  });
  assert.equal(gate.onError("unknown"), false);
  assert.equal(gate.onError(null), false);
  assert.equal(refreshes, 0);
  assert.equal(gate.onError("forbidden"), true);
  assert.equal(
    gate.onError("forbidden"),
    false,
    "no refresh loop for a persistent error",
  );
  assert.equal(refreshes, 1);
  gate.reset(); // a request succeeded: the session works again
  assert.equal(gate.onError("forbidden"), true);
  assert.equal(refreshes, 2);
});
await test("the notes UI re-checks the session on a refused request", () => {
  const app = src("components/notes/notes-app.tsx");
  assert.ok(
    app.includes("createSessionLossGate") && app.includes("router.refresh()"),
  );
  assert.ok(app.includes("sessionLoss.onError(e.kind)"));
  assert.ok(app.includes("sessionLoss.onError(data.loadErrorKind)"));
  assert.ok(
    src("components/notes/use-notes-data.ts").includes("loadErrorKind"),
  );
});
await test("rejected or expired JWT errors map to the refused-request kind", () => {
  const code = src("lib/notes-db.ts");
  for (const c of ["42501", "PGRST301", "PGRST302", "PGRST303"]) {
    assert.ok(code.includes(`case "${c}":`), c);
  }
  assert.ok(!code.includes("user_id:"), "notes-db still never writes user_id");
});

// --- Sprint 2 M4: static checks of the SQL and the isolation tests (nothing is executed) ---
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const migrationFile = readdirSync(
  new URL("../supabase/migrations/", import.meta.url),
).find((f) => f.endsWith("_enforce_owner_access.sql"));
const MIGRATION = migrationFile
  ? src(`supabase/migrations/${migrationFile}`)
  : "";
const sqlCode = (text: string) => text.replace(/--[^\n]*/g, ""); // statements only, without comments
await test("owner-access migration: exists and runs after the temporary anon migration it closes", () => {
  assert.ok(migrationFile, "migration file not found");
  const names = readdirSync(
    new URL("../supabase/migrations/", import.meta.url),
  ).sort();
  const tempAnon = names.find((n) => n.endsWith("_temp_anon_access.sql"));
  assert.ok(tempAnon, "temporary anon migration not found");
  // Later migrations (for example the chat tables) may follow it; it must never come first.
  assert.ok(names.indexOf(tempAnon) < names.indexOf(migrationFile));
});
await test("owner-access migration: every policy is `to authenticated` with an owner check, one per operation", () => {
  const m = sqlCode(MIGRATION);
  const policies = m.match(/create policy[\s\S]*?;/g) ?? [];
  assert.equal(
    policies.length,
    14,
    "notes 4, collections 4, tags 3, note_tags 3",
  );
  for (const p of policies) {
    assert.ok(/\bto authenticated\b/.test(p), p.slice(0, 60));
    assert.ok(
      p.includes("(select auth.uid())"),
      "auth.uid() must be wrapped in a select",
    );
    assert.ok(
      !/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i.test(p),
      "no open policy",
    );
  }
  for (const op of ["select", "insert", "update", "delete"]) {
    for (const t of ["notes", "collections"])
      assert.ok(m.includes(`"owner ${op} ${t}"`), `${op} ${t}`);
  }
  for (const op of ["select", "insert", "update"])
    assert.ok(m.includes(`"owner ${op} tags"`), `${op} tags`);
  assert.ok(
    !m.includes('"owner delete tags"') &&
      !m.includes('"owner update note_tags"'),
  );
  for (const op of ["select", "insert", "delete"])
    assert.ok(m.includes(`"owner ${op} note_tags"`), `${op} note_tags`);
  for (const u of m.match(/for update[\s\S]*?;/g) ?? [])
    assert.ok(
      /using/.test(u) && /with check/.test(u),
      "update needs USING and WITH CHECK",
    );
});
await test("owner-access migration: drops exactly the 16 temporary policies named in the temp migration", () => {
  const temp = src("supabase/migrations/20261013094208_temp_anon_access.sql");
  const created = [
    ...temp.matchAll(/create policy "(TEMP anon [^"]+)" on public\.(\w+)/g),
  ]
    .map((m) => `${m[1]}|${m[2]}`)
    .sort();
  const dropped = [
    ...sqlCode(MIGRATION).matchAll(
      /drop policy "(TEMP anon [^"]+)" on public\.(\w+)/g,
    ),
  ]
    .map((m) => `${m[1]}|${m[2]}`)
    .sort();
  assert.equal(created.length, 16);
  assert.deepEqual(dropped, created);
});
await test("owner-access migration: ownership NOT NULL, revoke before grant, no anon or service-role access", () => {
  const m = sqlCode(MIGRATION);
  assert.equal((m.match(/alter column user_id set not null/g) ?? []).length, 3);
  assert.ok(
    !/alter column user_id (drop default|set default)/.test(m),
    "the auth.uid() default stays",
  );
  const revoke = m.indexOf(
    "revoke all on table public.notes, public.collections, public.tags, public.note_tags",
  );
  assert.ok(
    revoke > -1 &&
      /from anon, authenticated;/.test(m.slice(revoke, revoke + 200)),
  );
  assert.ok(
    revoke < m.indexOf("grant select"),
    "revoke all must come before any grant",
  );
  assert.ok(
    !/\bgrant\b[^;]*\bto\b[^;]*\banon\b/i.test(m),
    "anon gets no grant",
  );
  assert.ok(
    !/to anon|to public|service_role|security definer|auth\.role\(|user_metadata|alter default privileges|all tables in schema|truncate/i.test(
      m,
    ),
  );
  // Clients never get write access to ownership or system-managed columns.
  const grants = m.match(/grant (insert|update) \([^)]*\)/g) ?? [];
  assert.ok(grants.length >= 7);
  for (const g of grants)
    assert.ok(!/user_id|created_at|updated_at|\bid\b/.test(g), g);
  assert.ok(
    !/grant (insert|update|delete|all)[^(;]*;/i.test(
      m.replace(/grant delete on [\w. ,]+ to authenticated;/g, ""),
    ),
    "only column-level INSERT/UPDATE grants",
  );
});
await test("owner-access migration: guard aborts on unowned rows and cross-owner references; no data change", () => {
  const m = sqlCode(MIGRATION);
  assert.ok(
    m.includes("raise exception") &&
      m.includes("user_id is null") &&
      m.includes("cross-owner"),
  );
  assert.ok(
    !/\b(delete from|insert into|update public\.)/i.test(m),
    "a schema migration must not change data",
  );
});
const CLEANUP = src("supabase/maintenance/cleanup_approved_demo_data.sql");
await test("cleanup script: inert by default, atomic, exact ids, never touches accounts", () => {
  const c = sqlCode(CLEANUP);
  assert.ok(
    /v_approved constant boolean := false;/.test(c),
    "the committed script must be inert",
  );
  assert.ok(!/\b(commit|rollback|truncate|drop|alter|grant|revoke)\b/i.test(c));
  assert.equal(
    (c.match(/\bdo \$\$/g) ?? []).length,
    1,
    "one DO statement = atomic",
  );
  assert.equal(
    (c.match(/delete from public\.(note_tags|notes|collections|tags)\b/g) ?? [])
      .length,
    4,
  );
  for (const stmt of c.match(/delete from[\s\S]*?;/g) ?? [])
    assert.ok(/where/i.test(stmt), "every delete is restricted");
  // auth.* is only counted, never written; no owner is ever assigned.
  for (const m of c.matchAll(/auth\.\w+/g)) assert.equal(m[0], "auth.users");
  assert.ok(!/(insert|update|delete)[^;]*auth\.users/i.test(c));
  assert.ok(!/set user_id|user_id\s*=/.test(c), "no reassignment");
  for (const md5 of [
    "8e7c781eb369498b30d43f0a7628ffc4",
    "66c6a7c4ad0d8a721a1f8a0459b58690",
    "33542fe7e1d4df0018546ed87acf3e14",
    "2780b53a38208ae049f4746581cc8b87",
  ]) {
    assert.ok(c.includes(md5), md5);
  }
  assert.ok(/cleanup aborted/.test(c) && /share row exclusive/.test(c));
});
const RLS_TEST = src("scripts/test-rls.mts");
await test("isolation tests: refuse to write while anonymous can read; credentials only from git-ignored env", () => {
  assert.ok(RLS_TEST.includes("--dry-run") && RLS_TEST.includes('"--run"'));
  const gate = RLS_TEST.indexOf("Safety gate 1");
  const runner = RLS_TEST.indexOf("for (const { name, fn } of tests)");
  assert.ok(
    gate > -1 && runner > gate,
    "the gate runs before any test is executed",
  );
  const gate2 = RLS_TEST.indexOf("Safety gate 2");
  assert.ok(
    gate2 > gate && gate2 < runner,
    "the sign-in gate also runs before any test",
  );
  assert.ok(RLS_TEST.includes("process.exit(3)"));
  assert.ok(
    !/console\.(log|error)\([^)]*(PASSWORD|EMAIL)\b/.test(
      RLS_TEST.replace(/NEEDED[\s\S]*?\] as const/, ""),
    ),
    "credentials are never printed",
  );
  assert.ok(
    !/service_role|secret_key|SUPABASE_SERVICE|SECRET/i.test(
      RLS_TEST.replace(/\/\/[^\n]*/g, ""), // code only: the header comment may say "no secret key"
    ),
  );
  assert.ok(
    RLS_TEST.includes('".env.test.local"') &&
      !/(password|email)\s*[:=]\s*["'][^"']+["']/i.test(RLS_TEST),
  );
  for (const file of [".env.test.local", ".env.local"]) {
    const ignored = spawnSync("git", ["check-ignore", "-q", file], {
      cwd: new URL("..", import.meta.url),
    });
    assert.equal(ignored.status, 0, `${file} must be git-ignored`);
  }
});

await test("isolation test 11: 428C9 only for identity-column cases, every attempt evaluated on its own", () => {
  const code = RLS_TEST.replace(/\/\/[^\n]*/g, "");
  assert.equal(
    (code.match(/428C9/g) ?? []).length,
    1,
    "428C9 appears once, as a named constant",
  );
  assert.ok(/IDENTITY_REFUSAL = "428C9"/.test(code));
  assert.ok(
    /identity\s*&&\s*r\.error !== null\s*&&\s*r\.error\.code === IDENTITY_REFUSAL/.test(
      code,
    ),
    "the identity code is only accepted when the case is flagged",
  );
  assert.ok(
    /identity: field === "id"/.test(code),
    "only id fields are flagged as identity cases",
  );
  const from = code.indexOf('"ownership and system-managed fields');
  const block = code.slice(
    from,
    code.indexOf('"tags cannot be deleted by clients'),
  );
  assert.ok(from > -1 && block.length > 100);
  assert.ok(
    block.includes("refused(r, c.identity === true)") &&
      block.includes("failures.push("),
  );
  assert.equal(
    (block.match(/\bassert\./g) ?? []).length,
    1,
    "one final assert: no case can stop the others",
  );
  assert.ok(
    (block.match(/\n\s+(ins|upd)\(/g) ?? []).length >= 20,
    "at least 20 protected-field cases",
  );
  for (const f of ["user_id", "created_at", "updated_at", "name"])
    assert.ok(block.includes(`"${f}"`), f);
});

await test("Feature 7 test-data cleanup script: inert by default, atomic, exactly the approved scope, never touches accounts", () => {
  const c = sqlCode(src("supabase/maintenance/cleanup_feature7_test_data.sql"));
  assert.ok(
    /v_approved constant boolean := false;/.test(c),
    "the committed script must be inert",
  );
  assert.ok(!/\b(commit|rollback|truncate|drop|alter|grant|revoke)\b/i.test(c));
  assert.equal(
    (c.match(/\bdo \$\$/g) ?? []).length,
    1,
    "one DO statement = atomic",
  );
  const deletes = (c.match(/delete from[\s\S]*?;/g) ?? []).map((d) =>
    d.replace(/\s+/g, " "),
  );
  assert.deepEqual(deletes, [
    "delete from public.note_tags where (note_id, tag_id) in ((300, 118), (300, 119));",
    "delete from public.notes where id in (300, 301, 302);",
    "delete from public.collections where id = 109;",
    "delete from public.tags where id in (114, 115, 118, 119);",
  ]);
  assert.equal(
    (c.match(/'[0-9a-f]{32}'/g) ?? []).length,
    4,
    "one fingerprint per table",
  );
  assert.ok(
    /provider'\s*=\s*'google'/.test(c) && /provider'\s*=\s*'email'/.test(c),
    "owners are checked by provider",
  );
  for (const m of c.matchAll(/auth\.\w+/g))
    assert.ok(["auth.users", "auth.identities"].includes(m[0]), m[0]);
  assert.ok(
    /v_identities_after <> v_identities_before/.test(c),
    "the accounts must be unchanged",
  );
  assert.ok(
    !/(insert|update)[^;]*(auth\.|public\.)/i.test(c),
    "no writes besides the four deletes",
  );
  assert.ok(
    !existsSync(
      new URL("../supabase/maintenance/cleanup_test_tags.sql", import.meta.url),
    ),
    "the overlapping tags-only script is gone",
  );
});

await test("the obsolete demo-mode banner is gone (the data is private since the owner-access migration)", () => {
  assert.ok(
    !existsSync(
      new URL("../components/notes/demo-banner.tsx", import.meta.url),
    ),
    "demo-banner.tsx must not exist",
  );
  for (const f of [
    "components/notes/notes-app.tsx",
    "components/notes/top-bar.tsx",
    "components/notes/sidebar.tsx",
    "components/notes/sidebar-panel.tsx",
    "app/notes/page.tsx",
  ]) {
    const code = src(f);
    assert.ok(
      !/DemoBanner|demo-banner|DEMO_NOTICE|publicly accessible/i.test(code),
      f,
    );
  }
});

// ---- Feature 9: Markdown export of a note ----------------------------------

await test("export: title becomes an H1 and the body follows unchanged", () => {
  assert.equal(
    noteToMarkdown({ title: "Plan", body: "First line\n\n- item\n[link](https://example.com)" }),
    "# Plan\n\nFirst line\n\n- item\n[link](https://example.com)\n",
  );
});

await test("export: Markdown the user typed is not escaped or altered", () => {
  const body = "## Heading\n* a\n* b\n`code` **bold** _it_ > quote";
  assert.ok(noteToMarkdown({ title: "T", body }).includes(`\n\n${body}\n`));
});

await test("export: rich-text (Feature 8) Markdown is exported as saved, underline stays <u>…</u>", () => {
  const body =
    "## Part\n\n**bold** *italic* <u>under</u> <u>**both**</u> [link](https://a.b)\n\n- a\n\n1. b\n\n> quote\n\n```js\nlet a = 1;\n```\n\n~~old~~\n\n---";
  assert.equal(noteToMarkdown({ title: "T", body }), `# T\n\n${body}\n`);
});

await test("export: Unicode and line breaks are preserved, CRLF becomes LF", () => {
  const out = noteToMarkdown({ title: "Größe – 日本語 🚀", body: "ä ö ü ß\r\nzweite Zeile\rdritte\n\nvierte" });
  assert.equal(out, "# Größe – 日本語 🚀\n\nä ö ü ß\nzweite Zeile\ndritte\n\nvierte\n");
  assert.ok(!out.includes("\r"));
});

await test("export: an empty or blank body gives just the heading", () => {
  assert.equal(noteToMarkdown({ title: "Only title", body: "" }), "# Only title\n");
  assert.equal(noteToMarkdown({ title: "Only title", body: " \n\n  \n" }), "# Only title\n");
});

await test("export: trailing newlines are normalised to one; a multi-line title stays one line", () => {
  assert.equal(noteToMarkdown({ title: "A\nB  C", body: "x\n\n\n" }), "# A B C\n\nx\n");
});

await test("export: the file name is the title plus .md and keeps Unicode", () => {
  assert.equal(markdownFilename("My plan"), "My plan.md");
  assert.equal(markdownFilename("Größe – 日本語"), "Größe – 日本語.md");
});

await test("export: unsafe file name characters never survive", () => {
  const name = markdownFilename('a/b\\c:d*e?f"g<h>i|j\u0000k\u202el');
  assert.match(name, /\.md$/);
  assert.ok(!/[\\/:*?"<>|\u0000-\u001f\u202e]/.test(name), name);
  assert.equal(name, "a-b-c-d-e-f-g-h-i-j-k-l.md");
  assert.equal(markdownFilename("../../etc/passwd"), "etc-passwd.md");
});

await test("export: dots, spaces and hyphens at the ends are trimmed; empty names fall back", () => {
  assert.equal(markdownFilename("  .hidden.  "), "hidden.md");
  assert.equal(markdownFilename("..."), "note.md");
  assert.equal(markdownFilename("///"), "note.md");
  assert.equal(markdownFilename(""), "note.md");
});

await test("export: Windows reserved names are prefixed, long titles are shortened", () => {
  assert.equal(markdownFilename("CON"), "_CON.md");
  assert.equal(markdownFilename("lpt1"), "_lpt1.md");
  assert.equal(markdownFilename("con.report"), "_con.report.md");
  assert.equal(markdownFilename("console"), "console.md");
  const long = markdownFilename("x".repeat(500));
  assert.equal(long, `${"x".repeat(200)}.md`);
  // shortened by characters, not UTF-16 units: no split emoji
  // the limit is in UTF-8 bytes (file systems allow 255), so 4-byte emoji stay under it
  const emoji = markdownFilename("🚀".repeat(200));
  assert.ok(new TextEncoder().encode(emoji).length <= 255, "emoji name within 255 bytes");
  assert.equal(Array.from(emoji.slice(0, -3)).length, 50);
  assert.ok(new TextEncoder().encode(markdownFilename("日".repeat(500))).length <= 255);
  assert.equal(markdownFilename("COM¹"), "_COM¹.md");
  assert.equal(markdownFilename("CONIN$"), "_CONIN$.md");
});

await test("export: the module is pure, the download is client-side and the database layer is untouched", () => {
  const lib = src("lib/note-markdown.ts");
  assert.ok(!/^\s*import\s/m.test(lib), "lib/note-markdown.ts must have no imports");
  const dl = src("components/notes/download-markdown.ts");
  assert.ok(/URL\.createObjectURL/.test(dl) && /\.download\s*=/.test(dl));
  assert.ok(!/supabase|fetch\(|notes-db/.test(dl), "download helper makes no request");
  assert.ok(!/markdown/i.test(src("lib/notes-db.ts")), "notes-db.ts is unchanged by Feature 9");
  const app = src("components/notes/notes-app.tsx");
  assert.ok(/downloadNoteAsMarkdown\(selectedNote\)/.test(app), "exports the saved note, not the draft");
  assert.ok(!/downloadNoteAsMarkdown\(\s*(draft|activeDraft)/.test(app));
});

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nall auth tests passed");
