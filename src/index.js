// src/index.js
import { ChatSession } from './chat/ChatSession.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { InquirerTabCompleter } from './utils/InquirerTabCompleter.js';

// Load environment variables
dotenv.config();

// Get directory name in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '..', 'config', 'config.json');

// Default configuration
const defaultConfig = {
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.2:latest'
  },
  memory: {
    persistMemory: process.env.PERSIST_MEMORY === 'false' ? false : true,
    maxMessages: parseInt(process.env.MAX_MESSAGES) || 100,
    summarizeThreshold: parseInt(process.env.SUMMARIZE_THRESHOLD) || 50
  },
  settings: {
    includeSystemPrompt: true,
    systemPrompt: process.env.SYSTEM_PROMPT || "You are a helpful assistant. Respond concisely and accurately.",
    temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.MAX_TOKENS) || 30000
  }
};

// Load configuration
let config = defaultConfig;
if (fs.existsSync(configPath)) {
  try {
    const configFile = fs.readFileSync(configPath, 'utf8');
    config = { ...defaultConfig, ...JSON.parse(configFile) };
  } catch (error) {
    console.error(chalk.red(`Error loading configuration: ${error.message}`));
  }
}

// Set up command line interface
const program = new Command();

program
  .name('ollama-chat-memory')
  .description('Chat with Ollama LLM with conversation memory')
  .version('1.0.0');

program
  .option('-m, --model <model>', 'Specify the model to use', config.ollama.defaultModel)
  .option('-t, --temperature <temperature>', 'Set the temperature (0.0-1.0)', parseFloat, config.settings.temperature)
  .option('-p, --persist', 'Enable persistent memory storage', config.memory.persistMemory)
  .option('-s, --system <prompt>', 'Set a custom system prompt')
  .option('-n, --no-system', 'Disable system prompt')
  .option('-c, --config <path>', 'Path to config file');

program.parse();

const options = program.opts();

// Update config with command line options
if (options.model) config.ollama.defaultModel = options.model;
if (options.temperature) config.settings.temperature = options.temperature;
if (options.persist !== undefined) config.memory.persistMemory = options.persist;
if (options.system) config.settings.systemPrompt = options.system;
if (options.noSystem === false) config.settings.includeSystemPrompt = false;

// Initialize chat session
const chatSession = new ChatSession({
  ollamaOptions: config.ollama,
  memoryOptions: config.memory,
  settings: {
    ...config.settings,
    model: config.ollama.defaultModel // Explicitly pass the model to settings
  },
  persistMemory: config.memory.persistMemory
});

// Event listeners
chatSession.on('initialized', ({ conversationId }) => {
  console.log(chalk.green(`Chat session initialized with conversation ID: ${conversationId}`));
});

chatSession.on('messageSent', ({ message }) => {
  // This is handled in the main loop
});

chatSession.on('responseReceived', ({ message }) => {
  // This is handled in the main loop
});

chatSession.on('error', ({ error }) => {
  console.error(chalk.red(`Error: ${error}`));
});

// Helper function to display conversation history
function displayConversationHistory(conversation) {
  if (!conversation || !conversation.messages || conversation.messages.length === 0) {
    console.log(chalk.yellow('No messages in this conversation.'));
    return;
  }
  
  console.log(chalk.cyan('\n--- Conversation History ---'));
  
  conversation.messages.forEach(msg => {
    if (msg.role === 'system') {
      console.log(chalk.gray(`System: ${msg.content}`));
    } else if (msg.role === 'user') {
      console.log(chalk.blue(`You: ${msg.content}`));
    } else if (msg.role === 'assistant') {
      console.log(chalk.green(`Assistant: ${msg.content}`));
    }
  });
  
  console.log(chalk.cyan('---------------------------\n'));
}

