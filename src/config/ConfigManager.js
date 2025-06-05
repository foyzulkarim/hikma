// src/config/ConfigManager.js
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * ConfigManager handles loading configuration from multiple sources
 * with the following priority (highest to lowest):
 * 1. Command line arguments
 * 2. Environment variables
 * 3. Local .env file
 * 4. Global config file (~/.hikma/config.env)
 * 5. Default values
 */
export class ConfigManager {
  constructor() {
    this.config = {
      ollama: {
        baseUrl: 'http://localhost:11434/api',
        defaultModel: 'llama3.2:latest'
      },
      memory: {
        persistMemory: true,
        maxMessages: 100,
        summarizeThreshold: 50
      },
      settings: {
        includeSystemPrompt: true,
        systemPrompt: "You are a helpful assistant. Respond concisely and accurately.",
        temperature: 0.7,
        maxTokens: 30000
      }
    };
    
    // Paths for configuration files
    this.localEnvPath = path.resolve(process.cwd(), '.env');
    this.globalConfigDir = path.join(os.homedir(), '.hikma');
    this.globalEnvPath = path.join(this.globalConfigDir, 'config.env');
  }

  /**
   * Load configuration from all sources
   * @param {Object} cliOptions - Command line options
   * @returns {Object} - The merged configuration
   */
  loadConfig(cliOptions = {}) {
    // 1. Load from global config file if it exists
    this.loadFromGlobalEnv();
    
    // 2. Load from local .env file if it exists
    this.loadFromLocalEnv();
    
    // 3. Load from environment variables
    this.loadFromEnv();
    
    // 4. Override with command line options (highest priority)
    this.loadFromCliOptions(cliOptions);
    
    return this.config;
  }

  /**
   * Load configuration from global ~/.hikma/config.env file
   */
  loadFromGlobalEnv() {
    try {
      if (fs.existsSync(this.globalEnvPath)) {
        const envConfig = dotenv.parse(fs.readFileSync(this.globalEnvPath));
        this.applyEnvConfig(envConfig);
      }
    } catch (error) {
      console.error(`Error loading global config: ${error.message}`);
    }
  }

