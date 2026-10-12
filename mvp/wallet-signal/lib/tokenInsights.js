// Evidence ranking, not a token safety or investment score.
// Every candidate states its coverage and interpretation limitations.
export function selectTokenInsights({ result, extensions, concentration, liquidity, now = Date.now() }) {
  const candidates = [];
  const push = (priority, title, detail, confidence, source, category) =>
    candidates.push({ priority, title, detail, confidence, source, category });
  const fee = extensions?.transferFee;
  if (fee?.status === "observed") {
    const oldFee = fee.olderFee, newFee = fee.newerFee;
    const rates = oldFee && newFee ? oldFee.percentage + "% / " + newFee.percentage + "%" : "not fully parsed";
    if (fee.configAuthorityReported && fee.configAuthority) {
      push(95, "Transfer-fee changes remain possible", "Reported fee schedules: " + rates + ". Configuration authority is present; future changes may be possible. Actual transaction fees and effective schedule are not independently verified.", "Parsed on-chain RPC; effective fee unverified", "Token-2022 mint", "permission");
    } else {
      push(70, "Transfer-fee configuration observed", "Reported fee schedules: " + rates + ". Configuration authority: " + (fee.configAuthorityReported ? "revoked" : "unknown") + ". Effective fees are not independently verified.", "Parsed on-chain RPC; effective fee unverified", "Token-2022 mint", "fee");
    }
  }
  if (extensions?.verified && extensions.extensions?.some(x => x.type === "permanentDelegate")) {
    push(100, "Permanent delegate extension observed", "Mint reports a permanent-delegate extension. Delegate identity and effective powers require separate configuration verification.", "Extension presence verified; powers unverified", "Token-2022 mint", "permission");
  }
  if (extensions?.verified && extensions.extensions?.some(x => x.type === "transferHook")) {
    push(98, "Transfer hook extension observed", "Mint reports a transfer-hook extension. Hook program behavior and restrictions have not been verified.", "Extension presence verified; behavior unverified", "Token-2022 mint", "permission");
  }
  if (result?.authorityDetailsStatus !== "not_parsed" && (result?.mintAuthority || result?.freezeAuthority)) {
    push(92, "Token authority remains present", [result.mintAuthority ? "Mint authority present" : null, result.freezeAuthority ? "Freeze authority present" : null].filter(Boolean).join("; ") + ". Authority presence alone does not prove misuse.", "Parsed on-chain RPC", "Solana mint account", "permission");
  }
  if (concentration?.largestAccountSharePct != null) {
    const share = Number(concentration.largestAccountSharePct);
    if (Number.isFinite(share)) push(share >= 20 ? 90 : 45, "Largest token-account balance", "Largest observed token account: " + share + "% of supply. Token accounts are not unique owners; pools and custody may distort concentration.", "On-chain account balances; ownership unresolved", "Solana RPC", "concentration");
  }
  if (liquidity?.reportedLiquidityUsd != null) {
    const observed = Date.parse(liquidity.observedAt || "");
    const age = Number.isFinite(observed) ? Math.max(0, now - observed) : Infinity;
    const freshness = age <= 5 * 60_000 ? "recent retrieval" : age <= 60 * 60_000 ? "older retrieval" : "stale or undated";
    push(age > 60 * 60_000 ? 65 : 40, "Reported liquidity", "Provider estimates $" + Math.round(liquidity.reportedLiquidityUsd).toLocaleString("en-US") + " across " + liquidity.poolCountReturned + " returned pools. LP locks and withdrawal rights unverified.", "Third-party estimate; " + freshness, "DexScreener" + (liquidity.observedAt ? " · " + liquidity.observedAt : ""), "liquidity");
  }
  if (!candidates.length) push(1, "Evidence currently unavailable", "No eligible observations could be established. This is not a safety assessment.", "Insufficient evidence", "Available providers", "coverage");
  candidates.sort((a,b) => b.priority - a.priority || a.title.localeCompare(b.title));
  return candidates.slice(0,3).map(({ priority, ...item }) => item);
}
