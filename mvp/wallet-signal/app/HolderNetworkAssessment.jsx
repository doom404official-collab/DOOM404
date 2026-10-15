"use client";
import {useEffect,useState} from 'react';
export default function HolderNetworkAssessment({mint,snapshotId}){
 const [data,setData]=useState(null),[state,setState]=useState('loading');
 useEffect(()=>{
  if(!mint){setState('unavailable');return;}
  const controller=new AbortController();
  setState('loading');
  fetch('/api/token/holder-assessment?mint='+encodeURIComponent(mint)+(snapshotId?'&snapshotId='+encodeURIComponent(snapshotId):''),{signal:controller.signal,cache:'no-store'})
   .then(async r=>{if(!r.ok)throw Error('Unavailable');return r.json();})
   .then(v=>{setData(v.assessment);setState('ready');})
   .catch(e=>{if(e.name!=='AbortError')setState('unavailable');});
  return ()=>controller.abort();
 },[mint,snapshotId]);
 if(state==='loading')return <section aria-live="polite">Loading holder network assessment…</section>;
 if(state!=='ready')return <section>Holder network assessment unavailable for this snapshot.</section>;
 const s=data.networkScore;
 const reasons=[
  ['Largest observed cluster',data.exposure.largestClusterPct+'% of mint supply'],
  ['Direct holder relationships',s.evidence.directPairs+' verified wallet pairs'],
  ['Repeated wallet interactions',s.evidence.repeatedPairs+' pairs with repeated transfers']
 ];
 return <section style={{background:'#151515',border:'1px solid #444',borderRadius:16,padding:20,color:'#fff',marginTop:20}}>
  <h2>Holder Independence &amp; Network Influence</h2>
  <div style={{fontSize:34,fontWeight:800,color:'#ff8b8b'}}>{s.score}<span style={{fontSize:18,color:'#bbb'}}> / {s.maxScore}</span></div>
  <p>Observed network concentration · Snapshot slot {data.slot} · {s.methodology}</p>
  <h3>Top findings</h3>
  <ol>{reasons.map(([title,value])=><li key={title}><strong>{title}:</strong> {value}</li>)}</ol>
  <details><summary>Scoring evidence and coverage</summary>
   <p>Direct penalty: {s.penalties.direct}; repeated: {s.penalties.repeated}; indirect: {s.penalties.indirect}; concentration: {s.penalties.concentration}.</p>
   <p>{data.evidenceCoverage.walletsSampled} holders sampled; {data.evidenceCoverage.decodedTransactions} decoded transactions; {data.evidenceCoverage.decodeFailures} decode failures; {data.evidenceCoverage.partialBatches} partial batches.</p>
   <p>Creator attribution: {data.creatorAttributionStatus==='not_verified'?'Not verified':data.creatorAttributionStatus}.</p>
  </details>
  <p style={{fontSize:12,color:'#aaa'}}>Based on retrievable on-chain data. Transaction connections do not prove common ownership or coordinated trading. Mint total supply is the denominator; this is a historical observed-evidence assessment, not a live scan.</p>
 </section>;
}
