// Experimental descriptive indicators only. Not a scam detector or credit rating.
// Every finding carries observed transaction signatures; no verified threat labels are inferred.
export function assessGlitchEvidence(pages, { hasMore = true } = {}) {
  const signatures = pages.flatMap(p => p.pagination?.pageSignatures || []);
  const unique = new Set(signatures);
  const decoded = pages.reduce((n,p) => n + (p.coverage?.transactionsDecoded || 0), 0);
  const unavailable = pages.reduce((n,p) => n + (p.coverage?.transactionsUnavailable || 0), 0);
  const transfers = pages.flatMap(p => p.transfers || []).filter(t =>
    (t.direction === "incoming" || t.direction === "outgoing") &&
    Number.isFinite(Number(t.amountSOL)) && Number(t.amountSOL) > 0 &&
    unique.has(t.signature)
  );
  const findings = [];
  const limitations = [];
  if (signatures.length !== unique.size) limitations.push("Duplicate signatures detected; evidence integrity failed.");
  if (unavailable) limitations.push(unavailable + " transactions were unavailable for decoding.");
  if (hasMore) limitations.push("Additional RPC-visible history may exist.");
  if (!pages.length) limitations.push("Deep analysis has not started.");
  limitations.push("Only explicit native SOL transfers are assessed; SPL tokens, swaps and program behavior are not covered.");
  limitations.push("Historical completeness and external threat labels are not independently verified.");

  const byCounterparty = new Map();
  for (const transfer of transfers) {
    if (!transfer.counterparty) continue;
    const entry = byCounterparty.get(transfer.counterparty) || { volume: 0, signatures: new Set(), count: 0 };
    entry.volume += Number(transfer.amountSOL);
    entry.count++;
    entry.signatures.add(transfer.signature);
    byCounterparty.set(transfer.counterparty, entry);
  }
  const ranked = [...byCounterparty.entries()].sort((a,b) => b[1].volume - a[1].volume);
  const totalVolume = ranked.reduce((n,[,x]) => n + x.volume, 0);
  const topShare = totalVolume > 0 ? ranked[0][1].volume / totalVolume : null;
  const topDistinctTransactions = ranked.length ? ranked[0][1].signatures.size : 0;
  if (topShare !== null && topShare >= 0.5 && topDistinctTransactions >= 3) {
    findings.push({
      id: "counterparty-concentration", classification: "heuristic", severity: "informational",
      title: "Concentrated observed SOL transfer volume",
      explanation: (100 * ranked[0][1].volume / totalVolume).toFixed(1) + "% of decoded explicit SOL transfer volume involves one counterparty. Concentration alone is not evidence of fraud.",
      signatures: [...ranked[0][1].signatures].slice(0, 10),
      supportingTransactions: ranked[0][1].signatures.size,
      rule: "At least 50% of observed explicit native SOL transfer volume with the same counterparty across at least 3 distinct decoded transactions.",
      scope: "decoded explicit native SOL transfers"
    });
  }
  const out = transfers.filter(t => t.direction === "outgoing");
  const incoming = transfers.filter(t => t.direction === "incoming");
  if (out.length >= 5 && incoming.length >= 5) {
    findings.push({
      id: "bidirectional-flow", classification: "heuristic", severity: "informational",
      title: "Both incoming and outgoing SOL activity observed",
      explanation: incoming.length + " incoming and " + out.length + " outgoing explicit SOL transfer instructions were decoded. This is normal for many wallets and is not a scam indicator.",
      signatures: [...new Set([...incoming, ...out].map(t => t.signature))].slice(0, 10),
      scope: "decoded explicit native SOL transfers",
      rule: "At least 5 incoming and 5 outgoing explicit native SOL transfer instructions."
    });
  }
  const integrityOk = signatures.length === unique.size && unavailable === 0;
  const confidence = !integrityOk || decoded < 20 ? "insufficient" :
    !hasMore && decoded >= 100 ? "moderate" : "low";
  const ruleChecks = [
    { id: "counterparty-concentration", title: "Counterparty concentration",
      threshold: "50% or more of observed explicit SOL transfer volume, supported by at least 3 distinct transactions",
      observed: topShare === null ? "No qualifying transfer volume" : (topShare * 100).toFixed(2) + "% across " + topDistinctTransactions + " distinct transactions",
      triggered: topShare !== null && topShare >= 0.5 && topDistinctTransactions >= 3 },
    { id: "bidirectional-flow", title: "Bidirectional SOL flow",
      threshold: "At least 5 incoming and 5 outgoing explicit SOL transfer instructions",
      observed: incoming.length + " incoming; " + out.length + " outgoing",
      triggered: incoming.length >= 5 && out.length >= 5 }
  ];
  const confidenceExplanation = confidence === "insufficient"
    ? "Fewer than 20 decoded transactions, unavailable records, or duplicate signatures prevent an adequate evidence assessment."
    : confidence === "moderate"
      ? "At least 100 decoded transactions, no unavailable records or duplicates, and the current RPC returned no further signatures. This is evidence coverage confidence, not fraud-detection accuracy."
      : "Observed records are internally consistent, but the scanned history is limited or additional RPC-visible transactions may exist. This is evidence coverage confidence, not fraud-detection accuracy.";
  return {
    version: "glitch-risk-indicators-v1",
    assessmentStatus: integrityOk && decoded >= 20 ? "experimental" : "insufficient_evidence",
    riskScore: null, riskBand: "not_assessed", confidence,
    coverage: { pages: pages.length, uniqueSignatures: unique.size, decodedTransactions: decoded,
      unavailableTransactions: unavailable, rpcVisibleHistoryExhausted: pages.length > 0 && !hasMore,
      completeChainHistoryVerified: false },
    findings, ruleChecks, confidenceExplanation, limitations
  };
}
