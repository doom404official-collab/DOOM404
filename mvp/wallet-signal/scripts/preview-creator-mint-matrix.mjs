import { createPumpFunIndexedCreatorProvider } from "../lib/pumpFunIndexedCreatorProvider.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyIndexedCreatorViaMint } from "../lib/creatorMintOriginCheck.mjs";
const allowed=process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e";
const mints=(process.env.CREATOR_MATRIX_MINTS||"").split(",").map(x=>x.trim()).filter(Boolean);
if(!allowed) console.log("CREATOR_MINT_MATRIX: SKIPPED_NON_TARGET_ENV");
else if(mints.length!==5||!process.env.HELIUS_RPC_URL) console.log("CREATOR_MINT_MATRIX: SKIPPED_NOT_CONFIGURED");
else {
  const provider=createPumpFunIndexedCreatorProvider();
  const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,pageLimit:100});
  const results=[];
  for(const mint of mints) {
    try {
      const [record]=await provider.lookup(mint);
      if(!record?.creator||!record?.createdTimestamp){results.push({mint,status:"UNRESOLVED",reason:"NO_INDEXED_CREATOR"});continue;}
      const result=await verifyIndexedCreatorViaMint({
        mint,indexedCreator:record.creator,createdTimestamp:record.createdTimestamp,
        lookupSignaturePage:rpc.lookupSignaturePage,fetchTransaction:rpc.fetchTransaction,
        maxPages:8,maxTransactions:30,
      });
      results.push({mint,indexedCreator:record.creator,status:result.status,
        creationSignature:result.creationSignature,evidence:result.evidence,
        pagesFetched:result.pagesFetched,inspected:result.inspected,retrieved:result.retrieved,
        newerThanWindow:result.newerThanWindow,errors:result.errors,
        reachedOlderHistory:result.reachedOlderHistory,historyExhausted:result.historyExhausted,
        limitReached:result.limitReached,resumeRequired:result.resumeRequired});
    }catch{results.push({mint,status:"UNRESOLVED",reason:"MINT_HISTORY_LOOKUP_ERROR"});}
  }
  console.log("CREATOR_MINT_MATRIX:",JSON.stringify({total:results.length,
    onchainMatches:results.filter(r=>r.status==="ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW").length,results}));
}
