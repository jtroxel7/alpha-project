#!/bin/bash
# Daily trading session for Alpha Project
# Usage: npm run trade (or ./scripts/trade.sh)
#
# This launches Claude Code with a trading prompt that:
# 1. Starts the dev server
# 2. Checks current portfolio & open positions
# 3. Checks for market resolutions
# 4. Scans for new opportunities
# 5. Researches candidates via web search
# 6. Places trades with documented reasoning
# 7. Updates BUILD_STATUS.md

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PROMPT_FILE="$SCRIPT_DIR/daily-trade.md"

echo "=========================================="
echo "  Alpha Project — Daily Trading Session"
echo "  $(date '+%Y-%m-%d %H:%M')"
echo "=========================================="
echo ""

# Check if claude CLI is available
if ! command -v claude &> /dev/null; then
    echo "Error: 'claude' CLI not found. Install Claude Code first."
    exit 1
fi

# Read the prompt file
PROMPT=$(cat "$PROMPT_FILE")

# Run Claude Code non-interactively with pre-approved tools
# Each --allowedTools entry is a separate quoted string
cd "$PROJECT_DIR"
claude -p "$PROMPT" \
  --allowedTools \
    "Bash(npm run dev *)" \
    "Bash(curl *)" \
    "Bash(node *)" \
    "Bash(python3 *)" \
    "Bash(kill *)" \
    "Bash(cd *)" \
    "Bash(sleep *)" \
    "WebSearch" \
    "WebFetch" \
    "Read" \
    "Edit" \
    "Write"

echo ""
echo "=========================================="
echo "  Trading session complete"
echo "=========================================="
