#!/bin/bash

echo "🏗️  Setting up Scoreboard Layout Builder..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
    echo ""
    
    echo "🚀 Starting development server..."
    echo ""
    echo "The layout builder will open at: http://localhost:3000"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    
    # Start the development server
    npm run dev
else
    echo "❌ Failed to install dependencies"
    echo "Please check your internet connection and try again."
    exit 1
fi