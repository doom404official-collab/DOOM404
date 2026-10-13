/** Read-only Pump.fun metadata schema probe.
 * Prints only allowlisted field presence and validated public signature candidates.
 * Does not infer creation signature from unrelated transaction fields.
 */
const mint = process.argv[2] || process.env.CREATOR_VALIDATION_MINT;
const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if (!valid.test(mint || "")) {
  console.error("Usage: node scripts/probe-pumpfun-creation-fields.mjs <MINT>");
  process.exitCode = 2;
} else {
  try {
    const response = await fetch("https://frontend-api-v3.pump.fun/coins-v2/" + mint, {
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("PROVIDER_HTTP_ERROR");
    const data = await response.json();
    if (data?.mint !== mint) throw Error("MINT_MISMATCH");
    const fields = ["creator","created_timestamp","creation_signature","create_tx",
      "creation_tx","creation_transaction","signature","tx_signature","deployment_signature"];
    const signatures = fields.filter(k => /signature|create_tx|creation_tx/.test(k))
      .filter(k => typeof data[k] === "string" && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(data[k]))
      .map(k => ({ field: k, signature: data[k] }));
    console.log("PUMPFUN_SCHEMA_PROBE:", JSON.stringify({
      mint, presentFields: fields.filter(k => Object.hasOwn(data,k)),
      candidateSignatureFields: signatures, creatorFieldPresent: valid.test(data.creator || ""),
      attributionStatus: "INDEXED_UNVERIFIED", rawResponseStored: false,
    }));
  } catch {
    console.log("PUMPFUN_SCHEMA_PROBE:", JSON.stringify({ mint, status: "PROVIDER_OR_SCHEMA_ERROR" }));
    process.exitCode = 1;
  }
}
