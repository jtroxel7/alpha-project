#!/usr/bin/env node
/**
 * Migration: Add 'crypto_sim' to the source CHECK constraint on trades and probability_estimates tables.
 * SQLite doesn't support ALTER TABLE ... ALTER COLUMN, so we recreate the tables with the new constraint.
 */

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "paper-trading.db");

console.log("Opening database:", DB_PATH);
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF"); // Temporarily disable for migration

const migration = db.transaction(() => {
  // 1. Migrate trades table
  console.log("Migrating trades table...");

  db.exec(`
    CREATE TABLE IF NOT EXISTS trades_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('polymarket', 'kalshi', 'crypto_sim')),
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
  `);

  // Copy existing data
  const tradeCount = db.prepare("SELECT COUNT(*) as c FROM trades").get();
  console.log(`  Found ${tradeCount.c} existing trades`);

  db.exec(`
    INSERT INTO trades_new SELECT * FROM trades;
  `);

  db.exec(`DROP TABLE trades;`);
  db.exec(`ALTER TABLE trades_new RENAME TO trades;`);

  // Recreate indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_market_id ON trades(market_id);
    CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
  `);

  // 2. Migrate probability_estimates table
  console.log("Migrating probability_estimates table...");

  db.exec(`
    CREATE TABLE IF NOT EXISTS probability_estimates_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('polymarket', 'kalshi', 'crypto_sim')),
      question TEXT NOT NULL,
      estimated_probability REAL NOT NULL,
      market_price REAL NOT NULL,
      edge REAL NOT NULL,
      abs_edge REAL NOT NULL,
      reasoning TEXT NOT NULL,
      confidence TEXT NOT NULL CHECK(confidence IN ('low', 'medium', 'high')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const estCount = db.prepare("SELECT COUNT(*) as c FROM probability_estimates").get();
  console.log(`  Found ${estCount.c} existing estimates`);

  db.exec(`
    INSERT INTO probability_estimates_new SELECT * FROM probability_estimates;
  `);

  db.exec(`DROP TABLE probability_estimates;`);
  db.exec(`ALTER TABLE probability_estimates_new RENAME TO probability_estimates;`);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_estimates_market_id ON probability_estimates(market_id);
    CREATE INDEX IF NOT EXISTS idx_estimates_abs_edge ON probability_estimates(abs_edge);
  `);

  console.log("Migration complete!");
});

try {
  migration();
  console.log("Successfully migrated database to support crypto_sim source.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  db.pragma("foreign_keys = ON");
  db.close();
}
