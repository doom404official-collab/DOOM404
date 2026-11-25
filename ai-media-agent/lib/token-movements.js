'use strict';
const {context,isToken,raw}=require('./sale-reconciliation');
function directTransfers(t,mint,owner){
 if(t?.meta?.err!==null)return [];
 const c=context(t),out=[];
 for(const x of c.msg.instructions){const d=x.parsed?.info;if(!isToken(x)||!['transfer','transferChecked'].includes(x.parsed?.type)||!d||d.mint&&d.mint!==mint)continue;
 const a=c.rows(d.source),b=c.rows(d.destination);if(!a.length||!b.length||!c.owner(d.source,a[0].owner,mint)||!c.owner(d.destination,b[0].owner,mint)||owner&&a[0].owner!==owner||d.authority!==a[0].owner||a[0].owner===b[0].owner)continue;
 const n=raw(x);if(n===null||n<=0n||c.delta(d.source)!==-n||c.delta(d.destination)!==n)continue;
 out.push({source:d.source,destination:d.destination,recipient:b[0].owner,rawAmount:n.toString(),decimals:a[0].uiTokenAmount.decimals,classification:b[0].owner==='1nc1nerator11111111111111111111111111111111'?'INCINERATOR_TRANSFER':'DIRECT_WALLET_TRANSFER'});
 }return out;
}
module.exports={directTransfers};