  /**
   * Load configuration from local .env file
   */
  loadFromLocalEnv() {
    try {
      if (fs.existsSync(this.localEnvPath)) {
        const envConfig = dotenv.parse(fs.readFileSync(this.localEnvPath));
        this.applyEnvConfig(envConfig);
      }
    } catch (error) {
      console.error(`Error loading local .env: ${error.message}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnv() {
    // Ollama config
    if (process.env.OLLAMA_BASE_URL) {
      this.config.ollama.baseUrl = process.env.OLLAMA_BASE_URL;
    }
    if (process.env.OLLAMA_DEFAULT_MODEL) {
      this.config.ollama.defaultModel = process.env.OLLAMA_DEFAULT_MODEL;
    }
    
    // Memory config
    if (process.env.PERSIST_MEMORY !== undefined) {
      this.config.memory.persistMemory = process.env.PERSIST_MEMORY === 'true';
    }
    if (process.env.MAX_MESSAGES) {
      this.config.memory.maxMessages = parseInt(process.env.MAX_MESSAGES, 10);
    }
    if (process.env.SUMMARIZE_THRESHOLD) {
      this.config.memory.summarizeThreshold = parseInt(process.env.SUMMARIZE_THRESHOLD, 10);
    }
    
    // Settings
    if (process.env.TEMPERATURE) {
      this.config.settings.temperature = parseFloat(process.env.TEMPERATURE);
    }
    if (process.env.MAX_TOKENS) {
      this.config.settings.maxTokens = parseInt(process.env.MAX_TOKENS, 10);
    }
    if (process.env.SYSTEM_PROMPT) {
      this.config.settings.systemPrompt = process.env.SYSTEM_PROMPT;
    }
    if (process.env.INCLUDE_SYSTEM_PROMPT !== undefined) {
      this.config.settings.includeSystemPrompt = process.env.INCLUDE_SYSTEM_PROMPT === 'true';
    }
  }

  /**
   * Apply environment variables from a parsed .env file
   * @param {Object} envConfig - Parsed environment variables
   */
  applyEnvConfig(envConfig) {
    // Ollama config
    if (envConfig.OLLAMA_BASE_URL) {
      this.config.ollama.baseUrl = envConfig.OLLAMA_BASE_URL;
    }
    if (envConfig.OLLAMA_DEFAULT_MODEL) {
      this.config.ollama.defaultModel = envConfig.OLLAMA_DEFAULT_MODEL;
    }
    
    // Memory config
    if (envConfig.PERSIST_MEMORY !== undefined) {
      this.config.memory.persistMemory = envConfig.PERSIST_MEMORY === 'true';
    }
    if (envConfig.MAX_MESSAGES) {
      this.config.memory.maxMessages = parseInt(envConfig.MAX_MESSAGES, 10);
    }
    if (envConfig.SUMMARIZE_THRESHOLD) {
      this.config.memory.summarizeThreshold = parseInt(envConfig.SUMMARIZE_THRESHOLD, 10);
    }
    
    // Settings
    if (envConfig.TEMPERATURE) {
      this.config.settings.temperature = parseFloat(envConfig.TEMPERATURE);
    }
    if (envConfig.MAX_TOKENS) {
      this.config.settings.maxTokens = parseInt(envConfig.MAX_TOKENS, 10);
    }
    if (envConfig.SYSTEM_PROMPT) {
      this.config.settings.systemPrompt = envConfig.SYSTEM_PROMPT;
    }
    if (envConfig.INCLUDE_SYSTEM_PROMPT !== undefined) {
      this.config.settings.includeSystemPrompt = envConfig.INCLUDE_SYSTEM_PROMPT === 'true';
    }
  }

  /**
   * Load configuration from command line options
   * @param {Object} cliOptions - Command line options
   */
  loadFromCliOptions(cliOptions) {
    // Ollama config
    if (cliOptions.model) {
      this.config.ollama.defaultModel = cliOptions.model;
    }
    if (cliOptions.baseUrl) {
      this.config.ollama.baseUrl = cliOptions.baseUrl;
    }
    
    // Memory config
    if (cliOptions.persist !== undefined) {
      this.config.memory.persistMemory = cliOptions.persist;
    }
    if (cliOptions.maxMessages) {
      this.config.memory.maxMessages = cliOptions.maxMessages;
    }
    if (cliOptions.summarizeThreshold) {
      this.config.memory.summarizeThreshold = cliOptions.summarizeThreshold;
    }
    
    // Settings
    if (cliOptions.temperature !== undefined) {
      this.config.settings.temperature = cliOptions.temperature;
    }
    if (cliOptions.maxTokens) {
      this.config.settings.maxTokens = cliOptions.maxTokens;
    }
    if (cliOptions.system) {
      this.config.settings.systemPrompt = cliOptions.system;
    }
    if (cliOptions.noSystem !== undefined) {
      this.config.settings.includeSystemPrompt = !cliOptions.noSystem;
    }
  }

  /**
   * Create a global configuration file
   * @param {Object} config - Configuration to save
   * @returns {Boolean} - Whether the operation was successful
   */
  saveGlobalConfig(config = this.config) {
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(this.globalConfigDir)) {
        fs.mkdirSync(this.globalConfigDir, { recursive: true });
      }
      
      // Convert config to environment variables format
      let envContent = '# Hikma global configuration\n\n';
      
      // Ollama config
      envContent += '# Ollama configuration\n';
      envContent += `OLLAMA_BASE_URL=${config.ollama.baseUrl}\n`;
      envContent += `OLLAMA_DEFAULT_MODEL=${config.ollama.defaultModel}\n\n`;
      
      // Memory config
      envContent += '# Memory configuration\n';
      envContent += `PERSIST_MEMORY=${config.memory.persistMemory}\n`;
      envContent += `MAX_MESSAGES=${config.memory.maxMessages}\n`;
      envContent += `SUMMARIZE_THRESHOLD=${config.memory.summarizeThreshold}\n\n`;
      
      // Settings
      envContent += '# Settings\n';
      envContent += `TEMPERATURE=${config.settings.temperature}\n`;
      envContent += `MAX_TOKENS=${config.settings.maxTokens}\n`;
      envContent += `SYSTEM_PROMPT="${config.settings.systemPrompt}"\n`;
      envContent += `INCLUDE_SYSTEM_PROMPT=${config.settings.includeSystemPrompt}\n`;
      
      // Write to file
      fs.writeFileSync(this.globalEnvPath, envContent);
      return true;
    } catch (error) {
      console.error(`Error saving global config: ${error.message}`);
      return false;
    }
  }
}

export default new ConfigManager();