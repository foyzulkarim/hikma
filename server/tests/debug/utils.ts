import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Get current directory for ES modules
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load debug environment variables
config({ path: join(__dirname, '.env.debug') });

const BASE_URL = process.env.DEBUG_API_URL || 'http://localhost:4000';
const TOKEN_FILE = join(__dirname, 'token.json');

export interface TokenData {
  user: {
    id: string;
    email: string;
    username: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

export async function makeRequest<T = any>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  console.log(`🌐 ${options.method || 'GET'} ${url}`);
  if (options.body && options.method !== 'GET') {
    console.log(`📤 Request body: ${options.body}`);
  }
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    // Handle non-JSON responses
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: Invalid JSON response - ${text}`);
  }

  console.log(`📥 Response (${response.status}):`, JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data, null, 2)}`);
  }

  return data;
}

export function saveToken(tokenData: TokenData): void {
  try {
    writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
    console.log('✅ Token saved successfully');
  } catch (error) {
    throw new Error(`Failed to save token: ${error}`);
  }
}

export function loadToken(): TokenData | null {
  try {
    const data = readFileSync(TOKEN_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

export function getAuthHeaders(): { Authorization: string } {
  const tokenData = loadToken();
  if (!tokenData) {
    throw new Error('No token found. Please run login script first: npx tsx tests/debug/login.ts');
  }
  return {
    Authorization: `Bearer ${tokenData.tokens.accessToken}`
  };
}

export function getDebugCredentials(): LoginRequest {
  const email = process.env.DEBUG_EMAIL;
  const username = process.env.DEBUG_USERNAME;
  const password = process.env.DEBUG_PASSWORD;

  if (!email && !username) {
    throw new Error(
      'Missing DEBUG_EMAIL or DEBUG_USERNAME in tests/debug/.env.debug\n' +
      'Copy tests/debug/.env.debug.example to tests/debug/.env.debug and configure your credentials'
    );
  }

  if (!password) {
    throw new Error(
      'Missing DEBUG_PASSWORD in tests/debug/.env.debug\n' +
      'Copy tests/debug/.env.debug.example to tests/debug/.env.debug and configure your credentials'
    );
  }

  return {
    emailOrUsername: email || username!,
    password: password
  };
}

export function getDefaultProjectId(): string {
  return process.env.DEBUG_PROJECT_ID || 'cmez8jxr500075kl57r8to8ga';
}