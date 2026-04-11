#!/bin/bash
# DSM Project — Local Development Launcher
# Starts both FastAPI backend and Next.js frontend

echo "=========================================="
echo "  DSM Project — WACMR Analytics Platform"
echo "=========================================="

# Check for .env file
if [ ! -f backend/.env ]; then
    echo "Creating backend/.env (add GROQ_API_KEY for AI agent)"
    echo "GROQ_API_KEY=" > backend/.env
fi

# Start backend
echo ""
echo "[1/2] Starting FastAPI backend on http://localhost:8000 ..."
cd "$(dirname "$0")"
PYTHONPATH=. uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
echo "[2/2] Starting Next.js frontend on http://localhost:3000 ..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000  (API docs: http://localhost:8000/docs)"
echo "  Frontend: http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

# Trap Ctrl+C to kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
