const {decodePump}=require("../lib/protocol-evidence");
const M=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const S=/^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
module.exports=async(req,res)=>{
res.setHeader("Cache-Control","no-store");
const {mint,signature}=req.query;if(req.method!=="GET"||typeof mint!=="string"||typeof signature!=="string"||!M.test(mint)||!S.test(signature))return res.status(400).json({error:"Invalid request"});
try{
const r=await fetch(process.env.SOLANA_RPC_URL||"https://api.mainnet-beta.solana.com",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getTransaction",params:[signature,{encoding:"jsonParsed",commitment:"finalized",maxSupportedTransactionVersion:0}]}),signal:AbortSignal.timeout(8000)});
const j=await r.json(),t=j.result;if(!r.ok||j.error||!t||t.meta?.err!==null)return res.status(422).json({mint,signature,status:"TRANSACTION_UNAVAILABLE"});
const msg=t.transaction.message,keys=msg.accountKeys.map(k=>typeof k==="string"?k:k.pubkey),pre=t.meta.preTokenBalances||[],post=t.meta.postTokenBalances||[];
const lookup=(account,owner,token)=>{const index=keys.indexOf(account);const rows=[...pre,...post].filter(b=>b.accountIndex===index);return index>=0&&rows.length&&rows.every(b=>b.owner===owner&&b.mint===token)};
const delta=account=>{const i=keys.indexOf(account);return BigInt(post.find(b=>b.accountIndex===i)?.uiTokenAmount.amount||"0")-BigInt(pre.find(b=>b.accountIndex===i)?.uiTokenAmount.amount||"0")};
const results=[],diagnostics=[];const diagnostic=req.query.diagnostic==='1';
for(let i=0;i<msg.instructions.length;i++){
const ix=msg.instructions[i],d=decodePump(ix);const row={outerIndex:i,program:ix.programId,instruction:d?.instruction||null,layout:d?.layoutStatus||null,seller:d?.accountRoles?.user||null,exactMint:d?.accountRoles?.base_mint===mint};if(diagnostic&&ix.programId==="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA")diagnostics.push(row);if(d?.protocol!=="PumpSwap"||d.instruction!=="sell"||d.layoutStatus!=="OFFICIAL_ACCOUNT_LAYOUT"){row.rejection="NOT_SUPPORTED_TOP_LEVEL_SELL_OR_LAYOUT";continue;}
const a=d.accountRoles;if(a.base_mint!==mint||!["So11111111111111111111111111111111111111112","EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"].includes(a.quote_mint)){row.rejection="MINT_OR_QUOTE_MISMATCH";continue;}
if(!lookup(a.user_base_token_account,a.user,mint)||!lookup(a.user_quote_token_account,a.user,a.quote_mint)||!lookup(a.pool_base_token_account,a.pool,mint)||!lookup(a.pool_quote_token_account,a.pool,a.quote_mint)){row.rejection="ACCOUNT_OWNERSHIP_OR_MINT_MISMATCH";row.accountChecks={userBase:!!lookup(a.user_base_token_account,a.user,mint),userQuote:!!lookup(a.user_quote_token_account,a.user,a.quote_mint),poolBase:!!lookup(a.pool_base_token_account,a.pool,mint),poolQuote:!!lookup(a.pool_quote_token_account,a.pool,a.quote_mint)};continue;}
const inner=t.meta.innerInstructions?.find(g=>g.index===i)?.instructions||[];
const amount=(source,destination,token,authority)=>inner.filter(x=>x.stackHeight===2&&["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"].includes(x.programId)&&["transfer","transferChecked"].includes(x.parsed?.type)&&x.parsed.info.source===source&&x.parsed.info.destination===destination&&x.parsed.info.authority===authority&&(!x.parsed.info.mint||x.parsed.info.mint===token)).reduce((n,x)=>n+BigInt(x.parsed.info.tokenAmount?.amount??x.parsed.info.amount),0n);
const out=amount(a.user_base_token_account,a.pool_base_token_account,mint,a.user),gain=amount(a.pool_quote_token_account,a.user_quote_token_account,a.quote_mint,a.pool);
Object.assign(row,{tokenOutRaw:out.toString(),quoteProceedsRaw:gain.toString(),instructionAmount:d.rawInstructionAmount,baseDelta:delta(a.user_base_token_account).toString(),quoteDelta:delta(a.user_quote_token_account).toString()});if(out<=0n||gain<=0n||out.toString()!==d.rawInstructionAmount||delta(a.user_base_token_account)!==-out||delta(a.user_quote_token_account)!==gain){row.rejection=out<=0n?"TOKEN_OUTFLOW_MISSING":gain<=0n?"QUOTE_PROCEEDS_MISSING":out.toString()!==d.rawInstructionAmount?"INSTRUCTION_AMOUNT_MISMATCH":"BALANCE_DELTA_MISMATCH";continue;}row.rejection=null;
results.push({instruction:"sell",protocol:"PumpSwap",seller:a.user,mint,tokenOutRaw:out.toString(),quoteMint:a.quote_mint,quoteProceedsRaw:gain.toString(),outerIndex:i,source:d.source});
}
if(diagnostic)for(const g of t.meta.innerInstructions||[])for(const x of g.instructions||[]){if(x.programId!=="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA")continue;const d=decodePump(x);if(d)diagnostics.push({outerIndex:g.index,stackHeight:x.stackHeight,instruction:d.instruction,layout:d.layoutStatus,seller:d.accountRoles?.user||null,exactMint:d.accountRoles?.base_mint===mint,rejection:"NESTED_INSTRUCTION_NOT_SUPPORTED"});}return res.status(200).json({mint,signature,slot:t.slot,...(diagnostic?{diagnostics:diagnostics.slice(0,30)}:{}),status:results.length?"SALE_RECONCILED":"NO_EXACT_SALE_MATCH",results,url:"https://solscan.io/tx/"+signature});
}catch{return res.status(502).json({mint,signature,status:"VALIDATION_UNAVAILABLE"})}
};
