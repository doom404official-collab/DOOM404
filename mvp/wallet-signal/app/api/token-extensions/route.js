import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReliableConnection } from "../../../lib/reliableConnection.js";

export const dynamic = "force-dynamic";
const TYPES = {
  transferFeeConfig: "Transfer fee configuration",
  transferHook: "Transfer hook",
  permanentDelegate: "Permanent delegate",
  nonTransferable: "Non-transferable",
  defaultAccountState: "Default account state",
  confidentialTransferMint: "Confidential transfer",
  interestBearingConfig: "Interest-bearing configuration",
  metadataPointer: "Metadata pointer",
  transferFeeAmount: "Transfer fee amount",
  tokenMetadata: "Token metadata"
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
    const addressOrNull = value => typeof value === "string" && value.length > 0 ? value : null;
    const normalizeFee = fee => {
      if (!fee || typeof fee !== "object") return null;
      const basisPoints = fee.transferFeeBasisPoints ?? fee.transfer_fee_basis_points;
      const maximumFee = fee.maximumFee ?? fee.maximum_fee;
      if (!Number.isInteger(Number(basisPoints)) || Number(basisPoints) < 0 || Number(basisPoints) > 10000 ||
          maximumFee === undefined || !/^\\d+$/.test(String(maximumFee))) return null;
      return {
        basisPoints: Number(basisPoints),
        percentage: Number(basisPoints) / 100,
        maximumFeeRaw: String(maximumFee),
        epoch: fee.epoch === undefined ? null : String(fee.epoch)
      };
    };
    const transferFeeEntry = info.extensions.find(item => (item?.extension || item?.type) === "transferFeeConfig");
    const config = transferFeeEntry?.state || transferFeeEntry?.transferFeeConfig || transferFeeEntry;
    const transferFee = transferFeeEntry ? {
      status: "observed",
      olderFee: normalizeFee(config?.olderTransferFee),
      newerFee: normalizeFee(config?.newerTransferFee),
      configAuthority: addressOrNull(config?.transferFeeConfigAuthority),
      withdrawalAuthority: addressOrNull(config?.withdrawWithheldAuthority),
      authorityFieldsReported: Object.prototype.hasOwnProperty.call(config || {}, "transferFeeConfigAuthority") &&
        Object.prototype.hasOwnProperty.call(config || {}, "withdrawWithheldAuthority"),
      note: "Two fee schedules may coexist around an epoch transition. Displayed schedules are not a guarantee of the fee applicable to a particular transaction. A null authority means revoked only if the RPC explicitly returned that field."
    } : { status: "not_observed", note: "No transferFeeConfig extension was reported by the parsed mint account." };
    const extensions = info.extensions.map(item => {
      const type = typeof item?.extension === "string" ? item.extension : typeof item?.type === "string" ? item.type : "unknown";
      return { type, label: TYPES[type] || type, observed: true,
        // Never infer enabled/disabled or permission scope from the extension name alone.
        interpretation: "Extension observed in parsed mint account. Configuration and effective permissions require separate validation." };
    });
    return NextResponse.json({
      status: "parsed_extensions_observed", mint: mint.toBase58(), verified: true,
      extensions, extensionCount: extensions.length, transferFee,
      coverage: { source: "Solana RPC getParsedAccountInfo", accountType: "mint", program: "spl-token-2022",
        limitations: "Presence is verified only as reported by parsed RPC. Fee configuration is parsed when available; fee schedule activation and actual transaction fees are not verified. No risk rating, hook behavior, or delegate power is asserted. Account-level extensions are not covered." },
      interpretation: "Observed Token-2022 mint extensions are evidence, not proof of malicious behavior."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", error: "Token-2022 extension inspection unavailable; no absence or safety conclusion can be made." }, { status: 503 });
  }
}
