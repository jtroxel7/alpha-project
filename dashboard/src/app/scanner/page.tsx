"use client";

import { useEffect, useState, useMemo } from "react";
import type { Market } from "@/lib/engine/types";
import { DEFAULT_CONFIG } from "@/lib/engine/types";

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDollar(n: number): string {
  return n >= 0 ? `$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
}

function daysUntil(dateStr: string): number {
  const end = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

// Kelly fraction for binary outcome
function kellyFraction(trueProb: number, entryPrice: number): number {
  if (entryPrice <= 0 || entryPrice >= 1 || trueProb <= 0 || trueProb >= 1) return 0;
  const b = (1 - entryPrice) / entryPrice;
  const f = (b * trueProb - (1 - trueProb)) / b;
  return Math.max(0, f);
}

export default function ScannerPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "polymarket" | "kalshi">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [maxDays, setMaxDays] = useState(30);
  const [sortBy, setSortBy] = useState<"volume24h" | "price_high" | "price_low">("volume24h");
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/markets?source=${sourceFilter}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setMarkets(data.markets || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [sourceFilter]);

  const categories = useMemo(() => {
    const cats = new Set(markets.map((m) => m.category));
    return ["all", ...Array.from(cats).sort()];
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    let result = markets.filter((m) => {
      if (m.endDate && daysUntil(m.endDate) > maxDays) return false;
      if (m.endDate && daysUntil(m.endDate) < 1) return false;
      if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
      const p = m.outcomePrices[0];
      if (p >= 0.98 || p <= 0.02) return false;
      return true;
    });

    if (sortBy === "price_high") {
      result.sort((a, b) => b.outcomePrices[0] - a.outcomePrices[0]);
    } else if (sortBy === "price_low") {
      result.sort((a, b) => a.outcomePrices[0] - b.outcomePrices[0]);
    } else {
      result.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    }

    return result;
  }, [markets, maxDays, categoryFilter, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold">Market Scanner</h1>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
            className="bg-card border border-card-border rounded px-2 py-1 text-sm"
          >
            <option value="all">All Sources</option>
            <option value="polymarket">Polymarket</option>
            <option value="kalshi">Kalshi</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-card border border-card-border rounded px-2 py-1 text-sm"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Categories" : c}
              </option>
            ))}
          </select>
          <select
            value={maxDays}
            onChange={(e) => setMaxDays(Number(e.target.value))}
            className="bg-card border border-card-border rounded px-2 py-1 text-sm"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-card border border-card-border rounded px-2 py-1 text-sm"
          >
            <option value="volume24h">Sort: Volume</option>
            <option value="price_high">Sort: Price High</option>
            <option value="price_low">Sort: Price Low</option>
          </select>
          <span className="text-muted">{filteredMarkets.length} markets</span>
        </div>
      </div>

      {loading && <div className="text-muted text-center py-20">Fetching markets...</div>}
      {error && <div className="text-accent-red text-center py-20">Error: {error}</div>}

      {!loading && !error && (
        <div className="space-y-2">
          {filteredMarkets.map((m) => (
            <MarketCard
              key={`${m.source}-${m.id}`}
              market={m}
              onClick={() => setSelectedMarket(m)}
            />
          ))}
          {filteredMarkets.length === 0 && (
            <div className="text-muted text-center py-20">No markets match filters.</div>
          )}
        </div>
      )}

      {selectedMarket && (
        <TradeModal
          market={selectedMarket}
          onClose={() => setSelectedMarket(null)}
        />
      )}
    </div>
  );
}

function MarketCard({ market, onClick }: { market: Market; onClick: () => void }) {
  const yesPrice = market.outcomePrices[0];
  const days = market.endDate ? daysUntil(market.endDate) : null;

  const priceColor =
    yesPrice >= 0.4 && yesPrice <= 0.6
      ? "text-accent-yellow"
      : yesPrice >= 0.7
      ? "text-accent-green"
      : yesPrice <= 0.3
      ? "text-accent-red"
      : "text-foreground";

  return (
    <div
      onClick={onClick}
      className="bg-card border border-card-border rounded-lg p-4 hover:border-accent-blue/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                market.source === "polymarket"
                  ? "bg-accent-blue/20 text-accent-blue"
                  : "bg-accent-yellow/20 text-accent-yellow"
              }`}
            >
              {market.source === "polymarket" ? "PM" : "KL"}
            </span>
            <span className="text-xs text-muted">{market.category}</span>
            {days !== null && (
              <span className={`text-xs ${days <= 3 ? "text-accent-red" : "text-muted"}`}>
                {days}d
              </span>
            )}
          </div>
          <div className="text-sm font-medium">{market.question}</div>
        </div>

        <div className="flex items-center gap-5 text-right shrink-0">
          <div>
            <div className="text-xs text-muted">YES</div>
            <div className={`font-mono font-bold text-lg ${priceColor}`}>
              {(yesPrice * 100).toFixed(0)}&cent;
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Volume</div>
            <div className="font-mono text-sm">{formatVolume(market.volume)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">24h</div>
            <div className="font-mono text-sm">{formatVolume(market.volume24h)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeModal({ market, onClose }: { market: Market; onClose: () => void }) {
  const yesPrice = market.outcomePrices[0];
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [estProb, setEstProb] = useState<string>((yesPrice * 100).toFixed(0));
  const [reasoning, setReasoning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const estProbNum = parseFloat(estProb) / 100;
  const entryPrice = side === "YES" ? yesPrice : 1 - yesPrice;
  const trueProb = side === "YES" ? estProbNum : 1 - estProbNum;
  const edge = side === "YES" ? estProbNum - yesPrice : (1 - estProbNum) - (1 - yesPrice);
  const absEdge = Math.abs(estProbNum - yesPrice);
  const hasEdge = absEdge >= DEFAULT_CONFIG.minEdge;

  // Kelly sizing
  const fullKelly = kellyFraction(trueProb, entryPrice);
  const quarterKelly = fullKelly * DEFAULT_CONFIG.kellyFraction;
  const kellyDollars = quarterKelly * DEFAULT_CONFIG.bankroll;
  const positionSize = Math.min(kellyDollars, DEFAULT_CONFIG.maxPositionPct * DEFAULT_CONFIG.bankroll);
  const quantity = positionSize > 0 ? positionSize / entryPrice : 0;

  // EV
  const ev = side === "YES"
    ? estProbNum * (1 - yesPrice) - (1 - estProbNum) * yesPrice
    : (1 - estProbNum) * yesPrice - estProbNum * (1 - yesPrice);

  async function handleSubmit() {
    if (!hasEdge || !reasoning.trim() || positionSize < 1) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          marketId: market.id,
          source: market.source,
          question: market.question,
          side,
          entryPrice,
          quantity: Math.round(quantity * 10) / 10,
          positionSize: Math.round(positionSize * 100) / 100,
          estimatedProbability: estProbNum,
          marketPriceAtEntry: yesPrice,
          edge: estProbNum - yesPrice,
          reasoning: reasoning.trim(),
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(onClose, 1500);
      }
    } catch (e) {
      console.error("Trade submission failed:", e);
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-select side based on estimate
  useEffect(() => {
    const est = parseFloat(estProb) / 100;
    if (!isNaN(est)) {
      setSide(est > yesPrice ? "YES" : "NO");
    }
  }, [estProb, yesPrice]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-card-border rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <div className="text-center py-8">
            <div className="text-accent-green text-2xl font-bold mb-2">Trade Recorded</div>
            <div className="text-muted">{side} {market.question.slice(0, 60)}</div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-muted uppercase tracking-wider mb-1">Paper Trade</div>
                <div className="text-sm font-medium pr-4">{market.question}</div>
              </div>
              <button onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none">&times;</button>
            </div>

            {/* Market price */}
            <div className="flex gap-4 mb-4 text-sm">
              <div className="bg-background rounded p-3 flex-1 text-center">
                <div className="text-xs text-muted">Market YES</div>
                <div className="font-mono font-bold text-lg">{(yesPrice * 100).toFixed(1)}&cent;</div>
              </div>
              <div className="bg-background rounded p-3 flex-1 text-center">
                <div className="text-xs text-muted">Market NO</div>
                <div className="font-mono font-bold text-lg">{((1 - yesPrice) * 100).toFixed(1)}&cent;</div>
              </div>
            </div>

            {/* Your estimate */}
            <div className="mb-4">
              <label className="block text-xs text-muted uppercase tracking-wider mb-1">
                Your probability estimate (YES %)
              </label>
              <input
                type="number"
                min="1"
                max="99"
                value={estProb}
                onChange={(e) => setEstProb(e.target.value)}
                className="w-full bg-background border border-card-border rounded px-3 py-2 font-mono text-lg"
              />
            </div>

            {/* Edge analysis */}
            <div className="bg-background rounded p-3 mb-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted">Side</span>
                <span className={`font-bold ${side === "YES" ? "text-accent-green" : "text-accent-red"}`}>
                  {side}
                </span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted">Edge</span>
                <span className={`font-mono ${hasEdge ? "text-accent-green" : "text-accent-red"}`}>
                  {(absEdge * 100).toFixed(1)}% {hasEdge ? "\u2713" : `(need ${(DEFAULT_CONFIG.minEdge * 100).toFixed(0)}%)`}
                </span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted">EV per contract</span>
                <span className="font-mono">{(ev * 100).toFixed(1)}&cent;</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted">Kelly (quarter)</span>
                <span className="font-mono">{(quarterKelly * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted">Position size</span>
                <span className="font-mono font-bold">{formatDollar(Math.max(positionSize, 0))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Contracts</span>
                <span className="font-mono">{quantity.toFixed(1)}</span>
              </div>
            </div>

            {/* Reasoning */}
            <div className="mb-4">
              <label className="block text-xs text-muted uppercase tracking-wider mb-1">
                Reasoning (required)
              </label>
              <textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder="Why do you believe the true probability differs from market price?"
                rows={3}
                className="w-full bg-background border border-card-border rounded px-3 py-2 text-sm resize-none"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!hasEdge || !reasoning.trim() || positionSize < 1 || submitting}
              className={`w-full py-2 rounded font-bold text-sm transition-colors ${
                hasEdge && reasoning.trim() && positionSize >= 1
                  ? "bg-accent-blue hover:bg-accent-blue/80 text-white cursor-pointer"
                  : "bg-card-border text-muted cursor-not-allowed"
              }`}
            >
              {submitting ? "Recording..." : `Record ${side} Trade \u2014 ${formatDollar(Math.max(positionSize, 0))}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
