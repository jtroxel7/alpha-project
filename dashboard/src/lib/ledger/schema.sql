-- Paper Trading Ledger Schema

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('polymarket', 'kalshi')),
  question TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('YES', 'NO')),
  entry_price REAL NOT NULL,
  quantity REAL NOT NULL,
  position_size REAL NOT NULL,
  estimated_probability REAL NOT NULL,
  market_price_at_entry REAL NOT NULL,
  edge REAL NOT NULL,
  reasoning TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed_win', 'closed_loss', 'closed_exit')),
  exit_price REAL,
  realized_pnl REAL,
  resolved_outcome TEXT CHECK(resolved_outcome IN ('YES', 'NO')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS probability_estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('polymarket', 'kalshi')),
  question TEXT NOT NULL,
  estimated_probability REAL NOT NULL,
  market_price REAL NOT NULL,
  edge REAL NOT NULL,
  abs_edge REAL NOT NULL,
  reasoning TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK(confidence IN ('low', 'medium', 'high')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total_value REAL NOT NULL,
  cash_balance REAL NOT NULL,
  invested_amount REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  realized_pnl REAL NOT NULL,
  open_positions INTEGER NOT NULL,
  total_trades INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  brier_score REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_market_id ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
CREATE INDEX IF NOT EXISTS idx_estimates_market_id ON probability_estimates(market_id);
CREATE INDEX IF NOT EXISTS idx_estimates_abs_edge ON probability_estimates(abs_edge);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON portfolio_snapshots(created_at);
