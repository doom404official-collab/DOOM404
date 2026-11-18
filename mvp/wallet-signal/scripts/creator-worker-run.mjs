import { createCreatorIntelligenceJobStore } from '../lib/creatorIntelligenceJobStore.mjs';
import { runCreatorIntelligenceTick } from '../lib/creatorIntelligenceTick.mjs';

const mint = process.env.CREATOR_INVESTIGATION_MINT || '98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'HELIUS_RPC_URL'];
if (required.some(key => !process.env[key])) throw Error('CREATOR_WORKER_CONFIGURATION_MISSING');

const store = createCreatorIntelligenceJobStore({
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY
});
await store.enqueue(mint);
const result = await runCreatorIntelligenceTick({
  mint,
  store,
  rpcUrl: process.env.HELIUS_RPC_URL,
  maxRequests: 500,
  maxDurationMs: 90000,
  indexedOriginEnabled: process.env.GLITCH_INDEXED_ORIGIN_ENABLED === 'true'
});
console.log(JSON.stringify({
  status: result.status,
  stage: result.stage,
  requests: result.requests,
  errorCode: result.errorCode || null
}));

if(result.errorCode)throw Error('CREATOR_INVESTIGATION_INCOMPLETE_ERROR: '+result.errorCode);
