import {createHash} from "node:crypto";
import {PublicKey} from "@solana/web3.js";
import {createHolderHistoryCheckpoint} from "./holderHistoryCheckpoint.mjs";
/** Create a stable holder snapshot from fresh RPC balances. */
export async function prepareHolderScanSnapshot({mint,connection}){
 const key=new PublicKey(mint);
 const [largest,supply]=await Promise.all([
  connection.getTokenLargestAccounts(key,"confirmed"),
  connection.getTokenSupply(key,"confirmed")
 ]);
 const total=BigInt(supply?.value?.amount||"0");
 if(total<=0n)throw Error("INVALID_TOKEN_SUPPLY");
 const rows=(largest?.value||[]).slice(0,20);
 if(rows.length===0)throw Error("NO_HOLDER_ACCOUNTS");
 const accounts=await Promise.all(rows.map(row=>connection.getParsedAccountInfo(row.address,"confirmed")));
 const holders=rows.map((row,i)=>{
  const owner=accounts[i]?.value?.data?.parsed?.info?.owner;
  if(typeof owner!=="string"||!owner)throw Error("HOLDER_OWNER_UNRESOLVED");
  return {tokenAccount:row.address.toBase58(),ownerWallet:owner,
   sharePct:Number(BigInt(row.amount)*1000000n/total)/10000};
 });
 const identity=JSON.stringify({mint:key.toBase58(),accounts:holders.map(row=>[row.tokenAccount,row.ownerWallet])});
 const holderSetHash=createHash("sha256").update(identity).digest("hex");
 return {mint:key.toBase58(),holderSetHash,checkpoint:createHolderHistoryCheckpoint({mint:key.toBase58(),holders})};
}
