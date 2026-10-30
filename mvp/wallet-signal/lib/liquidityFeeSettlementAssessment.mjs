import {isDeepStrictEqual} from 'node:util';
const raw=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&x.length<=20&&BigInt(x)<=18446744073709551615n;
const index=x=>Number.isSafeInteger(x)&&x>=0;
export function assessFeeSettlement({sweepAccounts,transferEvidence,vaultBalanceEvidence}={}){
 const sweeps=(sweepAccounts?.sweeps??[]).filter(x=>x?.poolMatched===true);
 const observed=transferEvidence?.transfers??[],vaults=vaultBalanceEvidence?.vaults??[];
 const positions=new Map();let conflict=false;
 for(const t of observed){
  if(!t||!index(t.outerInstructionIndex)||!index(t.innerInstructionIndex)){conflict=true;continue;}
  const id=t.outerInstructionIndex+':'+t.innerInstructionIndex;
  if(positions.has(id)){if(!isDeepStrictEqual(positions.get(id),t))conflict=true;}else positions.set(id,t);
 }
 const transfers=[...positions.values()];
 const targets=[...new Set(sweeps.map(s=>s.quoteVault).filter(Boolean))];
 const quotes=targets.length===1?vaults.filter(v=>v.vault===targets[0]):[];const quote=quotes.length===1?quotes[0]:null;
 const uniqueSweeps=new Set(sweeps.map(s=>s.outerInstructionIndex)).size===sweeps.length;
 const matches=(s,t)=>t.outerInstructionIndex===s.outerInstructionIndex&&t.parentInstructionMatched===true&&t.source===s.quoteVault&&t.destination===s.recipientTokenAccount&&t.operation===s.operation&&t.mint===s.quoteMint&&t.tokenProgram===s.quoteTokenProgram;
 const matched=!conflict&&transferEvidence?.evidenceComplete===true&&typeof transferEvidence.signature==='string'&&transferEvidence.signature.length>0&&index(transferEvidence.slot)&&uniqueSweeps&&sweeps.length>0&&sweeps.every(s=>index(s.outerInstructionIndex)&&s.innerInstructionIndex==null&&s.accountLayoutComplete===true&&['sweep_creator_fee','sweep_protocol_fee'].includes(s.operation)&&typeof s.quoteMint==='string'&&s.quoteMint.length>0&&transfers.some(t=>matches(s,t)))&&transfers.every(t=>t.signature===transferEvidence.signature&&t.slot===transferEvidence.slot&&sweeps.filter(s=>matches(s,t)).length===1);
 const valid=!conflict&&transfers.length>0&&transfers.every(t=>raw(t.amountRaw));
 const total=valid?transfers.reduce((sum,t)=>sum+BigInt(t.amountRaw),0n):null;
 const delta=quote?.status==='observed'&&quote.mintMatched===true&&sweeps.every(s=>s.quoteMint===quote.mint)&&typeof quote.rawDelta==='string'&&/^-?(0|[1-9][0-9]*)$/.test(quote.rawDelta)?BigInt(quote.rawDelta):null;
 const reconciled=matched&&valid&&delta!==null&&delta<0n&&total===-delta;
 return {status:reconciled?'AMOUNT_RECONCILED_AUTHORIZATION_PENDING':'INCOMPLETE_SETTLEMENT_EVIDENCE',targetSweepCount:sweeps.length,matchedTransferCount:transfers.length,matchedParentInstructions:matched,totalTransferRaw:total?.toString()??null,quoteVaultRawDelta:delta?.toString()??null,unexplainedRaw:delta!==null&&total!==null?(-delta-total).toString():null,amountReconciled:reconciled,authorizationVerified:false,settlementVerified:false,withdrawalConfirmed:false};
}
