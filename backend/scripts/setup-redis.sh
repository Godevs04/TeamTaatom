#!/bin/bash

# Redis Setup Script for Local Development
# This script helps set up Redis locally

echo "🔴 Redis Setup for Local Development"
echo "===================================="
echo ""

# Check if Redis is installed
if command -v redis-server &> /dev/null; then
    echo "✅ Redis is already installed"
    redis-server --version
else
    echo "❌ Redis is not installed"
    echo ""
    echo "Please install Redis:"
    echo ""
    echo "macOS (using Homebrew):"
    echo "  brew install redis"
    echo ""
    echo "Ubuntu/Debian:"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install redis-server"
    echo ""
    echo "Or use Docker:"
    echo "  docker run -d -p 6379:6379 --name redis redis"
    echo ""
    exit 1
fi

echo ""
echo "Starting Redis server..."
echo ""

# Check if Redis is already running
if redis-cli ping &> /dev/null; then
    echo "✅ Redis is already running"
else
    echo "Starting Redis server..."
    # Try to start Redis in background
    redis-server --daemonize yes 2>/dev/null || {
        echo "⚠️  Could not start Redis automatically"
        echo "Please start Redis manually:"
        echo "  redis-server"
        echo ""
        echo "Or if using Homebrew on macOS:"
        echo "  brew services start redis"
    }
fi

echo ""
echo "Testing Redis connection..."
if redis-cli ping | grep -q PONG; then
    echo "✅ Redis is running and responding"
    echo ""
    echo "Redis Configuration:"
    echo "  Host: localhost"
    echo "  Port: 6379"
    echo ""
    echo "You can test Redis with:"
    echo "  redis-cli ping"
    echo "  redis-cli set test 'hello'"
    echo "  redis-cli get test"
else
    echo "❌ Redis is not responding"
    echo "Please start Redis manually"
fi

