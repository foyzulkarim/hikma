import {
  PipelineType,
  PipelineDefinition,
  PipelineStep,
  PipelineContext,
  AgentIntent,
  AgentResponse,
  AgentQuery,
  ITool,
  ToolType,
  ToolCall,
  ResponseSource,
} from '@/core/types/agents';
import { vectorSearchTool } from '../tools/vector-search-tool';
import { llmService } from './llm-service';
import { logger } from '@/core/utils/logger';
import { ValidationError, ProcessingError } from '@/core/errors/app-error';

// Pipeline execution result
interface PipelineExecutionResult {
  success: boolean;
  response?: AgentResponse;
  error?: string;
  executionTime: number;
  toolCalls: ToolCall[];
}

// Pipeline manager service
export class PipelineManager {
  private pipelines: Map<PipelineType, PipelineDefinition> = new Map();
  private tools: Map<ToolType, ITool> = new Map();

  constructor() {
    this.initializeTools();
    this.initializePipelines();
  }

  // Initialize available tools
  private initializeTools(): void {
    this.registerTool(vectorSearchTool);
  }

  // Initialize default pipelines
  private initializePipelines(): void {
    // Search and Answer pipeline
    this.registerPipeline({
      id: 'search_and_answer',
      type: PipelineType.SEARCH_AND_ANSWER,
      name: 'Search and Answer',
      description: 'Search for relevant information and generate an answer',
      intent: AgentIntent.GENERAL_QUERY,
      priority: 1,
      steps: [
        {
          id: 'search',
          name: 'Vector Search',
          description: 'Search for relevant documents',
          tool: ToolType.VECTOR_SEARCH,
          input: (context) => ({
            query: context.query.query,
            projectId: context.query.projectId,
            topK: 5,
            rerank: true,
          }),
          output: (result, context) => {
            context.results.set('searchResults', result);
          },
        },
        {
          id: 'generate_answer',
          name: 'Generate Answer',
          description: 'Generate answer based on search results',
          tool: ToolType.TEXT_GENERATION,
          input: (context) => {
            const searchResults = context.results.get('searchResults');
            return {
              query: context.query.query,
              sources: searchResults?.results || [],
            };
          },
          output: (result, context) => {
            context.results.set('answer', result);
          },
        },
      ],
    });

    // Code Analysis pipeline
    this.registerPipeline({
      id: 'code_analysis',
      type: PipelineType.CODE_ANALYSIS,
      name: 'Code Analysis',
      description: 'Analyze and explain code',
      intent: AgentIntent.CODE_EXPLANATION,
      priority: 2,
      steps: [
        {
          id: 'search_code',
          name: 'Search Code',
          description: 'Search for relevant code',
          tool: ToolType.VECTOR_SEARCH,
          input: (context) => ({
            query: context.query.query,
            projectId: context.query.projectId,
            topK: 3,
            filters: { documentType: ['code'] },
            rerank: true,
          }),
          output: (result, context) => {
            context.results.set('codeResults', result);
          },
        },
        {
          id: 'explain_code',
          name: 'Explain Code',
          description: 'Generate code explanation',
          tool: ToolType.TEXT_GENERATION,
          input: (context) => {
            const codeResults = context.results.get('codeResults');
            return {
              query: context.query.query,
              sources: codeResults?.results || [],
              type: 'code_explanation',
            };
          },
          output: (result, context) => {
            context.results.set('explanation', result);
          },
        },
      ],
    });

    // Documentation Lookup pipeline
    this.registerPipeline({
      id: 'documentation_lookup',
      type: PipelineType.DOCUMENTATION_LOOKUP,
      name: 'Documentation Lookup',
      description: 'Find and present documentation',
      intent: AgentIntent.DOCUMENTATION_SEARCH,
      priority: 2,
      steps: [
        {
          id: 'search_docs',
          name: 'Search Documentation',
          description: 'Search for relevant documentation',
          tool: ToolType.VECTOR_SEARCH,
          input: (context) => ({
            query: context.query.query,
            projectId: context.query.projectId,
            topK: 5,
            filters: { documentType: ['documentation', 'readme', 'markdown'] },
            rerank: true,
          }),
          output: (result, context) => {
            context.results.set('docResults', result);
          },
        },
        {
          id: 'format_docs',
          name: 'Format Documentation',
          description: 'Format documentation response',
          tool: ToolType.TEXT_GENERATION,
          input: (context) => {
            const docResults = context.results.get('docResults');
            return {
              query: context.query.query,
              sources: docResults?.results || [],
              type: 'documentation',
            };
          },
          output: (result, context) => {
            context.results.set('formattedDocs', result);
          },
        },
      ],
    });

    // Commit Summary pipeline
    this.registerPipeline({
      id: 'commit_summary',
      type: PipelineType.COMMIT_SUMMARY,
      name: 'Commit Summary',
      description: 'Analyze and summarize commits',
      intent: AgentIntent.COMMIT_ANALYSIS,
      priority: 2,
      steps: [
        {
          id: 'search_commits',
          name: 'Search Commits',
          description: 'Search for relevant commits',
          tool: ToolType.VECTOR_SEARCH,
          input: (context) => ({
            query: context.query.query,
            projectId: context.query.projectId,
            topK: 10,
            filters: { documentType: ['commit'] },
            rerank: true,
          }),
          output: (result, context) => {
            context.results.set('commitResults', result);
          },
        },
        {
          id: 'summarize_commits',
          name: 'Summarize Commits',
          description: 'Generate commit summary',
          tool: ToolType.TEXT_GENERATION,
          input: (context) => {
            const commitResults = context.results.get('commitResults');
            return {
              query: context.query.query,
              sources: commitResults?.results || [],
              type: 'commit_analysis',
            };
          },
          output: (result, context) => {
            context.results.set('summary', result);
          },
        },
      ],
    });
  }

