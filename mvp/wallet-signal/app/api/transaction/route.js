import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SAMPLE_LIMIT = 20;

function getProgramId(instruction) {
  if (!instruction) return "";

  if (typeof instruction.programId === "string") {
    return instruction.programId;
  }

  if (instruction.programId?.toBase58) {
    return instruction.programId.toBase58();
  }

  return "";
}

function classifyTransaction(tx) {
  if (!tx) {
    return {
      category: "unknown",
      confidence: "low"
    };
  }

  const instructions =
    tx.transaction?.message?.instructions || [];

  const programs = new Set();
  const types = new Set();

  for (const instruction of instructions) {
    const programId = getProgramId(instruction);

    if (programId) {
      programs.add(programId);
    }

    if (instruction.parsed?.type) {
      types.add(instruction.parsed.type);
    }
  }

  const programList = [...programs];
  const typeList = [...types];

  const hasSystemTransfer =
    instructions.some(
      (instruction) =>
        instruction.program === "system" &&
        instruction.parsed?.type === "transfer"
    );

  const hasTokenTransfer =
    instructions.some(
      (instruction) =>
        (
          instruction.program === "spl-token" ||
          instruction.program === "spl-token-2022"
        ) &&
        (
          instruction.parsed?.type === "transfer" ||
          instruction.parsed?.type === "transferChecked"
        )
    );

  const hasStakeInstruction =
    instructions.some(
      (instruction) =>
        instruction.program === "stake"
    );

  const hasMultiplePrograms =
    programList.length >= 3;

  let category = "other";
  let confidence = "low";

  if (hasStakeInstruction) {
    category = "staking";
    confidence = "medium";
  } else if (hasTokenTransfer && hasMultiplePrograms) {
    category = "possible_swap_or_complex_token_activity";
    confidence = "low";
  } else if (hasTokenTransfer) {
    category = "token_transfer";
    confidence = "medium";
  } else if (hasSystemTransfer) {
    category = "sol_transfer";
    confidence = "medium";
  }

  return {
    category,
    confidence,
    programs: programList,
    instructionTypes: typeList
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

    const rpcUrl =
      process.env.SOLANA_RPC_URL ||
      "https://api.mainnet-beta.solana.com";

    const connection = new Connection(
      rpcUrl,
      "confirmed"
    );

    const signatures =
      await connection.getSignaturesForAddress(
        publicKey,
        { limit: SAMPLE_LIMIT }
      );

    const results = [];

    for (let i = 0; i < signatures.length; i += 5) {
      const batch = signatures.slice(i, i + 5);

      const transactions =
        await connection.getParsedTransactions(
          batch.map((item) => item.signature),
          {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0
          }
        );

      for (let j = 0; j < batch.length; j++) {
        const signatureInfo = batch[j];
        const transaction = transactions[j];

        const classification =
          classifyTransaction(transaction);

        results.push({
          signature: signatureInfo.signature,
          blockTime: signatureInfo.blockTime,
          success:
            transaction?.meta
              ? transaction.meta.err === null
              : null,
          ...classification
        });
      }
    }

    const categories = {};

    for (const item of results) {
      categories[item.category] =
        (categories[item.category] || 0) + 1;
    }

    return NextResponse.json({
      address: publicKey.toBase58(),
      network: "mainnet-beta",
      engineVersion: "0.4",
      transactionsRequested: signatures.length,
      transactionsDecoded:
        results.filter(
          (item) =>
            item.category !== "unknown"
        ).length,
      sampleLimit: SAMPLE_LIMIT,
      categories,
      transactions: results,
      disclaimer:
        "Preliminary instruction-based classification. Complex swaps, inner instructions and fund flows are not yet fully decoded."
    });

  } catch (error) {
    console.error("Transaction intelligence error:", error);

    return NextResponse.json(
      {
        error:
          "Unable to retrieve transaction intelligence"
      },
      { status: 500 }
    );
  }
}
