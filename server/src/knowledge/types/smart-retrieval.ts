/**
 * Smart Retrieval Type Definitions
 * 
 * Comprehensive type definitions for the smart retrieval system.
 * Extends existing embedding types with smart retrieval capabilities.
 */

// Re-export existing types for convenience
export * from '@/core/types/embeddings';

// Query Analysis Types
export interface QueryIntent {
  type: 'semantic' | 'keyword' | 'code' | 'hybrid' | 'graph';
  confidence: number;
  entities: string[];
  keywords: string[];
  codePatterns: CodePattern[];
  domains: string[];
  complexity: 'simple' | 'medium' | 'complex';
}

export interface CodePattern {
  type: 'function' | 'class' | 'variable' | 'api' | 'file';
  name: string;
  language?: string;
  confidence: number;
  context?: string;
}

export interface SearchStrategy {
  primary: 'vector' | 'graph' | 'keyword';
  secondary?: 'vector' | 'graph' | 'keyword';
  weights: SearchWeights;
  fusionAlgorithm: 'combsum' | 'combmnz' | 'rrf' | 'learned';
}

export interface SearchWeights {
  semantic: number;
  keyword: number;
  graph: number;
  personalization?: number;
  temporal?: number;
  popularity?: number;
}

// Context Types
export interface QueryContext {
  userId?: string;
  projectId?: string;
  sessionId?: string;
  fileContext?: string[];
  recentQueries?: string[];
  userPreferences?: Record<string, any>;
  activeRepository?: string;
  currentWorkingDirectory?: string;
}

export interface SearchContext {
  projectId: string;
  userId?: string;
  currentFile?: string;
  relatedEntities?: string[];
  searchScope?: 'project' | 'repository' | 'global';
  timeRange?: {
    start?: Date;
    end?: Date;
  };
}

// Result Types
export interface SmartSearchResult {
  id: string;
  content: string;
  source: 'vector' | 'graph' | 'keyword' | 'hybrid';
  type: 'chunk' | 'function' | 'class' | 'file' | 'documentation';
  scores: SearchScores;
  metadata: SmartResultMetadata;
  context?: ResultContext;
  relationships?: CrossReference[];
}

export interface SearchScores {
  semantic?: number;
  keyword?: number;
  graph?: number;
  personalized?: number;
  temporal?: number;
  popularity?: number;
  final: number;
  rank: number;
  confidence: number;
}

export interface SmartResultMetadata {
  chunkId: string;
  fileId: string;
  repositoryId: string;
  filePath: string;
  language: string;
  framework?: string;
  nodeType: string;
  nodeName?: string;
  startLine: number;
  endLine: number;
  lastModified: Date;
  author?: string;
  complexity?: number;
  tags: string[];
  isExported: boolean;
  hasTests: boolean;
  hasDocumentation: boolean;
}

export interface ResultContext {
  parentChunk?: SmartSearchResult;
  childChunks?: SmartSearchResult[];
  relatedChunks?: SmartSearchResult[];
  crossReferences?: CrossReference[];
  explanation?: string;
  highlightedTerms?: string[];
}

export interface CrossReference {
  id: string;
  type: 'calls' | 'imports' | 'extends' | 'implements' | 'references';
  targetId: string;
  targetName: string;
  targetType: string;
  confidence: number;
}

// Personalization Types
export interface UserProfile {
  userId: string;
  preferences: SearchPreferences;
  expertise: ExpertiseLevel;
  activityHistory: ActivityHistory;
  projectContexts: ProjectContext[];
  learningVector: number[];
  lastUpdated: Date;
}

export interface SearchPreferences {
  preferredLanguages: string[];
  preferredFrameworks: string[];
  contentTypes: ('code' | 'documentation' | 'tests' | 'examples')[];
  complexityLevel: 'beginner' | 'intermediate' | 'advanced';
  resultFormat: 'detailed' | 'concise' | 'code-focused';
  showRelatedContent: boolean;
  enablePersonalization: boolean;
}

export interface ExpertiseLevel {
  overall: number;
  languages: Record<string, number>;
  frameworks: Record<string, number>;
  domains: Record<string, number>;
  lastAssessed: Date;
}

export interface ActivityHistory {
  totalQueries: number;
  recentQueries: QueryActivity[];
  clickPatterns: ClickPattern[];
  dwellTimes: Record<string, number>;
  feedbackHistory: FeedbackRecord[];
  lastActive: Date;
}

export interface QueryActivity {
  id: string;
  query: string;
  intent: string;
  timestamp: Date;
  resultCount: number;
  clickedResults: string[];
  satisfaction?: number;
  executionTime: number;
}

export interface ClickPattern {
  resultPosition: number;
  resultType: string;
  dwellTime: number;
  wasHelpful: boolean;
  timestamp: Date;
}

