import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReliableConnection } from "../../../lib/reliableConnection.js";

import { normalizeTransferFee, resolveEpochFee, consistentEpochContext } from "../../../lib/tokenTransferFeeEvidence.mjs";

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
    // Bracket the account read; never resolve activation across an epoch boundary.
    const before = await connection.getEpochInfo("confirmed").catch(() => null);
    const response = await connection.getParsedAccountInfo(mint, {
      commitment: "confirmed", ...(Number.isSafeInteger(before?.absoluteSlot) ? { minContextSlot: before.absoluteSlot } : {})
    });
    const after = await connection.getEpochInfo({ commitment: "confirmed", ...(Number.isSafeInteger(response.context?.slot) ? { minContextSlot: response.context.slot } : {}) }).catch(() => null);
    const epochContext = consistentEpochContext(before, after, response.context?.slot);
    const observedAt = new Date().toISOString();
    const account = response.value;
    if (!account || account.data?.program !== "spl-token-2022" || account.data?.parsed?.type !== "mint") {
      return NextResponse.json({ status: "not_token_2022_mint", mint: mint.toBase58(), verified: false, extensions: [], reason: "Parsed Token-2022 mint account not available; extension inspection not performed." });
    }
    const info = account.data.parsed.info || {};
    if (!Array.isArray(info.extensions) || info.extensions.some(item => !item || typeof item !== "object" || typeof (item.extension || item.type) !== "string") || info.extensions.filter(item => (item.extension || item.type) === "transferFeeConfig").length > 1) {
      return NextResponse.json({ status: "not_parsed", mint: mint.toBase58(), verified: false, extensions: [], reason: "RPC did not provide an unambiguous parsed extensions array. Absence of extensions cannot be concluded." });
    }
    const authority = (config, keys) => {
      const key = keys.find(key => Object.prototype.hasOwnProperty.call(config || {}, key));
      if (!key) return { reported: false, value: null };
      if (config[key] === null) return { reported: true, value: null };
      try { return { reported: typeof config[key] === "string", value: new PublicKey(config[key]).toBase58() }; }
      catch { return { reported: false, value: null }; }
    };
    const transferFeeEntry = info.extensions.find(item => (item?.extension || item?.type) === "transferFeeConfig");
    const config = transferFeeEntry?.state || transferFeeEntry?.transferFeeConfig || transferFeeEntry?.data || transferFeeEntry;
    const configAuthority = authority(config, ["transferFeeConfigAuthority", "transfer_fee_config_authority"]);
    const withdrawalAuthority = authority(config, ["withdrawWithheldAuthority", "withdraw_withheld_authority"]);
    const transferFee = transferFeeEntry ? {
      status: "observed",
      olderFee: normalizeTransferFee(config?.olderTransferFee ?? config?.older_transfer_fee),
      newerFee: normalizeTransferFee(config?.newerTransferFee ?? config?.newer_transfer_fee),
      configAuthority: configAuthority.value,
      withdrawalAuthority: withdrawalAuthority.value,
      configAuthorityReported: configAuthority.reported,
      withdrawalAuthorityReported: withdrawalAuthority.reported,
      note: "Two fee schedules may coexist around an epoch transition. Displayed schedules are not a guarantee of the fee applicable to a particular transaction. A null authority means revoked only if the RPC explicitly returned that field."
    } : { status: "not_observed", note: "No transferFeeConfig extension was reported by the parsed mint account." };
    if (transferFeeEntry) {
      transferFee.effectiveFee = epochContext ? resolveEpochFee({ ...transferFee, epoch: epochContext.epoch }) : null;
      transferFee.effectiveStatus = transferFee.effectiveFee ? "resolved_at_observed_epoch" : "unverified";
      transferFee.note = "Schedule resolved only at the observed confirmed epoch when available. Raw maximum fee caps a rounded-up basis-point fee for a specified gross transfer amount. This is not a transaction simulation or guarantee of future transfer behavior.";
    }
    const extensions = info.extensions.map(item => {
      const type = typeof item?.extension === "string" ? item.extension : typeof item?.type === "string" ? item.type : "unknown";
      return { type, label: TYPES[type] || type, observed: true,
        // Never infer enabled/disabled or permission scope from the extension name alone.
        interpretation: "Extension observed in parsed mint account. Configuration and effective permissions require separate validation." };
    });
    return NextResponse.json({
      status: "parsed_extensions_observed", mint: mint.toBase58(), verified: true,
      extensions, extensionCount: extensions.length, transferFee, observedAt, epochContext,
      coverage: { source: "Solana RPC getParsedAccountInfo", accountType: "mint", program: "spl-token-2022",
        limitations: "Presence is verified only as reported by parsed RPC. Fee configuration is parsed when available; epoch selection is resolved only when bracketed RPC observations agree. Actual transfers, hooks and future configuration changes are not verified. No risk rating, hook behavior, or delegate power is asserted. Account-level extensions are not covered." },
      interpretation: "Observed Token-2022 mint extensions are evidence, not proof of malicious behavior."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", error: "Token-2022 extension inspection unavailable; no absence or safety conclusion can be made." }, { status: 503 });
  }
}
