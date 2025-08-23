// Agent intent types
export enum AgentIntent {
  CODE_EXPLANATION = 'CODE_EXPLANATION',
  CODE_SEARCH = 'CODE_SEARCH',
  DOCUMENTATION_SEARCH = 'DOCUMENTATION_SEARCH',
  COMMIT_ANALYSIS = 'COMMIT_ANALYSIS',
  GENERAL_QUERY = 'GENERAL_QUERY',
  UNKNOWN = 'UNKNOWN',
}

// Agent pipeline types
export enum PipelineType {
  SEARCH_AND_ANSWER = 'SEARCH_AND_ANSWER',
  CODE_ANALYSIS = 'CODE_ANALYSIS',
  DOCUMENTATION_LOOKUP = 'DOCUMENTATION_LOOKUP',
  COMMIT_SUMMARY = 'COMMIT_SUMMARY',
  GENERAL_RAG = 'GENERAL_RAG',
}

// Tool types
export enum ToolType {
  VECTOR_SEARCH = 'VECTOR_SEARCH',
  CODE_SEARCH = 'CODE_SEARCH',
  GIT_OPERATIONS = 'GIT_OPERATIONS',
  TEXT_GENERATION = 'TEXT_GENERATION',
  SUMMARIZATION = 'SUMMARIZATION',
  CLASSIFICATION = 'CLASSIFICATION',
}

// Agent query interface
export interface AgentQuery {
  id: string;
  query: string;
  projectId?: string;
  userId?: string;
  sessionId?: string;
  context?: AgentContext;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Agent context
export interface AgentContext {
  conversationHistory?: ConversationMessage[];
  currentFile?: string;
  currentDirectory?: string;
  selectedCode?: string;
  userPreferences?: UserPreferences;
  projectContext?: ProjectContext;
}

// Conversation message
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// User preferences
export interface UserPreferences {
  language?: string;
  responseStyle?: 'concise' | 'detailed' | 'technical';
  includeCodeExamples?: boolean;
  includeReferences?: boolean;
  maxResponseLength?: number;
}

// Project context
export interface ProjectContext {
  id: string;
  name: string;
  description?: string;
  primaryLanguage?: string;
  frameworks?: string[];
  repositories?: string[];
  documentation?: string[];
}

// Agent response interface
export interface AgentResponse {
  id: string;
  queryId: string;
  intent: AgentIntent;
  pipeline: PipelineType;
  response: string;
  sources: ResponseSource[];
  confidence: number;
  executionTime: number;
  toolCalls: ToolCall[];
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Response source
export interface ResponseSource {
  id: string;
  type: 'document' | 'code' | 'commit' | 'issue' | 'pr';
  title: string;
  content: string;
  path?: string;
  url?: string;
  score: number;
  metadata?: Record<string, any>;
}

// Tool call interface
export interface ToolCall {
  id: string;
  tool: ToolType;
  input: any;
  output: any;
  executionTime: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// Intent classification result
export interface IntentClassification {
  intent: AgentIntent;
  confidence: number;
  reasoning?: string;
  extractedEntities?: Record<string, any>;
}

// Pipeline execution context
export interface PipelineContext {
  query: AgentQuery;
  intent: AgentIntent;
  classification: IntentClassification;
  tools: Map<ToolType, ITool>;
  state: Map<string, any>;
  results: Map<string, any>;
}

// Pipeline step interface
export interface PipelineStep {
  id: string;
  name: string;
  description: string;
  tool: ToolType;
  input: (context: PipelineContext) => any;
  output: (result: any, context: PipelineContext) => void;
  condition?: (context: PipelineContext) => boolean;
  retryCount?: number;
  timeout?: number;
}

// Pipeline definition
export interface PipelineDefinition {
  id: string;
  type: PipelineType;
  name: string;
  description: string;
  steps: PipelineStep[];
  intent: AgentIntent;
  priority: number;
}

// Tool interface
export interface ITool {
  readonly type: ToolType;
  readonly name: string;
  readonly description: string;
  
  execute(input: any, context?: PipelineContext): Promise<any>;
  validate(input: any): boolean;
  getSchema(): any;
}

// Agent service interface
export interface IAgentService {
  // Query processing
  processQuery(query: AgentQuery): Promise<AgentResponse>;
  
  // Intent classification
  classifyIntent(query: string, context?: AgentContext): Promise<IntentClassification>;
  
  // Pipeline execution
  executePipeline(pipeline: PipelineType, context: PipelineContext): Promise<AgentResponse>;
  
  // Tool management
  registerTool(tool: ITool): void;
  getTool(type: ToolType): ITool | null;
  listTools(): ITool[];
  
  // Pipeline management
  registerPipeline(pipeline: PipelineDefinition): void;
  getPipeline(type: PipelineType): PipelineDefinition | null;
  listPipelines(): PipelineDefinition[];
}

// LLM service interface
export interface ILLMService {
  // Text generation
  generateText(prompt: string, options?: LLMOptions): Promise<string>;
  
  // Chat completion
  chatCompletion(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
  
  // Streaming
  streamText(prompt: string, options?: LLMOptions): AsyncIterable<string>;
  streamChat(messages: LLMMessage[], options?: LLMOptions): AsyncIterable<string>;
  
  // Function calling
  functionCall(messages: LLMMessage[], functions: LLMFunction[], options?: LLMOptions): Promise<LLMFunctionCall>;
  
  // Utilities
  estimateTokens(text: string): number;
  validateInput(text: string): boolean;
}

// LLM options
export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
  user?: string;
}

// LLM message
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  functionCall?: LLMFunctionCall;
}

// LLM function
export interface LLMFunction {
  name: string;
  description: string;
  parameters: any; // JSON schema
}

// LLM function call
export interface LLMFunctionCall {
  name: string;
  arguments: string;
}

// Agent metrics
export interface AgentMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageResponseTime: number;
  intentDistribution: Record<AgentIntent, number>;
  pipelineDistribution: Record<PipelineType, number>;
  toolUsage: Record<ToolType, number>;
  userSatisfaction?: number;
}

// Agent configuration
export interface AgentConfig {
  llm: {
    provider: 'openai' | 'ollama' | 'anthropic';
    model: string;
    temperature: number;
    maxTokens: number;
  };
  search: {
    maxResults: number;
    threshold: number;
    rerank: boolean;
  };
  response: {
    maxLength: number;
    includeReferences: boolean;
    includeSources: boolean;
  };
  performance: {
    timeout: number;
    retryCount: number;
    cacheResults: boolean;
  };
}

// Agent event types
export enum AgentEvent {
  QUERY_RECEIVED = 'QUERY_RECEIVED',
  INTENT_CLASSIFIED = 'INTENT_CLASSIFIED',
  PIPELINE_STARTED = 'PIPELINE_STARTED',
  TOOL_EXECUTED = 'TOOL_EXECUTED',
  PIPELINE_COMPLETED = 'PIPELINE_COMPLETED',
  RESPONSE_GENERATED = 'RESPONSE_GENERATED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
}

// Agent event data
export interface AgentEventData {
  queryId: string;
  event: AgentEvent;
  timestamp: Date;
  data?: any;
  error?: string;
}

