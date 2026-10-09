import { createReliableConnection } from "../../../lib/reliableConnection.js";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MAX_PAGES = 5;
const DAY = 86400;

function calculateCoverage(
  days,
  oldestTimestamp,
  now,
  reachedEnd,
  timestampsAvailable
) {
  if (!timestampsAvailable) {
    return "unknown";
  }

  const windowStart = now - days * DAY;

  if (
    oldestTimestamp !== null &&
    oldestTimestamp <= windowStart
  ) {
    return "complete_sample";
  }

  if (reachedEnd) {
    return "rpc_exhausted";
  }

  return "incomplete";
}

function calculateMaturityScore(ageDays) {
  if (ageDays === null) return null;

  if (ageDays < 7) return 2;
  if (ageDays < 30) return 5;
  if (ageDays < 90) return 10;
  if (ageDays < 180) return 15;
  if (ageDays < 365) return 20;

  return 25;
}

function calculateConsistencyScore(activeDays) {
  if (activeDays <= 2) return 0;
  if (activeDays <= 7) return 5;
  if (activeDays <= 20) return 10;
  if (activeDays <= 45) return 20;
  if (activeDays <= 65) return 25;

  return 30;
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

      before =
        batch[batch.length - 1].signature;

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

    const timestampsAvailable =
      timestamps.length === signatures.length;

    const oldestTimestamp =
      timestamps.length
        ? Math.min(...timestamps)
        : null;

    const newestTimestamp =
      timestamps.length
        ? Math.max(...timestamps)
        : null;

    const uniqueDays = new Set(
      timestamps.map((time) =>
        Math.floor(time / DAY)
      )
    );

    const transactions7d =
      timestamps.filter(
        (time) => time >= now - 7 * DAY
      ).length;

    const transactions30d =
      timestamps.filter(
        (time) => time >= now - 30 * DAY
      ).length;

    const transactions90d =
      timestamps.filter(
        (time) => time >= now - 90 * DAY
      ).length;

    const activeDays90d = new Set(
      timestamps
        .filter(
          (time) => time >= now - 90 * DAY
        )
        .map(
          (time) => Math.floor(time / DAY)
        )
    ).size;

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

    const coverage7d = calculateCoverage(
      7,
      oldestTimestamp,
      now,
      reachedEnd,
      timestampsAvailable
    );

    const coverage30d = calculateCoverage(
      30,
      oldestTimestamp,
      now,
      reachedEnd,
      timestampsAvailable
    );

    const coverage90d = calculateCoverage(
      90,
      oldestTimestamp,
      now,
      reachedEnd,
      timestampsAvailable
    );

    const scoringEligible =
      timestampsAvailable &&
      coverage7d === "complete_sample" &&
      coverage30d === "complete_sample" &&
      coverage90d === "complete_sample";

    const scoringReasons = [];

    if (signatures.length === 0) {
      scoringReasons.push(
        "No transactions were returned by the RPC provider."
      );
    }

    if (!timestampsAvailable) {
      scoringReasons.push(
        "Some retrieved transactions lack usable timestamps."
      );
    }

    if (timestampsAvailable) {
      const incompleteWindows = [
        [7, coverage7d],
        [30, coverage30d],
        [90, coverage90d]
      ].filter(([, coverage]) => coverage !== "complete_sample");

      if (incompleteWindows.length > 0) {
        const windows = incompleteWindows
          .map(([days]) => days + "-day")
          .join(", ");

        if (reachedEnd) {
          scoringReasons.push(
            "The available wallet history does not reach the start of the " +
            windows +
            " observation window(s)."
          );
        } else {
          scoringReasons.push(
            "The RPC retrieval limit was reached before the " +
            windows +
            " observation window(s) could be fully covered."
          );
        }
      }
    }

    const scoringExplanation = scoringEligible
      ? "The required 7-, 30- and 90-day observation windows are covered by the retrieved sample."
      : "Scores are withheld until the required observation windows have sufficient coverage.";

    const observedAgeDays =
      oldestTimestamp !== null
        ? Math.floor(
            (now - oldestTimestamp) / DAY
          )
        : null;

    const maturityScore =
      scoringEligible
        ? calculateMaturityScore(observedAgeDays)
        : null;

    const consistencyScore =
      scoringEligible
        ? calculateConsistencyScore(activeDays90d)
        : null;

    const preliminaryScore =
      scoringEligible
        ? maturityScore + consistencyScore
        : null;

    return NextResponse.json({
      address: publicKey.toBase58(),

      network: "mainnet-beta",

      balanceSOL:
        balanceLamports / LAMPORTS_PER_SOL,

      transactionsAnalyzed:
        signatures.length,

      latestTransaction:
        signatures[0]?.signature || null,

      activity: {
        activeDaysObserved:
          uniqueDays.size,

        activeDays90d,

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

      intelligence: {
        version: "0.3",

        observedAgeDays,

        maturityScore,

        maturityMaxScore: 25,

        activeDays90d,

        consistencyScore,

        consistencyMaxScore: 30,

        preliminaryScore,

        preliminaryMaxScore: 55,

        scoringStatus:
          scoringEligible
            ? "preliminary"
            : "insufficient_data",

        scoringExplanation,

        scoringReasons,

        disclaimer:
          "Activity scores describe observed behaviour, not trustworthiness or fraud risk."
      },

      dataCoverage: {
        pageSize: PAGE_SIZE,

        pagesFetched,

        maxPages: MAX_PAGES,

        transactionsRetrieved:
          signatures.length,

        reachedEnd,

        historyLimitReached:
          !reachedEnd,

        timestampsAvailable,

        coverage: {
          coverage7d,
          coverage30d,
          coverage90d
        },

        scoringEligible,

        completeWalletHistory:
          "Not independently verified"
      }
    });

  } catch (error) {
    console.error(
      "Wallet intelligence error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to retrieve wallet intelligence"
      },
      { status: 500 }
    );
  }
}
