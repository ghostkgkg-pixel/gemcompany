@echo off
title Gem-Company-Integrated-Server
echo ==========================================
echo    GEM COMPANY INTEGRATED LAUNCHER
echo ==========================================
echo.
echo [1/2] Starting Backend in background...
start /b python backend/main.py

echo [2/2] Starting Frontend...
echo.
cd frontend
npm run dev