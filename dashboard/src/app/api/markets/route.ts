import { NextRequest, NextResponse } from "next/server";
import { getPolymarketMarkets } from "@/lib/api/polymarket";
import { getKalshiMarkets } from "@/lib/api/kalshi";
import type { Market } from "@/lib/engine/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") || "all";

    let markets: Market[] = [];

    if (source === "all" || source === "polymarket") {
      try {
        const pm = await getPolymarketMarkets();
        markets = markets.concat(pm);
      } catch (e) {
        console.error("Polymarket fetch error:", e);
      }
    }

    if (source === "all" || source === "kalshi") {
      try {
        const km = await getKalshiMarkets();
        markets = markets.concat(km);
      } catch (e) {
        console.error("Kalshi fetch error:", e);
      }
    }

    // Sort by 24h volume descending
    markets.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

    return NextResponse.json({ markets, count: markets.length });
  } catch (error) {
    console.error("Markets API error:", error);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
