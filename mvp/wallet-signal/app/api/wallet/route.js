import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    let publicKey;

    try {
      publicKey = new PublicKey(address);
    } catch {
      return NextResponse.json(
        { error: "Invalid Solana wallet address" },
        { status: 400 }
      );
    }

    const rpcUrl =
      process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

    const connection = new Connection(rpcUrl, "confirmed");

    const [balanceLamports, signatures] = await Promise.all([
      connection.getBalance(publicKey),
      connection.getSignaturesForAddress(publicKey, {
        limit: 100,
      }),
    ]);

    return NextResponse.json({
      address: publicKey.toBase58(),
      network: "mainnet-beta",
      balanceSOL: balanceLamports / LAMPORTS_PER_SOL,
      transactionsAnalyzed: signatures.length,
      latestTransaction: signatures[0]?.signature || null,
    });
  } catch (error) {
    console.error("Wallet analysis error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve Solana wallet data" },
      { status: 500 }
    );
  }
}
