import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MAX_PAGES = 5;
const DAY = 86400;

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

      if (!PublicKey.isOnCurve(publicKey.toBytes())) {
        // Program-derived addresses can also be analyzed.
        // No rejection is required.
      }
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

    const balanceLamports =
      await connection.getBalance(publicKey);

    let signatures = [];
    let before = undefined;
    let reachedEnd = false;
    let pagesFetched = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const options = {
        limit: PAGE_SIZE
      };

      if (before) {
        options.before = before;
      }

      const batch =
        await connection.getSignaturesForAddress(
          publicKey,
          options
        );

      pagesFetched++;

      if (batch.length === 0) {
        reachedEnd = true;
        break;
      }

      signatures.push(...batch);

      before = batch[batch.length - 1].signature;

      if (batch.length < PAGE_SIZE) {
        reachedEnd = true;
        break;
      }
    }

    const now = Math.floor(Date.now() / 1000);

    const timestamps = signatures
      .map((tx) => tx.blockTime)
      .filter(
        (time) =>
          typeof time === "number" &&
          time <= now
      );

    const uniqueDays = new Set(
      timestamps.map((time) =>
        Math.floor(time / DAY)
      )
    );

    const transactions7d = timestamps.filter(
      (time) => time >= now - 7 * DAY
    ).length;

    const transactions30d = timestamps.filter(
      (time) => time >= now - 30 * DAY
    ).length;

    const transactions90d = timestamps.filter(
      (time) => time >= now - 90 * DAY
    ).length;

    const oldestTimestamp =
      timestamps.length
        ? Math.min(...timestamps)
        : null;

    const newestTimestamp =
      timestamps.length
        ? Math.max(...timestamps)
        : null;

    const weeklyActivity = [];

    for (let week = 0; week < 13; week++) {
      const weekEnd = now - week * 7 * DAY;
      const weekStart = weekEnd - 7 * DAY;

      const count = timestamps.filter(
        (time) =>
          time >= weekStart &&
          time < weekEnd
      ).length;

      weeklyActivity.push({
        week: week + 1,
        transactions: count
      });
    }

    const timestampsAvailable =
      timestamps.length === signatures.length;

    return NextResponse.json({
      address: publicKey.toBase58(),

      network: "mainnet-beta",

      balanceSOL:
        balanceLamports / LAMPORTS_PER_SOL,

      transactionsAnalyzed: signatures.length,

      latestTransaction:
        signatures[0]?.signature || null,

      activity: {
        activeDaysObserved: uniqueDays.size,

        transactions7d,
        transactions30d,
        transactions90d,

        firstObservedTransaction:
          oldestTimestamp !== null
            ? new Date(
                oldestTimestamp * 1000
              ).toISOString()
            : null,

        latestObservedTransaction:
          newestTimestamp !== null
            ? new Date(
                newestTimestamp * 1000
              ).toISOString()
            : null,

        weeklyActivity
      },

      dataCoverage: {
        pageSize: PAGE_SIZE,
        pagesFetched,
        maxPages: MAX_PAGES,
        transactionsRetrieved: signatures.length,
        reachedEnd,
        historyLimitReached: !reachedEnd,
        timestampsAvailable,
        completeWalletHistory:
          reachedEnd && timestampsAvailable
            ? "Pagination exhausted; RPC history not independently verified"
            : "No"
      }
    });

  } catch (error) {
    console.error(
      "Wallet analysis error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to retrieve Solana wallet data"
      },
      { status: 500 }
    );
  }
}
