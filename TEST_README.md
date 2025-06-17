# Testing the Edge TTS API

This directory contains a comprehensive test script for the Edge TTS Vercel API endpoints.

## Test Script Features

The `test.js` script tests both API endpoints:

### `/api/voices` endpoint (GET)
- Tests the voice list retrieval
- Validates response structure and required fields
- Counts available voices and locales

### `/api/tts` endpoint (POST)
- Tests basic TTS generation
- Tests with custom voice parameters (rate, volume, pitch)
- Tests with long text
- Tests with special characters
- Validates MP3 audio output
- Saves generated audio files for manual verification

### Error Handling Tests
- Missing required text parameter
- Text too long (>8000 characters)
- Wrong HTTP methods
- Invalid requests

## Running the Tests

### Prerequisites
- Node.js 18+ (required for the API)
- Your API server running locally or deployed

### Local Testing
```bash
# Start your development server first
npm run dev

# In another terminal, run tests
npm run test
# or
node test.js
```

### Testing Deployed App
```bash
# Test against your deployed Vercel app
npm run test:prod
# or
node test.js --url https://your-app.vercel.app
```

### Custom URL Testing
```bash
node test.js --url https://your-custom-domain.com
```

## Test Output

The script will:
1. Display real-time test progress with timestamps
2. Show detailed results for each test
3. Save generated MP3 files to `./test-output/` directory
4. Provide a comprehensive summary at the end

### Sample Output
```
📄 [2025-06-17T10:30:00.000Z] 🚀 Starting Edge TTS API Tests
📄 [2025-06-17T10:30:00.000Z] Testing against: http://localhost:3000
📄 [2025-06-17T10:30:00.000Z] Running test: GET /api/voices
✅ [2025-06-17T10:30:01.000Z] Test passed: GET /api/voices
📄 [2025-06-17T10:30:01.000Z] Running test: POST /api/tts - basic
✅ [2025-06-17T10:30:03.000Z] Test passed: POST /api/tts - basic
...
📊 Test Summary

Total Tests: 8
✅ Passed: 8
❌ Failed: 0

🎵 Audio files saved to: ./test-output/
```

## Generated Files

The test script creates audio files in the `test-output/` directory:
- `basic.mp3` - Basic TTS test
- `withoptions.mp3` - TTS with custom parameters
- `longtext.mp3` - Long text test
- `specialcharacters.mp3` - Special characters test

You can play these files to manually verify the audio output quality.

## Test Cases

1. **Basic Test**: Simple text with default voice
2. **With Options**: Custom rate, volume, and pitch parameters
3. **Long Text**: Tests with repeated text to check longer content
4. **Special Characters**: Tests XML escaping and character handling
5. **Error Cases**: Invalid requests to test error handling

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

## Customization

You can modify the test cases in `test.js` by editing the `TEST_CASES` object:

```javascript
const TEST_CASES = {
  yourTest: {
    text: 'Your test text here',
    voice: 'en-US-YourPreferredVoice',
    rate: '+10%',
    volume: '+5%',
    pitch: '+2Hz'
  }
};
```

## Troubleshooting

### Common Issues

1. **Connection refused**: Make sure your server is running on the correct port
2. **Module not found**: Ensure you're using Node.js 18+ with ES modules support
3. **Permission denied**: Make sure the script has execute permissions
4. **Audio validation fails**: Check if the generated audio files are valid MP3s

### Debug Mode

For more detailed output, you can modify the `log` function in the test script to include debug information.
