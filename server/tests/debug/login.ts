/**
 * Login Script - Authenticates and saves token to token.json
 * 
 * Usage:
 *   npx tsx tests/debug/login.ts
 */

import { makeRequest, saveToken, getDebugCredentials, type TokenData } from './utils';

async function login() {
  try {
    console.log('🔐 Logging in...');

    const loginData = getDebugCredentials();
    console.log(`👤 Attempting login for: ${loginData.emailOrUsername}`);

    const response = await makeRequest<TokenData>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginData),
    });

    console.log('✅ Login successful!');
    console.log(`User: ${response.user.username} (${response.user.email})`);
    
    saveToken(response);
    
  } catch (error) {
    console.error('❌ Login failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  login();
}
