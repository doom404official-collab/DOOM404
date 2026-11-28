// Normalize RPC parsed/partially decoded instructions for a reviewed schema.
// Never infer creator from fee payer, signer order, or token mint authority.
import bs58 from "bs58";
import { decodeLaunchCreator } from "./launchCreatorDecoder.js";

const address = value => typeof value === "string" ? value : value?.toBase58?.() || null;
export function inspectLaunchCreationTransaction({ mint, signature, transaction, schemas = [] } = {}) {
  const message = transaction?.transaction?.message;
  if (!mint || !message || transaction?.meta?.err || !signature) {
    return { status: "unverified", launchCreator: null, launchCreatorVerified: false, reason: "Successful transaction and signature required" };
  }
  const outer = Array.isArray(message.instructions) ? message.instructions : [];
  const inner = (transaction.meta?.innerInstructions || []).flatMap(group => group.instructions || []);
  const accountKeys = (message.accountKeys || []).map(k => address(k.pubkey || k));
  const all = [...outer, ...inner];
  const observations = [];
  for (const ix of all) {
    const programId = address(ix.programId) || (Number.isInteger(ix.programIdIndex) ? accountKeys[ix.programIdIndex] : null);
    const rawAccounts = (ix.accounts || []).map(k => typeof k === "number" ? accountKeys[k] : address(k));
    if (!programId || !rawAccounts.length || typeof ix.data !== "string") continue;
    let dataBytes;
    try { dataBytes = [...bs58.decode(ix.data)]; } catch { continue; }
    for (const schema of schemas) {
      if (schema.programId !== programId || schema.reviewed !== true) continue;
      const result = decodeLaunchCreator({ mint, instruction: { programId, accounts: rawAccounts, dataBytes }, schema });
      if (result.status === "launch_creator_observed") observations.push({ ...result, signature, blockTime: transaction.blockTime ?? null, programId });
    }
  }
  if (observations.length === 1) return observations[0];
  return { status: observations.length ? "ambiguous_creator" : "no_reviewed_creation_match",
    launchCreator: null, launchCreatorVerified: false, signature,
    reason: observations.length ? "Multiple creation matches require manual review" : "No matching reviewed creation instruction schema; creator remains unverified" };
}
