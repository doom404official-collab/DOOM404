const endpoint=process.env.HELIUS_RPC_URL;
if(!endpoint?.startsWith("https://"))throw Error("RPC_NOT_CONFIGURED");
const signature="37WZYkLnwzcPmYdoydTRhYAoUAcFGwHYem3QGt6exoSqt8H2SCZZuB5uUZg3Dd9NyTjYr62nhaxT2VbMELDKocA6";
const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getTransaction",params:[signature,{encoding:"jsonParsed",maxSupportedTransactionVersion:1}]}),signal:AbortSignal.timeout(30000)});
const j=await r.json(),tx=j.result;
if(!r.ok||j.error||!tx||tx.slot!==450097547||tx.meta?.err!==null)throw Error("TRANSACTION_UNVERIFIED");
const ix=tx.transaction.message.instructions[6];
if(ix.programId!=="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA")throw Error("PARENT_NOT_PUMP_AMM");
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decode58(s){let n=0n;for(const c of s){const v=alphabet.indexOf(c);if(v<0)throw Error("INVALID_BASE58");n=n*58n+BigInt(v)}const b=[];while(n){b.unshift(Number(n&255n));n>>=8n}for(const c of s){if(c!=="1")break;b.unshift(0)}return Buffer.from(b)}
const bytes=decode58(ix.data);
const disc=bytes.subarray(0,8).toString("hex");
const known={"66063d1201daebea":"buy","c62e1552b4d9e870":"buy_exact_quote_in","f223c68952e1f2b6":"deposit","33e685a4017f83ad":"sell","b712469c946da122":"withdraw","0830be07b644b7e5":"sweep_protocol_fee","20f6bf3408c949ba":"sweep_creator_fee"};
console.log(JSON.stringify({status:"OBSERVED_ONLY",slot:tx.slot,outerInstructionIndex:6,discriminatorHex:disc,operationCandidate:known[disc]??null,accountCount:ix.accounts?.length??null,scorePromoted:false,feeAuthorizationVerified:false}));
