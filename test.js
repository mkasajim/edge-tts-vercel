#!/usr/bin/env node

/**
 * Test script for Edge TTS Vercel API
 * Tests both /api/tts and /api/voices endpoints
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Configuration
const BASE_URL = process.env.BASE_URL || 'https://edge-tts-three.vercel.app/api';
const TEST_OUTPUT_DIR = './test-output';

// Test data
const TEST_CASES = {
  basic: {
    text: 'Hello, this is a test of the text-to-speech API.',
    voice: 'en-US-EmmaMultilingualNeural'
  },
  withOptions: {
    text: 'This test includes custom voice parameters.',
    voice: 'en-US-JennyNeural',
    rate: '+20%',
    volume: '+10%',
    pitch: '+5Hz'
  },
  longText: {
    text: 'This is a longer text to test the API with more content. '.repeat(20),
    voice: 'en-US-AriaNeural'
  },
  specialCharacters: {
    text: 'Testing special characters: Hello! How are you? I\'m fine. "Great!" & <amazing>.',
    voice: 'en-US-GuyNeural'
  }
};

// Test utilities
class TestRunner {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    
    // Ensure output directory exists
    if (!existsSync(TEST_OUTPUT_DIR)) {
      mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📄',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(url, options);
      return {
        ok: response.ok,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: response.ok ? await response.arrayBuffer() : await response.text()
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error.message
      };
    }
  }

  async runTest(name, testFn) {
    this.log(`Running test: ${name}`);
    try {
      const result = await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED', ...result });
      this.log(`Test passed: ${name}`, 'success');
      return result;
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: error.message });
      this.log(`Test failed: ${name} - ${error.message}`, 'error');
      throw error;
    }
  }

  async testVoicesEndpoint() {
    return await this.runTest('GET /api/voices', async () => {
      const response = await this.makeRequest(`${this.baseUrl}/api/voices`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.data}`);
      }
      
      const voices = JSON.parse(new TextDecoder().decode(response.data));
      
      // Validate response structure
      if (!Array.isArray(voices)) {
        throw new Error('Response is not an array');
      }
      
      if (voices.length === 0) {
        throw new Error('No voices returned');
      }
      
      // Check first voice has required fields
      const firstVoice = voices[0];
      const requiredFields = ['Name', 'DisplayName', 'LocaleName', 'Locale'];
      const missingFields = requiredFields.filter(field => !firstVoice[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      return {
        voiceCount: voices.length,
        sampleVoice: firstVoice.Name,
        locales: [...new Set(voices.map(v => v.Locale))].length
      };
    });
  }

  async testTTSEndpoint(testCase, caseName) {
    return await this.runTest(`POST /api/tts - ${caseName}`, async () => {
      const response = await this.makeRequest(`${this.baseUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase)
      });
      
      if (!response.ok) {
        const errorText = new TextDecoder().decode(response.data);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      // Validate response headers
      if (response.headers['content-type'] !== 'audio/mpeg') {
        throw new Error(`Expected audio/mpeg, got ${response.headers['content-type']}`);
      }
      
      const audioData = new Uint8Array(response.data);
      
      // Basic validation of MP3 data (should start with ID3 tag or frame sync)
      if (audioData.length < 10) {
        throw new Error('Audio data too short');
      }
      
      // Check for ID3 tag or MP3 frame sync
      const hasId3 = audioData[0] === 0x49 && audioData[1] === 0x44 && audioData[2] === 0x33;
      const hasFrameSync = audioData[0] === 0xFF && (audioData[1] & 0xE0) === 0xE0;
      
      if (!hasId3 && !hasFrameSync) {
        // Look for frame sync in first few bytes (sometimes ID3 is not present)
        let foundFrameSync = false;
        for (let i = 0; i < Math.min(100, audioData.length - 1); i++) {
          if (audioData[i] === 0xFF && (audioData[i + 1] & 0xE0) === 0xE0) {
            foundFrameSync = true;
            break;
          }
        }
        if (!foundFrameSync) {
          throw new Error('Invalid MP3 data - no valid frame sync found');
        }
      }
      
      // Save audio file for manual verification
      const filename = `${caseName.replace(/\s+/g, '_').toLowerCase()}.mp3`;
      const filepath = join(TEST_OUTPUT_DIR, filename);
      writeFileSync(filepath, audioData);
      
      return {
        audioSize: audioData.length,
        savedAs: filepath,
        voice: testCase.voice
      };
    });
  }

  async testErrorCases() {
    // Test missing text
    await this.runTest('POST /api/tts - missing text', async () => {
      const response = await this.makeRequest(`${this.baseUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ voice: 'en-US-EmmaMultilingualNeural' })
      });
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      
      const error = JSON.parse(new TextDecoder().decode(response.data));
      if (!error.error || !error.error.includes('required')) {
        throw new Error('Expected error message about required text');
      }
      
      return { expectedError: true };
    });

    // Test text too long
    await this.runTest('POST /api/tts - text too long', async () => {
      const longText = 'a'.repeat(8001);
      const response = await this.makeRequest(`${this.baseUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: longText })
      });
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      
      const error = JSON.parse(new TextDecoder().decode(response.data));
      if (!error.error || !error.error.includes('too long')) {
        throw new Error('Expected error message about text being too long');
      }
      
      return { expectedError: true };
    });

    // Test wrong HTTP method
    await this.runTest('GET /api/tts - wrong method', async () => {
      const response = await this.makeRequest(`${this.baseUrl}/api/tts`);
      
      if (response.status !== 405) {
        throw new Error(`Expected 405, got ${response.status}`);
      }
      
      return { expectedError: true };
    });
  }

  async runAllTests() {
    this.log('🚀 Starting Edge TTS API Tests');
    this.log(`Testing against: ${this.baseUrl}`);
    
    try {
      // Test voices endpoint
      await this.testVoicesEndpoint();
      
      // Test TTS endpoint with different cases
      for (const [caseName, testCase] of Object.entries(TEST_CASES)) {
        await this.testTTSEndpoint(testCase, caseName);
      }
      
      // Test error cases
      await this.testErrorCases();
      
    } catch (error) {
      // Individual test failures are already logged
    }
    
    this.printSummary();
  }

  printSummary() {
    this.log('📊 Test Summary', 'info');
    console.log(`\nTotal Tests: ${this.results.passed + this.results.failed}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(t => t.status === 'FAILED')
        .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    }
    
    if (this.results.passed > 0) {
      console.log('\n✅ Passed Tests:');
      this.results.tests
        .filter(t => t.status === 'PASSED')
        .forEach(t => {
          console.log(`  - ${t.name}`);
          if (t.voiceCount) console.log(`    Voices: ${t.voiceCount}, Locales: ${t.locales}`);
          if (t.audioSize) console.log(`    Audio: ${t.audioSize} bytes, Voice: ${t.voice}`);
          if (t.savedAs) console.log(`    Saved: ${t.savedAs}`);
        });
    }
    
    console.log(`\n🎵 Audio files saved to: ${TEST_OUTPUT_DIR}/`);
    
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Command line argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = 'http://localhost:3000';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && i + 1 < args.length) {
      baseUrl = args[i + 1];
      i++; // Skip next argument as it's the URL value
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node test.js [options]

Options:
  --url <url>     Base URL for the API (default: http://localhost:3000)
  --help, -h      Show this help message

Examples:
  node test.js                                    # Test local development server
  node test.js --url https://your-app.vercel.app # Test deployed app
      `);
      process.exit(0);
    }
  }
  
  return { baseUrl };
}

// Main execution
async function main() {
  const { baseUrl } = parseArgs();
  const runner = new TestRunner(baseUrl);
  await runner.runAllTests();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { TestRunner };
