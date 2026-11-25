// Client-supplied evidence is never an authenticated investigation.
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');return res.status(410).json({error:'CLIENT_EVIDENCE_DISABLED',replacement:'/api/investigate'});};
