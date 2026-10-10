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
  if (totalVolume > 0 && ranked[0][1].volume / totalVolume >= 0.5 && ranked[0][1].signatures.size >= 3) {
    findings.push({
      id: "counterparty-concentration", classification: "heuristic", severity: "informational",
      title: "Concentrated observed SOL transfer volume",
      explanation: (100 * ranked[0][1].volume / totalVolume).toFixed(1) + "% of decoded explicit SOL transfer volume involves one counterparty. Concentration alone is not evidence of fraud.",
      signatures: [...ranked[0][1].signatures].slice(0, 10),
      supportingTransactions: ranked[0][1].signatures.size,
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
      scope: "decoded explicit native SOL transfers"
    });
  }
  const integrityOk = signatures.length === unique.size && unavailable === 0;
  const confidence = !integrityOk || decoded < 20 ? "insufficient" :
    !hasMore && decoded >= 100 ? "moderate" : "low";
  return {
    version: "glitch-risk-indicators-v1",
    assessmentStatus: integrityOk && decoded >= 20 ? "experimental" : "insufficient_evidence",
    riskScore: null, riskBand: "not_assessed", confidence,
    coverage: { pages: pages.length, uniqueSignatures: unique.size, decodedTransactions: decoded,
      unavailableTransactions: unavailable, rpcVisibleHistoryExhausted: pages.length > 0 && !hasMore,
      completeChainHistoryVerified: false },
    findings, limitations
  };
}
