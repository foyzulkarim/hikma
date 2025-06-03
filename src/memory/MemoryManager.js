// src/memory/MemoryManager.js
import { nanoid } from 'nanoid';

/**
 * Base class for conversation memory management
 */
export class MemoryManager {
  constructor(options = {}) {
    this.options = {
      maxMessages: 100,
      summarizeThreshold: 50,
      ...options
    };
    
    this.conversations = new Map();
    this.activeConversationId = null;
  }
  
  /**
   * Create a new conversation
   * @param {Object} metadata - Optional metadata for the conversation
   * @returns {String} - The ID of the new conversation
   */
  createConversation(metadata = {}) {
    const id = nanoid();
    const conversation = {
      id,
      messages: [],
      metadata: {
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        messageCount: 0,
        ...metadata
      },
      summary: null
    };
    
    this.conversations.set(id, conversation);
    this.activeConversationId = id;
    return id;
  }
  
  /**
   * Set the active conversation
   * @param {String} conversationId - The ID of the conversation to set as active
   * @returns {Boolean} - Whether the operation was successful
   */
  setActiveConversation(conversationId) {
    if (!this.conversations.has(conversationId)) {
      return false;
    }
    
    this.activeConversationId = conversationId;
    return true;
  }
  
  /**
   * Get the active conversation
   * @returns {Object|null} - The active conversation or null if none is active
   */
  getActiveConversation() {
    if (!this.activeConversationId) {
      return null;
    }
    
    return this.conversations.get(this.activeConversationId);
  }
  
  /**
   * Add a message to a conversation
   * @param {String} role - The role of the message sender (user, assistant, system)
   * @param {String} content - The content of the message
   * @param {String} conversationId - Optional conversation ID (uses active conversation if not provided)
   * @returns {Object|null} - The added message or null if operation failed
   */
  addMessage(role, content, conversationId = null) {
    const targetId = conversationId || this.activeConversationId;
    
    if (!targetId || !this.conversations.has(targetId)) {
      return null;
    }
    
    const conversation = this.conversations.get(targetId);
    const message = {
      id: nanoid(),
      role,
      content,
      timestamp: new Date().toISOString()
    };
    
    conversation.messages.push(message);
    conversation.metadata.messageCount += 1;
    conversation.metadata.lastUpdated = new Date().toISOString();
    
    // Check if we need to summarize based on threshold
    if (conversation.messages.length > this.options.summarizeThreshold) {
      this.summarizeConversation(targetId);
    }
    
    // Enforce max messages limit if needed
    if (this.options.maxMessages > 0 && conversation.messages.length > this.options.maxMessages) {
      // Remove oldest messages but keep the summary
      const excessCount = conversation.messages.length - this.options.maxMessages;
      conversation.messages.splice(0, excessCount);
    }
    
    return message;
  }
  
  /**
   * Get all messages from a conversation
   * @param {String} conversationId - Optional conversation ID (uses active conversation if not provided)
   * @returns {Array|null} - Array of messages or null if conversation not found
   */
  getMessages(conversationId = null) {
    const targetId = conversationId || this.activeConversationId;
    
    if (!targetId || !this.conversations.has(targetId)) {
      return null;
    }
    
    return [...this.conversations.get(targetId).messages];
  }
  
  /**
   * Get formatted conversation history for LLM context
   * @param {String} conversationId - Optional conversation ID (uses active conversation if not provided)
   * @returns {String|null} - Formatted conversation history or null if conversation not found
   */
  getFormattedHistory(conversationId = null) {
    const messages = this.getMessages(conversationId);
    
    if (!messages) {
      return null;
    }
    
    const conversation = this.conversations.get(conversationId || this.activeConversationId);
    let result = '';
    
    // Add summary if available
    if (conversation.summary) {
      result += `[Conversation Summary: ${conversation.summary}]\n\n`;
    }
    
    // Format each message
    messages.forEach(message => {
      const roleLabel = message.role.charAt(0).toUpperCase() + message.role.slice(1);
      result += `${roleLabel}: ${message.content}\n\n`;
    });
    
    return result;
  }
  
  /**
   * Summarize a conversation (placeholder - to be implemented by subclasses)
   * @param {String} conversationId - The ID of the conversation to summarize
   */
  summarizeConversation(conversationId) {
    // Base implementation does nothing - subclasses should override
    console.log(`Summarization requested for conversation ${conversationId}`);
  }
  
  /**
   * Delete a conversation
   * @param {String} conversationId - The ID of the conversation to delete
   * @returns {Boolean} - Whether the operation was successful
   */
  deleteConversation(conversationId) {
    if (!this.conversations.has(conversationId)) {
      return false;
    }
    
    this.conversations.delete(conversationId);
    
    // Reset active conversation if it was the deleted one
    if (this.activeConversationId === conversationId) {
      this.activeConversationId = null;
    }
    
    return true;
  }
  
  /**
   * Get all conversations
   * @returns {Array} - Array of all conversations
   */
  getAllConversations() {
    return Array.from(this.conversations.values());
  }
  
  /**
   * Clear all conversations
   */
  clearAllConversations() {
    this.conversations.clear();
    this.activeConversationId = null;
  }
}

export default MemoryManager;
