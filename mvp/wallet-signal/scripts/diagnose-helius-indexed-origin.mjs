import {fetchHeliusOldestOriginCandidates} from '../lib/heliusIndexedOriginProvider.mjs';
const mint=process.env.CREATOR_INVESTIGATION_MINT||'98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
if(process.env.GLITCH_INDEXED_ORIGIN_DIAGNOSTIC!=='true')throw Error('INDEXED_DIAGNOSTIC_OPT_IN_REQUIRED');
if(!process.env.HELIUS_RPC_URL)throw Error('HELIUS_RPC_URL_MISSING');
let requests=0;
const budget={take:async()=>{if(requests>=1)throw Error('DIAGNOSTIC_REQUEST_LIMIT');requests++;}};
const result=await fetchHeliusOldestOriginCandidates({mint,rpcUrl:process.env.HELIUS_RPC_URL,budget,enabled:true,limit:5});
console.log(JSON.stringify({status:result.status,requests,candidates:result.candidates?.length||0,
 archiveComplete:false,providerPaginationAvailable:Boolean(result.providerPaginationToken)}));
if(result.status!=='CANDIDATES')process.exitCode=1;
