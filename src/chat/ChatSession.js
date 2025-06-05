// src/chat/ChatSession.js
import { MemoryManager } from '../memory/MemoryManager.js';
import { SqliteMemoryManager } from '../memory/SqliteMemoryManager.js';
import { OllamaClient } from '../OllamaClient.js';
import { ContextManager } from '../context/ContextManager.js';
import { ToolManager } from '../tools/ToolManager.js';
import EventEmitter from 'events';

/**
 * ChatSession manages the interaction between memory and the LLM
 */
export class ChatSession extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Initialize memory manager
    if (options.persistMemory) {
      this.memory = new SqliteMemoryManager(options.memoryOptions);
    } else {
      this.memory = new MemoryManager(options.memoryOptions);
    }
    
    // Initialize Ollama client
    this.ollama = new OllamaClient(options.ollamaOptions);
    
    // Initialize context manager
    this.context = new ContextManager();
    
    // Initialize tool manager
    this.tools = new ToolManager();
    
    // Session settings
    this.settings = {
      includeSystemPrompt: true,
      systemPrompt: "You are a helpful assistant. Respond concisely and accurately.",
      includeTimestamps: false,
      includeMessageIds: false,
      maxTokens: 2048,
      temperature: 0.7,
      ...options.settings
    };
    
    this.initialized = false;
    this.activeConversationId = null;
  }
  
  /**
   * Initialize the chat session
   */
  async initialize() {
    // Initialize memory manager if it's SQLite
    if (this.memory instanceof SqliteMemoryManager) {
      await this.memory.initialize();
    }
    
    // Create a new conversation if none exists
    if (this.memory.getAllConversations().length === 0) {
      this.activeConversationId = this.memory.createConversation({
        title: "New Conversation",
        model: this.settings.model || "llama3"
      });
      
      // Add system prompt if enabled
      if (this.settings.includeSystemPrompt && this.settings.systemPrompt) {
        this.memory.addMessage('system', this.settings.systemPrompt, this.activeConversationId);
      }
    } else {
      // Use the most recent conversation
      const conversations = this.memory.getAllConversations();
      const mostRecent = conversations.reduce((latest, current) => {
        const latestDate = new Date(latest.metadata.lastUpdated);
        const currentDate = new Date(current.metadata.lastUpdated);
        return currentDate > latestDate ? current : latest;
      }, conversations[0]);
      
      this.activeConversationId = mostRecent.id;
      this.memory.setActiveConversation(this.activeConversationId);
    }
    
    this.initialized = true;
    this.emit('initialized', { conversationId: this.activeConversationId });
    return true;
  }
  
  /**
   * Send a message and get a response
   * @param {String} message - The user message
   * @returns {Promise<Object>} - The response object
   */
  async sendMessage(message) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check if this is a tool command
    const toolResult = await this.processToolCommand(message);
    if (toolResult && toolResult.success) {
      // Add user message to memory
      const userMessage = this.memory.addMessage('user', message, this.activeConversationId);
      this.emit('messageSent', { message: userMessage });
      
      // Add tool result as assistant message
      const assistantMessage = this.memory.addMessage(
        'assistant', 
        `[Tool: ${toolResult.toolName}]\n\n${toolResult.result}`, 
        this.activeConversationId
      );
      this.emit('responseReceived', { message: assistantMessage });
      
      return {
        success: true,
        message: assistantMessage,
        isToolResult: true,
        toolResult
      };
    }
    
    // Get context content and prepend to message if available
    const contextContent = await this.context.getFullContext(this.activeConversationId);
    const messageWithContext = contextContent ? contextContent + message : message;
    
    // Add user message to memory (original message without context)
    const userMessage = this.memory.addMessage('user', message, this.activeConversationId);
    this.emit('messageSent', { message: userMessage });
    
    // Get conversation history
    const messages = this.memory.getMessages(this.activeConversationId);
    
    // For the last message (user's message), replace with context-enriched version
    const messagesWithContext = [...messages];
    if (messagesWithContext.length > 0 && messagesWithContext[messagesWithContext.length - 1].role === 'user') {
      messagesWithContext[messagesWithContext.length - 1] = {
        ...messagesWithContext[messagesWithContext.length - 1],
        content: messageWithContext
      };
    }
    
    // Generate response from Ollama
    const result = await this.ollama.generateChatCompletion(messagesWithContext, {
      model: this.settings.model,
      temperature: this.settings.temperature,
      max_tokens: this.settings.maxTokens,
      availableTools: this.tools.getAllTools()
    });
    
    if (result.success) {
      // Add assistant response to memory
      const assistantMessage = this.memory.addMessage('assistant', result.response, this.activeConversationId);
      this.emit('responseReceived', { message: assistantMessage });
      
      return {
        success: true,
        message: assistantMessage,
        rawResponse: result.rawResponse
      };
    } else {
      this.emit('error', { error: result.error });
      
      return {
        success: false,
        error: result.error
      };
    }
  }
  
  /**
   * Create a new conversation
   * @param {Object} metadata - Optional metadata for the conversation
   * @returns {String} - The ID of the new conversation
   */
  createNewConversation(metadata = {}) {
    const id = this.memory.createConversation({
      title: metadata.title || "New Conversation",
      model: metadata.model || this.settings.model || "llama3",
      ...metadata
    });
    
    this.activeConversationId = id;
    
    // Add system prompt if enabled
    if (this.settings.includeSystemPrompt && this.settings.systemPrompt) {
      this.memory.addMessage('system', this.settings.systemPrompt, id);
    }
    
    this.emit('conversationCreated', { conversationId: id });
    return id;
  }
  
  /**
   * Switch to a different conversation
   * @param {String} conversationId - The ID of the conversation to switch to
   * @returns {Boolean} - Whether the operation was successful
   */
  switchConversation(conversationId) {
    const result = this.memory.setActiveConversation(conversationId);
    
    if (result) {
      this.activeConversationId = conversationId;
      this.emit('conversationSwitched', { conversationId });
    }
    
    return result;
  }
  
  /**
   * Get the current conversation
   * @returns {Object|null} - The current conversation or null if none is active
   */
  getCurrentConversation() {
    return this.memory.getActiveConversation();
  }
  
  /**
   * Get all conversations
   * @returns {Array} - Array of all conversations
   */
  getAllConversations() {
    return this.memory.getAllConversations();
  }
  
  /**
   * Delete a conversation
   * @param {String} conversationId - The ID of the conversation to delete
   * @returns {Boolean} - Whether the operation was successful
   */
  deleteConversation(conversationId) {
    const result = this.memory.deleteConversation(conversationId);
    
    if (result) {
      // Clean up context for this conversation
      this.context.cleanupConversation(conversationId);
      
      this.emit('conversationDeleted', { conversationId });
      
      // If we deleted the active conversation, create a new one
      if (this.activeConversationId === conversationId) {
        this.createNewConversation();
      }
    }
    
    return result;
  }
  
  /**
   * Update system prompt
   * @param {String} systemPrompt - The new system prompt
   * @returns {Boolean} - Whether the operation was successful
   */
  updateSystemPrompt(systemPrompt) {
    this.settings.systemPrompt = systemPrompt;
    
    // Find and update the system message in the current conversation
    const messages = this.memory.getMessages(this.activeConversationId);
    const systemMessage = messages.find(msg => msg.role === 'system');
    
    if (systemMessage) {
      // Remove old system message
      // Note: This is a simplification. In a real implementation, you'd need a method to update messages
      const conversation = this.memory.getActiveConversation();
      conversation.messages = conversation.messages.filter(msg => msg.id !== systemMessage.id);
      
      // Add new system message
      this.memory.addMessage('system', systemPrompt, this.activeConversationId);
    } else if (this.settings.includeSystemPrompt) {
      // Add system message if it doesn't exist
      this.memory.addMessage('system', systemPrompt, this.activeConversationId);
    }
    
    return true;
  }
  
  /**
   * Update chat settings
   * @param {Object} settings - The new settings
   */
  updateSettings(settings) {
    this.settings = {
      ...this.settings,
      ...settings
    };
    
    this.emit('settingsUpdated', { settings: this.settings });
  }
  
  /**
   * List available models from Ollama
   * @returns {Promise<Object>} - Object containing success status and models array
   */
  async listModels() {
    return await this.ollama.listModels();
  }

  /**
   * Close the chat session and clean up resources
   */
  async close() {
    if (this.memory instanceof SqliteMemoryManager) {
      this.memory.close();
    }
    
    this.emit('closed');
  }

  /**
   * Get the context manager
   * @returns {ContextManager} - The context manager instance
   */
  getContextManager() {
    return this.context;
  }
  
  /**
   * Get token usage statistics
   * @returns {Object} - Token usage statistics
   */
  getTokenUsage() {
    return this.ollama.getTokenUsage();
  }
  
  /**
   * Reset token usage statistics
   */
  resetTokenUsage() {
    this.ollama.resetTokenUsage();
  }
  
  /**
   * Get the tool manager
   * @returns {ToolManager} - The tool manager instance
   */
  getToolManager() {
    return this.tools;
  }
  
  /**
   * Process a message to check if it should be handled by a tool
   * @param {String} message - The user message
   * @returns {Promise<Object|null>} - Tool execution result or null if no tool matched
   */
  async processToolCommand(message) {
    return await this.tools.executeToolFromPrompt(message);
  }
}

export default ChatSession;
