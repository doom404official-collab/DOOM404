// Conservative assessment prototype: no overall safety verdict with incomplete coverage.
// Attribute signals are descriptive, not probabilistic scam-risk estimates.
export function assessTokenEvidence({ result, extensions, concentration, liquidity, creatorEvidence } = {}) {
  const attributes = [];
  const add = (id, label, score, assessment, explanation, coverage, source) =>
    attributes.push({ id, label, score, assessment, explanation, coverage, source });
  const share = Number(concentration?.largestAccountSharePct);
  if (concentration?.largestAccountSharePct != null && Number.isFinite(share) && share >= 0 && share <= 100) {
    add("concentration", "Token-account concentration", null, share >= 20 ? "Elevated observed concentration" : "Ownership review required",
      "Largest account: " + share.toFixed(2) + "% of supply. Account balances do not establish unique beneficial owners; pools and custody are not classified.",
      "partial", "Solana RPC");
  } else add("concentration","Token-account concentration",null,"Not assessed","Largest-account evidence unavailable.","missing","Solana RPC");
  if (result?.authorityDetailsStatus === "not_parsed" || !result) {
    add("permissions","Mint and freeze permissions",null,"Not assessed","Authority fields were not reliably parsed.","missing","Solana RPC");
  } else {
    const present = [result.mintAuthority ? "mint" : null,result.freezeAuthority ? "freeze" : null].filter(Boolean);
    add("permissions","Mint and freeze permissions",present.length ? 35 : 85,present.length ? "Permissions remain active" : "Mint and freeze authorities not present",
      present.length ? "Observed active authorities: "+present.join(", ")+". Presence is not proof of misuse." : "No mint or freeze authority reported in parsed mint state. Other Token-2022 controls may still apply.",
      "partial","Solana RPC");
  }
  if (extensions?.transferFee?.status === "observed") {
    const fee = extensions.transferFee;
    add("transfer_fee","Transfer-fee controls",fee.configAuthorityReported && fee.configAuthority ? 35 : null,
      fee.configAuthorityReported && fee.configAuthority ? "Fee changes may be possible" : "Fee configuration needs review",
      "Observed fee configuration does not establish the actual fee charged. Unknown authority status is not revoked.",
      "partial","Token-2022 parsed RPC");
  } else add("transfer_fee","Transfer-fee controls",null,"Not assessed","No verified fee-control assessment. Absence of an observed extension is not proof of absence.","missing","Token-2022 parsed RPC");
  if (liquidity?.reportedLiquidityUsd != null) {
    add("liquidity","Liquidity resilience",null,"Liquidity reported; resilience unverified",
      "Third-party reported liquidity: $"+Math.round(liquidity.reportedLiquidityUsd).toLocaleString("en-US")+". Reserve custody, LP locks and market-cap context remain unverified.",
      "partial","DexScreener");
  } else add("liquidity","Liquidity resilience",null,"Not assessed","No verified liquidity-resilience evidence.","missing","DexScreener");
  const creatorWallet = creatorEvidence?.creator;
  const creatorStatus = creatorEvidence?.status;
  if (creatorWallet && creatorStatus === "VERIFIED") {
    add("creator","Creator attribution",null,"Launch creator independently verified",
      "Attributed wallet: " + creatorWallet + ". Attribution alone does not establish beneficial ownership or previous launch behavior.",
      "verified","Creator Intelligence");
  } else if (creatorWallet && creatorStatus === "ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW") {
    add("creator","Creator attribution",null,"On-chain creator match; review pending",
      "Candidate wallet: " + creatorWallet + ". Independent review remains pending; previous launches are not assessed.",
      "partial","Creator Intelligence");
  } else {
    add("creator","Creator attribution",null,"Creator not established",
      "No independently verified launch-creator attribution is available for this scan.",
      "missing","Creator Intelligence");
  }
  const verifiedCount = attributes.filter(a=>a.coverage === "verified").length;
  const partialCount = attributes.filter(a=>a.coverage === "partial").length;
  const missingCount = attributes.filter(a=>a.coverage === "missing").length;
  // Scores from partially assessed permissions must not imply a complete token score.
  const coverageCount = attributes.filter(a=>a.coverage !== "missing").length;
  return {
    version:"prototype_v1", attributes,
    assessedAttributes: coverageCount, totalAttributes: attributes.length,
    verifiedAttributes: verifiedCount, partialAttributes: partialCount, missingAttributes: missingCount,
    verifiedCoveragePct: Math.round(verifiedCount/attributes.length*100),
    evidenceCoveragePct: Math.round(coverageCount/attributes.length*100),
    consolidatedScore: null, consolidatedStatus: "withheld_incomplete_evidence",
    message: "Overall score withheld until ownership, liquidity controls, token extensions and creator evidence meet validated coverage requirements. Individual permission scores are provisional, not token safety ratings."
  };
}
