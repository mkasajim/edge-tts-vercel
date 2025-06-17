#!/bin/bash

# Edge TTS API Test Runner
# Simple wrapper script for the Node.js test suite

set -e

echo "🧪 Edge TTS API Test Runner"
echo "=========================="

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required (found: $(node --version))"
    exit 1
fi

# Default values
URL="https://edge-tts-three.vercel.app"
HELP=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            URL="$2"
            shift 2
            ;;
        --help|-h)
            HELP=true
            shift
            ;;
        *)
            echo "❌ Unknown argument: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Show help
if [ "$HELP" = true ]; then
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --url <url>     Base URL for the API (default: http://localhost:3000)"
    echo "  --help, -h      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                          # Test local development server"
    echo "  $0 --url https://your-app.vercel.app       # Test deployed app"
    echo ""
    echo "The script will test both /api/voices and /api/tts endpoints"
    echo "Generated audio files will be saved to ./test-output/"
    exit 0
fi

echo "🎯 Target URL: $URL"
echo ""

# Check if test output directory exists
if [ ! -d "test-output" ]; then
    echo "📁 Creating test-output directory..."
    mkdir -p test-output
fi

# Run the test
echo "🚀 Starting tests..."
echo ""

node test.js --url "$URL"
