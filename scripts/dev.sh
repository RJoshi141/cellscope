#!/usr/bin/env bash
# Starts the Flask API (seeds 4 demo packs on first run) and the React dashboard.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT/backend"
uv sync --quiet
uv run flask --app cellscope:create_app run --port 5001 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT  # stop the API when I ctrl-c

# wait for the API instead of a blind sleep
for _ in {1..20}; do curl -sf localhost:5001/api/health >/dev/null && break; sleep 0.5; done
if ! curl -sf localhost:5001/api/health >/dev/null; then
  echo "API failed to start (see the error above). Stale local DB? Run: rm backend/cellscope.db" >&2
  exit 1
fi

cd "$ROOT/frontend"
[ -d node_modules ] || npm install
npm run dev  # Vite proxies /api to :5001
