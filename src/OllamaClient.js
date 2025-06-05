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
    
    // Token usage tracking
    this.tokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
  }

  /**
   * Get current token usage statistics
   * @returns {Object} - Token usage statistics
   */
  getTokenUsage() {
    return { ...this.tokenUsage };
  }
  
  /**
   * Reset token usage statistics
   */
  resetTokenUsage() {
    this.tokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
  }

  /**
   * Check if Ollama server is running
   * @returns {Promise<boolean>} - True if server is running
   */
  async isServerRunning() {
    try {
      await axios.get(`${this.baseUrl}/version`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Find a fallback model if the requested one isn't available
   * @param {string} requestedModel - The model that was requested
   * @returns {Promise<string|null>} - Available model name or null if none found
   */
  async findFallbackModel(requestedModel) {
    try {
      const result = await this.listModels();
      if (result.success && result.models && result.models.length > 0) {
        // Return the first available model
        return result.models[0].name;
      }
      return null;
    } catch (error) {
      return null;
    }
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

      // Update token usage
      if (response.data.prompt_eval_count !== undefined && 
          response.data.eval_count !== undefined) {
        this.tokenUsage.promptTokens += response.data.prompt_eval_count;
        this.tokenUsage.completionTokens += response.data.eval_count;
        this.tokenUsage.totalTokens += (response.data.prompt_eval_count + response.data.eval_count);
      }

      return {
        success: true,
        response: response.data.response,
        rawResponse: response.data,
        tokenUsage: {
          promptTokens: response.data.prompt_eval_count,
          completionTokens: response.data.eval_count,
          totalTokens: response.data.prompt_eval_count + response.data.eval_count
        }
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
      // Check if Ollama server is running
      const isRunning = await this.isServerRunning();
      if (!isRunning) {
        return {
          success: false,
          error: "Ollama server is not running. Please start the Ollama server and try again.",
          response: null
        };
      }

      const model = options.model || this.defaultModel;
      const params = { ...this.defaultParams, ...options };

      // Add tool information to system context if tools are available
      let enhancedMessages = [...messages];
      if (options.availableTools && options.availableTools.length > 0) {
        const toolDescriptions = options.availableTools.map(tool => 
          `- ${tool.name}: ${tool.description} (Keywords: ${tool.keywords.join(', ')})`
        ).join('\n');
        
        const toolSystemPrompt = `\n\nAvailable Tools:\n${toolDescriptions}\n\nIf the user's request can be fulfilled by one of these tools, respond with: "I'll use the [tool_name] tool to help you with that." Otherwise, provide a helpful response.`;
        
        // Find system message and enhance it, or add a new one
        const systemMessageIndex = enhancedMessages.findIndex(msg => msg.role === 'system');
        if (systemMessageIndex >= 0) {
          enhancedMessages[systemMessageIndex] = {
            ...enhancedMessages[systemMessageIndex],
            content: enhancedMessages[systemMessageIndex].content + toolSystemPrompt
          };
        } else {
          enhancedMessages.unshift({
            role: 'system',
            content: 'You are a helpful assistant.' + toolSystemPrompt
          });
        }
      }

      // Format messages into a chat prompt
      const formattedMessages = enhancedMessages.map(msg => {
        const role = msg.role === 'assistant' ? 'Assistant' :
          msg.role === 'user' ? 'User' :
            msg.role === 'system' ? 'System' : msg.role;
        return `${role}: ${msg.content}`;
      }).join('\n\n');

      // Add a final prompt for the assistant to respond
      const prompt = `${formattedMessages}\n\nAssistant:`;

      // Only log a portion of the prompt to avoid console clutter
      const truncatedPrompt = prompt.length > 200 ? prompt.substring(0, 200) + '...' : prompt;
      console.log('Sending chat prompt:', { 
        prompt: truncatedPrompt, 
        model, 
        params, 
        baseUrl: this.baseUrl 
      });
      
      try {
        const response = await axios.post(`${this.baseUrl}/generate`, {
          model,
          prompt,
          ...params
        });
        
        // Update token usage
        if (response.data.prompt_eval_count !== undefined && 
            response.data.eval_count !== undefined) {
          this.tokenUsage.promptTokens += response.data.prompt_eval_count;
          this.tokenUsage.completionTokens += response.data.eval_count;
          this.tokenUsage.totalTokens += (response.data.prompt_eval_count + response.data.eval_count);
        }

        return {
          success: true,
          response: response.data.response,
          rawResponse: response.data,
          tokenUsage: {
            promptTokens: response.data.prompt_eval_count,
            completionTokens: response.data.eval_count,
            totalTokens: response.data.prompt_eval_count + response.data.eval_count
          }
        };
      } catch (error) {
        // Check if error is due to model not found
        if (error.response && error.response.status === 404) {
          // Try to find a fallback model
          const fallbackModel = await this.findFallbackModel(model);
          
          if (fallbackModel) {
            console.log(`Model ${model} not found. Falling back to ${fallbackModel}`);
            
            // Try again with fallback model
            const fallbackResponse = await axios.post(`${this.baseUrl}/generate`, {
              model: fallbackModel,
              prompt,
              ...params
            });
            
            // Update token usage for fallback model
            if (fallbackResponse.data.prompt_eval_count !== undefined && 
                fallbackResponse.data.eval_count !== undefined) {
              this.tokenUsage.promptTokens += fallbackResponse.data.prompt_eval_count;
              this.tokenUsage.completionTokens += fallbackResponse.data.eval_count;
              this.tokenUsage.totalTokens += (fallbackResponse.data.prompt_eval_count + fallbackResponse.data.eval_count);
            }
            
            return {
              success: true,
              response: fallbackResponse.data.response,
              rawResponse: fallbackResponse.data,
              usedFallbackModel: true,
              fallbackModel,
              tokenUsage: {
                promptTokens: fallbackResponse.data.prompt_eval_count,
                completionTokens: fallbackResponse.data.eval_count,
                totalTokens: fallbackResponse.data.prompt_eval_count + fallbackResponse.data.eval_count
              }
            };
          } else {
            return {
              success: false,
              error: `Model '${model}' not found and no fallback models are available. Please download a model using 'ollama pull <model_name>'`,
              response: null
            };
          }
        }
        
        throw error; // Re-throw if it's not a 404 error
      }
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