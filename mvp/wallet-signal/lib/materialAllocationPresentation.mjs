import {projectStreamflowAllocationControl} from './streamflowAllocationProjection.mjs';
const raw=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
/** Overlay fresh independently produced controls without changing the sampled
 * eligible-wallet subtotal, points or coverage. Gross amounts always remain. */
export function withVerifiedAllocationControls(classification,evidence,{mint,now=Date.now()}={}){
 if(classification?.version!==1||classification.mint!==mint||evidence?.version!==1||evidence.mint!==mint||!Array.isArray(evidence.allocations)||!raw(classification.supplyRaw)||BigInt(classification.supplyRaw)===0n)return classification;
 const allocations=classification.allocations.map(row=>{
  if(row.eligible||row.infrastructureVerified||row.wallet!==row.tokenAccount||!raw(row.amountRaw))return row;
  const matches=evidence.allocations.filter(p=>p.tokenAccount===row.tokenAccount);if(matches.length!==1)return row;
  const control=projectStreamflowAllocationControl({proof:matches[0].controlEvidence,mint,tokenAccountAddress:row.tokenAccount,currentBalanceRaw:row.amountRaw,observedAt:new Date(now).toISOString()});
  if(!control||!Number.isFinite(new Date(Number(control.releaseTime)*1000).getTime()))return row;
  const percent=n=>Number(BigInt(n)*1000000n/BigInt(classification.supplyRaw))/10000;
  return {...row,classification:'vesting_escrow',classificationBasis:control.basis,releaseConditionsVerified:true,withdrawalConditionsVerified:true,economicRoleVerified:true,restrictedAmountRaw:control.restrictedNetRaw,restrictedSharePct:percent(control.restrictedNetRaw),unclassifiedAmountRaw:control.unclassifiedSurplusRaw,unclassifiedSharePct:percent(control.unclassifiedSurplusRaw),controlEvidence:control};
 });
 const unknown=allocations.filter(r=>!r.eligible&&!r.infrastructureVerified&&r.classification!=='burn_account').reduce((n,r)=>n+BigInt(r.unclassifiedAmountRaw??r.amountRaw),0n),restricted=allocations.reduce((n,r)=>n+BigInt(r.restrictedAmountRaw??(r.classification==='restricted_token_account'?r.amountRaw:'0')),0n);
 return {...classification,allocations,unclassifiedSharePct:Number(unknown*1000000n/BigInt(classification.supplyRaw))/10000,restrictedSharePct:Number(restricted*1000000n/BigInt(classification.supplyRaw))/10000};
}

export function verifiedEscrowFundingWindows(evidence,{mint,creator}={}){
 if(!Array.isArray(evidence)||!creator)return [];
 return evidence.slice(0,2).filter(p=>p?.mint===mint&&p.creator===creator&&/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(p.signature??'')&&Number.isSafeInteger(p.slot)&&p.slot>0&&Number.isSafeInteger(p.instructionIndex)&&p.instructionIndex>=0&&Number.isSafeInteger(p.innerInstructionIndex)&&p.innerInstructionIndex>=0&&p.classification==='verified_external_transfer'&&p.historyComplete===false&&raw(p.openingRaw)&&raw(p.outflowRaw)&&raw(p.closingRaw)&&BigInt(p.openingRaw)-BigInt(p.outflowRaw)===BigInt(p.closingRaw));
}
