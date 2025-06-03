// src/memory/SqliteMemoryManager.js
import Database from 'better-sqlite3';
import { MemoryManager } from './MemoryManager.js';
import { nanoid } from 'nanoid';
import path from 'path';
import os from 'os';

/**
 * SQLite implementation of the MemoryManager for persistent storage
 */
export class SqliteMemoryManager extends MemoryManager {
  constructor(options = {}) {
    super(options);
    
    this.dbPath = options.dbPath || path.join(os.homedir(), '.ollama-chat-memory.db');
    this.db = null;
    this.initialized = false;
  }
  
  /**
   * Initialize the database
   */
  async initialize() {
    try {
      this.db = new Database(this.dbPath);
      
      // Create tables if they don't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          metadata TEXT,
          summary TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT,
          role TEXT,
          content TEXT,
          timestamp TEXT,
          FOREIGN KEY (conversation_id) REFERENCES conversations (id)
        );
      `);
      
      // Load existing conversations
      const rows = this.db.prepare('SELECT * FROM conversations').all();
      
      for (const row of rows) {
        const conversation = {
          id: row.id,
          messages: [],
          metadata: JSON.parse(row.metadata),
          summary: row.summary
        };
        
        // Load messages for this conversation
        const messages = this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC').all(row.id);
        
        for (const msg of messages) {
          conversation.messages.push({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
          });
        }
        
        this.conversations.set(row.id, conversation);
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize SQLite database:', error);
      return false;
    }
  }
  
  /**
   * Create a new conversation with SQLite persistence
   * @param {Object} metadata - Optional metadata for the conversation
   * @returns {String} - The ID of the new conversation
   */
  createConversation(metadata = {}) {
    const id = super.createConversation(metadata);
    
    if (this.initialized) {
      try {
        const conversation = this.conversations.get(id);
        
        this.db.prepare(`
          INSERT INTO conversations (id, metadata, summary, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          id,
          JSON.stringify(conversation.metadata),
          conversation.summary,
          conversation.metadata.created,
          conversation.metadata.lastUpdated
        );
      } catch (error) {
        console.error('Failed to persist conversation:', error);
      }
    }
    
    return id;
  }
  
  /**
   * Add a message to a conversation with SQLite persistence
   * @param {String} role - The role of the message sender (user, assistant, system)
   * @param {String} content - The content of the message
   * @param {String} conversationId - Optional conversation ID (uses active conversation if not provided)
   * @returns {Object|null} - The added message or null if operation failed
   */
  addMessage(role, content, conversationId = null) {
    const message = super.addMessage(role, content, conversationId);
    
    if (message && this.initialized) {
      try {
        const targetId = conversationId || this.activeConversationId;
        const conversation = this.conversations.get(targetId);
        
        // Insert message
        this.db.prepare(`
          INSERT INTO messages (id, conversation_id, role, content, timestamp)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          message.id,
          targetId,
          message.role,
          message.content,
          message.timestamp
        );
        
        // Update conversation metadata
        this.db.prepare(`
          UPDATE conversations
          SET metadata = ?, updated_at = ?
          WHERE id = ?
        `).run(
          JSON.stringify(conversation.metadata),
          conversation.metadata.lastUpdated,
          targetId
        );
      } catch (error) {
        console.error('Failed to persist message:', error);
      }
    }
    
    return message;
  }
  
  /**
   * Delete a conversation with SQLite persistence
   * @param {String} conversationId - The ID of the conversation to delete
   * @returns {Boolean} - Whether the operation was successful
   */
  deleteConversation(conversationId) {
    const result = super.deleteConversation(conversationId);
    
    if (result && this.initialized) {
      try {
        // Delete messages first due to foreign key constraint
        this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
        
        // Delete conversation
        this.db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId);
      } catch (error) {
        console.error('Failed to delete conversation from database:', error);
      }
    }
    
    return result;
  }
  
  /**
   * Update conversation summary with SQLite persistence
   * @param {String} conversationId - The ID of the conversation to update
   * @param {String} summary - The new summary
   * @returns {Boolean} - Whether the operation was successful
   */
  updateSummary(conversationId, summary) {
    if (!this.conversations.has(conversationId)) {
      return false;
    }
    
    const conversation = this.conversations.get(conversationId);
    conversation.summary = summary;
    
    if (this.initialized) {
      try {
        this.db.prepare(`
          UPDATE conversations
          SET summary = ?
          WHERE id = ?
        `).run(summary, conversationId);
      } catch (error) {
        console.error('Failed to update summary in database:', error);
      }
    }
    
    return true;
  }
  
  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

export default SqliteMemoryManager;
