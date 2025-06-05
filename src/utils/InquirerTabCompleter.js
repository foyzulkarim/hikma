// src/utils/InquirerTabCompleter.js
import inquirer from 'inquirer';
import { CommandCompleter } from './CommandCompleter.js';
import chalk from 'chalk';

/**
 * Custom prompt with tab completion for inquirer
 */
export class InquirerTabCompleter {
  constructor() {
    this.completer = new CommandCompleter();
    this.initialized = false;
  }

  /**
   * Initialize the tab completer with available commands
   */
  initialize() {
    if (this.initialized) return;

    // Register all available commands
    this.registerCommands();
    this.initialized = true;
  }

  /**
   * Register all available commands for completion
   */
  registerCommands() {
    // Register main commands
    this.completer.registerCommand('help', [], 'Display help message');
    this.completer.registerCommand('history', [], 'Show conversation history');
    this.completer.registerCommand('new', [], 'Start a new conversation');
    this.completer.registerCommand('list', [], 'List all conversations');
    this.completer.registerCommand('switch', [], 'Switch to a different conversation');
    this.completer.registerCommand('delete', [], 'Delete a conversation');
    this.completer.registerCommand('system', [], 'Update the system prompt');
    this.completer.registerCommand('temp', [], 'Update the temperature setting');
    this.completer.registerCommand('model', [], 'Change the model');
    this.completer.registerCommand('models', [], 'List all available models');
    this.completer.registerCommand('tools', [], 'List available tools and their keywords');
    this.completer.registerCommand('usage', [], 'Display token usage statistics');
    this.completer.registerCommand('exit', [], 'Exit the chat');
    
    // Register context commands with subcommands
    this.completer.registerCommand('context', [
      'help',
      'show',
      'tokens',
      'add',
      'rm',
      'clear',
      'hooks'
    ], 'Manage context files and hooks');
  }

  /**
   * Format commands with descriptions for better display
   */
  formatCommandsWithDescriptions(commands) {
    const commandDescriptions = {
      '/help': 'Display help message',
      '/history': 'Show conversation history', 
      '/new': 'Start a new conversation',
      '/list': 'List all conversations',
      '/switch': 'Switch to a different conversation',
      '/delete': 'Delete a conversation',
      '/system': 'Update the system prompt',
      '/temp': 'Update the temperature setting',
      '/model': 'Change the model',
      '/models': 'List all available models',
      '/tools': 'List available tools and their keywords',
      '/usage': 'Display token usage statistics',
      '/exit': 'Exit the chat',
      '/context': 'Manage context files and hooks'
    };

    return commands.map((cmd, index) => {
      const description = commandDescriptions[cmd] || '';
      const isFirst = index === 0;
      const marker = isFirst ? '▶ ' : '  ';
      return {
        name: `${marker}${cmd}${description ? chalk.gray(' - ' + description) : ''}`,
        value: cmd,
        short: cmd
      };
    });
  }

  /**
   * Create a custom inquirer prompt with tab completion
   * @param {Object} options - Prompt options
   * @returns {Promise} - Promise that resolves with the user's input
   */
  async prompt(options = {}) {
    // Initialize if not already done
    this.initialize();
    
    // Register the autocomplete type if not already registered
    if (!inquirer.prompt.prompts.autocomplete) {
      try {
        // Try to load inquirer-autocomplete-prompt
        const { default: autocompletePrompt } = await import('inquirer-autocomplete-prompt');
        inquirer.registerPrompt('autocomplete', autocompletePrompt);
      } catch (error) {
        console.error('Error loading inquirer-autocomplete-prompt:', error.message);
        console.error('Please install it with: npm install inquirer-autocomplete-prompt');
        
        // Fall back to standard prompt
        return inquirer.prompt({
          type: 'input',
          name: 'userInput',
          message: options.message || 'You:',
          prefix: options.prefix || '',
        });
      }
    }

    // Create the autocomplete prompt with enhanced formatting
    return inquirer.prompt({
      type: 'autocomplete',
      name: 'userInput',
      message: options.message || 'You:',
      prefix: options.prefix || '',
      source: async (answersSoFar, input) => {
        // Always show all commands when input starts with '/' but is just '/'
        if (input === '/') {
          const allCommands = Array.from(this.completer.commands.keys()).map(cmd => `/${cmd}`);
          return this.formatCommandsWithDescriptions(allCommands);
        }
        
        // Show completions for partial slash commands
        if (input && input.startsWith('/')) {
          const completions = this.completer.getCompletions(input);
          if (completions.length > 0) {
            return this.formatCommandsWithDescriptions(completions);
          }
        }
        
        // No completions for non-slash commands
        return [];
      },
      // Don't use suggestOnly mode - allow direct selection from list
      suggestOnly: false,
      // Set page size to show more options at once  
      pageSize: 8,
      // Customize text shown during search
      searchText: 'Searching commands...',
      emptyText: 'Type / to see available commands',
      // Don't loop through suggestions
      loop: false,
    });
  }
}

export default InquirerTabCompleter;
