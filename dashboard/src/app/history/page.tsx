"use client";

import { useEffect, useState } from "react";
import type { Trade } from "@/lib/engine/types";

function formatDollar(n: number): string {
  return n >= 0 ? `$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
}

function statusBadge(status: Trade["status"]) {
  const styles = {
    open: "bg-accent-blue/20 text-accent-blue",
    closed_win: "bg-accent-green/20 text-accent-green",
    closed_loss: "bg-accent-red/20 text-accent-red",
    closed_exit: "bg-muted/20 text-muted",
  };
  const labels = {
    open: "OPEN",
    closed_win: "WIN",
    closed_loss: "LOSS",
    closed_exit: "EXIT",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function HistoryPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trades")
      .then((r) => r.json())
      .then((data) => {
        setTrades(data.trades || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-muted text-center py-20">Loading trade history...</div>;
  }

  const closedTrades = trades.filter((t) => t.status !== "open");
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
  const wins = closedTrades.filter((t) => t.status === "closed_win").length;
  const losses = closedTrades.filter((t) => t.status === "closed_loss").length;

  // Cumulative P&L data
  const cumulativePnl = closedTrades
    .sort((a, b) => new Date(a.closedAt || a.createdAt).getTime() - new Date(b.closedAt || b.createdAt).getTime())
    .reduce<{ date: string; pnl: number }[]>((acc, t) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].pnl : 0;
      acc.push({
        date: (t.closedAt || t.createdAt).slice(0, 10),
        pnl: prev + (t.realizedPnl || 0),
      });
      return acc;
    }, []);

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="flex gap-4">
        <div className="bg-card border border-card-border rounded-lg p-4 flex-1">
          <div className="text-xs text-muted uppercase">Total Realized P&L</div>
          <div className={`text-2xl font-mono font-bold ${totalPnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
            {formatDollar(totalPnl)}
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4 flex-1">
          <div className="text-xs text-muted uppercase">Record</div>
          <div className="text-2xl font-mono font-bold">
            <span className="text-accent-green">{wins}W</span>{" "}
            <span className="text-muted">/</span>{" "}
            <span className="text-accent-red">{losses}L</span>
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4 flex-1">
          <div className="text-xs text-muted uppercase">Total Trades</div>
          <div className="text-2xl font-mono font-bold">{trades.length}</div>
        </div>
      </div>

      {/* Cumulative P&L Chart (simple bar representation) */}
      {cumulativePnl.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted uppercase mb-3">Cumulative P&L</div>
          <div className="flex items-end gap-1 h-32">
            {cumulativePnl.map((d, i) => {
              const max = Math.max(...cumulativePnl.map((x) => Math.abs(x.pnl)), 1);
              const height = Math.abs(d.pnl) / max;
              return (
                <div
                  key={i}
                  className="flex-1 min-w-1 rounded-sm"
                  style={{
                    height: `${Math.max(height * 100, 4)}%`,
                    backgroundColor: d.pnl >= 0 ? "var(--accent-green)" : "var(--accent-red)",
                    opacity: 0.7,
                  }}
                  title={`${d.date}: ${formatDollar(d.pnl)}`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Trade Log Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-card-border">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Trade Log</h2>
        </div>
        {trades.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted">No trades recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs uppercase tracking-wider">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Market</th>
                  <th className="px-4 py-2">Side</th>
                  <th className="px-4 py-2">Entry</th>
                  <th className="px-4 py-2">Size</th>
                  <th className="px-4 py-2">Edge</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-t border-card-border hover:bg-background/50">
                    <td className="px-4 py-3 text-muted font-mono text-xs">
                      {(t.createdAt || "").slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate">{t.question}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        t.side === "YES" ? "bg-accent-green/20 text-accent-green" : "bg-accent-red/20 text-accent-red"
                      }`}>
                        {t.side}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{t.entryPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono">{formatDollar(t.positionSize)}</td>
                    <td className="px-4 py-3 font-mono">{(t.edge * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3">{statusBadge(t.status)}</td>
                    <td className="px-4 py-3 font-mono">
                      {t.realizedPnl !== undefined && t.realizedPnl !== null ? (
                        <span className={t.realizedPnl >= 0 ? "text-accent-green" : "text-accent-red"}>
                          {formatDollar(t.realizedPnl)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
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
