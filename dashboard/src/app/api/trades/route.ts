import { NextRequest, NextResponse } from "next/server";
import { insertTrade, getAllTrades, closeTrade, getOpenTrades } from "@/lib/ledger/db";
import type { Trade } from "@/lib/engine/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let trades: Trade[];
    if (status === "open") {
      trades = getOpenTrades();
    } else {
      trades = getAllTrades();
    }

    return NextResponse.json({ trades });
  } catch (error) {
    console.error("Trades GET error:", error);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "open") {
      const trade: Omit<Trade, "id"> = {
        marketId: body.marketId,
        source: body.source || "polymarket",
        question: body.question,
        side: body.side,
        entryPrice: body.entryPrice,
        quantity: body.quantity,
        positionSize: body.positionSize,
        estimatedProbability: body.estimatedProbability,
        marketPriceAtEntry: body.marketPriceAtEntry,
        edge: body.edge,
        reasoning: body.reasoning,
        status: "open",
        createdAt: new Date().toISOString(),
      };

      const id = insertTrade(trade);
      return NextResponse.json({ id, message: "Trade opened" });
    }

    if (action === "close") {
      const { tradeId, exitPrice, resolvedOutcome, status } = body;
      closeTrade(tradeId, exitPrice, resolvedOutcome, status);
      return NextResponse.json({ message: "Trade closed" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Trades POST error:", error);
    return NextResponse.json({ error: "Failed to process trade" }, { status: 500 });
  }
}
