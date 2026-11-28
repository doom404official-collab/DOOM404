import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Keypair,PublicKey} from '@solana/web3.js';
import BN from 'bn.js';
import {initializeV2,getPdaLaunchpadAuth,getPdaLaunchpadPoolId,getPdaLaunchpadVaultId,PoolInfoLayout,CLMM_PROGRAM_ID,getPdaPoolId,getPdaPoolVaultId} from '@raydium-io/raydium-sdk-v2';
import {encodeBase58Bytes} from '../lib/pumpFunCreation.mjs';
import {verifyBoundedCreatorOrigin} from '../lib/boundedCreatorOriginV2.mjs';
import {identifyCurrentPool} from '../lib/currentPoolIdentity.mjs';
const fresh=()=>Keypair.generate().publicKey;
const PROGRAM=new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
function launch(){
 const payer=fresh(),creator=fresh(),mint=fresh(),quote=new PublicKey('So11111111111111111111111111111111111111112');
 const pool=getPdaLaunchpadPoolId(PROGRAM,mint,quote).publicKey;
 const ix=initializeV2(PROGRAM,payer,creator,fresh(),fresh(),getPdaLaunchpadAuth(PROGRAM).publicKey,pool,mint,quote,getPdaLaunchpadVaultId(PROGRAM,pool,mint).publicKey,getPdaLaunchpadVaultId(PROGRAM,pool,quote).publicKey,fresh(),new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),6,'Test','TEST','https://example.invalid/',{type:'ConstantCurve',supply:new BN('1000000000'),totalSellA:new BN('800000000'),totalFundRaisingB:new BN('85000000000'),migrateType:'cpmm'},new BN(0),new BN(0),new BN(0),0);
 const accountKeys=ix.keys.map(k=>({pubkey:k.pubkey.toBase58(),signer:k.isSigner,writable:k.isWritable}));accountKeys.push({pubkey:PROGRAM.toBase58(),signer:false,writable:false});
 const mi=accountKeys.findIndex(k=>k.pubkey===mint.toBase58());const preBalances=accountKeys.map(()=>10),postBalances=[...preBalances];preBalances[mi]=0;postBalances[mi]=10;
 const transaction={version:0,slot:123,blockTime:1795770000,transaction:{signatures:['synthetic-signature'],message:{accountKeys,instructions:[{programId:PROGRAM.toBase58(),accounts:ix.keys.map(k=>k.pubkey.toBase58()),data:encodeBase58Bytes(ix.data)}]}},meta:{err:null,preBalances,postBalances,innerInstructions:[{index:0,instructions:[{programId:'11111111111111111111111111111111',parsed:{type:'createAccount',info:{newAccount:mint.toBase58(),owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'}}},{programId:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',parsed:{type:'initializeMint2',info:{mint:mint.toBase58(),decimals:6,mintAuthority:payer.toBase58()}}}]}]}};
 return {transaction,mint:mint.toBase58(),creator:creator.toBase58(),payer:payer.toBase58()};
}
test('LaunchLab designated creator is recovered separately from payer and mint authority',()=>{const f=launch(),p=verifyBoundedCreatorOrigin(f.transaction,f.mint);assert.equal(p.creator,f.creator);assert.notEqual(p.creator,f.payer);assert.equal(p.programId,PROGRAM.toBase58());assert.equal(p.independentlyReviewed,false);});
test('LaunchLab rejects unknown instruction versions, altered pool PDAs and mint lifecycle',()=>{
 for(const change of [tx=>tx.transaction.message.instructions[0].data='11111111',tx=>tx.transaction.message.instructions[0].accounts[5]=fresh().toBase58(),tx=>tx.meta.innerInstructions[0].instructions[0].parsed.info.owner=PROGRAM.toBase58()]){const f=launch();change(f.transaction);assert.equal(verifyBoundedCreatorOrigin(f.transaction,f.mint),null);}
});
test('Orca identity validates discriminator, pool PDA and mint binding without inventing reserve proof',()=>{
 const owner=new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'),a=fresh(),b=fresh(),config=fresh(),seed=Buffer.from([64,0]),data=Buffer.alloc(653);
 createHash('sha256').update('account:Whirlpool').digest().copy(data,0,0,8);config.toBuffer().copy(data,8);seed.copy(data,43);a.toBuffer().copy(data,101);b.toBuffer().copy(data,181);
 const pool=PublicKey.findProgramAddressSync([Buffer.from('whirlpool'),config.toBuffer(),a.toBuffer(),b.toBuffer(),seed],owner)[0].toBase58(),account={owner,data,executable:false};
 const r=identifyCurrentPool(account,a.toBase58(),pool);assert.equal(r.mintBindingVerified,true);assert.equal(r.reservesVerified,false);assert.equal(r.withdrawalControlsVerified,false);assert.equal(identifyCurrentPool(account,fresh().toBase58(),pool).mintBindingVerified,false);assert.equal(identifyCurrentPool(account,a.toBase58(),fresh().toBase58()).mintBindingVerified,false);
});
test('Raydium CLMM layout identity is mint-bound and never uses constant-product reserves',()=>{
 const data=Buffer.alloc(PoolInfoLayout.span),[mint,other]=[fresh(),fresh()].sort((a,b)=>Buffer.compare(a.toBuffer(),b.toBuffer())),config=fresh();createHash('sha256').update('account:PoolState').digest().copy(data,0,0,8);const pool=getPdaPoolId(CLMM_PROGRAM_ID,config,mint,other);data[8]=pool.nonce;config.toBuffer().copy(data,9);mint.toBuffer().copy(data,73);other.toBuffer().copy(data,105);getPdaPoolVaultId(CLMM_PROGRAM_ID,pool.publicKey,mint).publicKey.toBuffer().copy(data,137);getPdaPoolVaultId(CLMM_PROGRAM_ID,pool.publicKey,other).publicKey.toBuffer().copy(data,169);
 const account={owner:CLMM_PROGRAM_ID,data,executable:false};const r=identifyCurrentPool(account,mint.toBase58(),pool.publicKey.toBase58());assert.equal(r.protocol,'raydium_clmm');assert.equal(r.mintBindingVerified,true);assert.equal(r.reservesVerified,false);assert.equal(identifyCurrentPool(account,mint.toBase58(),fresh().toBase58()).mintBindingVerified,false);
});
