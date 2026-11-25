const test=require('node:test'),assert=require('node:assert/strict');
test('lagging RPC node retries account read once and preserves both observation slots',async()=>{
 const original=global.fetch,calls=[];const mint='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',owner='11111111111111111111111111111111';
 global.fetch=async(url,options)=>{const b=JSON.parse(options.body);calls.push(b);let result;
 if(b.method==='getTokenLargestAccounts')result={context:{slot:100},value:[{address:'account',amount:'100',decimals:6}]};
 if(b.method==='getTokenSupply')result={context:{slot:99},value:{amount:'1000',decimals:6}};
 if(b.method==='getMultipleAccounts'){
  if(b.params[1].encoding==='jsonParsed'&&b.params[1].minContextSlot)return {ok:true,json:async()=>({error:{code:-32016}})};
  result={context:{slot:98},value:b.params[1].encoding==='jsonParsed'?[{owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',data:{parsed:{type:'account',info:{mint,owner,tokenAmount:{amount:'100'}}}}}]:[{owner,executable:false,data:['','base64']}]};
 }
 return {ok:true,json:async()=>({result})};};
 try{let status=200,out;await require('../api/owners')({method:'GET',query:{mint}},{setHeader(){},status(s){status=s;return this},json(d){out=d}});assert.equal(status,200);assert.equal(out.ownerReadContext.minContextFallback,true);assert.equal(out.ownerReadContext.rankingLagSlots,2);assert.equal(out.ownerResolutionSlot,98);assert.equal(out.largestAccountsSlot,100);assert.equal(calls.filter(x=>x.method==='getMultipleAccounts'&&x.params[1].encoding==='jsonParsed').length,2);assert.equal(out.reconciliation.reconciled,true)}finally{global.fetch=original}
});
