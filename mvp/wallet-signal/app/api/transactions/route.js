import { createReliableConnection } from "../../../lib/reliableConnection.js";
import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SAMPLE_LIMIT = 20;

function getProgramId(instruction) {
  if (!instruction) return "Unknown";

  if (typeof instruction.programId === "string") {
    return instruction.programId;
  }

  if (instruction.programId?.toBase58) {
    return instruction.programId.toBase58();
  }

  return "Unknown";
}

function classifyTransaction(transaction) {
  const instructions =
    transaction?.transaction?.message?.instructions || [];

  const programs = instructions.map(getProgramId);

  const systemProgram =
    "11111111111111111111111111111111";

  const tokenProgram =
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

  const token2022Program =
    "TokenzQdBNbLqP5VEhdkAS6EPFfC4V6Q3QY3FZx";

  let category = "Other / Unknown";

  if (programs.includes(tokenProgram) ||
      programs.includes(token2022Program)) {
    category = "Token Program Interaction";
  } else if (programs.includes(systemProgram)) {
    category = "System Program Interaction";
  }

  return {
    category,
    programs: [...new Set(programs)],
    success: transaction?.meta?.err === null
  };
}

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
      publicKey = new PublicKey(address.trim());
    } catch {
      return NextResponse.json(
        { error: "Invalid Solana wallet address" },
        { status: 400 }
      );
    }

    const connection = createReliableConnection();

    const signatures =
      await connection.getSignaturesForAddress(
        publicKey,
        { limit: SAMPLE_LIMIT }
      );

    const transactions = [];
    const categories = {};
    let failedToDecode = 0;
    let rateLimited = false;

    for (const entry of signatures) {
      try {
        const transaction =
          await connection.getParsedTransaction(
            entry.signature,
            {
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed"
            }
          );

        if (!transaction) {
          failedToDecode++;
          continue;
        }

        const classification =
          classifyTransaction(transaction);

        categories[classification.category] =
          (categories[classification.category] || 0) + 1;

        transactions.push({
          signature: entry.signature,
          timestamp: entry.blockTime
            ? new Date(entry.blockTime * 1000).toISOString()
            : null,
          ...classification
        });

      } catch (error) {
        console.error(
          "Transaction decode error:",
          error.message
        );

        failedToDecode++;

        if (
          error.code === 429 ||
          String(error.message).includes("429") ||
          String(error.message).includes("Too many requests")
        ) {
          rateLimited = true;
          break;
        }
      }

      // The shared RPC transport already spaces requests by 300ms and
      // applies bounded retries/backoff; avoid adding a second fixed delay.
    }

    return NextResponse.json({
      engineVersion: "0.4.1",
      address: publicKey.toBase58(),
      network: "mainnet-beta",
      transactionsRequested: SAMPLE_LIMIT,
      signaturesRetrieved: signatures.length,
      transactionsDecoded: transactions.length,
      failedToDecode,
      rateLimited,
      categories,
      transactions,
      dataCoverage: {
        status: rateLimited
          ? "Partial - RPC rate limit reached"
          : failedToDecode > 0
          ? "Partial - some transactions unavailable"
          : "Sample decoded",
        note:
          "Classification is based on observed program interactions. " +
          "It does not establish whether a wallet is fraudulent."
      }
    });

  } catch (error) {
    console.error(
      "Transaction intelligence error:",
      error
    );

    const isRateLimit =
      error.code === 429 ||
      String(error.message).includes("429");

    return NextResponse.json(
      {
        error: isRateLimit
          ? "Solana RPC rate limit reached. Please retry later."
          : "Unable to retrieve transaction intelligence",
        rateLimited: isRateLimit
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
