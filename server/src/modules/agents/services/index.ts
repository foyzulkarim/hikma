// LLM service
export {
  OpenAILLMService,
  llmService,
  LLMTokenEstimator,
} from './llm-service.js';

// Intent classifier
export {
  IntentClassificationService,
  intentClassifier,
} from './intent-classifier.js';

// Pipeline manager
export {
  PipelineManager,
  pipelineManager,
} from './pipeline-manager.js';

// Agent service
export {
  AgentService,
  agentService,
} from './agent-service.js';

// Tools
export {
  VectorSearchTool,
  vectorSearchTool,
} from '../tools/vector-search-tool.js';

// Agent orchestrator
export class AgentOrchestrator {
  constructor(
    private agentService = agentService,
    private llmService = llmService,
    private intentClassifier = intentClassifier,
    private pipelineManager = pipelineManager
  ) {}

  // Initialize all agent services
  async initialize(): Promise<void> {
    try {
      // Test LLM service
      const isLLMReady = await this.llmService.testConnection();
      if (!isLLMReady) {
        throw new Error('LLM service not ready');
      }

      // Warm up services
      await this.llmService.warmup();

      console.log('Agent orchestrator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize agent orchestrator:', error);
      throw error;
    }
  }

  // Cleanup all services
  async cleanup(): Promise<void> {
    try {
      // No specific cleanup needed for current services
      console.log('Agent orchestrator cleaned up successfully');
    } catch (error) {
      console.error('Failed to cleanup agent orchestrator:', error);
      throw error;
    }
  }

  // Health check for all services
  async healthCheck(): Promise<{
    agent: any;
    llm: boolean;
    overall: boolean;
  }> {
    try {
      const agentHealth = await this.agentService.healthCheck();
      const llmHealth = await this.llmService.testConnection();

      return {
        agent: agentHealth,
        llm: llmHealth,
        overall: agentHealth.status === 'healthy' && llmHealth,
      };
    } catch (error) {
      return {
        agent: { status: 'unhealthy' },
        llm: false,
        overall: false,
      };
    }
  }

  // Get service instances
  getAgentService() {
    return this.agentService;
  }

  getLLMService() {
    return this.llmService;
  }

  getIntentClassifier() {
    return this.intentClassifier;
  }

  getPipelineManager() {
    return this.pipelineManager;
  }
}

// Export singleton instance
export const agentOrchestrator = new AgentOrchestrator();

// Export all types
export * from '@/core/types/agents.js';

