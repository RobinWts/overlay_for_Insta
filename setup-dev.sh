#!/bin/bash

# Development environment setup script for overlay-image server
# This script sets up the development environment for both Mac and server deployment

set -e

echo "🚀 Setting up overlay-image development environment..."

# Check if nvm is installed
if ! command -v nvm &> /dev/null; then
    echo "❌ nvm is not installed. Please install it first:"
    echo "   brew install nvm"
    echo "   Then restart your terminal and run this script again."
    exit 1
fi

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"

# Use the Node.js version specified in .nvmrc
echo "📦 Installing Node.js version from .nvmrc..."
nvm use

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Verify Sharp installation
echo "🔍 Verifying Sharp installation..."
node -e "const sharp = require('sharp'); console.log('✅ Sharp version:', sharp.versions);"

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "Available commands:"
echo "  npm run dev     - Start development server with auto-reload"
echo "  npm start       - Start production server"
echo "  npm test        - Run server tests"
echo "  npm run docker:build - Build Docker image"
echo "  npm run docker:run   - Run Docker container"
echo ""
echo "To start development:"
echo "  npm run dev"
echo ""
echo "To test the server (in another terminal):"
echo "  npm test"
