#!/bin/bash
# Start backend server

cd backend
python -m venv venv

# On Windows: venv\Scripts\activate
# On macOS/Linux: source venv/bin/activate

pip install -r requirements.txt
python main.py
