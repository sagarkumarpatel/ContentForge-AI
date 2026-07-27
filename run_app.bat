@echo off
echo Starting FastAPI Backend...
start cmd /k "venv\Scripts\activate && uvicorn api:app --reload"

echo Starting Next.js Frontend...
start cmd /k "cd frontend && npm run dev"

echo ========================================================
echo Both servers are starting in separate command windows!
echo.
echo Backend API is running on http://localhost:8000
echo Frontend UI is running on http://localhost:3000
echo ========================================================
