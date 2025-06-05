// src/utils/TabCompleter.js
import readline from 'readline';
import { CommandCompleter } from './CommandCompleter.js';

/**
 * Provides tab completion functionality for the CLI
 */
export class TabCompleter {
  constructor() {
    this.completer = new CommandCompleter();
    this.rl = null;
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
   * Create a readline interface with tab completion
   * @param {Object} options - Options for the readline interface
   * @returns {Object} - The readline interface
   */
  createInterface(options = {}) {
    // Initialize if not already done
    this.initialize();
    
    // Create the readline interface with completion
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: this.completeInput.bind(this),
      ...options
    });
    
    return this.rl;
  }

  /**
   * Completion function for readline
   * @param {String} line - The current input line
   * @returns {Array} - [completions, original]
   */
  completeInput(line) {
    const completions = this.completer.getCompletions(line);
    return [completions, line];
  }

  /**
   * Get a readline interface with tab completion
   * @returns {Object} - The readline interface
   */
  getInterface() {
    if (!this.rl) {
      return this.createInterface();
    }
    return this.rl;
  }

  /**
   * Close the readline interface
   */
  close() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}

export default TabCompleter;