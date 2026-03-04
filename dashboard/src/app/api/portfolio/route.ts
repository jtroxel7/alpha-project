import { NextResponse } from "next/server";
import { getPortfolioSnapshot, getOpenTrades, getPortfolioHistory } from "@/lib/ledger/db";

export async function GET() {
  try {
    const snapshot = getPortfolioSnapshot();
    const openTrades = getOpenTrades();
    const history = getPortfolioHistory();

    return NextResponse.json({ snapshot, openTrades, history });
  } catch (error) {
    console.error("Portfolio API error:", error);
    return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }
}
