// src/api/OllamaClient.js
import axios from 'axios';

/**
 * Client for interacting with the Ollama API
 */
export class OllamaClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434/api';
    this.defaultModel = options.defaultModel || 'llama3.2:latest';
    this.defaultParams = {
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      stream: false,
      ...options.defaultParams
    };
  }

  /**
   * Send a prompt to Ollama and get a response
   * @param {String} prompt - The prompt to send
   * @param {Object} options - Options for the request
   * @returns {Promise<Object>} - The response from Ollama
   */
  async generateCompletion(prompt, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const params = { ...this.defaultParams, ...options };

      const response = await axios.post(`${this.baseUrl}/generate`, {
        model,
        prompt,
        ...params
      });

      return {
        success: true,
        response: response.data.response,
        rawResponse: response.data
      };
    } catch (error) {
      console.error('Error generating completion:', error.message);
      return {
        success: false,
        error: error.message,
        response: null,
        rawResponse: error.response?.data
      };
    }
  }

  /**
   * Get a list of available models
   * @returns {Promise<Object>} - The list of models
   */
  async listModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/tags`);
      return {
        success: true,
        models: response.data.models
      };
    } catch (error) {
      console.error('Error listing models:', error.message);
      return {
        success: false,
        error: error.message,
        models: []
      };
    }
  }

  /**
   * Generate a chat completion with conversation history
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} options - Options for the request
   * @returns {Promise<Object>} - The response from Ollama
   */
  async generateChatCompletion(messages, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const params = { ...this.defaultParams, ...options };

      // Format messages into a chat prompt
      const formattedMessages = messages.map(msg => {
        const role = msg.role === 'assistant' ? 'Assistant' :
          msg.role === 'user' ? 'User' :
            msg.role === 'system' ? 'System' : msg.role;
        return `${role}: ${msg.content}`;
      }).join('\n\n');

      // Add a final prompt for the assistant to respond
      const prompt = `${formattedMessages}\n\nAssistant:`;

      console.log('Sending chat prompt:', { prompt, model, params, baseUrl: this.baseUrl });

      const response = await axios.post(`${this.baseUrl}/generate`, {
        model,
        prompt,
        ...params
      });

      return {
        success: true,
        response: response.data.response,
        rawResponse: response.data
      };
    } catch (error) {
      console.error('Error generating chat completion:', error.message);
      return {
        success: false,
        error: error.message,
        response: null,
        rawResponse: error.response?.data
      };
    }
  }
}

export default OllamaClient;
