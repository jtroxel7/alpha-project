import { NextResponse } from "next/server";
import { getPortfolioSnapshot, getOpenTrades, getPortfolioHistory } from "@/lib/ledger/db";

export async function GET() {
  try {
    const snapshot = getPortfolioSnapshot();
    const openTrades = getOpenTrades();
    const history = getPortfolioHistory();

    return NextResponse.json({ snapshot, openTrades, history });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "DB_UNAVAILABLE") {
      // Running on Vercel without filesystem — return defaults
      return NextResponse.json({
        snapshot: {
          totalValue: 500, cashBalance: 500, investedAmount: 0,
          unrealizedPnl: 0, realizedPnl: 0, totalPnl: 0, pnlPercent: 0,
          openPositions: 0, totalTrades: 0, wins: 0, losses: 0, winRate: 0, brierScore: null,
        },
        openTrades: [],
        history: [],
      });
    }
    console.error("Portfolio API error:", error);
    return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }
}
