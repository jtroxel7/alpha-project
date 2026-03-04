"use client";

import { useEffect, useState } from "react";
import type { Trade, PortfolioSnapshot } from "@/lib/engine/types";

function formatDollar(n: number): string {
  return n >= 0 ? `$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function PnlText({ value }: { value: number }) {
  const color = value > 0 ? "text-accent-green" : value < 0 ? "text-accent-red" : "text-muted";
  return <span className={color}>{formatDollar(value)}</span>;
}

function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-4">
      <div className="text-muted text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-mono font-bold">{value}</div>
      {subValue && <div className="text-sm text-muted mt-1">{subValue}</div>}
    </div>
  );
}

export default function PortfolioPage() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((data) => {
        setSnapshot(data.snapshot);
        setOpenTrades(data.openTrades || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-muted text-center py-20">Loading portfolio...</div>;
  }

  const s = snapshot || {
    totalValue: 500,
    cashBalance: 500,
    investedAmount: 0,
    unrealizedPnl: 0,
    realizedPnl: 0,
    totalPnl: 0,
    pnlPercent: 0,
    openPositions: 0,
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    brierScore: null,
  };

  return (
    <div className="space-y-6">
      {/* Hero: Portfolio Value */}
      <div className="bg-card border border-card-border rounded-lg p-6">
        <div className="text-muted text-sm mb-1">Portfolio Value</div>
        <div className="flex items-baseline gap-4">
          <span className="text-4xl font-mono font-bold">{formatDollar(s.totalValue)}</span>
          <span className={`text-lg font-mono ${s.totalPnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
            {formatDollar(s.totalPnl)} ({formatPct(s.pnlPercent)})
          </span>
        </div>
        <div className="mt-3 flex gap-6 text-sm text-muted">
          <span>Cash: {formatDollar(s.cashBalance)}</span>
          <span>Invested: {formatDollar(s.investedAmount)}</span>
          <span>Exposure: {((s.investedAmount / Math.max(s.totalValue, 1)) * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open Positions" value={String(s.openPositions)} />
        <StatCard
          label="Win Rate"
          value={s.totalTrades > 0 ? `${(s.winRate * 100).toFixed(0)}%` : "\u2014"}
          subValue={`${s.wins}W / ${s.losses}L of ${s.totalTrades} trades`}
        />
        <StatCard label="Realized P&L" value={formatDollar(s.realizedPnl)} />
        <StatCard
          label="Brier Score"
          value={s.brierScore !== null ? s.brierScore.toFixed(3) : "\u2014"}
          subValue={s.brierScore !== null ? (s.brierScore < 0.2 ? "Excellent" : s.brierScore < 0.3 ? "Good" : "Needs work") : "No resolved trades yet"}
        />
      </div>

      {/* Open Positions Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-card-border">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Open Positions</h2>
        </div>
        {openTrades.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted">
            No open positions. Head to the Scanner to find opportunities.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs uppercase tracking-wider">
                  <th className="px-4 py-2">Market</th>
                  <th className="px-4 py-2">Side</th>
                  <th className="px-4 py-2">Entry</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Cost</th>
                  <th className="px-4 py-2">Est. Prob</th>
                  <th className="px-4 py-2">Edge</th>
                </tr>
              </thead>
              <tbody>
                {openTrades.map((t) => (
                  <tr key={t.id} className="border-t border-card-border hover:bg-background/50">
                    <td className="px-4 py-3 max-w-xs truncate">{t.question}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        t.side === "YES" ? "bg-accent-green/20 text-accent-green" : "bg-accent-red/20 text-accent-red"
                      }`}>
                        {t.side}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{t.entryPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono">{t.quantity.toFixed(1)}</td>
                    <td className="px-4 py-3 font-mono">{formatDollar(t.positionSize)}</td>
                    <td className="px-4 py-3 font-mono">{(t.estimatedProbability * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 font-mono">
                      <PnlText value={t.edge} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
