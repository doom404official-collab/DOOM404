/** Private Supabase REST storage adapter; no client-side use.
 * Explicitly configured only after Preview Supabase provisioning.
 */
export function createIntelligenceVault({ url, serviceRoleKey, fetchImpl = fetch } = {}) {
  if (!url || !/^https:\/\/[^/]+\.supabase\.co\/?$/.test(url)) throw Error("VAULT_URL_INVALID");
  if (!serviceRoleKey || typeof serviceRoleKey !== "string") throw Error("VAULT_CREDENTIAL_MISSING");
  const base = url.replace(/\/$/, "") + "/rest/v1/";
  const address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  async function request(table, { method = "GET", query = "", data } = {}) {
    const response = await fetchImpl(base + table + query, {
      method, cache: "no-store",
      headers: { apikey: serviceRoleKey, authorization: "Bearer " + serviceRoleKey,
        "content-type": "application/json", prefer: "return=minimal,resolution=merge-duplicates" },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error(response.status === 429 ? "VAULT_RATE_LIMITED" :
      [401,403].includes(response.status) ? "VAULT_AUTH_FAILED" : "VAULT_REQUEST_FAILED");
    if (method === "GET") {
      const result = await response.json();
      if (!Array.isArray(result)) throw Error("VAULT_INVALID_RESPONSE");
      return result;
    }
    return true;
  }
  return {
    async getAttribution(mint) {
      if (!address.test(mint || "")) throw Error("INVALID_MINT");
      const rows = await request("token_creator_attributions", { query: "?mint=eq." + mint + "&select=*" });
      return rows[0] || null;
    },
    async putIndexedAttribution({ mint, indexedCreator, creationTimestamp }) {
      if (!address.test(mint || "") || !address.test(indexedCreator || "")) throw Error("INVALID_ADDRESS");
      if (!Number.isSafeInteger(creationTimestamp) || creationTimestamp <= 0) throw Error("INVALID_TIMESTAMP");
      // Never overwrite verified attribution via an indexed-only observation.
      const existing = await this.getAttribution(mint);
      if (existing?.status === "VERIFIED" || existing?.status === "ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW" || existing?.status === "CONFLICT") return false;
      await request("token_creator_attributions", {
        method: "POST", query: "?on_conflict=mint",
        data: { mint, indexed_creator: indexedCreator, creation_timestamp: new Date(creationTimestamp > 1e12 ? creationTimestamp : creationTimestamp * 1000).toISOString(),
          status: "INDEXED_UNVERIFIED", last_checked_at: new Date().toISOString() },
      });
      return true;
    },
    async storeCreatorEvidence(payload) {
      const required=["p_mint","p_creator","p_signature","p_program_id","p_decoder_version"];
      if(!payload||required.some(k=>typeof payload[k]!=="string"||!payload[k]))throw Error("INVALID_EVIDENCE_PAYLOAD");
      if(!address.test(payload.p_mint)||!address.test(payload.p_creator)||
         !address.test(payload.p_program_id)||!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(payload.p_signature))
        throw Error("INVALID_EVIDENCE_PAYLOAD");
      const response=await fetchImpl(base+"rpc/store_creator_evidence",{
        method:"POST",cache:"no-store",
        headers:{apikey:serviceRoleKey,authorization:"Bearer "+serviceRoleKey,
          "content-type":"application/json"},
        body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)
      });
      if(!response.ok)throw Error([401,403].includes(response.status)?"VAULT_AUTH_FAILED":"VAULT_EVIDENCE_WRITE_FAILED");
      const status=await response.json();
      if(!["ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW","CONFLICT"].includes(status))throw Error("VAULT_UNEXPECTED_EVIDENCE_STATUS");
      return status;
    },
    async getCreatorEvidence(mint) {
      if(!address.test(mint||""))throw Error("INVALID_MINT");
      return request("onchain_transaction_evidence",{
        query:"?mint=eq."+mint+"&select=signature,mint,program_id,decoded_creator,decoder_version,verification_status"
      });
    },
    async getCheckpoint(mint) {
      if (!address.test(mint || "")) throw Error("INVALID_MINT");
      const rows = await request("creator_investigation_checkpoints", { query: "?mint=eq." + mint + "&select=checkpoint" });
      return rows[0]?.checkpoint || null;
    },
    async saveCheckpoint(checkpoint) {
      const { validateCreatorCheckpoint } = await import("./creatorInvestigationCheckpoint.mjs");
      validateCreatorCheckpoint(checkpoint);
      await request("creator_investigation_checkpoints", { method: "POST", query: "?on_conflict=mint",
        data: { mint: checkpoint.mint, indexed_creator: checkpoint.indexedCreator,
          created_timestamp: checkpoint.createdTimestamp, checkpoint_version: checkpoint.version,
          checkpoint, updated_at: new Date().toISOString() } });
    },
  };
}
