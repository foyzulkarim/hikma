// src/utils/SimpleTabCompleter.js
import readline from 'readline';
import { CommandCompleter } from './CommandCompleter.js';

/**
 * A simple tab completer that works with standard Node.js readline
 */
export class SimpleTabCompleter {
  constructor() {
    this.completer = new CommandCompleter();
    this.initialized = false;
    this.commands = [];
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
    // Define all commands
    const commands = [
      { name: 'help', description: 'Display help message' },
      { name: 'history', description: 'Show conversation history' },
      { name: 'new', description: 'Start a new conversation' },
      { name: 'list', description: 'List all conversations' },
      { name: 'switch', description: 'Switch to a different conversation' },
      { name: 'delete', description: 'Delete a conversation' },
      { name: 'system', description: 'Update the system prompt' },
      { name: 'temp', description: 'Update the temperature setting' },
      { name: 'model', description: 'Change the model' },
      { name: 'models', description: 'List all available models' },
      { name: 'context', description: 'Manage context files and hooks' },
      { name: 'tools', description: 'List available tools and their keywords' },
      { name: 'usage', description: 'Display token usage statistics' },
      { name: 'exit', description: 'Exit the chat' }
    ];

    // Store commands for direct access
    this.commands = commands.map(cmd => `/${cmd.name}`);
    
    // Register main commands
    commands.forEach(cmd => {
      this.completer.registerCommand(cmd.name, [], cmd.description);
    });
    
    // Register context subcommands
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
   * Set up tab completion for the terminal
   */
  setupTabCompletion() {
    // Initialize if not already done
    this.initialize();
    
    // Create readline interface for tab completion
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: (line) => {
        const completions = this.completer.getCompletions(line);
        return [completions.length ? completions : this.commands, line];
      }
    });
    
    // Don't interfere with the main program flow
    rl.on('line', () => {});
    
    return rl;
  }

  /**
   * Get completions for a given input
   * @param {String} input - The current input text
   * @returns {Array} - Array of possible completions
   */
  getCompletions(input) {
    // Initialize if not already done
    if (!this.initialized) {
      this.initialize();
    }
    
    return this.completer.getCompletions(input);
  }
}

export default SimpleTabCompleter;