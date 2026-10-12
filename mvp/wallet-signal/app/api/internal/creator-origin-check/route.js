import { NextResponse } from "next/server";
import { resolvePumpFunCreatorFromEnvironment } from "../../../../lib/creatorOriginServer.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  // No public creator-origin endpoint: a server-side test token is mandatory.
  const expected = process.env.CREATOR_ORIGIN_TEST_TOKEN;
  const supplied = request.headers.get("x-creator-origin-test-token");
  if (!expected || !supplied || supplied !== expected || process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const mint = new URL(request.url).searchParams.get("mint") || "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
    return NextResponse.json({ error: "Invalid mint" }, { status: 400 });
  }
  try {
    const result = await resolvePumpFunCreatorFromEnvironment({ mint, maxCandidates: 100 });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "UNRESOLVED", reason: "RPC_VALIDATION_FAILED" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
