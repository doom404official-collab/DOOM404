import {createHash} from "node:crypto";
import {PublicKey} from "@solana/web3.js";
import {createHolderHistoryCheckpoint} from "./holderHistoryCheckpoint.mjs";
/** Create a stable holder snapshot from fresh RPC balances. */
export async function prepareHolderScanSnapshot({mint,connection}){
 const key=new PublicKey(mint);
 let largest,supply;
 try{largest=await connection.getTokenLargestAccounts(key,"confirmed");}
 catch{throw Error("SNAPSHOT_LARGEST_ACCOUNTS_RPC_FAILED");}
 try{supply=await connection.getTokenSupply(key,"confirmed");}
 catch{throw Error("SNAPSHOT_SUPPLY_RPC_FAILED");}
 const rawSupply=supply?.value?.amount;
 if(typeof rawSupply!=="string"||!/^\d+$/.test(rawSupply))throw Error("INVALID_TOKEN_SUPPLY");
 const total=BigInt(rawSupply);
 if(total<=0n)throw Error("INVALID_TOKEN_SUPPLY");
 const rows=(largest?.value||[]).slice(0,20);
 if(rows.length===0)throw Error("NO_HOLDER_ACCOUNTS");
 const slot=x=>Number.isSafeInteger(x)&&x>=0;
 if(!slot(largest?.context?.slot)||!slot(supply?.context?.slot))throw Error("SNAPSHOT_CONTEXT_MISSING");
 if(supply.context.slot<largest.context.slot)throw Error("SNAPSHOT_CONTEXT_REGRESSED");
 const seen=new Set();let sum=0n;
 for(const row of rows){
  const address=row?.address?.toBase58?.();
  if(!address||seen.has(address)||typeof row.amount!=="string"||!/^\d+$/.test(row.amount))throw Error("INVALID_HOLDER_ACCOUNT");
  seen.add(address);const amount=BigInt(row.amount);sum+=amount;
  if(amount>total||sum>total)throw Error("INVALID_HOLDER_SUPPLY");
 }
 const accounts=[];
 // Bound owner lookups to avoid bursts of 20 concurrent RPC calls.
 for(let i=0;i<rows.length;i+=3){
  try{accounts.push(...await Promise.all(rows.slice(i,i+3).map(row=>connection.getParsedAccountInfo(row.address,{commitment:"confirmed",minContextSlot:supply.context.slot}))));}
  catch{throw Error("SNAPSHOT_OWNER_LOOKUP_RPC_FAILED");}
 }
 const holders=rows.map((row,i)=>{
  const response=accounts[i];
  if(!slot(response?.context?.slot)||response.context.slot<supply.context.slot)throw Error("SNAPSHOT_OWNER_CONTEXT_INVALID");
  const account=response?.value;
  const info=account?.data?.parsed?.info;
  const program=account?.owner?.toBase58?.();
  if(!["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"].includes(program)||account?.data?.parsed?.type!=="account"||info?.mint!==key.toBase58())throw Error("HOLDER_ACCOUNT_IDENTITY_MISMATCH");
  const owner=info?.owner;
  if(typeof owner!=="string"||!owner)throw Error("HOLDER_OWNER_UNRESOLVED");
  return {tokenAccount:row.address.toBase58(),ownerWallet:owner,amountRaw:row.amount,
   sharePct:Number(BigInt(row.amount)*1000000n/total)/10000};
 });
 // Never persist an infrastructure wallet as an eligible holder. The standard
 // largest-accounts RPC is limited to 20; a replacement requires a verified
 // eligible-holder source rather than silently accepting only 19 holders.
 if(holders.some(h=>h.ownerWallet==="1nc1nerator11111111111111111111111111111111"))
  throw Error("ELIGIBLE_HOLDER_SET_REQUIRED");
 const identity=JSON.stringify({mint:key.toBase58(),accounts:holders.map(row=>[row.tokenAccount,row.ownerWallet])});
 const holderSetHash=createHash("sha256").update(identity).digest("hex");
 const checkpoint=createHolderHistoryCheckpoint({mint:key.toBase58(),holders});
 checkpoint.snapshot={source:"solana_rpc",commitment:"confirmed",supplyRaw:rawSupply,largestAccountsSlot:largest.context.slot,supplySlot:supply.context.slot,ownerSlots:accounts.map(a=>a.context.slot),capturedAt:new Date().toISOString(),sameSlot:accounts.every(a=>a.context.slot===largest.context.slot)&&supply.context.slot===largest.context.slot};
 // Multiple RPC reads are a dated observation, not an atomic or historical snapshot.
 return {mint:key.toBase58(),holderSetHash,checkpoint};
}
