#!/bin/bash
echo "Starting EcoGuard AI Server..."
echo "Open http://localhost:8000 in your browser once started."
python3 -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
