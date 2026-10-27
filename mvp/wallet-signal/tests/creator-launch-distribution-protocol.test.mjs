import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {inspectCreatorLaunchDistributionTransaction as inspect} from '../lib/creatorLaunchDistributionProtocol.mjs';
import {PUMP_PROGRAM_ID} from '../lib/pumpFunCreation.mjs';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const address=n=>new PublicKey(Buffer.alloc(32,n)).toBase58(),mint=address(9),creator=address(7),signature='1'.repeat(88);
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes){let n=BigInt('0x'+bytes.toString('hex')),out='';while(n){out=alphabet[Number(n%58n)]+out;n/=58n;}for(const b of bytes){if(b!==0)break;out='1'+out;}return out;}
const str=s=>{const b=Buffer.from(s),n=Buffer.alloc(4);n.writeUInt32LE(b.length);return Buffer.concat([n,b]);};
function fixture(kind='create'){
 const accounts=Array.from({length:kind==='create'?14:16},(_,i)=>address(i+20));accounts[0]=mint;
 const system='11111111111111111111111111111111',token='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',token22='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',ata='ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
 if(kind==='create'){accounts[8]=system;accounts[9]=token;accounts[10]=ata;accounts[13]=PUMP_PROGRAM_ID;}else{accounts[6]=system;accounts[7]=token22;accounts[8]=ata;accounts[15]=PUMP_PROGRAM_ID;}
 const data=b58(Buffer.concat([createHash('sha256').update('global:'+kind).digest().subarray(0,8),str('Synthetic'),str('SYN'),str('https://offline.invalid'),Buffer.alloc(32,7),...(kind==='create_v2'?[Buffer.from([0,0])]:[])]));
 return {mint,creator,signature,transaction:{slot:100,blockTime:1000,version:'legacy',transaction:{signatures:[signature],message:{accountKeys:accounts,instructions:[{programId:PUMP_PROGRAM_ID,accounts,data}]}},meta:{err:null,innerInstructions:[],preTokenBalances:[],postTokenBalances:[]}}};
}
function unknown(result){assert.equal(result.status,'UNKNOWN');assert.equal(result.initialAttributableRaw,null);assert.equal(result.zeroAllocationVerified,false);assert.equal(result.launchDistributionCoverageComplete,false);assert.deepEqual(result.verifiedLaunchDistributions,[]);}
for(const kind of ['create','create_v2'])test(kind+' role layout is not a historically verified allocation schema',()=>{
 const input=fixture(kind),before=structuredClone(input),r=inspect(input);unknown(r);assert.equal(r.reason,'HISTORICAL_DISTRIBUTION_SCHEMA_UNVERIFIED');assert.equal(r.instructionCandidates.length,1);assert.equal(r.instructionCandidates[0].instructionIndex,0);assert.equal(r.instructionCandidates[0].innerInstructionIndex,null);assert.deepEqual(input,before);
});
test('outer/inner coordinates survive compiled account references and JSON roundtrip',()=>{
 const input=fixture(),tx=input.transaction,ix=tx.transaction.message.instructions[0];
 ix.accounts=ix.accounts.map((_,i)=>i);tx.transaction.message.instructions=[{programId:'11111111111111111111111111111111',parsed:{type:'transfer',info:{}}}];tx.meta.innerInstructions=[{index:0,instructions:[ix]}];
 const r=inspect(JSON.parse(JSON.stringify(input)));unknown(r);assert.equal(r.instructionCandidates[0].instructionIndex,0);assert.equal(r.instructionCandidates[0].innerInstructionIndex,0);
});
for(const [name,mutate,reason] of [
 ['unavailable',x=>x.transaction=null,'RAW_TRANSACTION_UNAVAILABLE'],
 ['wrong signature',x=>x.transaction.transaction.signatures=['2'.repeat(88)],'TRANSACTION_IDENTITY_UNVERIFIED'],
 ['missing slot',x=>delete x.transaction.slot,'TRANSACTION_IDENTITY_UNVERIFIED'],
 ['unsupported version',x=>x.transaction.version=2,'TRANSACTION_VERSION_UNSUPPORTED'],
 ['missing status',x=>delete x.transaction.meta.err,'TRANSACTION_STATUS_UNVERIFIED'],
 ['failed transaction',x=>x.transaction.meta.err={InstructionError:[0,'InvalidArgument']},'TRANSACTION_NOT_SUCCESSFUL'],
 ['missing inner metadata',x=>delete x.transaction.meta.innerInstructions,'INSTRUCTION_CONTEXT_UNVERIFIED'],
 ['null instruction',x=>x.transaction.transaction.message.instructions=[null],'INSTRUCTION_CONTEXT_UNVERIFIED'],
 ['duplicate inner group',x=>x.transaction.meta.innerInstructions=[{index:0,instructions:[]},{index:0,instructions:[]}],'INSTRUCTION_CONTEXT_UNVERIFIED'],
 ['invalid inner parent',x=>x.transaction.meta.innerInstructions=[{index:1,instructions:[]}],'INSTRUCTION_CONTEXT_UNVERIFIED'],
 ['conflicting program reference',x=>x.transaction.transaction.message.instructions[0].programIdIndex=0,'INSTRUCTION_CONTEXT_UNVERIFIED'],
 ['unresolved account reference',x=>{x.transaction.transaction.message.instructions[0].accounts=[...x.transaction.transaction.message.instructions[0].accounts];x.transaction.transaction.message.instructions[0].accounts[1]=999;},'LAUNCH_LAYOUT_UNVERIFIED'],
 ['unsupported layout',x=>x.transaction.transaction.message.instructions[0].data='2','LAUNCH_LAYOUT_UNVERIFIED'],
 ['wrong creator',x=>x.creator=address(8),'CREATOR_ROLE_MISMATCH'],
 ['unsupported launchpad',x=>x.transaction.transaction.message.instructions[0].programId=address(8),'SUPPORTED_LAUNCH_INSTRUCTION_NOT_FOUND']
])test(name+' remains Unknown without zero allocation',()=>{const x=fixture();mutate(x);const r=inspect(x);unknown(r);assert.equal(r.reason,reason);});
test('supply, mintTo, balance increases, buy flags and claimed provenance cannot manufacture proof',()=>{
 const x=fixture();Object.assign(x,{historicalSchemaVerified:true,coverageComplete:true,launchDistributionCoverageComplete:true});
 x.transaction.meta.postTokenBalances=[{accountIndex:1,mint,owner:creator,uiTokenAmount:{amount:'999999'}}];
 x.transaction.transaction.message.instructions.push({programId:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',parsed:{type:'mintTo',info:{mint,account:address(20),amount:'999999'}}});
 x.transaction.verifiedLaunchDistributions=[{mint,recipient:creator,amountRaw:'999999',verifiedLaunchDistribution:true}];
 const r=inspect(x);unknown(r);assert.equal(r.reason,'HISTORICAL_DISTRIBUTION_SCHEMA_UNVERIFIED');
});
test('holdings tick inspects only its already-fetched creation response; no added RPC or raw persistence',async()=>{
 const x=fixture();let saved;const methods=[];
 const state={originEvidence:[{creator,signature,programId:PUMP_PROGRAM_ID,decoderVersion:'pump-fun-create-prefix-v1'}]};
 const r=await runCreatorIntelligenceTick({mint,store:{async get(){return {stage:'holdings',status:'partial',state};},async claim(){return true;},async save(row){saved=row;}},rpcUrl:'https://offline.invalid',fetchImpl:async(_,o)=>{
  const {method}=JSON.parse(o.body);methods.push(method);
  const result=method==='getTransaction'?x.transaction:method==='getTokenSupply'?{value:{amount:'1000000',decimals:6}}:{value:[]};
  return {ok:true,status:200,json:async()=>({result})};
 }});
 assert.equal(r.errorCode,null);assert.equal(r.stage,'selling');assert.deepEqual(methods.slice(0,2),['getTransaction','getTransaction']);assert.deepEqual(methods.slice(2).sort(),['getTokenAccountsByOwner','getTokenSupply']);unknown(saved.state.launchDistributionProtocolReview);assert.ok(!JSON.stringify(saved.state.launchDistributionProtocolReview).includes('offline.invalid'));assert.equal(saved.state.launchDistributionProtocolReview.instructionCandidates.length,1);
});
