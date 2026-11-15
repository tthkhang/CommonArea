#!/bin/bash
# Top 1 Server - double-click to play on this Mac.
# With Node.js: real multiplayer server (admin password "admin" unless ADMIN_PASSWORD is set).
# Without Node.js: solo mode through Python (rules run in the browser, bots keep you company).
cd "$(dirname "$0")"
export PORT="${PORT:-5173}"
if command -v node >/dev/null 2>&1; then
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}" OPEN_BROWSER=1 node server.mjs
else
  echo "Node.js was not found: starting SOLO mode. Install Node.js 18+ (https://nodejs.org) for multiplayer."
  python3 serve.py --open
fi
