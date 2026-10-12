// StonkFun public token index: provider attribution only, never on-chain creator verification.
// Public index documented at https://stonkfun.xyz/api/public/total-assets
const INDEX_URL = "https://stonkfun.xyz/api/public/total-assets";
const PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIG = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
const keys = ["mint", "mintAddress", "tokenMint", "address", "baseMint"];
const creatorKeys = ["creator", "creatorWallet", "creatorAddress", "deployer"];
const sigKeys = ["creationSignature", "launchSignature", "signature", "txSignature"];
function findToken(value, mint, depth = 0, budget = {remaining: 12000}) {
  if (depth > 7 || budget.remaining-- <= 0 || !value || typeof value !== "object") return null;
  if (!Array.isArray(value) && keys.some(k => value[k] === mint)) return value;
  const children = Array.isArray(value) ? value : Object.values(value);
  for (const child of children) {
    const found = findToken(child, mint, depth + 1, budget);
    if (found) return found;
  }
  return null;
}
export function parseStonkFunIndex(payload, mint) {
  if (!PUBKEY.test(mint || "")) return { status: "invalid_mint" };
  const token = findToken(payload, mint);
  if (!token) return { status: "not_found", source: INDEX_URL };
  const creator = creatorKeys.map(k => token[k]).find(x => typeof x === "string" && PUBKEY.test(x)) || null;
  const signature = sigKeys.map(k => token[k]).find(x => typeof x === "string" && SIG.test(x)) || null;
  return {
    status: "provider_record_observed", platform: "StonkFun", platformVerifiedAsLauncher: false,
    creatorCandidate: creator, launchCreatorVerified: false, signature,
    source: INDEX_URL, evidenceClass: "provider_reported",
    reason: "Public token-index match; creator role and launch instruction require independent on-chain verification."
  };
}
export async function lookupStonkFun(mint, { fetchImpl = fetch, timeoutMs = 4500 } = {}) {
  if (!PUBKEY.test(mint || "")) return { status: "invalid_mint" };
  try {
    const response = await fetchImpl(INDEX_URL, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (!response.ok) return { status: "provider_unavailable", httpStatus: response.status };
    return parseStonkFunIndex(await response.json(), mint);
  } catch { return { status: "provider_unavailable" }; }
}
