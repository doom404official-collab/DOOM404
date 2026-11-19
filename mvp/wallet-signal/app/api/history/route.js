import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { createReliableConnection } from '../../../lib/reliableConnection.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  let wallet;
  try { wallet = new PublicKey(params.get('address') || ''); }
  catch { return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 }); }
  const limit = Number(params.get('limit') || 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return NextResponse.json({ error: 'Invalid page size' }, { status: 400 });
  const before = params.get('before');
  if (before && !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(before)) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
  try {
    const rows = await createReliableConnection().getSignaturesForAddress(wallet, { limit: limit + 1, ...(before ? { before } : {}) });
    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    return NextResponse.json({ address: wallet.toBase58(), items: page.map(row => ({ signature: row.signature, slot: row.slot, timestamp: row.blockTime ? new Date(row.blockTime * 1000).toISOString() : null, status: row.err ? 'failed' : 'success' })), pagination: { hasMore, nextCursor: hasMore ? page.at(-1)?.signature : null, totalKnown: null }, coverage: { completeHistoryVerified: false, note: 'RPC-visible signatures only; provider may lack older history.' } });
  } catch { return NextResponse.json({ error: 'History temporarily unavailable', incomplete: true }, { status: 503 }); }
}
