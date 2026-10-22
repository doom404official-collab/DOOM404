const url=process.env.HELIUS_RPC_URL;
if(!url?.startsWith("https://"))throw Error("RPC_NOT_CONFIGURED");
const signature="37WZYkLnwzcPmYdoydTRhYAoUAcFGwHYem3QGt6exoSqt8H2SCZZuB5uUZg3Dd9NyTjYr62nhaxT2VbMELDKocA6";
const account="6DgMfbDmjbGT9knSgztDg7Fg813mwjw2Bz5ieBztqDju";
const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getTransaction",params:[signature,{encoding:"jsonParsed",maxSupportedTransactionVersion:1}]}),signal:AbortSignal.timeout(30000)});
const data=await response.json();
const tx=data.result;
if(!response.ok||data.error||!tx||tx.slot!==450097547||tx.meta?.err!==null)throw Error("TRANSACTION_UNVERIFIED");
const parents=tx.transaction.message.instructions;
const matches=[];
for(const group of tx.meta.innerInstructions??[])for(const [position,ix] of group.instructions.entries()){
 const info=ix.parsed?.info??{};
 if(info.source!==account||!["X5QPJcpph4mBAJDzc4hRziFftSbcygV59kRb2Fu6Je1","EFikfamGR5RwvVXWAgekcpcNEZnccmgAQjWASYnNSzG","HjQjngTDqoHE6aaGhUqfz9aQ7WZcBRjy5xB8PScLSr8i"].includes(info.destination))continue;
 matches.push({outer:group.index,inner:position,program:ix.programId,parentProgram:parents[group.index]?.programId??null,source:info.source,destination:info.destination,amountRaw:info.amount??info.tokenAmount?.amount??null});
}
console.log(JSON.stringify({status:"OBSERVED_ONLY",slot:tx.slot,matches,scorePromoted:false}));
