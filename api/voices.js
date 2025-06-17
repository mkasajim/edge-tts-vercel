// Vercel API Route for Voice List
// File: api/voices.js

const BASE_URL = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud';
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const VOICE_LIST_URL = `https://${BASE_URL}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;
const CHROMIUM_MAJOR_VERSION = '130';

const BASE_HEADERS = {
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9'
};

const VOICE_HEADERS = {
  'Authority': 'speech.platform.bing.com',
  'Sec-CH-UA': `" Not;A Brand";v="99", "Microsoft Edge";v="${CHROMIUM_MAJOR_VERSION}", "Chromium";v="${CHROMIUM_MAJOR_VERSION}"`,
  'Sec-CH-UA-Mobile': '?0',
  'Accept': '*/*',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  ...BASE_HEADERS
};

async function fetchVoices() {
  try {
    const response = await fetch(VOICE_LIST_URL, {
      headers: VOICE_HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }
    
    const voices = await response.json();
    
    // Process voices like in the Python version
    return voices.map(voice => {
      // Add Language field from Locale
      if (voice.Locale) {
        voice.Language = voice.Locale.split('-')[0];
      }
      
      // Add DisplayName and LocaleName for compatibility
      if (voice.FriendlyName) {
        voice.DisplayName = voice.FriendlyName;
      }
      if (voice.Locale) {
        voice.LocaleName = voice.Locale;
      }
      
      // Clean ContentCategories and VoicePersonalities
      if (voice.VoiceTag) {
        if (voice.VoiceTag.ContentCategories) {
          voice.VoiceTag.ContentCategories = voice.VoiceTag.ContentCategories.map(cat => cat.trim());
        }
        if (voice.VoiceTag.VoicePersonalities) {
          voice.VoiceTag.VoicePersonalities = voice.VoiceTag.VoicePersonalities.map(pers => pers.trim());
        }
      }
      
      return voice;
    });
  } catch (error) {
    console.error('Error fetching voices:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const voices = await fetchVoices();
    return res.status(200).json(voices);
  } catch (error) {
    console.error('Handler Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
