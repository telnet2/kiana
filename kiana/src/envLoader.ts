/**
 * Environment Variable Loader Utility
 * 
 * Provides consistent .env file loading across the application
 * with support for current directory and parent directory fallback
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load environment variables from .env files
 * Priority: current directory -> parent directory -> system environment
 */
export function loadEnv(): void {
  // Load from current directory first
  const currentDirEnv = path.join(process.cwd(), '.env');
  
  if (fs.existsSync(currentDirEnv)) {
    dotenv.config({ path: currentDirEnv });
    console.log('[Env] Loaded .env from current directory');
    return;
  }
  
  // Fallback to parent directory
  const parentDirEnv = path.join(process.cwd(), '..', '.env');
  
  if (fs.existsSync(parentDirEnv)) {
    dotenv.config({ path: parentDirEnv });
    console.log('[Env] Loaded .env from parent directory');
    return;
  }
  
  // If no .env files found, still call dotenv.config() to ensure any existing env vars are preserved
  dotenv.config();
}

/**
 * Load environment variables with custom options
 */
export function loadEnvCustom(options: {
  paths?: string[];
  silent?: boolean;
}): void {
  const { paths = [], silent = true } = options;
  
  // Try provided paths first
  for (const envPath of paths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, debug: !silent });
      if (!silent) {
        console.log(`[Env] Loaded .env from: ${envPath}`);
      }
      return;
    }
  }
  
  // Fallback to default behavior
  loadEnv();
}

/**
 * Check if required environment variables are set
 */
export function checkRequiredEnv(vars: string[]): { missing: string[]; present: string[] } {
  const missing: string[] = [];
  const present: string[] = [];
  
  for (const varName of vars) {
    if (!process.env[varName] || process.env[varName]?.trim() === '') {
      missing.push(varName);
    } else {
      present.push(varName);
    }
  }
  
  return { missing, present };
}

/**
 * Get ARK configuration from environment with fallback to .env files
 */
export function getARKConfigFromEnv(): {
  modelId: string;
  apiKey: string;
  baseURL: string;
} {
  return {
    modelId: process.env.ARK_MODEL_ID || 'doubao-pro-32k',
    apiKey: process.env.ARK_API_KEY || '',
    baseURL: process.env.ARK_BASE_URL || 'https://ark-ap-southeast.byteintl.net/api/v3'
  };
}