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
import { readFileSync } from "node:fs";
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

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nall auth tests passed");
