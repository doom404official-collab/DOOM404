import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const batches={holder_origin:[
 '5BEqVfb2EhzfYmaefvmhwpay1eN2jWvTADKbs3DYZcJLGjhsKGG93qLGqDcXETh39iuQfbsvrGKjhui7ne1AJjKL',
 'KMoj9pQq8XncaZPHQ5bTNZPDgQwfCBgdihVkxc5Y27fh7iGYwMbti2Mcscprhia1NBJauBbEvs5DE8ooWKWg6bs',
 '4vMXPSiiUQgdsEfVmRkHGFvdWyf8EQJX8n1tVqjRj7qnwu9W31dmxyVGwxm4CsjzPywxvEiJPidjPkGdgbd3PxdN'
],creator_outflows:[
 '2tqJx2jEhP8Rx5SMB9qqw7RYrekqmgH78dRdeVmv6oSor4Rgb4m4tLjZLT9DCPLd4VwVsFUJhxYzwZUvTxwQShCN',
 '3i8UBbXPmQUBaX9sReQ9bR1LZC1C14DzjfRorXydy2FDzWAVmWpPyxHarmoVpwNQuoA2RQiXyBPTTVmW5VwcucTj',
 '4FP1JbrUgBRuHvMkYGVY9kawZY4fnqwDFddFYAGCkQNemthtLasGyP1J9xtFAiN3TDfPgYgfntkguyNTVHHscSgV'
]};
const signatures=batches[process.env.RECONCILIATION_BATCH??'holder_origin'];
const endpoint=process.env.HELIUS_RPC_URL;let requests=0;const records=[];
try{
 if(!signatures)throw Error('RECONCILIATION_BATCH_INVALID');
 if(!endpoint?.startsWith('https://'))throw Error('HELIUS_ACCESS_UNAVAILABLE');
 for(const signature of signatures){
  requests++;const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:requests,method:'getTransaction',params:[signature,{encoding:'jsonParsed',commitment:'finalized',maxSupportedTransactionVersion:1}]}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('TRANSACTION_PROVIDER_HTTP_FAILURE');const body=await response.text();if(body.length>4000000)throw Error('TRANSACTION_RESPONSE_TOO_LARGE');
  const data=JSON.parse(body);if(data.error)throw Error('TRANSACTION_PROVIDER_RESPONSE_INVALID');
  const transaction=data.result;
  if(transaction!==null&&(!Number.isSafeInteger(transaction?.slot)||transaction?.transaction?.signatures?.[0]!==signature))throw Error('TRANSACTION_IDENTITY_MISMATCH');
  records.push({signature,provider:'helius',commitment:'finalized',observedAt:new Date().toISOString(),responseSha256:createHash('sha256').update(body).digest('hex'),transaction});
  writeFileSync('reconciliation-transactions.json',JSON.stringify({schemaVersion:1,requests,records},null,2)+'\n',{mode:0o600});
 }
 console.log(JSON.stringify({status:'TARGETED_TRANSACTIONS_RETAINED',requests,available:records.filter(r=>r.transaction!==null).length,checkpointModified:false}));
}catch(error){console.log(JSON.stringify({status:'TARGETED_CAPTURE_STOPPED',requests,retained:records.length,reason:/^[A-Z_]+$/.test(error.message)?error.message:'CAPTURE_FAILED'}));process.exitCode=1;}
