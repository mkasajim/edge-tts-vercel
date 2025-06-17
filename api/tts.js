// Vercel API Route for Edge TTS
// File: api/tts.js

import { WebSocket } from 'ws';

// Constants from edge-tts
const BASE_URL = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud';
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const CHROMIUM_FULL_VERSION = '130.0.2849.68';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const DEFAULT_VOICE = 'en-US-EmmaMultilingualNeural';

// Headers for WebSocket connection
const WSS_HEADERS = {
  'Pragma': 'no-cache',
  'Cache-Control': 'no-cache',
  'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9'
};

function generateConnectId() {
  return crypto.randomUUID().replace(/-/g, '');
}

function dateToString() {
  return new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
}

function removeIncompatibleCharacters(text) {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function createSSML(text, voice = DEFAULT_VOICE, rate = '+0%', volume = '+0%', pitch = '+0Hz') {
  const escapedText = escapeXml(removeIncompatibleCharacters(text));
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${escapedText}</prosody></voice></speak>`;
}

function generateSecMsGec() {
  const timestamp = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const data = encoder.encode(`${timestamp}`);
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < data.length; i += 3) {
    const a = data[i];
    const b = data[i + 1] || 0;
    const c = data[i + 2] || 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += chars.charAt((bitmap >> 6) & 63);
    result += chars.charAt(bitmap & 63);
  }
  
  const padding = data.length % 3;
  if (padding === 1) {
    result = result.slice(0, -2) + '==';
  } else if (padding === 2) {
    result = result.slice(0, -1) + '=';
  }
  
  return result;
}

function createSSMLRequest(requestId, ssml) {
  const timestamp = dateToString();
  return `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}Z\r\nPath:ssml\r\n\r\n${ssml}`;
}

function createConfigRequest() {
  const timestamp = dateToString();
  return `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`;
}

function parseMessage(data) {
  const headerEnd = data.indexOf('\r\n\r\n');
  if (headerEnd === -1) return { headers: {}, data: data };
  
  const headerStr = data.slice(0, headerEnd);
  const messageData = data.slice(headerEnd + 4);
  
  const headers = {};
  headerStr.split('\r\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      headers[line.slice(0, colonIndex)] = line.slice(colonIndex + 1);
    }
  });
  
  return { headers, data: messageData };
}

async function handleTTSWebSocket(text, voice, rate, volume, pitch) {
  return new Promise((resolve, reject) => {
    const audioChunks = [];
    const requestId = generateConnectId();
    const connectionId = generateConnectId();
    const secMsGec = generateSecMsGec();
    
    const wsUrl = `${WSS_URL}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectionId}`;
    
    const ws = new WebSocket(wsUrl, { headers: WSS_HEADERS });
    
    ws.on('open', () => {
      // Send configuration request
      ws.send(createConfigRequest());
      
      // Send SSML request
      const ssml = createSSML(text, voice, rate, volume, pitch);
      ws.send(createSSMLRequest(requestId, ssml));
    });
    
    ws.on('message', (data) => {
      if (typeof data === 'string') {
        // Text message - contains metadata
        const { headers } = parseMessage(data);
        
        if (headers.Path === 'turn.end') {
          // End of turn - close connection
          ws.close();
          return;
        }
      } else {
        // Binary message - contains audio data
        // Ensure data is properly converted to Buffer
        let buffer;
        if (Buffer.isBuffer(data)) {
          buffer = data;
        } else if (data instanceof ArrayBuffer) {
          buffer = Buffer.from(data);
        } else if (data.buffer instanceof ArrayBuffer) {
          buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        } else {
          buffer = Buffer.from(data);
        }
        
        if (buffer.length < 2) return;
        
        // First 2 bytes contain header length (big endian)
        const headerLength = buffer.readUInt16BE(0);
        
        if (headerLength + 2 >= buffer.length) return;
        
        // Parse headers
        const headerBuffer = buffer.slice(2, headerLength + 2);
        const headerText = headerBuffer.toString('utf-8');
        const audioData = buffer.slice(headerLength + 2);
        
        const { headers } = parseMessage(headerText);
        
        if (headers.Path === 'audio' && headers['Content-Type'] === 'audio/mpeg') {
          // Ensure audioData is a proper Buffer before pushing
          audioChunks.push(Buffer.from(audioData));
        }
      }
    });
    
    ws.on('close', () => {
      if (audioChunks.length > 0) {
        try {
          // Ensure all chunks are proper Buffers before concatenating
          const validChunks = audioChunks.filter(chunk => 
            Buffer.isBuffer(chunk) || chunk instanceof Uint8Array || chunk instanceof ArrayBuffer
          ).map(chunk => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          
          if (validChunks.length > 0) {
            const combined = Buffer.concat(validChunks);
            resolve(combined);
          } else {
            reject(new Error('No valid audio data received'));
          }
        } catch (error) {
          reject(new Error(`Failed to combine audio chunks: ${error.message}`));
        }
      } else {
        reject(new Error('No audio data received'));
      }
    });
    
    ws.on('error', (error) => {
      reject(new Error(`WebSocket error: ${error.message || 'Unknown error'}`));
    });
    
    // Set timeout
    setTimeout(() => {
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.close();
        reject(new Error('TTS request timeout'));
      }
    }, 30000); // 30 second timeout
  });
}

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const {
      text,
      voice = DEFAULT_VOICE,
      rate = '+0%',
      volume = '+0%',
      pitch = '+0Hz'
    } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    if (text.length > 8000) {
      return res.status(400).json({ error: 'Text too long. Maximum 8000 characters.' });
    }
    
    const audioData = await handleTTSWebSocket(text, voice, rate, volume, pitch);
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioData.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    return res.send(audioData);
  } catch (error) {
    console.error('TTS Error:', error);
    return res.status(500).json({ 
      error: 'TTS generation failed', 
      details: error.message 
    });
  }
}
