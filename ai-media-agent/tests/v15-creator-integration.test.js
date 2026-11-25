'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const fixtures=require('./fixtures/historical/index.json'),find=p=>Object.values(fixtures).find(f=>f.signature.startsWith(p));
const mint='EMQGeopasoZZUqiPDErvSL1QqvGr5WfZ1hbcvmAf8C3Y';
test('creator API replays raw evidence and never assigns sampled trader sales to creator',async()=>{
 const old=global.fetch,creator='6qUtYLyyoYCNj1Snd6FkGfTAzXHgSWCS4nyg871VwD13';
 const refs=['4j7m','4Fpb','479US','4X1W'].map(find).map(f=>({signature:f.signature}));let providerTransactions=0;
 global.fetch=async(_,opts)=>{const {method,params}=JSON.parse(opts.body);let result;
 if(method==='getTransactionsForAddress')result={data:params[0]===mint?[refs[0]]:refs};
 else if(method==='getTokenAccountsByOwner')result={context:{slot:500000000},value:[]};
 else if(method==='getSignaturesForAddress')result=[{signature:find('4HFX').signature,slot:find('4HFX').transaction.slot,err:null}];
 else if(method==='getTransaction'){providerTransactions++;throw Error('Unexpected live transaction request');}
 else throw Error(method);
 return {ok:true,json:async()=>({result})};};
 try{let body,status;const res={setHeader(){},status(n){status=n;return this},json(v){body=v}};await require('../api/creator-intelligence')({method:'GET',query:{mint}},res);
 assert.equal(status,200);assert.equal(body.creator,creator);assert.equal(body.consolidated.currentDirectHoldings.rawBalance,'0');assert.equal(body.consolidated.verifiedMarketSales.length,0);assert.equal(body.consolidated.directTransfers[0].rawAmount,'3520918746848');assert.equal(body.consolidated.recipientMovements[0].rawAmount,'3520918000000');assert.equal(body.consolidated.observedFunding[0].preLaunch,true);assert.equal(body.history.scope.errors,0);assert.equal(body.rpcConsumption.methods.getTransaction,undefined);assert.equal(providerTransactions,0);
 }finally{global.fetch=old}
});
test('verified sales reach trader aggregation and editorial narration; zero holdings alone never claim a dump',()=>{
 const ctx={window:{},document:{getElementById:()=>({addEventListener(){}})}};
 for(const file of ['lib/trader-intelligence.js','universal.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);
 const seller='creator-fixture',sig='sale-fixture',ci={mint,creator:seller,creatorStatus:'PROTOCOL_CREATOR_OBSERVED',creationEvidence:[{mint,creator:seller,signature:'creation',slot:1}],roleEvidence:[{address:seller,status:'ROLE_BALANCE_OBSERVED',rawBalance:'0'}],history:{initialAllocation:[{postRaw:'100',preRaw:'0',slot:1}],tokenDisposals:[{rawDecrease:'100',slot:2,signature:sig,status:'MARKET_SALE_RECONCILED',sales:[{mint,seller,signature:sig,slot:2,tokenOutRaw:'100',quoteMint:'NATIVE_SOL',quoteProceedsRaw:'10'}]}]}};
 const h={mint,top20TokenAccountSharePercent:10,accounts:[{ownerVerified:true,tokenOwner:'holder'}],supply:{decimals:6},unresolved:[]};
 const d=ctx.window.doom404UniversalBuild(mint,h,{mint,scope:{transactionsRetrieved:1},directTransfers:[],manipulationIndicators:{}},{creatorIntelligence:ci});
 assert.ok(d.findings.some(x=>x.label==='CREATOR MARKET SALES'));assert.match(d.script,/confirms 1 market sale/);assert.ok(d.references.some(r=>r.signature===sig));assert.ok(d.intelligence.findings.some(x=>x.id==='editorial-CREATOR MARKET SALES'));
 ci.history.tokenDisposals=[];const noSale=ctx.window.doom404UniversalBuild(mint,h,null,{creatorIntelligence:ci});assert.ok(!noSale.findings.some(x=>x.label==='CREATOR MARKET SALES'));assert.doesNotMatch(noSale.script,/creator dump|dumped/i);
});
