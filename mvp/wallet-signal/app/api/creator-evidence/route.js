import { NextResponse } from 'next/server';
import { createIntelligenceVault } from '../../../lib/intelligenceVault.mjs';
import { resolveCachedCreator } from '../../../lib/resolveCachedCreator.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
 const mint = new URL(request.url).searchParams.get('mint') || '';
 if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return NextResponse.json({error:'INVALID_MINT'}, {status:400});
 if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({status:'UNAVAILABLE'}, {status:503});
 try {
  const vault = createIntelligenceVault({url:process.env.SUPABASE_URL, serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const result = await resolveCachedCreator({mint,vault});
  return NextResponse.json(result, {headers:{'Cache-Control':'no-store'}});
 } catch {
  return NextResponse.json({status:'UNAVAILABLE'}, {status:503});
 }
}
