#!/bin/bash
# Start backend and frontend together
# Press Ctrl+C to stop both

cleanup() {
    echo "Stopping..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup INT TERM

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting backend..."
cd "$ROOT/backend"
"$ROOT/venv/bin/python3" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

echo "Starting frontend..."
cd "$ROOT/frontend"
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID  (logs: /tmp/backend.log)"
echo "Frontend PID: $FRONTEND_PID  (logs: /tmp/frontend.log)"
echo "Open http://localhost:5173"
echo "Press Ctrl+C to stop."

wait
