// Server-side eligibility decision for cached vs missing Top20 assessments.
// This function never starts an expensive job from a public GET request.
export function resolveAssessmentState({snapshot,batches=[],maxAgeMs=6*60*60*1000,now=Date.now()}={}){
 if(!snapshot)return {status:'not_assessed',needsInvestigation:true};
 if(!Array.isArray(batches)||batches.length!==4)return {status:'investigation_pending',needsInvestigation:true,
  processedBatches:batches?.length??0};
 const created=Date.parse(snapshot.created_at??'');
 const stale=Number.isFinite(created)&&now-created>maxAgeMs;
 return {status:stale?'stale':'available',needsInvestigation:stale,
  snapshotId:snapshot.id,partialBatches:batches.filter(b=>b.status==='partial').length};
}
