const SYSTEM='11111111111111111111111111111111',TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',WSOL='So11111111111111111111111111111111111111112';
/** Reconcile a typed native-sale payout against the actor's complete lamport
 * equation. System flows, fee payer charges and explicitly closed native token
 * accounts are accounted separately. Unknown residuals never become proceeds. */
export function verifyDirectNativeSale({tx,flat,keys,creator,event,identity}={}){
 try{
  const paid=BigInt(event.solAmountRaw)-BigInt(event.protocolFeeRaw)-BigInt(event.creatorFeeRaw);if(paid<=0n)return null;
  const index=keys.indexOf(creator),before=tx.meta.preBalances[index],after=tx.meta.postBalances[index];if(!Number.isSafeInteger(before)||!Number.isSafeInteger(after)||!Number.isSafeInteger(tx.meta.fee)||before<0||after<0||tx.meta.fee<0)return null;
  const lamports=i=>{if(!Number.isSafeInteger(i.lamports)||i.lamports<0)throw Error();return BigInt(i.lamports);};
  const systemNet=account=>flat.reduce((n,{ix})=>{if(ix.programId!==SYSTEM)return n;const i=ix.parsed?.info,t=ix.parsed?.type;if(t==='transfer')return n+(i.destination===account?lamports(i):0n)-(i.source===account?lamports(i):0n);if(t==='createAccount')return n+(i.newAccount===account?lamports(i):0n)-(i.source===account?lamports(i):0n);return n;},0n);
  let closeRefund=0n;const closed=new Set();
  for(const {ix}of flat){if(ix.programId!==TOKEN||ix.parsed?.type!=='closeAccount'||ix.parsed.info.destination!==creator)continue;const i=ix.parsed.info,a=i.account,id=identity(a),k=keys.indexOf(a);if(closed.has(a)||k<0||i.owner!==creator||id?.owner!==creator||id.mint!==WSOL||id.programId!==TOKEN||tx.meta.postBalances[k]!==0||!Number.isSafeInteger(tx.meta.preBalances[k]))return null;closed.add(a);
   let tokenNet=0n;for(const {ix:t}of flat){if(t.programId!==TOKEN||!['transfer','transferChecked'].includes(t.parsed?.type))continue;const p=t.parsed.info;if(p.source!==a&&p.destination!==a)continue;const source=identity(p.source),dest=identity(p.destination),raw=p.tokenAmount?.amount??p.amount;if(source?.mint!==WSOL||dest?.mint!==WSOL||source.programId!==TOKEN||dest.programId!==TOKEN||!(/^(0|[1-9][0-9]*)$/).test(raw||''))return null;tokenNet+=(p.destination===a?1n:-1n)*BigInt(raw);}
   const refund=BigInt(tx.meta.preBalances[k])+systemNet(a)+tokenNet;if(refund<0n)return null;closeRefund+=refund;
  }
  const explicit=systemNet(creator),fee=keys[0]===creator?BigInt(tx.meta.fee):0n;
  if(BigInt(after)-BigInt(before)!==explicit+closeRefund-fee+paid)return null;
  return {paidRaw:paid.toString(),explicitSystemNetRaw:explicit.toString(),nativeAccountRefundsRaw:closeRefund.toString(),feePayerChargeRaw:fee.toString()};
 }catch{return null;}
}
