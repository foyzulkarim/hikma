// src/commands/config.js
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import configManager from '../config/ConfigManager.js';

/**
 * Set up the config command for managing global configuration
 * @param {Command} program - Commander program instance
 */
export function setupConfigCommand(program) {
  const configCmd = program
    .command('config')
    .description('Manage global configuration');
  
  // Get current configuration
  configCmd
    .command('get [key]')
    .description('Get configuration value(s)')
    .action((key) => {
      const config = configManager.loadConfig();
      
      if (!key) {
        // Display all config
        console.log(chalk.cyan('\nCurrent Configuration:'));
        console.log(chalk.yellow('\nOllama Configuration:'));
        console.log(`Base URL: ${chalk.green(config.ollama.baseUrl)}`);
        console.log(`Default Model: ${chalk.green(config.ollama.defaultModel)}`);
        
        console.log(chalk.yellow('\nMemory Configuration:'));
        console.log(`Persist Memory: ${chalk.green(config.memory.persistMemory)}`);
        console.log(`Max Messages: ${chalk.green(config.memory.maxMessages)}`);
        console.log(`Summarize Threshold: ${chalk.green(config.memory.summarizeThreshold)}`);
        
        console.log(chalk.yellow('\nSettings:'));
        console.log(`Temperature: ${chalk.green(config.settings.temperature)}`);
        console.log(`Max Tokens: ${chalk.green(config.settings.maxTokens)}`);
        console.log(`System Prompt: ${chalk.green(config.settings.systemPrompt)}`);
        console.log(`Include System Prompt: ${chalk.green(config.settings.includeSystemPrompt)}`);
        console.log('');
      } else {
        // Get specific key
        const keys = key.split('.');
        let value = config;
        
        for (const k of keys) {
          if (value[k] === undefined) {
            console.log(chalk.red(`Configuration key '${key}' not found`));
            return;
          }
          value = value[k];
        }
        
        console.log(`${key}: ${chalk.green(value)}`);
      }
    });
  
  // Set configuration value
  configCmd
    .command('set <key> <value>')
    .description('Set configuration value')
    .action((key, value) => {
      const config = configManager.loadConfig();
      const keys = key.split('.');
      
      // Convert value to appropriate type
      let typedValue = value;
      if (value === 'true') typedValue = true;
      else if (value === 'false') typedValue = false;
      else if (!isNaN(value)) {
        if (value.includes('.')) typedValue = parseFloat(value);
        else typedValue = parseInt(value, 10);
      }
      
      // Set the value
      let current = config;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (current[k] === undefined) {
          console.log(chalk.red(`Configuration key '${key}' not found`));
          return;
        }
        current = current[k];
      }
      
      const lastKey = keys[keys.length - 1];
      if (current[lastKey] === undefined) {
        console.log(chalk.red(`Configuration key '${key}' not found`));
        return;
      }
      
      current[lastKey] = typedValue;
      
      // Save configuration
      if (configManager.saveGlobalConfig(config)) {
        console.log(chalk.green(`Configuration '${key}' set to '${value}'`));
      } else {
        console.log(chalk.red('Failed to save configuration'));
      }
    });
  
  // Initialize configuration
  configCmd
    .command('init')
    .description('Initialize global configuration')
    .action(async () => {
      const config = configManager.loadConfig();
      
      // Prompt for configuration values
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'baseUrl',
          message: 'Ollama API base URL:',
          default: config.ollama.baseUrl
        },
        {
          type: 'input',
          name: 'defaultModel',
          message: 'Default model:',
          default: config.ollama.defaultModel
        },
        {
          type: 'confirm',
          name: 'persistMemory',
          message: 'Enable persistent memory?',
          default: config.memory.persistMemory
        },
        {
          type: 'number',
          name: 'temperature',
          message: 'Temperature (0.0-1.0):',
          default: config.settings.temperature,
          validate: (value) => {
            if (value >= 0 && value <= 1) return true;
            return 'Temperature must be between 0 and 1';
          }
        },
        {
          type: 'input',
          name: 'systemPrompt',
          message: 'System prompt:',
          default: config.settings.systemPrompt
        }
      ]);
      
      // Update configuration
      config.ollama.baseUrl = answers.baseUrl;
      config.ollama.defaultModel = answers.defaultModel;
      config.memory.persistMemory = answers.persistMemory;
      config.settings.temperature = answers.temperature;
      config.settings.systemPrompt = answers.systemPrompt;
      
      // Save configuration
      if (configManager.saveGlobalConfig(config)) {
        console.log(chalk.green('Global configuration saved successfully'));
      } else {
        console.log(chalk.red('Failed to save global configuration'));
      }
    });
}

export default setupConfigCommand;