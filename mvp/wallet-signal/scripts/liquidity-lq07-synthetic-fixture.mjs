import {writeFile,mkdir} from 'node:fs/promises';
const dir=process.argv[2];if(!dir)throw Error('OUTPUT_DIRECTORY_REQUIRED');
await mkdir(dir,{recursive:true});
const pool='11111111111111111111111111111111',a='1'.repeat(64),b='2'.repeat(64),c='3'.repeat(64);
const prior={schemaVersion:1,pool,before:a,seen:[a],events:[],pages:1,pendingSignatures:[],pendingSignatureCount:0,unresolvedReasons:{},errors:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',requestCount:60,stopReason:'CHECKPOINTED',reconciliation:{reconciliationStatus:'PENDING_SIGNATURES_RECONCILED_HISTORY_UNVERIFIED',originalPendingSignatureCount:2,originalStopReason:'RETRIEVAL_INCOMPLETE',sourceDigest:'a'.repeat(64),replayDigest:'b'.repeat(64),originalSeen:32,recoveredPending:2,verifiedDistinct:34,candidateCount:0,historyExhausted:false}};
const next={...structuredClone(prior),seen:[a,b],pendingSignatures:[c],pendingSignatureCount:1,unresolvedReasons:{[c]:'RPC_TRANSACTION_UNAVAILABLE'},requestCount:120,stopReason:'RETRIEVAL_INCOMPLETE',errors:[{stage:'transaction',signature:c,message:'SYNTHETIC_PROVIDER_SECRET_DO_NOT_UPLOAD'}]};
await writeFile(dir+'/prior.json',JSON.stringify(prior),{flag:'wx'});
await writeFile(dir+'/failed.json',JSON.stringify(next),{flag:'wx'});
