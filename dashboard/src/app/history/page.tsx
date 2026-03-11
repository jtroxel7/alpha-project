"use client";

import { useEffect, useState } from "react";
import type { Trade } from "@/lib/engine/types";

function formatDollar(n: number): string {
  return n >= 0 ? `$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
}

function sourceBadge(source: string) {
  if (source === "crypto_sim") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400">
        CRYPTO
      </span>
    );
  }
  if (source === "kalshi") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400">
        KALSHI
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">
      POLY
    </span>
  );
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

type FilterMode = "all" | "markets" | "crypto";

export default function HistoryPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");

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

  // Filter trades by source
  const filteredTrades = trades.filter((t) => {
    if (filter === "markets") return t.source !== "crypto_sim";
    if (filter === "crypto") return t.source === "crypto_sim";
    return true;
  });

  const closedTrades = filteredTrades.filter((t) => t.status !== "open");
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
  const wins = closedTrades.filter((t) =>
    t.status === "closed_win" || (t.status === "closed_exit" && (t.realizedPnl || 0) > 0)
  ).length;
  const losses = closedTrades.filter((t) =>
    t.status === "closed_loss" || (t.status === "closed_exit" && (t.realizedPnl || 0) <= 0)
  ).length;

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

  // Counts for filter buttons
  const marketCount = trades.filter(t => t.source !== "crypto_sim").length;
  const cryptoCount = trades.filter(t => t.source === "crypto_sim").length;

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
            filter === "all"
              ? "bg-white/10 text-white"
              : "text-muted hover:text-white hover:bg-white/5"
          }`}
        >
          All ({trades.length})
        </button>
        <button
          onClick={() => setFilter("markets")}
          className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
            filter === "markets"
              ? "bg-blue-500/20 text-blue-400"
              : "text-muted hover:text-blue-400 hover:bg-blue-500/10"
          }`}
        >
          Markets ({marketCount})
        </button>
        <button
          onClick={() => setFilter("crypto")}
          className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
            filter === "crypto"
              ? "bg-yellow-500/20 text-yellow-400"
              : "text-muted hover:text-yellow-400 hover:bg-yellow-500/10"
          }`}
        >
          Crypto 5min ({cryptoCount})
        </button>
      </div>

      {/* Summary Row */}
      <div className="flex gap-4">
        <div className="bg-card border border-card-border rounded-lg p-4 flex-1">
          <div className="text-xs text-muted uppercase">
            {filter === "crypto" ? "Crypto" : filter === "markets" ? "Market" : "Total"} Realized P&L
          </div>
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
          <div className="text-xs text-muted uppercase">
            {filter === "all" ? "Total" : filter === "crypto" ? "Crypto" : "Market"} Trades
          </div>
          <div className="text-2xl font-mono font-bold">{filteredTrades.length}</div>
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
        {filteredTrades.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted">
            {filter === "crypto" ? "No crypto trades yet. The crypto trader runs every 30 minutes." : "No trades recorded yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs uppercase tracking-wider">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Source</th>
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
                {filteredTrades.map((t) => (
                  <tr key={t.id} className="border-t border-card-border hover:bg-background/50">
                    <td className="px-4 py-3 text-muted font-mono text-xs">
                      {(t.createdAt || "").slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-4 py-3">{sourceBadge(t.source)}</td>
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
                        <span className="text-muted">{"\u2014"}</span>
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
