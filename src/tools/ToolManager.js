/**
 * ToolManager handles the registration and execution of tools
 * that can be used by the agent to perform actions based on user prompts
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export class ToolManager {
  constructor() {
    this.tools = new Map();
    this.registerDefaultTools();
  }

  /**
   * Register a new tool
   * @param {String} name - The name of the tool
   * @param {Function} handler - The function that handles the tool execution
   * @param {Array} keywords - Keywords that trigger this tool
   * @param {String} description - Description of what the tool does
   */
  registerTool(name, handler, keywords, description) {
    this.tools.set(name, {
      name,
      handler,
      keywords,
      description
    });
  }

  /**
   * Register default tools
   */
  registerDefaultTools() {
    // Git tools
    this.registerTool(
      'git_pull_request',
      this.handleGitPullRequest.bind(this),
      ['pull request', 'pr', 'github pr', 'check pr', 'show pr'],
      'Check current branch pull request details'
    );

    this.registerTool(
      'git_diff',
      this.handleGitDiff.bind(this),
      ['diff', 'changes', 'git diff', 'check changes', 'show changes', 'what changed', 'changes made', 'modifications', 'git status changes', 'working directory changes'],
      'Show git diff of current changes'
    );

    this.registerTool(
      'git_status',
      this.handleGitStatus.bind(this),
      ['git status', 'status', 'repository status', 'repo status', 'working tree status'],
      'Show git repository status'
    );

    this.registerTool(
      'list_directory',
      this.handleListDirectory.bind(this),
      ['list files', 'ls', 'show files', 'directory contents', 'current directory', 'list directory'],
      'List files in the current directory'
    );

    this.registerTool(
      'read_file',
      this.handleReadFile.bind(this),
      ['read file', 'show file', 'cat file', 'display file', 'view file'],
      'Read and display file contents'
    );

    this.registerTool(
      'execute_command',
      this.handleExecuteCommand.bind(this),
      ['run command', 'execute', 'shell command', 'bash command', 'terminal command'],
      'Execute a shell command'
    );
  }

  /**
   * Find the most appropriate tool for a given prompt
   * @param {String} prompt - The user prompt
   * @returns {Object|null} - The matched tool or null if no match
   */
  findMatchingTool(prompt) {
    const normalizedPrompt = prompt.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    
    // Check each tool's keywords for matches and score them
    for (const [name, tool] of this.tools.entries()) {
      let score = 0;
      let matchedKeywords = [];
      
      for (const keyword of tool.keywords) {
        const normalizedKeyword = keyword.toLowerCase();
        
        // Exact phrase match gets highest score
        if (normalizedPrompt.includes(normalizedKeyword)) {
          // Longer keywords get higher scores (more specific)
          const keywordScore = normalizedKeyword.length;
          score += keywordScore;
          matchedKeywords.push(keyword);
        }
      }
      
      // Bonus points for multiple keyword matches
      if (matchedKeywords.length > 1) {
        score += matchedKeywords.length * 5;
      }
      
      // Update best match if this tool has a higher score
      if (score > bestScore) {
        bestScore = score;
        bestMatch = tool;
      }
    }
    
    // Only return a match if we have a reasonable score
    return bestScore > 0 ? bestMatch : null;
  }

  /**
   * Execute a tool based on the user prompt
   * @param {String} prompt - The user prompt
   * @returns {Promise<Object>} - Result of the tool execution
   */
  async executeToolFromPrompt(prompt) {
    const tool = this.findMatchingTool(prompt);
    
    if (!tool) {
      return {
        success: false,
        error: 'No matching tool found for this prompt'
      };
    }
    
    try {
      return await tool.handler(prompt);
    } catch (error) {
      return {
        success: false,
        error: `Error executing tool ${tool.name}: ${error.message}`
      };
    }
  }

  /**
   * Handle git pull request command
   * @param {String} prompt - The user prompt
   * @returns {Promise<Object>} - Result of the command
   */
  async handleGitPullRequest(prompt) {
    try {
      // Check if gh CLI is installed
      const { stdout: ghVersion, stderr: ghError } = await execAsync('gh --version', { cwd: process.cwd() });
      
      if (ghError) {
        return {
          success: false,
          error: 'GitHub CLI (gh) is not installed or not in PATH. Please install it first.'
        };
      }
      
      // Execute gh pr view command
      const { stdout, stderr } = await execAsync('gh pr view', { cwd: process.cwd() });
      
      if (stderr && stderr.includes('no pull requests found')) {
        return {
          success: false,
          error: 'No pull request found for the current branch'
        };
      }
      
      return {
        success: true,
        result: stdout,
        toolName: 'git_pull_request'
      };
    } catch (error) {
      if (error.message.includes('not a git repository')) {
        return {
          success: false,
          error: 'Current directory is not a git repository'
        };
      }
      
      if (error.message.includes('no pull requests found')) {
        return {
          success: false,
          error: 'No pull request found for the current branch'
        };
      }
      
      return {
        success: false,
        error: `Error checking pull request: ${error.message}`
      };
    }
  }

  /**
   * Handle git diff command
   * @param {String} prompt - The user prompt
   * @returns {Promise<Object>} - Result of the command
   */
  async handleGitDiff(prompt) {
    try {
      // Execute git diff command
      const { stdout, stderr } = await execAsync('git diff', { cwd: process.cwd() });
      
      if (stderr) {
        return {
          success: false,
          error: `Error: ${stderr}`
        };
      }
      
      if (!stdout.trim()) {
        return {
          success: true,
          result: 'No changes detected in the working directory',
          toolName: 'git_diff'
        };
      }
      
      return {
        success: true,
        result: stdout,
        toolName: 'git_diff'
      };
    } catch (error) {
      if (error.message.includes('not a git repository')) {
        return {
          success: false,
          error: 'Current directory is not a git repository'
        };
      }
      
      return {
        success: false,
        error: `Error checking git diff: ${error.message}`
      };
    }
  }

  /**
   * Handle git status command
   * @param {String} prompt - The user prompt
   * @returns {Promise<Object>} - Result of the command
   */
  async handleGitStatus(prompt) {
    try {
      // Execute git status command
      const { stdout, stderr } = await execAsync('git status', { cwd: process.cwd() });
      
      if (stderr) {
        return {
          success: false,
          error: `Error: ${stderr}`
        };
      }
      
      return {
        success: true,
        result: stdout,
        toolName: 'git_status'
      };
    } catch (error) {
      if (error.message.includes('not a git repository')) {
        return {
          success: false,
          error: 'Current directory is not a git repository'
        };
      }
      
      return {
        success: false,
        error: `Error checking git status: ${error.message}`
      };
    }
  }

  /**
   * Handle list directory command
   * @param {String} prompt - The user prompt
   * @returns {Promise<Object>} - Result of the command
   */
  async handleListDirectory(prompt) {
    try {
      // Execute ls command
      const { stdout, stderr } = await execAsync('ls', { cwd: process.cwd() });
      
      if (stderr) {
        return {
          success: false,
          error: `Error: ${stderr}`
        };
      }
      
      return {
        success: true,
        result: stdout,
        toolName: 'list_directory'
      };
    } catch (error) {
      if (error.message.includes('not a directory')) {
        return {
          success: false,
          error: 'Current directory is not a directory'
        };
      }
      
      return {
        success: false,
        error: `Error listing directory: ${error.message}`
      };
    }
  }

  /**
   * Handle read file command
   * @param {String} prompt - The user prompt
   * @returns {Promise<Object>} - Result of the command
   */
  async handleReadFile(prompt) {
    // Extract filename from prompt
    const fileNameMatch = prompt.match(/read file\s+([^\s]+)|show file\s+([^\s]+)|cat file\s+([^\s]+)|display file\s+([^\s]+)|view file\s+([^\s]+)/i);
    
    if (!fileNameMatch) {
      return {
        success: false,
        error: 'No filename specified. Please specify a file to read.'
      };
    }
    
    const fileName = fileNameMatch[1] || fileNameMatch[2] || fileNameMatch[3] || fileNameMatch[4] || fileNameMatch[5];
    
    try {
      const filePath = path.resolve(process.cwd(), fileName);
      const content = fs.readFileSync(filePath, 'utf8');
      
      return {
        success: true,
        result: content,
        toolName: 'read_file',
        fileName
      };
    } catch (error) {
      return {
        success: false,
        error: `Error reading file: ${error.message}`
      };
    }
  }

  /**
   * Handle execute command
   * @param {String} prompt - The user prompt
   * @returns {Promise<Object>} - Result of the command
   */
  async handleExecuteCommand(prompt) {
    try {
      // Execute the command
      const { stdout, stderr } = await execAsync(prompt, { cwd: process.cwd() });
      
      if (stderr) {
        return {
          success: false,
          error: `Error: ${stderr}`
        };
      }
      
      return {
        success: true,
        result: stdout,
        toolName: 'execute_command'
      };
    } catch (error) {
      return {
        success: false,
        error: `Error executing command: ${error.message}`
      };
    }
  }

  /**
   * Get all available tools
   * @returns {Array} - Array of tool objects
   */
  getAllTools() {
    return Array.from(this.tools.values());
  }
}

export default ToolManager;
