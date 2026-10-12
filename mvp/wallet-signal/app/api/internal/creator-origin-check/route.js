import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { resolvePumpFunCreatorFromEnvironment } from "../../../../lib/creatorOriginServer.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function equalSecret(expected, supplied) {
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(supplied, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
function privateJson(body, status) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}
export async function GET(request) {
  // Preview-only endpoint; never accept the test token on production.
  if (process.env.VERCEL_ENV !== "preview") return privateJson({ error: "Not found" }, 404);
  const expected = process.env.CREATOR_ORIGIN_TEST_TOKEN;
  const supplied = request.headers.get("x-creator-origin-test-token");
  if (!equalSecret(expected, supplied)) {
    // Server-side diagnostic only. Never log token values, lengths, hashes, headers, or URL.
    // These coarse reason codes are visible only to authorized Vercel log readers.
    const reason = !expected ? "TEST_TOKEN_NOT_CONFIGURED"
      : !supplied ? "TEST_TOKEN_HEADER_MISSING"
      : "TEST_TOKEN_MISMATCH";
    console.warn("creator-origin-auth-rejected", { reason, preview: true });
    return privateJson({ error: "Unauthorized" }, 401);
  }
  const mint = new URL(request.url).searchParams.get("mint") || "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return privateJson({ error: "Invalid mint" }, 400);
  try {
    const result = await resolvePumpFunCreatorFromEnvironment({ mint, maxCandidates: 100 });
    return privateJson(result, 200);
  } catch {
    return privateJson({ status: "UNRESOLVED", reason: "RPC_VALIDATION_FAILED" }, 503);
  }
}
