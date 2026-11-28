import {withScannerAdmission} from '../../../../lib/scannerAdmission.mjs';
export const dynamic='force-dynamic';
// Reference-only diagnostics are retired. Existing admission/auth policies still
// apply; this endpoint cannot read providers, mutate evidence or promote scores.
export async function POST(request){
 return withScannerAdmission(request,async()=>Response.json({status:'retired_reference_diagnostic',historicalEvidencePreserved:true,scorePromoted:false},{status:410,headers:{'Cache-Control':'no-store'}}),'internal/holder-scan-smoke');
}
