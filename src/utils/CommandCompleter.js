// src/utils/CommandCompleter.js
/**
 * Provides command completion functionality for the CLI
 */
export class CommandCompleter {
  constructor() {
    this.commands = new Map();
    this.commandAliases = new Map();
  }

  /**
   * Register a command with its possible completions
   * @param {String} command - The command name (without the leading slash)
   * @param {Array} subcommands - Optional array of subcommands
   * @param {String} description - Optional description of the command
   * @param {String} alias - Optional command alias
   */
  registerCommand(command, subcommands = [], description = '', alias = null) {
    this.commands.set(command, { subcommands, description });
    
    if (alias) {
      this.commandAliases.set(alias, command);
    }
  }

  /**
   * Get completions for a given input
   * @param {String} input - The current input text
   * @returns {Array} - Array of possible completions
   */
  getCompletions(input) {
    // Handle empty input
    if (!input || !input.trim()) {
      return Array.from(this.commands.keys()).map(cmd => `/${cmd}`);
    }

    const trimmedInput = input.trim();
    
    // If input starts with '/', it's a command
    if (trimmedInput.startsWith('/')) {
      const commandText = trimmedInput.slice(1); // Remove the leading '/'
      const parts = commandText.split(' ');
      
      // If there's only one part, complete the command name
      if (parts.length === 1) {
        const commandPrefix = parts[0];
        return this.completeCommandName(commandPrefix);
      } 
      // If there are multiple parts, try to complete subcommands
      else if (parts.length > 1) {
        const commandName = parts[0];
        const subcommandPrefix = parts[parts.length - 1];
        
        // Check if the command exists
        const command = this.commands.get(commandName) || 
                        this.commands.get(this.commandAliases.get(commandName));
                        
        if (command) {
          return this.completeSubcommand(commandName, subcommandPrefix, parts.length - 1);
        }
      }
    }
    
    return []; // No completions available
  }

  /**
   * Complete a command name based on prefix
   * @param {String} prefix - The command prefix
   * @returns {Array} - Array of possible command completions
   */
  completeCommandName(prefix) {
    const completions = [];
    
    // Add direct commands
    for (const [cmd] of this.commands.entries()) {
      if (cmd.startsWith(prefix)) {
        completions.push(`/${cmd}`);
      }
    }
    
    // Add aliases
    for (const [alias, cmd] of this.commandAliases.entries()) {
      if (alias.startsWith(prefix)) {
        completions.push(`/${alias}`);
      }
    }
    
    return completions;
  }

  /**
   * Complete a subcommand based on prefix
   * @param {String} commandName - The main command name
   * @param {String} prefix - The subcommand prefix
   * @param {Number} position - The position of the subcommand in the input
   * @returns {Array} - Array of possible subcommand completions
   */
  completeSubcommand(commandName, prefix, position) {
    // Get the command (either directly or via alias)
    const command = this.commands.get(commandName) || 
                    this.commands.get(this.commandAliases.get(commandName));
    
    if (!command || !command.subcommands || command.subcommands.length === 0) {
      return [];
    }
    
    // Filter subcommands that match the prefix
    return command.subcommands
      .filter(subcmd => subcmd.startsWith(prefix))
      .map(subcmd => {
        // For the first subcommand position, return the full command
        if (position === 1) {
          return `/${commandName} ${subcmd}`;
        }
        // For later positions, just return the subcommand
        return subcmd;
      });
  }
}

export default CommandCompleter;