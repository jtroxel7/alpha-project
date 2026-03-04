# Build Status — Alpha Project

> **Last updated**: 2026-03-03
> **Current phase**: Dashboard Integration
> **Next session should start here**: Phase 5 integration — wire trade entry to scanner, then begin paper trading

## Build Phases

### Phase 1: Foundation (DONE)
- [x] Project directory structure created
- [x] CLAUDE.md created with full project context
- [x] BUILD_STATUS.md created (this file)
- [x] Initialize Next.js project with TypeScript + Tailwind
- [x] Install dependencies (better-sqlite3, recharts, date-fns)
- [x] Create SQLite schema (`src/ledger/schema.sql`)
- [x] Create database setup (`src/ledger/db.ts`) — full CRUD for trades, estimates, portfolio

### Phase 2: API Clients (DONE)
- [x] Polymarket API client (`src/lib/api/polymarket.ts`)
  - [x] Fetch active events/markets from Gamma API
  - [x] Fetch live prices from CLOB API
  - [x] Fetch order book depth
  - [x] Fetch price history
  - [x] Category extraction from event tags
- [x] Kalshi API client (`src/lib/api/kalshi.ts`)
  - [x] Fetch active events/markets
  - [x] Fetch order books
- [x] Shared types (`src/lib/engine/types.ts`)

### Phase 3: Trading Engine (DONE)
- [x] Edge calculator (`src/lib/engine/edge.ts`)
  - [x] Compare estimated probability to market price
  - [x] Calculate expected value
  - [x] Quarter-Kelly position sizing
  - [x] Risk limit checks (max position, max exposure)
  - [x] Trade signal generation and ranking
- [x] Market scanner (`src/lib/engine/scanner.ts`)
  - [x] Filter by liquidity, time horizon, category
  - [x] Rank opportunities by analysis score
  - [x] Get top-N candidates for AI analysis

### Phase 4: Dashboard (DONE)
- [x] Layout shell with client-side Nav component + active tab highlighting
- [x] Portfolio Overview page (`/`)
  - [x] Portfolio value + P&L hero display
  - [x] Open positions table
  - [x] Quick stats cards (Brier score, win rate, cash balance, open positions)
- [x] Market Scanner page (`/scanner`)
  - [x] Live data from Polymarket API (250+ markets)
  - [x] Filter controls (source, category, time horizon, sort)
  - [x] Color-coded prices (red/yellow/green by probability)
  - [x] Filters out near-resolved markets (>98% or <2%)
- [x] Trade History page (`/history`)
  - [x] Summary stats (P&L, record, total trades)
  - [x] Cumulative P&L bar chart
  - [x] Trade log table with status badges
- [x] Calibration page (`/calibration`)
  - [x] Brier score display with interpretation
  - [x] Reliability diagram (calibration chart)
  - [x] Stats grid (total trades, resolved, win rate)
- [x] API routes: `/api/portfolio`, `/api/trades`, `/api/markets`, `/api/calibration`

### Phase 5: Integration & Polish (IN PROGRESS)
- [x] Wire scanner → dashboard display (live Polymarket data flowing)
- [x] Wire ledger → portfolio display
- [ ] Add trade entry capability from scanner (record paper trades)
- [ ] Wire resolutions → calibration metrics
- [ ] API route for AI to submit trades programmatically
- [ ] Responsive design pass

### Phase 6: Live Paper Trading (NOT STARTED)
- [ ] AI begins daily market analysis
- [ ] Record trades with reasoning
- [ ] Track calibration daily
- [ ] Review and adjust strategy after 3 days
- [ ] Full week review

## Architecture Notes
- All market data APIs are public (no auth needed for reads)
- Paper trades are recorded in local SQLite (`dashboard/data/paper-trading.db`)
- The AI (Claude) performs analysis and proposes trades
- Dashboard is the human-facing view of the AI's trading activity
- Polymarket Gamma API returns events with `tags[]` array (not `category` field)
- Category mapping done via slug lookup table in polymarket.ts
- When ready for real trading, we add Polymarket wallet integration

## File Map
```
dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with Nav component
│   │   ├── globals.css             # Dark theme CSS variables
│   │   ├── page.tsx                # Portfolio overview (home)
│   │   ├── components/Nav.tsx      # Client-side nav with active highlighting
│   │   ├── scanner/page.tsx        # Market scanner with live data
│   │   ├── history/page.tsx        # Trade history + P&L chart
│   │   ├── calibration/page.tsx    # Brier score + reliability diagram
│   │   └── api/
│   │       ├── portfolio/route.ts  # GET portfolio snapshot + open trades
│   │       ├── trades/route.ts     # GET/POST trades (open + close)
│   │       ├── markets/route.ts    # GET live markets from Polymarket/Kalshi
│   │       └── calibration/route.ts # GET calibration buckets
│   └── lib/
│       ├── api/
│       │   ├── polymarket.ts       # Polymarket Gamma + CLOB API client
│       │   └── kalshi.ts           # Kalshi REST API client
│       ├── engine/
│       │   ├── types.ts            # All TypeScript types + config
│       │   ├── edge.ts             # Edge calc, Kelly sizing, signal gen
│       │   └── scanner.ts          # Market filtering + ranking
│       └── ledger/
│           ├── schema.sql          # SQLite schema
│           └── db.ts               # Database operations (CRUD)
├── data/                           # SQLite DB lives here (gitignored)
└── package.json
```

## Known Issues / Blockers
(none currently)
