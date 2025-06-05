#!/usr/bin/env node

// This is the entry point for the CLI command
// We need to load environment variables before importing the main module
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Try to load local .env file first
const localEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

// Then try to load global config if it exists
const globalEnvPath = path.join(process.env.HOME || process.env.USERPROFILE, '.hikma', 'config.env');
if (fs.existsSync(globalEnvPath)) {
  dotenv.config({ path: globalEnvPath });
}

// Now import the main module
import '../src/index.js';