// Helper function to display available commands
function displayHelp() {
  console.log(chalk.cyan('\nAvailable Commands:'));
  console.log(chalk.yellow('/help') + ' - Display this help message');
  console.log(chalk.yellow('/history') + ' - Show conversation history');
  console.log(chalk.yellow('/new') + ' - Start a new conversation');
  console.log(chalk.yellow('/list') + ' - List all conversations');
  console.log(chalk.yellow('/switch <id>') + ' - Switch to a different conversation');
  console.log(chalk.yellow('/delete <id>') + ' - Delete a conversation');
  console.log(chalk.yellow('/system <prompt>') + ' - Update the system prompt');
  console.log(chalk.yellow('/temp <value>') + ' - Update the temperature setting');
  console.log(chalk.yellow('/model <name>') + ' - Change the model');
  console.log(chalk.yellow('/models') + ' - List all available models');
  console.log(chalk.yellow('/context') + ' - Manage context files and hooks for the chat session');
  console.log(chalk.yellow('/tools') + ' - List available tools');
  console.log(chalk.yellow('/usage') + ' - Display token usage statistics');
  console.log(chalk.yellow('/exit') + ' - Exit the chat');
  console.log('');
  console.log(chalk.cyan('Special Prefixes:'));
  console.log(chalk.yellow('!<command>') + ' - Execute a bash command');
  console.log(chalk.yellow('gh:<command>') + ' - Execute a GitHub CLI command');
  console.log(chalk.yellow('gh:pr list') + ' - List pull requests');
  console.log(chalk.yellow('gh:pr view <number>') + ' - View a specific pull request');
  console.log('');
}

// Helper function to display context help
function displayContextHelp() {
  console.log(chalk.cyan('\nContext Commands:'));
  console.log(chalk.yellow('/context help') + ' - Show this context help');
  console.log(chalk.yellow('/context show') + ' - Display current context configuration');
  console.log(chalk.yellow('/context tokens') + ' - Display token counts for context files');
  console.log(chalk.yellow('/context add <file1> [file2...]') + ' - Add file(s) to context');
  console.log(chalk.yellow('/context rm <file1> [file2...]') + ' - Remove file(s) from context');
  console.log(chalk.yellow('/context clear') + ' - Clear all files from current context');
  console.log(chalk.yellow('/context hooks') + ' - View and manage context hooks');
  console.log('');
}

// Helper function to display context status
function displayContextStatus(contextManager, conversationId) {
  const files = contextManager.getContextFiles(conversationId);
  const hooks = contextManager.getHooks(conversationId);
  const tokenCounts = contextManager.getContextTokenCounts(conversationId);
  
  console.log(chalk.cyan('\n--- Context Configuration ---'));
  
  if (files.length === 0) {
    console.log(chalk.gray('No files in context'));
  } else {
    console.log(chalk.yellow(`Files in context (${files.length}, ~${tokenCounts.totalTokens} tokens):`));
    files.forEach(file => {
      const relativePath = path.relative(process.cwd(), file);
      const fileDetail = tokenCounts.files.find(f => f.path === relativePath);
      const tokenInfo = fileDetail ? ` (~${fileDetail.tokens} tokens)` : '';
      console.log(`  ${chalk.green('✓')} ${relativePath}${chalk.gray(tokenInfo)}`);
    });
  }
  
  if (hooks.length === 0) {
    console.log(chalk.gray('No context hooks'));
  } else {
    console.log(chalk.yellow(`\nContext hooks (${hooks.length}):`));
    hooks.forEach(hook => {
      console.log(`  ${chalk.green('✓')} ${hook.name}`);
    });
  }
  
  console.log(chalk.cyan('-----------------------------\n'));
}

// Helper function to display token counts
function displayContextTokens(contextManager, conversationId) {
  const tokenCounts = contextManager.getContextTokenCounts(conversationId);
  
  console.log(chalk.cyan('\n--- Context Token Counts ---'));
  
  if (tokenCounts.files.length === 0) {
    console.log(chalk.gray('No files in context'));
  } else {
    console.log(chalk.yellow(`Total tokens: ~${tokenCounts.totalTokens} (${tokenCounts.files.length} files)`));
    
    // Sort files by token count (highest first)
    const sortedFiles = [...tokenCounts.files].sort((a, b) => b.tokens - a.tokens);
    
    sortedFiles.forEach(file => {
      const sizeKB = (file.size / 1024).toFixed(1);
      console.log(`  ${chalk.green('•')} ${file.path}: ${chalk.yellow(`~${file.tokens} tokens`)} (${sizeKB} KB)`);
    });
  }
  
  console.log(chalk.cyan('---------------------------\n'));
}

