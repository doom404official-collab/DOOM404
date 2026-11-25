'use strict';
function earlyLaunch({mint,creator,relationships,market,now=Date.now()}){
 const creation=(creator?.creationEvidence||[]).filter(x=>x.mint===mint&&Number.isInteger(x.slot));
 const times=creation.map(x=>x.blockTime).filter(x=>Number.isFinite(x)&&x>0);
 const pairMs=market?.pairCreatedAt;
 const sameSlot=relationships?.manipulationIndicators?.coordinatedAcquisitions||[];
 return {mint,observedAt:new Date(now).toISOString(),mintCreationTime:times.length?new Date(Math.min(...times)*1000).toISOString():null,mintCreationEvidence:creation,pairCreatedAt:Number.isFinite(pairMs)?new Date(pairMs).toISOString():null,pairAgeSeconds:Number.isFinite(pairMs)&&pairMs<=now?Math.floor((now-pairMs)/1000):null,activityWindow: Number.isFinite(pairMs)&&now-pairMs<86400000?'PROVIDER_24H_BUCKET_PAIR_YOUNGER_THAN_24H':'PROVIDER_24H_BUCKET',initialAllocation:creator?.history?.initialAllocation||[],creatorDisposals:creator?.history?.tokenDisposals||[],sharedFundingObservations:relationships?.sharedFundingObservations||[],sameSlotObservations:sameSlot,bundleStatus:'UNESTABLISHED',sniperStatus:'UNESTABLISHED',scope:relationships?.scope||null,limitation:'Bounded observations do not establish earliest buyers, common control, sniper intent or bundles. Pair age is not mint creation age.'};
}
module.exports={earlyLaunch};
