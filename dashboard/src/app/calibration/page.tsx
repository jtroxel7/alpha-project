"use client";

import { useEffect, useState } from "react";
import type { PortfolioSnapshot, CalibrationBucket } from "@/lib/engine/types";

export default function CalibrationPage() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [buckets, setBuckets] = useState<CalibrationBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/portfolio").then((r) => r.json()),
      fetch("/api/calibration").then((r) => r.json()).catch(() => ({ buckets: [] })),
    ]).then(([portfolio, cal]) => {
      setSnapshot(portfolio.snapshot);
      setBuckets(cal.buckets || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="text-muted text-center py-20">Loading calibration data...</div>;
  }

  const s = snapshot;
  const brierScore = s?.brierScore;
  const hasBuckets = buckets.length > 0;

  return (
    <div className="space-y-6">
      {/* Brier Score Card */}
      <div className="bg-card border border-card-border rounded-lg p-6">
        <div className="text-muted text-sm mb-2">Overall Brier Score</div>
        <div className="flex items-baseline gap-4">
          <span className="text-4xl font-mono font-bold">
            {brierScore !== null && brierScore !== undefined ? brierScore.toFixed(3) : "—"}
          </span>
          <span className="text-sm text-muted">
            {brierScore === null || brierScore === undefined
              ? "No resolved trades yet"
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
          Lower is better. 0.0 = perfect prediction. 0.25 = random coin flip guessing.
          Superforecasters typically score 0.1–0.2.
        </div>
      </div>

      {/* Calibration Chart */}
      <div className="bg-card border border-card-border rounded-lg p-6">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
          Reliability Diagram
        </div>
        {!hasBuckets ? (
          <div className="text-muted text-center py-12">
            Need resolved trades to display calibration. Start trading and wait for markets to resolve.
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
          <div className="text-xs text-muted uppercase">Resolved</div>
          <div className="text-xl font-mono font-bold">{(s?.wins || 0) + (s?.losses || 0)}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted uppercase">Win Rate</div>
          <div className="text-xl font-mono font-bold">
            {s && s.wins + s.losses > 0 ? `${(s.winRate * 100).toFixed(0)}%` : "—"}
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted uppercase">Avg Edge</div>
          <div className="text-xl font-mono font-bold">—</div>
        </div>
      </div>
    </div>
  );
}
