const {decodePump,withdrawalEvidence}=require("../lib/protocol-evidence");
const samples=["5QShvXCWPavPSM2Jb2breH2xPTgcD978XTnu7mU92fya3mQTzGYgXCm8B1fNyZpqjgGdSs9Viks74R9vCHp8qtTk","3TgWRXmKeiBHVzCxG3vC9Vnac63bHkQHiUADvkmhWj1t6Min1YxoL2cHvqczkdCSKYexY4CFMtXex77BBaYDXVmK","cXZkdb8mWX6tKLoVWEgAh8iYBLctuJ8kYHsMKxhoxPp5eafdBXiekzEWpQgo46ruuN4ejNeVqUXSCUqkPPjkk4y","3b5KZrR3zovsy1GdLkyhgQNkgGVARSkSVA4dBXRHp8VmSGCzBwC7cz7sfYT9qeN6Y1dRRybJ7tfHoxbFvjCaoHfG","5yasuqRRUCEBVMmGqB4eJ1uryeJVn81urghoNkFV6aTopytmMvdmteNL6burFkj6CT5wGrqWVengBK7V22xMopq4","VH8p7TYKChXCVmSN5RX18FbrDZYX76WYM9Mkha9orvUUhLh4SR5ALaMrN719MQ18YWJgmcexDpbAKKFfE3k57ni","4CXqTtLSoR4st4wFHqMHiSRmENzRw12obTR8Yo1sEioJR1WJB1x7pf8bqHjQ87SzCbGXJBEsv6zs9chZmQmSGSwY","4VAv5NF389u3jYzW1F6ftY7S1xiczzNCkmqdwWud4HsPus6bE3RgkLZPeYgPM6vM5PyQDg1Y8thN5fq9Pxgtx76d","5szAzonR1xednaLYFUSh9bctDcwq14rcYp8Ax6hncfuJbvTGgWzL171fsrZBv78pjkU4Sej5Ja3ipuF4A2pzH3xT"];
const {layouts,AMM_V4,UNSUPPORTED_ROUTER}=require('../lib/protocol-evidence');
const programs={jupiter:'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',raydium_amm:AMM_V4,raydium_cpmm:'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',raydium_clmm:'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',pumpswap:'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',orca:'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'};
async function rpc(method,params){const r=await fetch(process.env.SOLANA_RPC_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('RPC_HTTP_'+r.status);const j=await r.json();if(j.error)throw Error('RPC_'+j.error.code);return j.result}
function summarize(t,signature,mint){
 const logs=t.meta?.logMessages||[],stack=[],events=[];
 for(const line of logs){let m=line.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) invoke /);if(m){stack.push(m[1]);continue}m=line.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) (success|failed)/);if(m){if(stack.at(-1)===m[1])stack.pop();continue}if(line.startsWith('Program log: Instruction: ')&&stack.length)events.push({program:stack.at(-1),name:line.slice(26).trim()})}
 const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,''),ix=[...(t.transaction?.message?.instructions||[]),...(t.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
 const decoded=ix.map(x=>({x,d:decodePump(x)})).filter(x=>x.d).slice(0,12).map(({x,d})=>({...d,accounts:d.accounts,matchingLogs:events.filter(e=>e.program===d.program&&normalize(e.name)===normalize(d.instruction)).map(e=>e.name).slice(0,3)}));
 const unmatched=ix.filter(x=>!decodePump(x)&&typeof x.data==='string'&&x.programId!== 'ComputeBudget111111111111111111111111111111').slice(0,12).map(x=>({program:x.programId,dataPrefix:x.data.slice(0,32),stackHeight:x.stackHeight??null,logs:events.filter(e=>e.program===x.programId).map(e=>e.name).slice(0,5),status:x.programId===UNSUPPORTED_ROUTER?'UNSUPPORTED_NO_AUTHORITATIVE_LAYOUT':'UNRECOGNIZED_INSTRUCTION'}));
 const balances=[...new Set([...(t.meta?.preTokenBalances||[]),...(t.meta?.postTokenBalances||[])].map(b=>b.mint))];
 const withdrawals=(mint?[mint]:balances).flatMap(m=>withdrawalEvidence(t,m));
 return {signature,solscan:'https://solscan.io/tx/'+signature,slot:t.slot,blockTime:t.blockTime,execution:t.meta?.err===null?'SUCCESS':'FAILED_OR_UNKNOWN',decoded,unmatched,withdrawals,balances:(t.meta?.postTokenBalances||[]).slice(0,20).map(b=>({mint:b.mint,owner:b.owner,accountIndex:b.accountIndex,rawAmount:b.uiTokenAmount?.amount})),validation:t.meta?.err!==null?'EXCLUDED_FAILED_OR_UNKNOWN':decoded.some(d=>d.matchingLogs.length)?'DISCRIMINATOR_AND_PROGRAM_LOG_MATCH':decoded.length?'INSTRUCTION_DECODED_LOG_NAME_UNAVAILABLE':'UNRESOLVED',limitation:'Program logs corroborate instruction names at transaction level. Raw instruction amounts are input parameters or limits, not actual fills. Pool account ownership is checked separately; no manipulation determination.'};
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='GET'||process.env.VERCEL_ENV!=='preview'||!process.env.SOLANA_RPC_URL)return res.status(403).json({error:'PREVIEW_ONLY'});
 try{
  if(req.query.discover){const program=programs[req.query.discover];if(!program)return res.status(400).json({error:'UNSUPPORTED_DISCOVERY_PROGRAM'});
   // One bounded page. Never iterate arbitrary history or retrieve transaction bodies here.
   const address=req.query.pool||program;if(req.query.pool&&!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))return res.status(400).json({error:'INVALID_POOL'});
   let poolVerification=null;if(req.query.pool){const a=await rpc('getAccountInfo',[address,{encoding:'base64',commitment:'finalized'}]);poolVerification={address,owner:a?.value?.owner||null,expectedProgram:program,verified:a?.value?.owner===program};if(!poolVerification.verified)return res.status(400).json({error:'POOL_PROGRAM_OWNER_MISMATCH',poolVerification})}
   const rows=await rpc('getSignaturesForAddress',[address,{limit:12,commitment:'finalized'}]);return res.status(200).json({program,poolVerification,scope:'ONE_PAGE_MAX_12_SIGNATURES',signatures:(rows||[]).map(s=>({signature:s.signature,slot:s.slot,execution:s.err===null?'SUCCESS':'FAILED',blockTime:s.blockTime}))});
  }
  const i=Number(req.query.sample||0),explicit=req.query.signature;if(explicit&&!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(explicit))return res.status(400).json({error:'INVALID_SIGNATURE'});
  if(!explicit&&(!Number.isInteger(i)||i<0||i>=samples.length))return res.status(400).json({error:'INVALID_SAMPLE'});
  const signature=explicit||samples[i],t=await rpc('getTransaction',[signature,{encoding:'jsonParsed',commitment:'finalized',maxSupportedTransactionVersion:1}]);if(!t)return res.status(502).json({error:'TRANSACTION_UNAVAILABLE'});
  const result=summarize(t,signature,req.query.mint);const pools=[...new Set(result.decoded.map(d=>d.roles.pool).filter(Boolean))].slice(0,6);
  if(pools.length){const a=await rpc('getMultipleAccounts',[pools,{encoding:'base64',commitment:'finalized'}]);result.poolAccounts=pools.map((address,n)=>({address,owner:a?.value?.[n]?.owner||null,expectedPrograms:[...new Set(result.decoded.filter(d=>d.roles.pool===address).map(d=>d.program))],exists:!!a?.value?.[n],programOwnerVerified:result.decoded.filter(d=>d.roles.pool===address).every(d=>d.program===a?.value?.[n]?.owner)}))}
  return res.status(200).json(result);
 }catch(e){return res.status(503).json({error:e.message.startsWith('RPC_')?e.message:'RPC_RETRIEVAL_FAILED'})}
};
module.exports.summarize=summarize;
