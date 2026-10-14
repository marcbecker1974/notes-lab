// Lightweight tests for the auth redirect logic. Run: npm run test:auth
// (Node strips the TypeScript types; no test framework needed.)
import assert from "node:assert/strict";
import {
  handleOAuthCallback,
  resolveOAuthCallback,
} from "../lib/auth/oauth-callback.ts";
import { authErrorMessage } from "../lib/auth/messages.ts";
import { canonicalLocalUrl } from "../lib/auth/dev-origin.ts";
import { safeRedirectPath } from "../lib/auth/redirect.ts";

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

// --- resolveOAuthCallback -----------------------------------------------
const cb = (qs: string) => new URL(`${ORIGIN}/auth/callback${qs}`);
const ok = async () => ({ error: null });

await test("valid code -> /protected and code is exchanged", async () => {
  let seen = "";
  const path = await resolveOAuthCallback(cb("?code=abc"), async (c) => {
    seen = c;
    return { error: null };
  });
  assert.equal(path, "/protected");
  assert.equal(seen, "abc");
});
await test("ignores a ?next= parameter (fixed destination)", async () => {
  assert.equal(
    await resolveOAuthCallback(cb("?code=abc&next=https://evil.example"), ok),
    "/protected",
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
await test("success -> 307 /protected (relative Location)", async () =>
  assert.equal(
    loc(await handleOAuthCallback(cb("?code=abc"), ok)),
    "307 /protected",
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
  for (const c of ["oauth_cancelled", "oauth_failed", "oauth_missing_code"]) {
    assert.ok(authErrorMessage(c));
  }
  assert.equal(authErrorMessage("nope"), null);
  assert.equal(authErrorMessage("toString"), null);
  assert.equal(authErrorMessage(undefined), null);
});

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nall auth tests passed");