// Main chat loop
async function startChat() {
  console.log(chalk.cyan('\n=== Ollama Chat with Memory ==='));
  console.log(chalk.yellow('Type /help for available commands'));
  
  // Initialize the chat session
  await chatSession.initialize();
  
  // Get the current conversation
  const currentConversation = chatSession.getCurrentConversation();
  
  // Display the current model
  console.log(chalk.green(`Using model: ${chatSession.settings.model || config.ollama.defaultModel}`));
  
  // Display system prompt if enabled
  if (config.settings.includeSystemPrompt) {
    console.log(chalk.gray(`System: ${config.settings.systemPrompt}`));
  }
  
  // Initialize tab completer
  const tabCompleter = new InquirerTabCompleter();
  
  // Main loop
  let chatActive = true;
  while (chatActive) {
    // Use tab completer for input with command completion
    const { userInput } = await tabCompleter.prompt({
      message: chalk.blue('You:'),
      prefix: ''
    });
    
    // Process GitHub commands with gh: prefix
    if (userInput.startsWith('gh:')) {
      const ghQuery = userInput.slice(3).trim();
      if (ghQuery) {
        try {
          console.log(chalk.gray(`Querying GitHub: ${ghQuery}`));
          const { execSync } = await import('child_process');
          
          // Handle specific GitHub queries
          if (ghQuery.startsWith('pr')) {
            // Format: gh:pr list or gh:pr view <number>
            const prCommand = `gh ${ghQuery}`;
            console.log(chalk.gray(`Executing: ${prCommand}`));
            const result = execSync(prCommand, { encoding: 'utf8' });
            console.log(result);
          } else {
            // Default to passing the command to gh CLI
            const result = execSync(`gh ${ghQuery}`, { encoding: 'utf8' });
            console.log(result);
          }
        } catch (error) {
          console.error(chalk.red(`Error executing GitHub command: ${error.message}`));
        }
      }
    }
    // Process bash commands with ! prefix
    else if (userInput.startsWith('!')) {
      const bashCommand = userInput.slice(1).trim();
      if (bashCommand) {
        try {
          console.log(chalk.gray(`Executing: ${bashCommand}`));
          const { execSync } = await import('child_process');
          const result = execSync(bashCommand, { encoding: 'utf8' });
          console.log(result);
        } catch (error) {
          console.error(chalk.red(`Error executing command: ${error.message}`));
        }
      }
    }
    // Process commands
    else if (userInput.startsWith('/')) {
      const parts = userInput.slice(1).split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ');
      
      switch (command) {
        case 'help':
          displayHelp();
          break;
          
        case 'history':
          displayConversationHistory(chatSession.getCurrentConversation());
          break;
          
        case 'new':
          const newId = chatSession.createNewConversation({
            title: args || 'New Conversation'
          });
          console.log(chalk.green(`Created new conversation with ID: ${newId}`));
          break;
          
        case 'list':
          const conversations = chatSession.getAllConversations();
          console.log(chalk.cyan('\n--- Available Conversations ---'));
          conversations.forEach(conv => {
            const isActive = conv.id === chatSession.activeConversationId;
            const marker = isActive ? chalk.green('*') : ' ';
            console.log(`${marker} ${chalk.yellow(conv.id)} - ${conv.metadata.title} (${conv.metadata.messageCount} messages)`);
          });
          console.log('');
          break;
          
        case 'switch':
          if (!args) {
            console.log(chalk.red('Please provide a conversation ID'));
            break;
          }
          
          const switched = chatSession.switchConversation(args);
          if (switched) {
            console.log(chalk.green(`Switched to conversation: ${args}`));
          } else {
            console.log(chalk.red(`Conversation not found: ${args}`));
          }
          break;
          
        case 'delete':
          if (!args) {
            console.log(chalk.red('Please provide a conversation ID'));
            break;
          }
          
          const deleted = chatSession.deleteConversation(args);
          if (deleted) {
            console.log(chalk.green(`Deleted conversation: ${args}`));
          } else {
            console.log(chalk.red(`Conversation not found: ${args}`));
          }
          break;
          
        case 'system':
          if (!args) {
            console.log(chalk.red('Please provide a system prompt'));
            break;
          }
          
          chatSession.updateSystemPrompt(args);
          console.log(chalk.green('System prompt updated'));
          break;
          
        case 'temp':
          if (!args || isNaN(parseFloat(args))) {
            console.log(chalk.red('Please provide a valid temperature value (0.0-1.0)'));
            break;
          }
          
          const temp = parseFloat(args);
          if (temp < 0 || temp > 1) {
            console.log(chalk.red('Temperature must be between 0.0 and 1.0'));
            break;
          }
          
          chatSession.updateSettings({ temperature: temp });
          console.log(chalk.green(`Temperature updated to ${temp}`));
          break;
          
        case 'model':
          if (!args) {
            console.log(chalk.red('Please provide a model name'));
            break;
          }
          
          chatSession.updateSettings({ model: args });
          console.log(chalk.green(`Model updated to ${args}`));
          break;
          
        case 'models':
          console.log(chalk.gray('Fetching available models...'));
          const modelResult = await chatSession.listModels();
          if (modelResult.success && modelResult.models) {
            console.log(chalk.cyan('\n--- Available Models ---'));
            modelResult.models.map(model => model.name).forEach(modelName => {
              const isActive = modelName === chatSession.settings.model;
              const marker = isActive ? chalk.green('*') : ' ';
              console.log(`${marker} ${chalk.yellow(modelName)}`);
            });
            console.log('');
          } else {
            console.log(chalk.red(`Error fetching models: ${modelResult.error || 'Unknown error'}`));
          }
          break;
          
        case 'context':
          if (!args) {
            displayContextHelp();
            break;
          }
          
          const contextParts = args.split(' ');
          const contextCommand = contextParts[0].toLowerCase();
          const contextArgs = contextParts.slice(1);
          
          const contextManager = chatSession.getContextManager();
          
          switch (contextCommand) {
            case 'help':
              displayContextHelp();
              break;
              
            case 'show':
              displayContextStatus(contextManager, chatSession.activeConversationId);
              break;
              
            case 'tokens':
              displayContextTokens(contextManager, chatSession.activeConversationId);
              break;
              
            case 'add':
              if (contextArgs.length === 0) {
                console.log(chalk.red('Please provide file(s) to add'));
                console.log(chalk.yellow('Usage: /context add <file1> [file2...]'));
                break;
              }
              
              console.log(chalk.gray('Adding files to context...'));
              const addResult = await contextManager.addFiles(chatSession.activeConversationId, contextArgs);
              
              if (addResult.success) {
                console.log(chalk.green(`Successfully added files to context`));
                console.log(chalk.gray(`Total files in context: ${addResult.totalFiles}`));
                
                // Display results
                addResult.results.forEach(result => {
                  if (result.success) {
                    if (result.isDirectory) {
                      console.log(`  ${chalk.green('✓')} ${result.file} (directory: ${result.filesAdded} files added, ${result.filesSkipped} skipped)`);
                    } else {
                      console.log(`  ${chalk.green('✓')} ${result.file}`);
                    }
                  } else {
                    console.log(`  ${chalk.red('✗')} ${result.file}: ${result.error}`);
                  }
                });
              } else {
                console.log(chalk.yellow('No files could be added:'));
                addResult.results.forEach(result => {
                  console.log(`  ${chalk.red('✗')} ${result.file}: ${result.error}`);
                });
              }
              break;
              
            case 'rm':
              if (contextArgs.length === 0) {
                console.log(chalk.red('Please provide file(s) to remove'));
                console.log(chalk.yellow('Usage: /context rm <file1> [file2...]'));
                break;
              }
              
              const removeResult = contextManager.removeFiles(chatSession.activeConversationId, contextArgs);
              
              if (removeResult.success) {
                console.log(chalk.green(`Successfully removed ${removeResult.results.filter(r => r.success).length} file(s) from context`));
                console.log(chalk.gray(`Total files in context: ${removeResult.totalFiles}`));
              } else {
                console.log(chalk.yellow('Some files could not be removed:'));
                removeResult.results.forEach(result => {
                  if (result.success) {
                    console.log(`  ${chalk.green('✓')} ${result.file}`);
                  } else {
                    console.log(`  ${chalk.red('✗')} ${result.file}: ${result.error}`);
                  }
                });
              }
              break;
              
            case 'clear':
              const clearResult = contextManager.clearFiles(chatSession.activeConversationId);
              if (clearResult.success) {
                console.log(chalk.green(`Cleared ${clearResult.clearedCount} file(s) from context`));
              } else {
                console.log(chalk.red('Error clearing context'));
              }
              break;
              
            case 'hooks':
              const hooks = contextManager.getHooks(chatSession.activeConversationId);
              if (hooks.length === 0) {
                console.log(chalk.gray('No context hooks defined'));
              } else {
                console.log(chalk.cyan('\n--- Context Hooks ---'));
                hooks.forEach(hook => {
                  console.log(`  ${chalk.green('✓')} ${hook.name}`);
                });
                console.log('');
              }
              break;
              
            default:
              console.log(chalk.red(`Unknown context command: ${contextCommand}`));
              displayContextHelp();
          }
          break;
          
        case 'exit':
          console.log(chalk.green('Goodbye!'));
          chatActive = false;
          break;
          
        case 'tools':
          const toolManager = chatSession.getToolManager();
          const tools = toolManager.getAllTools();
          
          console.log(chalk.cyan('\n--- Available Tools ---'));
          if (tools.length === 0) {
            console.log(chalk.gray('No tools available'));
          } else {
            tools.forEach(tool => {
              console.log(`${chalk.yellow(tool.name)} - ${tool.description}`);
              console.log(chalk.gray(`  Keywords: ${tool.keywords.join(', ')}`));
            });
          }
          console.log('');
          break;
          
        case 'usage':
          const tokenUsage = chatSession.getTokenUsage();
          console.log(chalk.cyan('\n--- Token Usage Statistics ---'));
          console.log(chalk.yellow(`Prompt tokens: ${tokenUsage.promptTokens.toLocaleString()}`));
          console.log(chalk.yellow(`Completion tokens: ${tokenUsage.completionTokens.toLocaleString()}`));
          console.log(chalk.yellow(`Total tokens: ${tokenUsage.totalTokens.toLocaleString()}`));
          console.log(chalk.cyan('------------------------------\n'));
          break;
          
        default:
          console.log(chalk.red(`Unknown command: ${command}`));
          console.log(chalk.yellow('Type /help for available commands'));
      }
    } else if (userInput.trim()) {
      // Send message to Ollama (tool processing is handled inside ChatSession.sendMessage)
      console.log(chalk.gray('Assistant is thinking...'));
      
      const response = await chatSession.sendMessage(userInput);
      
      if (response.success) {
        if (response.isToolResult) {
          console.log(chalk.green(`\nAssistant (using ${response.toolResult.toolName}):`));
          console.log(response.toolResult.result);
        } else {
          console.log(chalk.green(`Assistant: ${response.message.content}`));
        }
      } else {
        console.log(chalk.red(`Error: ${response.error}`));
      }
    }
  }
  
  // Clean up
  await chatSession.close();
}

// Start the chat
startChat().catch(error => {
  console.error(chalk.red(`Fatal error: ${error.message}`));
  process.exit(1);
});
