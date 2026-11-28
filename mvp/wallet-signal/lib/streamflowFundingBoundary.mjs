import {discoverStreamflowAllocation} from './streamflowAllocationDiscovery.mjs';
const TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const u=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
/** Exact sender boundary for a standalone supported Streamflow create. The
 * escrow deposit and actual treasury/partner token fees remain distinct. */
export function verifyStreamflowFundingBoundary({mint,sender,transaction:tx}={}){
 try{
  const message=tx?.transaction?.message,keys=message.accountKeys.map(k=>typeof k==='string'?k:k.pubkey),events=[];
  const candidates=message.instructions.flatMap(ix=>ix.accounts?.length===18?[discoverStreamflowAllocation({mint,tokenAccount:ix.accounts[4],transaction:tx})]:[]).filter(Boolean);
  if(candidates.length!==1||candidates[0].sender!==sender)return null;
  const discovery=candidates[0],tokenProgram=discovery.tokenProgram,ix=message.instructions[discovery.instructionIndex],a=ix.accounts,group=tx.meta.innerInstructions.find(g=>g.index===discovery.instructionIndex).instructions;
  const row=(name,account)=>{const r=tx.meta[name].filter(b=>keys[b.accountIndex]===account);if(r.length>1)throw Error();return r[0];};
  const identity=account=>{const before=row('preTokenBalances',account),after=row('postTokenBalances',account);for(const b of [before,after].filter(Boolean))if(b.mint!==mint||b.programId!==tokenProgram||!u(b.uiTokenAmount?.amount))throw Error();if(before&&after&&(before.owner!==after.owner||before.uiTokenAmount.decimals!==after.uiTokenAmount.decimals))throw Error();return after||before;};
  const before=row('preTokenBalances',a[1]),after=row('postTokenBalances',a[1]);if(!before||!after||identity(a[1]).owner!==sender)return null;
  const decimals=before.uiTokenAmount.decimals;if(!Number.isInteger(decimals)||decimals<0||decimals>255)return null;
  let total=0n,escrowTransfers=0;
  for(const [innerInstructionIndex,i]of group.entries()){
   if(i.programId!==tokenProgram||!['transfer','transferChecked'].includes(i.parsed?.type))continue;
   const p=i.parsed.info;if(p.source!==a[1])continue;
   if(i.stackHeight!==2||p.authority!==sender||![a[4],a[7],a[10]].includes(p.destination))return null;
   const target=identity(p.destination),amount=p.tokenAmount?.amount??p.amount;
   if(!target||target.uiTokenAmount.decimals!==decimals||!u(amount)||BigInt(amount)===0n||i.parsed.type==='transferChecked'&&(p.mint!==mint||p.tokenAmount.decimals!==decimals))return null;
   const deposit=p.destination===a[4];
   if(target.owner!==(deposit?a[4]:p.destination===a[7]?a[6]:a[9])||target.owner===sender)return null;
   if(deposit)escrowTransfers++;
   total+=BigInt(amount);events.push({mint,creator:sender,signature:discovery.signature,slot:tx.slot,instructionIndex:discovery.instructionIndex,innerInstructionIndex,timestamp:tx.blockTime,type:'EXTERNAL_TRANSFER_OUT',amountRaw:amount,decimals,sourceTokenAccount:a[1],destinationTokenAccount:p.destination,transferMechanism:deposit?'vesting_escrow_deposit':'protocol_fee',independentlyVerified:true,instructionVerified:true,saleVerified:false,decoderVersion:'streamflow-sender-boundary-v1',historyComplete:false});
  }
  if(escrowTransfers!==1||events.length<1||BigInt(before.uiTokenAmount.amount)-BigInt(after.uiTokenAmount.amount)!==total)return null;
  const ownedTotal=name=>tx.meta[name].filter(b=>b.mint===mint&&b.owner===sender).reduce((n,b)=>{if(b.programId!==tokenProgram||b.uiTokenAmount.decimals!==decimals||!u(b.uiTokenAmount.amount))throw Error();return n+BigInt(b.uiTokenAmount.amount);},0n);
  if(ownedTotal('preTokenBalances')-ownedTotal('postTokenBalances')!==total)return null;
  const otherSourceMoves=[...message.instructions.map((i,index)=>({i,index,outer:true})),...tx.meta.innerInstructions.flatMap(g=>g.instructions.map(i=>({i,index:g.index,outer:false})))].filter(p=>p.i.programId===tokenProgram&&['transfer','transferChecked','burn','burnChecked','mintTo','mintToChecked'].includes(p.i.parsed?.type)&&[p.i.parsed.info.source,p.i.parsed.info.account,p.i.parsed.info.destination].includes(a[1]));
  if(otherSourceMoves.some(p=>p.outer||p.index!==discovery.instructionIndex))return null;
  return {events,discovery,fundingTotalRaw:total.toString(),sourceRawBefore:before.uiTokenAmount.amount,sourceRawAfter:after.uiTokenAmount.amount,historyComplete:false};
 }catch{return null;}
}