  // Tool management
  registerTool(tool: ITool): void {
    this.tools.set(tool.type, tool);
    logger.debug({ toolType: tool.type, toolName: tool.name }, 'Tool registered');
  }

  getTool(type: ToolType): ITool | null {
    return this.tools.get(type) || null;
  }

  listTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  // Pipeline management
  registerPipeline(pipeline: PipelineDefinition): void {
    this.pipelines.set(pipeline.type, pipeline);
    logger.debug({ pipelineType: pipeline.type, pipelineName: pipeline.name }, 'Pipeline registered');
  }

  getPipeline(type: PipelineType): PipelineDefinition | null {
    return this.pipelines.get(type) || null;
  }

  listPipelines(): PipelineDefinition[] {
    return Array.from(this.pipelines.values());
  }

  // Pipeline execution
  async executePipeline(
    pipelineType: PipelineType,
    query: AgentQuery,
    intent: AgentIntent
  ): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    const toolCalls: ToolCall[] = [];

    try {
      logger.info({
        pipelineType,
        queryId: query.id,
        intent,
      }, 'Starting pipeline execution');

      // Get pipeline definition
      const pipeline = this.getPipeline(pipelineType);
      if (!pipeline) {
        throw new ValidationError(`Pipeline not found: ${pipelineType}`);
      }

      // Create execution context
      const context: PipelineContext = {
        query,
        intent,
        classification: { intent, confidence: 1.0 },
        tools: this.tools,
        state: new Map(),
        results: new Map(),
      };

      // Execute pipeline steps
      for (const step of pipeline.steps) {
        try {
          // Check step condition
          if (step.condition && !step.condition(context)) {
            logger.debug({ stepId: step.id }, 'Step condition not met, skipping');
            continue;
          }

          // Execute step
          const stepResult = await this.executeStep(step, context);
          toolCalls.push(stepResult);

        } catch (error) {
          logger.error({
            stepId: step.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          }, 'Step execution failed');

          // Add failed tool call
          toolCalls.push({
            id: `${step.id}_${Date.now()}`,
            tool: step.tool,
            input: step.input(context),
            output: null,
            executionTime: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          // Continue with next step or fail pipeline based on step criticality
          if (step.retryCount === undefined || step.retryCount === 0) {
            throw error;
          }
        }
      }

      // Generate response
      const response = await this.generateResponse(context, toolCalls);

      const executionTime = Date.now() - startTime;

      logger.info({
        pipelineType,
        queryId: query.id,
        executionTime,
        toolCallCount: toolCalls.length,
      }, 'Pipeline execution completed');

      return {
        success: true,
        response,
        executionTime,
        toolCalls,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error({
        pipelineType,
        queryId: query.id,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Pipeline execution failed');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        toolCalls,
      };
    }
  }

  // Execute individual step
  private async executeStep(step: PipelineStep, context: PipelineContext): Promise<ToolCall> {
    const stepStartTime = Date.now();

    try {
      logger.debug({ stepId: step.id, toolType: step.tool }, 'Executing pipeline step');

      // Get tool
      const tool = this.getTool(step.tool);
      if (!tool) {
        throw new ValidationError(`Tool not found: ${step.tool}`);
      }

      // Prepare input
      const input = step.input(context);

      // Execute tool
      let output;
      if (step.tool === ToolType.TEXT_GENERATION) {
        output = await this.executeTextGeneration(input);
      } else {
        output = await tool.execute(input, context);
      }

      // Process output
      step.output(output, context);

      const executionTime = Date.now() - stepStartTime;

      const toolCall: ToolCall = {
        id: `${step.id}_${Date.now()}`,
        tool: step.tool,
        input,
        output,
        executionTime,
        success: true,
      };

      logger.debug({
        stepId: step.id,
        toolType: step.tool,
        executionTime,
      }, 'Step executed successfully');

      return toolCall;

    } catch (error) {
      const executionTime = Date.now() - stepStartTime;

      logger.error({
        stepId: step.id,
        toolType: step.tool,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Step execution failed');

      throw error;
    }
  }

  // Execute text generation (LLM calls)
  private async executeTextGeneration(input: any): Promise<string> {
    try {
      const { query, sources, type } = input;

      // Create appropriate prompt based on type
      let systemPrompt: string;
      let userPrompt: string;

      switch (type) {
        case 'code_explanation':
          systemPrompt = llmService.createSystemPrompt('code_assistant');
          userPrompt = this.createCodeExplanationPrompt(query, sources);
          break;

        case 'documentation':
          systemPrompt = llmService.createSystemPrompt('documentation_helper');
          userPrompt = this.createDocumentationPrompt(query, sources);
          break;

        case 'commit_analysis':
          systemPrompt = llmService.createSystemPrompt('commit_analyzer');
          userPrompt = this.createCommitAnalysisPrompt(query, sources);
          break;

        default:
          systemPrompt = llmService.createSystemPrompt('general_assistant');
          userPrompt = llmService.createUserPrompt(query, sources);
          break;
      }

      // Generate response
      const response = await llmService.chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        temperature: 0.7,
        maxTokens: 2000,
      });

      return response;

    } catch (error) {
      logger.error({
        input,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Text generation failed');

      throw new ProcessingError('Failed to generate text response');
    }
  }

  // Create specialized prompts
  private createCodeExplanationPrompt(query: string, sources: any[]): string {
    let prompt = `Please explain the following code based on the user's question: "${query}"\n\n`;

    if (sources.length > 0) {
      prompt += `Relevant code from the codebase:\n\n`;
      
      sources.forEach((source, index) => {
        prompt += `[${index + 1}] ${source.title}\n`;
        if (source.path) {
          prompt += `File: ${source.path}\n`;
        }
        prompt += `Code:\n\`\`\`\n${source.content}\n\`\`\`\n\n`;
      });
    }

    prompt += `Please provide a clear explanation of how this code works, including:
1. What the code does
2. How it works
3. Key components and their roles
4. Any important patterns or techniques used

Make your explanation clear and accessible.`;

    return prompt;
  }

  private createDocumentationPrompt(query: string, sources: any[]): string {
    let prompt = `Please help with this documentation question: "${query}"\n\n`;

    if (sources.length > 0) {
      prompt += `Relevant documentation:\n\n`;
      
      sources.forEach((source, index) => {
        prompt += `[${index + 1}] ${source.title}\n`;
        if (source.path) {
          prompt += `Source: ${source.path}\n`;
        }
        prompt += `Content:\n${source.content}\n\n`;
      });
    }

    prompt += `Please provide a comprehensive answer based on the documentation above. Include relevant examples and references where appropriate.`;

    return prompt;
  }

  private createCommitAnalysisPrompt(query: string, sources: any[]): string {
    let prompt = `Please analyze the following commits based on the question: "${query}"\n\n`;

    if (sources.length > 0) {
      prompt += `Recent commits:\n\n`;
      
      sources.forEach((source, index) => {
        prompt += `[${index + 1}] ${source.title}\n`;
        prompt += `Changes:\n${source.content}\n\n`;
      });
    }

    prompt += `Please provide an analysis that includes:
1. Summary of the changes
2. Impact of the changes
3. Patterns or trends in the commits
4. Any notable improvements or fixes

Focus on the most relevant and important changes.`;

    return prompt;
  }

  // Generate final response
  private async generateResponse(
    context: PipelineContext,
    toolCalls: ToolCall[]
  ): Promise<AgentResponse> {
    try {
      // Extract response content from results
      let responseContent = '';
      const sources: ResponseSource[] = [];

      // Get the final answer from results
      const answer = context.results.get('answer') || 
                    context.results.get('explanation') || 
                    context.results.get('formattedDocs') || 
                    context.results.get('summary') || 
                    'I was unable to generate a response.';

      responseContent = answer;

      // Extract sources from search results
      const searchResults = context.results.get('searchResults') || 
                           context.results.get('codeResults') || 
                           context.results.get('docResults') || 
                           context.results.get('commitResults');

      if (searchResults && searchResults.results) {
        searchResults.results.forEach((result: any) => {
          sources.push({
            id: result.id,
            type: result.type,
            title: result.title,
            content: result.content.substring(0, 500), // Truncate for response
            path: result.path,
            score: result.score,
            metadata: result.metadata,
          });
        });
      }

      // Calculate confidence based on search results and tool success
      const successfulToolCalls = toolCalls.filter(tc => tc.success).length;
      const confidence = Math.min(1.0, successfulToolCalls / toolCalls.length);

      const response: AgentResponse = {
        id: `response_${Date.now()}`,
        queryId: context.query.id,
        intent: context.intent,
        pipeline: this.getPipelineTypeFromIntent(context.intent),
        response: responseContent,
        sources,
        confidence,
        executionTime: 0, // Will be set by caller
        toolCalls,
        timestamp: new Date(),
      };

      return response;

    } catch (error) {
      logger.error({
        queryId: context.query.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to generate response');

      throw new ProcessingError('Failed to generate agent response');
    }
  }

  // Helper methods
  private getPipelineTypeFromIntent(intent: AgentIntent): PipelineType {
    const mapping: Record<AgentIntent, PipelineType> = {
      [AgentIntent.CODE_EXPLANATION]: PipelineType.CODE_ANALYSIS,
      [AgentIntent.CODE_SEARCH]: PipelineType.SEARCH_AND_ANSWER,
      [AgentIntent.DOCUMENTATION_SEARCH]: PipelineType.DOCUMENTATION_LOOKUP,
      [AgentIntent.COMMIT_ANALYSIS]: PipelineType.COMMIT_SUMMARY,
      [AgentIntent.GENERAL_QUERY]: PipelineType.GENERAL_RAG,
      [AgentIntent.UNKNOWN]: PipelineType.SEARCH_AND_ANSWER,
    };

    return mapping[intent] || PipelineType.SEARCH_AND_ANSWER;
  }

  // Pipeline validation
  validatePipeline(pipeline: PipelineDefinition): boolean {
    try {
      // Check required fields
      if (!pipeline.id || !pipeline.type || !pipeline.steps) {
        return false;
      }

      // Check steps
      for (const step of pipeline.steps) {
        if (!step.id || !step.tool || !step.input || !step.output) {
          return false;
        }

        // Check if tool exists
        if (!this.getTool(step.tool)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Pipeline analytics
  getPipelineMetrics(pipelineType: PipelineType): any {
    // This would return metrics about pipeline performance
    // For now, return basic info
    const pipeline = this.getPipeline(pipelineType);
    return {
      type: pipelineType,
      stepCount: pipeline?.steps.length || 0,
      toolsUsed: pipeline?.steps.map(s => s.tool) || [],
    };
  }
}

// Export singleton instance
export const pipelineManager = new PipelineManager();