export interface FeedbackRecord {
  id: string;
  resultId: string;
  queryId: string;
  rating: number;
  feedback: 'helpful' | 'not_helpful' | 'irrelevant' | 'outdated';
  comment?: string;
  timestamp: Date;
}

export interface ProjectContext {
  projectId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  expertise: number;
  recentFiles: string[];
  favoriteFiles: string[];
  collaborators: string[];
  workingPatterns: Record<string, number>;
}

// Analytics Types
export interface SearchEvent {
  id: string;
  userId?: string;
  sessionId: string;
  query: string;
  processedQuery: string;
  queryIntent: QueryIntent;
  searchStrategy: SearchStrategy;
  resultsCount: number;
  clickedResults: ClickEvent[];
  noClickResults: boolean;
  satisfactionScore?: number;
  feedbackGiven: boolean;
  executionTime: number;
  cacheHit: boolean;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface ClickEvent {
  resultId: string;
  position: number;
  dwellTime: number;
  actionType: 'view' | 'copy' | 'open' | 'share';
  timestamp: Date;
}

export interface SearchMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  ndcg: number;
  mrr: number;
  clickThroughRate: number;
  zeroClickRate: number;
  averageQueryTime: number;
  cacheHitRate: number;
  userSatisfaction: number;
  queryVolume: number;
}

// Caching Types
export interface CacheKey {
  query: string;
  queryHash: string;
  userId?: string;
  projectId?: string;
  contextHash?: string;
}

export interface CacheEntry {
  key: CacheKey;
  results: SmartSearchResult[];
  metadata: CacheMetadata;
  semanticVector?: number[];
  hitCount: number;
  lastAccessed: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface CacheMetadata {
  queryIntent: string;
  searchStrategy: string;
  executionTime: number;
  resultQuality: number;
  userSatisfaction?: number;
}

// Configuration Types
export interface SmartRetrievalConfig {
  queryClassification: {
    enabled: boolean;
    confidenceThreshold: number;
    codeDetectionEnabled: boolean;
    entityExtractionEnabled: boolean;
  };
  vectorSearch: {
    defaultTopK: number;
    rerankingEnabled: boolean;
    diversityThreshold: number;
    semanticThreshold: number;
  };
  graphSearch: {
    enabled: boolean;
    maxTraversalDepth: number;
    relationshipTypes: string[];
    contextExpansionEnabled: boolean;
  };
  resultFusion: {
    defaultWeights: SearchWeights;
    adaptiveWeighting: boolean;
    diversityOptimization: boolean;
    maxResults: number;
  };
  personalization: {
    enabled: boolean;
    learningRate: number;
    minInteractions: number;
    expertiseDecayRate: number;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxCacheSize: number;
    semanticCaching: boolean;
    precomputePopular: boolean;
  };
  analytics: {
    enabled: boolean;
    trackingEnabled: boolean;
    metricsCalculationInterval: number;
    retentionDays: number;
  };
}

// API Types
export interface SmartSearchRequest {
  query: string;
  context?: QueryContext;
  options?: SmartSearchOptions;
}

export interface SmartSearchOptions {
  searchTypes?: ('semantic' | 'keyword' | 'graph')[];
  maxResults?: number;
  includeRelated?: boolean;
  personalize?: boolean;
  useCache?: boolean;
  strategy?: 'auto' | 'semantic' | 'hybrid' | 'graph';
  debug?: boolean;
}

export interface SmartSearchResponse {
  results: SmartSearchResult[];
  metadata: SearchResponseMetadata;
  suggestions?: SearchSuggestion[];
  debug?: DebugInfo;
}

export interface SearchResponseMetadata {
  query: string;
  processedQuery: string;
  queryIntent: QueryIntent;
  searchStrategy: SearchStrategy;
  totalResults: number;
  executionTime: number;
  cacheHit: boolean;
  personalizedResults: boolean;
  diversityScore: number;
}

export interface SearchSuggestion {
  type: 'query' | 'filter' | 'scope';
  text: string;
  reason: string;
  confidence: number;
}

export interface DebugInfo {
  queryClassification: QueryIntent;
  searchExecution: {
    vectorSearchTime: number;
    graphSearchTime: number;
    keywordSearchTime: number;
    fusionTime: number;
    personalizationTime: number;
  };
  resultBreakdown: {
    vectorResults: number;
    graphResults: number;
    keywordResults: number;
    finalResults: number;
  };
  cacheInfo: {
    hit: boolean;
    key: string;
    ttl: number;
  };
}

// Error Types
export interface SmartRetrievalError {
  code: string;
  message: string;
  details?: Record<string, any>;
  component: 'classifier' | 'processor' | 'search' | 'fusion' | 'cache' | 'analytics';
  timestamp: Date;
}

// Event Types for Real-time Updates
export interface RetrievalEvent {
  type: 'search_started' | 'search_completed' | 'cache_hit' | 'personalization_updated';
  userId?: string;
  sessionId: string;
  data: Record<string, any>;
  timestamp: Date;
}