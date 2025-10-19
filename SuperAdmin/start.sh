#!/bin/bash

# TeamTaatom SuperAdmin Startup Script

echo "🚀 Starting TeamTaatom SuperAdmin Dashboard..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating environment file..."
    echo "VITE_API_URL=http://localhost:3000" > .env
    echo "VITE_APP_NAME=TeamTaatom SuperAdmin" >> .env
    echo "VITE_APP_VERSION=1.0.0" >> .env
    echo "✅ Environment file created. Please edit .env if needed."
    echo ""
fi

echo "🔧 Starting development server..."
echo "📱 Dashboard will be available at: http://localhost:5001"
echo "🔗 Backend should be running at: http://localhost:3000"
echo "📱 Main frontend runs at: http://localhost:8081"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
