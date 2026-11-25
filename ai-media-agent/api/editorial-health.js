// Retired paid diagnostic endpoint. Normal investigations report sanitized stage status.
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');res.status(404).end();};
