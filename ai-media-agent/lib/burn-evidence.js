'use strict';
const {context,isToken,raw}=require('./sale-reconciliation');
function burnEvidence(t,mint,{owner,signature}={}){
 if(t?.meta?.err!==null)return [];
 const c=context(t),groups=new Map();
 for(const x of c.flat){const d=x.parsed?.info;if(!isToken(x)||!['burn','burnChecked'].includes(x.parsed?.type)||d?.mint!==mint)continue;
 const rows=c.rows(d.account),n=raw(x);if(!rows.length||!rows.every(b=>b.mint===mint&&b.owner===rows[0].owner)||owner&&rows[0].owner!==owner||n===null||n<=0n)continue;
 // Owner authority only: delegate/multisig authority needs independent evidence.
 if(d.authority!==rows[0].owner||!c.msg.accountKeys.some(k=>k.pubkey===d.authority&&k.signer))continue;
 if(x.parsed.type==='burnChecked'&&d.tokenAmount.decimals!==rows[0].uiTokenAmount.decimals)continue;
 const a=groups.get(d.account)||[];a.push({account:d.account,owner:rows[0].owner,authority:d.authority,rawAmount:n.toString(),instruction:x.parsed.type,outerIndex:x.outerIndex,program:x.programId});groups.set(d.account,a);
 }
 const results=[];for(const [account,rows] of groups){const total=rows.reduce((n,r)=>n+BigInt(r.rawAmount),0n);if(c.delta(account)!==-total)continue;
 // No other amount-changing operation may contaminate the account reconciliation.
 if(c.flat.some(x=>isToken(x)&&['transfer','transferChecked','mintTo','mintToChecked'].includes(x.parsed?.type)&&[x.parsed.info.account,x.parsed.info.source,x.parsed.info.destination].includes(account)))continue;
 for(const r of rows)results.push({...r,mint,status:'TOKEN_BURN_RECONCILED',supplyReductionRaw:r.rawAmount,supplySemantics:'Successful SPL burn reduces mint supply by this amount; not a historical total-supply snapshot.',...(signature?{signature,slot:t.slot,url:'https://solscan.io/tx/'+signature}:{})});
 }return results;
}
module.exports={burnEvidence};
