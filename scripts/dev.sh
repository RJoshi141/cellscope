#!/usr/bin/env bash
# Starts the Flask API, seeds two packs on first run, then starts the React dashboard.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="http://localhost:5001/api"

cd "$ROOT/backend"
uv sync --quiet
uv run flask --app cellscope:create_app run --port 5001 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT  # stop the API when I ctrl-c

# wait for the API instead of a blind sleep
for _ in {1..20}; do curl -sf "$API/batteries" >/dev/null && break; sleep 0.5; done

if [ "$(curl -s "$API/batteries")" = "[]" ]; then
  echo "Seeding demo packs..."
  for i in 1 2 3; do
    curl -s -X POST "$API/batteries" -H 'Content-Type: application/json' \
      -d "{\"serial\":\"SN-00$i\",\"name\":\"Pack $i\",\"design_capacity_mah\":5000}" >/dev/null
  done
fi

cd "$ROOT/frontend"
[ -d node_modules ] || npm install
npm run dev
