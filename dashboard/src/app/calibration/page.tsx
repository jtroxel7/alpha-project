"use client";

import { useEffect, useState } from "react";
import type { PortfolioSnapshot, CalibrationBucket, Trade } from "@/lib/engine/types";

export default function CalibrationPage() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [buckets, setBuckets] = useState<CalibrationBucket[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/portfolio").then((r) => r.json()),
      fetch("/api/calibration").then((r) => r.json()).catch(() => ({ buckets: [] })),
      fetch("/api/trades").then((r) => r.json()).catch(() => ({ trades: [] })),
    ]).then(([portfolio, cal, tradeData]) => {
      setSnapshot(portfolio.snapshot);
      setBuckets(cal.buckets || []);
      setTrades(tradeData.trades || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="text-muted text-center py-20">Loading calibration data...</div>;
  }

  const s = snapshot;
  const brierScore = s?.brierScore;
  const hasBuckets = buckets.length > 0;

  const closedTrades = trades.filter((t) => t.status !== "open");
  const resolvedTrades = closedTrades.filter((t) => t.resolvedOutcome);
  const exitedTrades = closedTrades.filter((t) => t.status === "closed_exit");
  const profitableExits = exitedTrades.filter((t) => (t.realizedPnl || 0) > 0);
  const unprofitableExits = exitedTrades.filter((t) => (t.realizedPnl || 0) <= 0);

  const totalRealizedPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
  const avgEdge = closedTrades.length > 0
    ? closedTrades.reduce((sum, t) => sum + Math.abs(t.edge), 0) / closedTrades.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Closed Trades Performance */}
      <div className="bg-card border border-card-border rounded-lg p-6">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
          Closed Trades Performance
        </div>
        {closedTrades.length === 0 ? (
          <div className="text-muted text-center py-8">
            No closed trades yet. Close positions to see performance.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-muted uppercase">Total Closed</div>
                <div className="text-xl font-mono font-bold">{closedTrades.length}</div>
              </div>
              <div>
                <div className="text-xs text-muted uppercase">Record</div>
                <div className="text-xl font-mono font-bold">
                  <span className="text-green-400">{s?.wins || 0}W</span>
                  {" / "}
                  <span className="text-red-400">{s?.losses || 0}L</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted uppercase">Win Rate</div>
                <div className="text-xl font-mono font-bold">
                  {s && (s.wins + s.losses) > 0 ? `${(s.winRate * 100).toFixed(0)}%` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted uppercase">Realized P&L</div>
                <div className={`text-xl font-mono font-bold ${totalRealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {totalRealizedPnl >= 0 ? "+" : ""}${totalRealizedPnl.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Closed trade list */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-xs uppercase border-b border-card-border">
                    <th className="text-left py-2 pr-4">Market</th>
                    <th className="text-center py-2 px-2">Side</th>
                    <th className="text-right py-2 px-2">Entry</th>
                    <th className="text-right py-2 px-2">Exit</th>
                    <th className="text-right py-2 px-2">P&L</th>
                    <th className="text-center py-2 pl-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((t) => {
                    const pnl = t.realizedPnl || 0;
                    const isWin = pnl > 0;
                    const isResolved = !!t.resolvedOutcome;
                    return (
                      <tr key={t.id} className="border-b border-card-border/50">
                        <td className="py-2 pr-4 max-w-[200px] truncate">{t.question}</td>
                        <td className="text-center py-2 px-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.side === "YES" ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                            {t.side}
                          </span>
                        </td>
                        <td className="text-right py-2 px-2 font-mono">{t.entryPrice.toFixed(2)}</td>
                        <td className="text-right py-2 px-2 font-mono">{t.exitPrice?.toFixed(2) || "—"}</td>
                        <td className={`text-right py-2 px-2 font-mono font-bold ${isWin ? "text-green-400" : "text-red-400"}`}>
                          {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                        </td>
                        <td className="text-center py-2 pl-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${isWin ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                            {isResolved ? (isWin ? "WIN" : "LOSS") : (isWin ? "PROFIT" : "LOSS")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Brier Score Card */}
      <div className="bg-card border border-card-border rounded-lg p-6">
        <div className="text-muted text-sm mb-2">Brier Score (Resolved Trades Only)</div>
        <div className="flex items-baseline gap-4">
          <span className="text-4xl font-mono font-bold">
            {brierScore !== null && brierScore !== undefined ? brierScore.toFixed(3) : "—"}
          </span>
          <span className="text-sm text-muted">
            {brierScore === null || brierScore === undefined
              ? `${resolvedTrades.length} resolved of ${closedTrades.length} closed trades`
              : brierScore < 0.1
              ? "Exceptional — better than most superforecasters"
              : brierScore < 0.2
              ? "Excellent — strong calibration"
              : brierScore < 0.25
              ? "Good — above average"
              : brierScore < 0.33
              ? "Decent — room for improvement"
              : "Needs work — predictions are poorly calibrated"}
          </span>
        </div>
        <div className="mt-4 text-xs text-muted">
          Brier score measures probability calibration on market-resolved trades only.
          Exited trades are tracked above by P&L.
          Lower is better. 0.0 = perfect. 0.25 = coin flip.
        </div>
      </div>

      {/* Calibration Chart */}
      <div className="bg-card border border-card-border rounded-lg p-6">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
          Reliability Diagram
        </div>
        {!hasBuckets ? (
          <div className="text-muted text-center py-12">
            Need market-resolved trades to display calibration chart.
            {closedTrades.length > 0 && ` ${closedTrades.length} trades closed but awaiting market resolution.`}
          </div>
        ) : (
          <div className="relative">
            {/* Chart grid */}
            <div className="relative h-64 border-l border-b border-card-border">
              {/* Perfect calibration line */}
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to top right, transparent 49.5%, var(--muted) 49.5%, var(--muted) 50.5%, transparent 50.5%)",
                  opacity: 0.3,
                }}
              />
              {/* Buckets */}
              {buckets.map((b, i) => {
                const x = ((b.predicted) * 100);
                const y = (b.actual * 100);
                return (
                  <div
                    key={i}
                    className="absolute w-3 h-3 bg-accent-blue rounded-full border-2 border-background"
                    style={{
                      left: `${x}%`,
                      bottom: `${y}%`,
                      transform: "translate(-50%, 50%)",
                    }}
                    title={`Predicted: ${(b.predicted * 100).toFixed(0)}%, Actual: ${(b.actual * 100).toFixed(0)}%, n=${b.count}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted mt-1 px-2">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
            <div className="text-center text-xs text-muted mt-1">Predicted Probability</div>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted uppercase">Total Trades</div>
          <div className="text-xl font-mono font-bold">{s?.totalTrades || 0}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted uppercase">Exits (by P&L)</div>
          <div className="text-xl font-mono font-bold">
            <span className="text-green-400">{profitableExits.length}</span>
            {" / "}
            <span className="text-red-400">{unprofitableExits.length}</span>
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted uppercase">Avg Edge</div>
          <div className="text-xl font-mono font-bold">
            {closedTrades.length > 0 ? `${(avgEdge * 100).toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted uppercase">Resolved</div>
          <div className="text-xl font-mono font-bold">{resolvedTrades.length}</div>
        </div>
      </div>
    </div>
  );
}
