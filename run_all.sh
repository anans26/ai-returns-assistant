#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Activate venv — Scripts/ on Windows (Git Bash), bin/ on Linux/macOS
if [ -f "$ROOT/.venv/Scripts/activate" ]; then
  source "$ROOT/.venv/Scripts/activate"
elif [ -f "$ROOT/.venv/bin/activate" ]; then
  source "$ROOT/.venv/bin/activate"
fi

echo "============================================"
echo " Returns Agent -- Starting Servers"
echo "============================================"
echo ""
echo "  Backend  >  http://localhost:8000"
echo "  Frontend >  http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Start backend
cd "$ROOT/backend"
uvicorn api:app --reload --port 8000 &
BACKEND_PID=$!

# Let the backend bind before the frontend starts
sleep 2

# Start frontend
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

# Kill both on Ctrl+C or script exit
trap 'echo ""; echo "Stopping servers..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; wait; echo "Done."' INT TERM

wait
