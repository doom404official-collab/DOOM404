import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SAMPLE_LIMIT = 20;
const LAMPORTS_PER_SOL = 1000000000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTransfers(instructions, walletAddress, signature) {
  const transfers = [];

  for (const instruction of instructions || []) {
    if (
      instruction.program !== "system" ||
      instruction.parsed?.type !== "transfer"
    ) {
      continue;
    }

    const info = instruction.parsed?.info || {};
    const source = info.source;
    const destination = info.destination;
    const lamports = Number(info.lamports);

    if (
      !source ||
      !destination ||
      !Number.isSafeInteger(lamports) ||
      lamports < 0
    ) {
      continue;
    }

    let direction = "other";
    let counterparty = null;

    if (
      source === walletAddress &&
      destination === walletAddress
    ) {
      direction = "self";
      counterparty = walletAddress;
    } else if (source === walletAddress) {
      direction = "outgoing";
      counterparty = destination;
    } else if (destination === walletAddress) {
      direction = "incoming";
      counterparty = source;
    } else {
      continue;
    }

    transfers.push({
      signature,
      direction,
      counterparty,
      source,
      destination,
      amountSOL: lamports / LAMPORTS_PER_SOL
    });
  }

  return transfers;
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

    const walletAddress = publicKey.toBase58();

    const rpcUrl =
      process.env.SOLANA_RPC_URL ||
      "https://api.mainnet-beta.solana.com";

    const connection = new Connection(rpcUrl, {
      commitment: "confirmed",
      disableRetryOnRateLimit: true
    });

    const signatures =
      await connection.getSignaturesForAddress(
        publicKey,
        { limit: SAMPLE_LIMIT }
      );

    const transfers = [];
    let decoded = 0;
    let unavailable = 0;
    let rateLimited = false;
    const decodedActivity = [];

    for (const entry of signatures) {
      try {
        const transaction =
          await connection.getParsedTransaction(
            entry.signature,
            {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0
            }
          );

        if (!transaction) {
          unavailable++;
          continue;
        }

        decoded++;
        const blockTime = transaction.blockTime ?? entry.blockTime;
        if (Number.isFinite(blockTime) && blockTime > 0) {
          decodedActivity.push(blockTime);
        }

        const outerInstructions =
          transaction.transaction?.message?.instructions || [];

        const innerInstructions =
          (transaction.meta?.innerInstructions || [])
            .flatMap((group) => group.instructions || []);

        const transactionTransfers = extractTransfers(
          [...outerInstructions, ...innerInstructions],
          walletAddress,
          entry.signature
        );

        for (const transfer of transactionTransfers) {
          transfers.push({
            ...transfer,
            timestamp: entry.blockTime
              ? new Date(entry.blockTime * 1000).toISOString()
              : null
          });
        }

      } catch (error) {
        unavailable++;

        console.error(
          "GLITCH decode error:",
          error.message
        );

        if (
          error.code === 429 ||
          String(error.message).includes("429")
        ) {
          rateLimited = true;
          break;
        }
      }

      await wait(700);
    }

    const incoming = transfers.filter(
      (item) => item.direction === "incoming"
    );

    const outgoing = transfers.filter(
      (item) => item.direction === "outgoing"
    );

    const counterparties = {};

    for (const transfer of transfers) {
      if (
        !transfer.counterparty ||
        transfer.direction === "self"
      ) {
        continue;
      }

      if (!counterparties[transfer.counterparty]) {
        counterparties[transfer.counterparty] = {
          address: transfer.counterparty,
          interactions: 0,
          incomingSOL: 0,
          outgoingSOL: 0
        };
      }

      const item = counterparties[transfer.counterparty];

      item.interactions++;

      if (transfer.direction === "incoming") {
        item.incomingSOL += transfer.amountSOL;
      }

      if (transfer.direction === "outgoing") {
        item.outgoingSOL += transfer.amountSOL;
      }
    }

    const topCounterparties =
      Object.values(counterparties)
        .sort((a, b) => b.interactions - a.interactions)
        .slice(0, 10);

    const sumSOL = (items) =>
      Number(
        items.reduce(
          (total, item) => total + item.amountSOL,
          0
        ).toFixed(9)
      );

    // Frequency reflects decoded transactions with usable timestamps only.
    const timestamps = decodedActivity.sort((a, b) => a - b);
    const dayCounts = new Map();
    for (const timestamp of timestamps) {
      const day = new Date(timestamp * 1000).toISOString().slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }
    const dailyActivity = [...dayCounts].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
    const busiestDay = dailyActivity.reduce(
      (best, day) => !best || day.count > best.count ? day : best, null
    );
    let longestQuietPeriodHours = null;
    for (let i = 1; i < timestamps.length; i++) {
      const gap = (timestamps[i] - timestamps[i - 1]) / 3600;
      longestQuietPeriodHours = Math.max(longestQuietPeriodHours ?? 0, gap);
    }
    const frequency = {
      timestampedTransactions: timestamps.length,
      activeDaysInSample: dailyActivity.length,
      dailyActivity,
      busiestDay,
      longestQuietPeriodHours: longestQuietPeriodHours == null
        ? null : Number(longestQuietPeriodHours.toFixed(2)),
      note: "Only timestamped decoded transactions in the recent sample. Observed gaps do not prove inactivity."
    };

    // Only incoming/outgoing explicit SOL transfers contribute to concentration.
    const ranked = Object.values(counterparties).map((item) => ({
      ...item,
      totalSOL: item.incomingSOL + item.outgoingSOL
    })).sort((a, b) => b.totalSOL - a.totalSOL);
    const volume = ranked.reduce((sum, item) => sum + item.totalSOL, 0);
    const interactions = ranked.reduce((sum, item) => sum + item.interactions, 0);
    const percent = (numerator, denominator) => denominator > 0
      ? Number((100 * numerator / denominator).toFixed(2)) : null;
    const concentration = {
      observedTransferCount: interactions,
      totalObservedSOL: Number(volume.toFixed(9)),
      largestCounterparty: ranked[0]?.address ?? null,
      top1VolumeSharePercent: percent(ranked[0]?.totalSOL ?? 0, volume),
      top3VolumeSharePercent: percent(
        ranked.slice(0, 3).reduce((sum, item) => sum + item.totalSOL, 0), volume
      ),
      top1InteractionSharePercent: percent(
        Math.max(0, ...ranked.map((item) => item.interactions)), interactions
      ),
      note: "Observed explicit SOL transfers only; not a safety or fraud assessment."
    };

    return NextResponse.json({
      engineVersion: "0.6.0",
      scanner: "DOOM404 GLITCH",
      address: walletAddress,
      network: "mainnet-beta",
      coverage: {
        signaturesRetrieved: signatures.length,
        transactionsDecoded: decoded,
        transactionsUnavailable: unavailable,
        rateLimited,
        sampleLimit: SAMPLE_LIMIT,
        scope:
          "Most recent sampled transactions only"
      },
      summary: {
        incomingTransferCount: incoming.length,
        outgoingTransferCount: outgoing.length,
        incomingSOL: sumSOL(incoming),
        outgoingSOL: sumSOL(outgoing),
        uniqueCounterparties:
          Object.keys(counterparties).length
      },
      topCounterparties,
      behaviorIntelligence: { frequency, concentration },
      transfers,
      limitations: [
        "Only explicit parsed System Program SOL transfers are counted.",
        "Includes top-level and inner instructions.",
        "Transaction fees and rent-related balance changes are not treated as transfers.",
        "Wrapped SOL and token transfers are not decoded in this phase.",
        "Counterparties are addresses, not verified real-world identities.",
        "Frequency and concentration reflect only the sampled decoded transactions.",
        "No fraud or wallet safety determination is made."
      ]
    });

  } catch (error) {
    console.error("GLITCH Scanner error:", error);

    const rateLimited =
      error.code === 429 ||
      String(error.message).includes("429");

    return NextResponse.json(
      {
        error: rateLimited
          ? "Solana RPC rate limit reached"
          : "Unable to retrieve GLITCH intelligence"
      },
      { status: rateLimited ? 429 : 500 }
    );
  }
}
