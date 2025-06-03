// src/index.js
import { ChatSession } from './chat/ChatSession.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Get directory name in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '..', 'config', 'config.json');

// Default configuration
const defaultConfig = {
  ollama: {
    baseUrl: 'http://localhost:11434/api',
    defaultModel: 'llama3'
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
    maxTokens: 2048
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
  settings: config.settings,
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
  console.log(chalk.yellow('/exit') + ' - Exit the chat');
  console.log('');
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
  console.log(chalk.green(`Using model: ${config.ollama.defaultModel}`));
  
  // Display system prompt if enabled
  if (config.settings.includeSystemPrompt) {
    console.log(chalk.gray(`System: ${config.settings.systemPrompt}`));
  }
  
  // Main loop
  let chatActive = true;
  while (chatActive) {
    const { userInput } = await inquirer.prompt({
      type: 'input',
      name: 'userInput',
      message: chalk.blue('You:'),
      prefix: ''
    });
    
    // Process commands
    if (userInput.startsWith('/')) {
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
          
        case 'exit':
          console.log(chalk.green('Goodbye!'));
          chatActive = false;
          break;
          
        default:
          console.log(chalk.red(`Unknown command: ${command}`));
          console.log(chalk.yellow('Type /help for available commands'));
      }
    } else if (userInput.trim()) {
      // Send message to Ollama
      console.log(chalk.gray('Assistant is thinking...'));
      
      const response = await chatSession.sendMessage(userInput);
      
      if (response.success) {
        console.log(chalk.green(`Assistant: ${response.message.content}`));
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
