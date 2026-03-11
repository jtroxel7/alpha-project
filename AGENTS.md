# Alpha Project — Prediction Market Paper Trading System

## Overview
An AI-driven paper trading system for prediction markets (Polymarket + Kalshi).
The goal is to demonstrate positive alpha over a 1-2 week test period with $500 paper money,
then transition to real money trading.

## Core Strategy
- Scan prediction markets for mispriced contracts
- Estimate true probabilities using news, data, and reasoning
- Trade when estimated probability diverges from market price by >= 5%
- Size positions using quarter-Kelly criterion
- Track calibration (Brier score) and P&L rigorously

## Risk Parameters
- Starting bankroll: $500
- Max single position: 10% of bankroll ($50)
- Max total exposure: 70% of bankroll ($350)
- Min edge threshold: 3 percentage points (configurable)
- Position sizing: Half-Kelly, capped at 10% of bankroll
- Target trades per day: 3-5
- Reassessment trigger: Market moves 15pts against position

## Architecture

### Tech Stack
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Charts**: Recharts (P&L, calibration curves)
- **Database**: SQLite via better-sqlite3 (paper trading ledger)
- **API Sources**: Polymarket (primary), Kalshi (secondary)
- **No auth required**: Both APIs are public for read-only market data

### Project Structure
```
alpha-project/
├── AGENTS.md              # This file — project context (auto-loaded)
├── BUILD_STATUS.md        # Living build tracker with current status
├── src/
│   ├── api/               # API clients for Polymarket and Kalshi
│   │   ├── polymarket.ts  # Gamma + CLOB API client
│   │   └── kalshi.ts      # Kalshi REST API client
│   ├── engine/            # Core trading logic
│   │   ├── edge.ts        # Edge calculator + Kelly position sizer
│   │   ├── scanner.ts     # Market scanner and filtering
│   │   └── types.ts       # Shared TypeScript types
│   ├── ledger/            # Paper trading state
│   │   ├── db.ts          # SQLite setup and queries
│   │   └── schema.sql     # Database schema
│   └── dashboard/         # Next.js app (lives in project root)
│       └── (Next.js app router structure)
├── package.json
└── docs/                  # Research notes, API docs
```

### API Endpoints Used

**Polymarket (no auth for reads)**:
- `GET gamma-api.polymarket.com/events?active=true&closed=false` — discover markets
- `GET gamma-api.polymarket.com/markets` — market details with prices
- `GET clob.polymarket.com/price?token_id=X&side=BUY` — live prices
- `GET clob.polymarket.com/book?token_id=X` — order book depth
- `GET clob.polymarket.com/prices-history?market=X&interval=1d` — price history

**Kalshi (no auth for reads)**:
- `GET api.elections.kalshi.com/trade-api/v2/events?with_nested_markets=true` — events
- `GET api.elections.kalshi.com/trade-api/v2/markets?status=open` — markets
- `GET api.elections.kalshi.com/trade-api/v2/markets/{ticker}/orderbook` — order book

### Database Schema (SQLite)
Tables: markets, probability_estimates, trades, positions, portfolio_snapshots
See `src/ledger/schema.sql` for full schema.

### Dashboard Pages
1. **Portfolio Overview** — total value, P&L, open positions, quick stats
2. **Market Scanner** — filtered opportunity feed sorted by EV
3. **Trade History** — cumulative P&L chart, trade log, filters
4. **Calibration** — Brier score, reliability diagram, category radar

## How the AI Trading Loop Works
1. Scanner pulls active markets from Polymarket/Kalshi APIs
2. AI (Codex) analyzes each candidate: reads contract, searches for data, estimates probability
3. Edge calculator compares AI estimate to market price
4. If edge >= threshold, Kelly sizer determines position size
5. Trade is recorded in SQLite ledger with reasoning
6. Dashboard displays portfolio, P&L, and calibration metrics
7. On resolution, outcomes are recorded and Brier score updated

## Current Build Status
See BUILD_STATUS.md for detailed progress tracking.

## Key Decisions
- Using Polymarket as primary (more markets, more retail participants, more mispricing)
- Kalshi as secondary signal (cross-reference when both platforms have same market)
- Paper trading via local SQLite — no real accounts needed for testing phase
- 5% edge threshold chosen to ensure 3-5 trades/day minimum
- Next.js chosen for dashboard — SSR for fast loads, API routes for backend logic
