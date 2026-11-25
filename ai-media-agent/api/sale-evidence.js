const {reconcileSales}=require('../lib/sale-reconciliation');
const {getTransaction,rpc,stats}=require('../lib/transaction-evidence');
const M=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/,S=/^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');const {mint,signature}=req.query;
 if(req.method!=='GET'||typeof mint!=='string'||typeof signature!=='string'||!M.test(mint)||!S.test(signature))return res.status(400).json({error:'Invalid request'});
 try{const before={...stats},t=await getTransaction(signature,rpc);const {results,diagnostics,status}=reconcileSales(t,mint,{signature});return res.status(status==='TRANSACTION_UNAVAILABLE'?422:200).json({mint,signature,slot:t?.slot,status,results,...(req.query.diagnostic==='1'?{diagnostics}:{}),evidenceCache:{scope:'FINALIZED_FIXTURES_AND_BOUNDED_PROCESS_CACHE',...Object.fromEntries(Object.keys(stats).map(k=>[k,stats[k]-before[k]]))},url:'https://solscan.io/tx/'+signature});}catch{return res.status(502).json({mint,signature,status:'VALIDATION_UNAVAILABLE'})}
};
