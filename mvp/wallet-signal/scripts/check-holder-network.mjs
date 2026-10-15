import {fetchMintHolderSnapshot} from '../lib/solanaHolderSnapshot.mjs';
import {investigateHolderSample} from '../lib/holderSampleInvestigation.mjs';
const rpcUrl=process.env.HELIUS_RPC_URL,mint=process.env.TEST_TOKEN_MINT;
if(!rpcUrl||!mint){console.error('Missing RPC URL or mint');process.exitCode=2;}
else try{
 const snapshot=await fetchMintHolderSnapshot({rpcUrl,mint});
 const startIndex=Number(process.env.HOLDER_START_INDEX??0);
 const batchSize=Number(process.env.HOLDER_BATCH_SIZE??5);
 const result=await investigateHolderSample({rpcUrl,snapshot,holderLimit:20,startIndex,batchSize,historyLimit:10,maxPages:2});
 console.log(JSON.stringify({mint,holderCount:snapshot.holders.length,slot:snapshot.slot,...result}));
}catch(error){
 console.error(JSON.stringify({status:'error',reason:String(error.message).replaceAll(rpcUrl,'[REDACTED]')}));
 process.exitCode=1;
}
