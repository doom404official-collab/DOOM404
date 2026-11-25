"use strict";
const {isInfrastructure}=require('./holder-classification');
function accountHolders(accounts,supply){
 const total=BigInt(supply);if(total<=0n)throw Error('INVALID_SUPPLY');
 const seen=new Set();for(const a of accounts){if(seen.has(a.tokenAccount))throw Error('DUPLICATE_TOKEN_ACCOUNT');seen.add(a.tokenAccount);if(!/^\d+$/.test(a.rawAmount))throw Error('INVALID_BALANCE')}
 const sum=rows=>rows.reduce((n,a)=>n+BigInt(a.rawAmount),0n),pct=n=>Number(n*100000000n/total)/1000000;
 const top20=sum(accounts),top10=sum(accounts.slice(0,10));if(top20>total)throw Error('SAMPLE_EXCEEDS_SUPPLY');
 const bonding=accounts.filter(a=>a.classification==='PUMP_FUN_BONDING_CURVE_INFRASTRUCTURE');
 const pools=accounts.filter(a=>isInfrastructure(a)&&!bonding.includes(a));
 // No custody exclusions without an independently validated custody adapter.
 const nonExcluded=accounts.filter(a=>!isInfrastructure(a)),unresolved=nonExcluded.filter(a=>!a.ownerVerified||!a.tokenOwner);
 const groups=new Map();for(const a of accounts){if(!a.ownerVerified||!a.tokenOwner)continue;const g=groups.get(a.tokenOwner)||{owner:a.tokenOwner,rawAmount:0n,nonExcludedRawAmount:0n,tokenAccounts:[]};g.rawAmount+=BigInt(a.rawAmount);if(!isInfrastructure(a))g.nonExcludedRawAmount+=BigInt(a.rawAmount);g.tokenAccounts.push(a.tokenAccount);groups.set(a.tokenOwner,g)}
 const ownerGroups=[...groups.values()].map(g=>({...g,count:g.tokenAccounts.length,sharePercent:pct(g.rawAmount),nonExcludedSharePercent:pct(g.nonExcludedRawAmount),rawAmount:String(g.rawAmount),nonExcludedRawAmount:String(g.nonExcludedRawAmount),classification:g.nonExcludedRawAmount===0n?'VERIFIED_INFRASTRUCTURE':'PURPOSE_UNRESOLVED'})).sort((a,b)=>b.nonExcludedSharePercent-a.nonExcludedSharePercent);
 const infra=sum(bonding)+sum(pools),remaining=sum(nonExcluded);
 return {top10TokenAccountSharePercent:pct(top10),top20TokenAccountSharePercent:pct(top20),classifiedInfrastructureSharePercent:pct(infra),classifiedInfrastructureCount:bonding.length+pools.length,verifiedBondingCurveSharePercent:pct(sum(bonding)),verifiedLiquidityPoolSharePercent:pct(sum(pools)),verifiedCustodySharePercent:0,custodyVerificationStatus:'NOT_ESTABLISHED',unclassifiedTop20SharePercent:pct(remaining),nonExcludedTop20SharePercent:pct(remaining),unresolvedAccountSharePercent:pct(sum(unresolved)),purposeUnresolvedSharePercent:pct(remaining),resolvedOwnerCount:ownerGroups.length,resolvedTokenAccountCount:accounts.filter(a=>a.ownerVerified&&a.tokenOwner).length,ownerGroups,largestObservedOwner:ownerGroups[0]||null,largestObservedOwnerSharePercent:ownerGroups[0]?.nonExcludedSharePercent??null,ownerConcentrationScope:'Non-excluded balances in sampled Top 20 only; controlling address is not beneficial ownership or independence',reconciliation:{supplyRaw:String(total),sampledRaw:String(top20),verifiedInfrastructureRaw:String(infra),nonExcludedRaw:String(remaining),unresolvedOwnerRaw:String(sum(unresolved)),outsideSampleRaw:String(total-top20),reconciled:infra+remaining===top20,percentagePrecision:6}};
}
module.exports={accountHolders};
