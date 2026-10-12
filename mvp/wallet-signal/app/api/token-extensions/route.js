import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReliableConnection } from "../../../lib/reliableConnection.js";

export const dynamic = "force-dynamic";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPF7GvEw3Q7p5F6w9p";
const TYPES = {
  transferFeeConfig: "Transfer fee configuration",
  transferHook: "Transfer hook",
  permanentDelegate: "Permanent delegate",
  nonTransferable: "Non-transferable",
  defaultAccountState: "Default account state",
  confidentialTransferMint: "Confidential transfer",
  interestBearingConfig: "Interest-bearing configuration",
  metadataPointer: "Metadata pointer",
  transferFeeAmount: "Transfer fee amount"
};
export async function GET(request) {
  const value = new URL(request.url).searchParams.get("mint") || "";
  let mint;
  try { mint = new PublicKey(value); }
  catch { return NextResponse.json({ error: "Invalid token mint address" }, { status: 400 }); }
  try {
    const connection = createReliableConnection();
    const response = await connection.getParsedAccountInfo(mint, "confirmed");
    const account = response.value;
    if (!account || account.data?.program !== "spl-token-2022" || account.data?.parsed?.type !== "mint") {
      return NextResponse.json({ status: "not_token_2022_mint", mint: mint.toBase58(), verified: false, extensions: [], reason: "Parsed Token-2022 mint account not available; extension inspection not performed." });
    }
    const info = account.data.parsed.info || {};
    if (!Array.isArray(info.extensions)) {
      return NextResponse.json({ status: "not_parsed", mint: mint.toBase58(), verified: false, extensions: [], reason: "RPC did not provide a parsed extensions array. Absence of extensions cannot be concluded." });
    }
    const extensions = info.extensions.map(item => {
      const type = typeof item?.extension === "string" ? item.extension : typeof item?.type === "string" ? item.type : "unknown";
      return { type, label: TYPES[type] || type, observed: true,
        // Never infer enabled/disabled or permission scope from the extension name alone.
        interpretation: "Extension observed in parsed mint account. Configuration and effective permissions require separate validation." };
    });
    return NextResponse.json({
      status: "parsed_extensions_observed", mint: mint.toBase58(), verified: true,
      extensions, extensionCount: extensions.length,
      coverage: { source: "Solana RPC getParsedAccountInfo", accountType: "mint", program: "spl-token-2022",
        limitations: "Presence is verified only as reported by parsed RPC. No configuration-based risk rating, fee rate, hook behavior, or delegate power is asserted. Account-level extensions are not covered." },
      interpretation: "Observed Token-2022 mint extensions are evidence, not proof of malicious behavior."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", error: "Token-2022 extension inspection unavailable; no absence or safety conclusion can be made." }, { status: 503 });
  }
}
