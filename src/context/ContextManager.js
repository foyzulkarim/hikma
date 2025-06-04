import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * ContextManager handles context files and hooks for chat sessions
 */
export class ContextManager {
  constructor() {
    // Store context files per conversation ID
    this.contextFiles = new Map(); // conversationId -> Set of file paths
    this.contextHooks = new Map(); // conversationId -> Set of hook functions
    this.maxFileSize = 1024 * 1024; // 1MB max file size
    this.supportedExtensions = new Set([
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', 
      '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.scala',
      '.html', '.css', '.scss', '.less', '.xml', '.json', '.yaml', '.yml',
      '.md', '.txt', '.sql', '.sh', '.bash', '.zsh', '.fish',
      '.dockerfile', '.gitignore', '.env'
    ]);
    // Average tokens per character for estimation
    this.tokensPerChar = 0.25;
  }

  /**
   * Initialize context for a conversation
   * @param {String} conversationId - The conversation ID
   */
  initializeContext(conversationId) {
    if (!this.contextFiles.has(conversationId)) {
      this.contextFiles.set(conversationId, new Set());
    }
    if (!this.contextHooks.has(conversationId)) {
      this.contextHooks.set(conversationId, new Set());
    }
  }

  /**
   * Add file(s) to context
   * @param {String} conversationId - The conversation ID
   * @param {String|Array} filePaths - File path(s) to add
   * @returns {Object} - Result object with success status and details
   */
  async addFiles(conversationId, filePaths) {
    this.initializeContext(conversationId);
    
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const results = [];
    const contextSet = this.contextFiles.get(conversationId);

    for (const filePath of paths) {
      try {
        const resolvedPath = path.resolve(filePath);
        
        // Check if path exists
        if (!fs.existsSync(resolvedPath)) {
          results.push({
            file: filePath,
            success: false,
            error: 'Path does not exist'
          });
          continue;
        }

        const stats = fs.statSync(resolvedPath);
        
        // Handle directory recursively
        if (stats.isDirectory()) {
          const dirResults = await this.addDirectory(conversationId, resolvedPath);
          results.push({
            file: filePath,
            success: dirResults.success,
            isDirectory: true,
            filesAdded: dirResults.filesAdded,
            filesSkipped: dirResults.filesSkipped
          });
          continue;
        }
        
        // Handle single file
        const fileResult = this.addSingleFile(conversationId, resolvedPath, filePath);
        results.push(fileResult);

      } catch (error) {
        results.push({
          file: filePath,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: results.some(r => r.success), // Success if at least one file was added
      results,
      totalFiles: contextSet.size
    };
  }
  
  /**
   * Add a single file to context
   * @param {String} conversationId - The conversation ID
   * @param {String} resolvedPath - Resolved file path
   * @param {String} originalPath - Original file path (for reporting)
   * @returns {Object} - Result object with success status
   * @private
   */
  addSingleFile(conversationId, resolvedPath, originalPath) {
    const contextSet = this.contextFiles.get(conversationId);
    
    try {
      // Check if it's a file
      const stats = fs.statSync(resolvedPath);
      if (!stats.isFile()) {
        return {
          file: originalPath,
          success: false,
          error: 'Path is not a file'
        };
      }

      // Check file size
      if (stats.size > this.maxFileSize) {
        return {
          file: originalPath,
          success: false,
          error: `File too large (max ${this.maxFileSize / 1024 / 1024}MB)`
        };
      }

      // Check if extension is supported
      const ext = path.extname(resolvedPath).toLowerCase();
      if (!this.supportedExtensions.has(ext) && ext !== '') {
        return {
          file: originalPath,
          success: false,
          error: 'File type not supported'
        };
      }

      // Try to read file to ensure it's readable
      const content = fs.readFileSync(resolvedPath, 'utf8');
      
      contextSet.add(resolvedPath);
      return {
        file: originalPath,
        success: true
      };
    } catch (error) {
      return {
        file: originalPath,
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Add a directory and its contents to context
   * @param {String} conversationId - The conversation ID
   * @param {String} dirPath - Directory path
   * @returns {Object} - Result object with success status and details
   * @private
   */
  async addDirectory(conversationId, dirPath) {
    const contextSet = this.contextFiles.get(conversationId);
    let filesAdded = 0;
    let filesSkipped = 0;
    
    // Function to recursively process directories
    const processDir = (currentPath) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        
        // Skip hidden files and directories
        if (entry.name.startsWith('.')) {
          filesSkipped++;
          continue;
        }
        
        // Skip node_modules, dist, build directories
        if (entry.isDirectory() && 
            ['node_modules', 'dist', 'build', 'out', '.git'].includes(entry.name)) {
          filesSkipped++;
          continue;
        }
        
        if (entry.isDirectory()) {
          processDir(entryPath);
        } else if (entry.isFile()) {
          const result = this.addSingleFile(conversationId, entryPath, entryPath);
          if (result.success) {
            filesAdded++;
          } else {
            filesSkipped++;
          }
        }
      }
    };
    
    try {
      processDir(dirPath);
      return {
        success: filesAdded > 0,
        filesAdded,
        filesSkipped
      };
    } catch (error) {
      return {
        success: filesAdded > 0,
        filesAdded,
        filesSkipped,
        error: error.message
      };
    }
  }

  /**
   * Remove file(s) from context
   * @param {String} conversationId - The conversation ID
   * @param {String|Array} filePaths - File path(s) to remove
   * @returns {Object} - Result object with success status and details
   */
  removeFiles(conversationId, filePaths) {
    this.initializeContext(conversationId);
    
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const results = [];
    const contextSet = this.contextFiles.get(conversationId);

    for (const filePath of paths) {
      const resolvedPath = path.resolve(filePath);
      
      if (contextSet.has(resolvedPath)) {
        contextSet.delete(resolvedPath);
        results.push({
          file: filePath,
          success: true
        });
      } else {
        results.push({
          file: filePath,
          success: false,
          error: 'File not in context'
        });
      }
    }

    return {
      success: results.every(r => r.success),
      results,
      totalFiles: contextSet.size
    };
  }

  /**
   * Clear all files from context
   * @param {String} conversationId - The conversation ID
   * @returns {Object} - Result object
   */
  clearFiles(conversationId) {
    this.initializeContext(conversationId);
    
    const contextSet = this.contextFiles.get(conversationId);
    const fileCount = contextSet.size;
    contextSet.clear();

    return {
      success: true,
      clearedCount: fileCount
    };
  }

  /**
   * Get all files in context for a conversation
   * @param {String} conversationId - The conversation ID
   * @returns {Array} - Array of file paths
   */
  getContextFiles(conversationId) {
    this.initializeContext(conversationId);
    return Array.from(this.contextFiles.get(conversationId));
  }

  /**
   * Get context content for inclusion in prompts
   * @param {String} conversationId - The conversation ID
   * @returns {String} - Formatted context content
   */
  async getContextContent(conversationId) {
    this.initializeContext(conversationId);
    
    const files = this.getContextFiles(conversationId);
    if (files.length === 0) {
      return '';
    }

    let contextContent = '\n--- CONTEXT FILES ---\n';
    
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(process.cwd(), filePath);
        
        contextContent += `\n=== ${relativePath} ===\n`;
        contextContent += content;
        contextContent += '\n=== END OF FILE ===\n';
      } catch (error) {
        contextContent += `\n=== ${filePath} ===\n`;
        contextContent += `[Error reading file: ${error.message}]\n`;
        contextContent += '=== END OF FILE ===\n';
      }
    }
    
    contextContent += '--- END CONTEXT FILES ---\n\n';
    return contextContent;
  }

  /**
   * Add a context hook function
   * @param {String} conversationId - The conversation ID
   * @param {Function} hookFunction - Function that returns additional context
   * @param {String} hookName - Name for the hook
   */
  addHook(conversationId, hookFunction, hookName = 'unnamed') {
    this.initializeContext(conversationId);
    
    const hookSet = this.contextHooks.get(conversationId);
    hookSet.add({ name: hookName, fn: hookFunction });
  }

  /**
   * Remove a context hook
   * @param {String} conversationId - The conversation ID
   * @param {String} hookName - Name of the hook to remove
   */
  removeHook(conversationId, hookName) {
    this.initializeContext(conversationId);
    
    const hookSet = this.contextHooks.get(conversationId);
    for (const hook of hookSet) {
      if (hook.name === hookName) {
        hookSet.delete(hook);
        return true;
      }
    }
    return false;
  }

  /**
   * Get all hooks for a conversation
   * @param {String} conversationId - The conversation ID
   * @returns {Array} - Array of hook objects
   */
  getHooks(conversationId) {
    this.initializeContext(conversationId);
    return Array.from(this.contextHooks.get(conversationId));
  }

  /**
   * Execute all hooks and get their content
   * @param {String} conversationId - The conversation ID
   * @returns {String} - Combined hook content
   */
  async executeHooks(conversationId) {
    this.initializeContext(conversationId);
    
    const hooks = this.getHooks(conversationId);
    if (hooks.length === 0) {
      return '';
    }

    let hookContent = '\n--- CONTEXT HOOKS ---\n';
    
    for (const hook of hooks) {
      try {
        const content = await hook.fn();
        if (content) {
          hookContent += `\n=== ${hook.name} ===\n`;
          hookContent += content;
          hookContent += '\n=== END HOOK ===\n';
        }
      } catch (error) {
        hookContent += `\n=== ${hook.name} ===\n`;
        hookContent += `[Error executing hook: ${error.message}]\n`;
        hookContent += '=== END HOOK ===\n';
      }
    }
    
    hookContent += '--- END CONTEXT HOOKS ---\n\n';
    return hookContent;
  }

  /**
   * Get full context (files + hooks) for a conversation
   * @param {String} conversationId - The conversation ID
   * @returns {String} - Complete context content
   */
  async getFullContext(conversationId) {
    const fileContext = await this.getContextContent(conversationId);
    const hookContext = await this.executeHooks(conversationId);
    
    return fileContext + hookContext;
  }

  /**
   * Get supported file extensions
   * @returns {Array} - Array of supported extensions
   */
  getSupportedExtensions() {
    return Array.from(this.supportedExtensions);
  }

  /**
   * Estimate token count for a given text
   * @param {String} text - The text to estimate tokens for
   * @returns {Number} - Estimated token count
   */
  estimateTokenCount(text) {
    if (!text) return 0;
    return Math.ceil(text.length * this.tokensPerChar);
  }

  /**
   * Get token counts for all context files
   * @param {String} conversationId - The conversation ID
   * @returns {Object} - Object with token counts and file details
   */
  getContextTokenCounts(conversationId) {
    this.initializeContext(conversationId);
    
    const files = this.getContextFiles(conversationId);
    if (files.length === 0) {
      return {
        files: [],
        totalTokens: 0,
        totalFiles: 0
      };
    }

    const fileDetails = [];
    let totalTokens = 0;
    
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(process.cwd(), filePath);
        const tokens = this.estimateTokenCount(content);
        
        fileDetails.push({
          path: relativePath,
          tokens,
          size: content.length
        });
        
        totalTokens += tokens;
      } catch (error) {
        fileDetails.push({
          path: filePath,
          tokens: 0,
          size: 0,
          error: error.message
        });
      }
    }
    
    return {
      files: fileDetails,
      totalTokens,
      totalFiles: files.length
    };
  }

  /**
   * Clean up context for a conversation (call when conversation is deleted)
   * @param {String} conversationId - The conversation ID
   */
  cleanupConversation(conversationId) {
    this.contextFiles.delete(conversationId);
    this.contextHooks.delete(conversationId);
  }
}

export default ContextManager; 
