import {NextResponse} from 'next/server';
import {PublicKey} from '@solana/web3.js';
import {readHolderFrozenObservation} from '../../../lib/holderFrozenObservation.mjs';
export const dynamic='force-dynamic';
export async function GET(request){
 const headers={'Cache-Control':'no-store'};let mint;
 try{mint=new PublicKey(new URL(request.url).searchParams.get('mint')||'').toBase58();}
 catch{return NextResponse.json({error:'Invalid token mint'},{status:400,headers});}
 try{return NextResponse.json(await readHolderFrozenObservation(mint),{headers});}
 catch{return NextResponse.json({mint,status:'unavailable',error:'Frozen Holder observation unavailable',finalScore:null},{status:503,headers});}
}
