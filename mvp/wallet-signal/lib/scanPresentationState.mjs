/** Presentation states are separate from risk and coverage. A source failure is
 * never evidence of a completed investigation. Legacy saved reports remain readable. */
export function scanPresentationState({progress,assessed=false,complete=false,hasEvidence=false}={}){
 const stage=progress?.stage;
 const interrupted=stage==='bounded_stopped'||stage==='interrupted'||progress?.state==='interrupted';
 const active=!interrupted&&['initial_in_progress','deep_in_progress','initializing','collecting_evidence','assessment_in_progress'].includes(stage);
 const state=interrupted?'interrupted':active?(stage==='initializing'?'initializing':hasEvidence?'assessment_in_progress':'collecting_evidence'):assessed?(complete?'complete':'complete_partial'):'complete_insufficient';
 return {state,active,provisional:active&&assessed,status:interrupted?'Scan interrupted · Available evidence retained.':active?'Analyzing token risks…':state==='complete'?'Scan complete.':state==='complete_partial'?'Scan complete · Some evidence remains unverified.':'Scan complete · Insufficient evidence for an overall score.',riskLabel:active?(assessed?'Provisional observed risk':'Calculating risk…'):null,supporting:active?'Collecting token intelligence.':null};
}
