/**
 * Smart Search Configuration
 * 
 * Configuration settings for the smart retrieval system components.
 */

import { SmartRetrievalConfig, SearchWeights } from '@/knowledge/types/smart-retrieval';

export const smartSearchConfig: SmartRetrievalConfig = {
  queryClassification: {
    enabled: true,
    confidenceThreshold: 0.7,
    codeDetectionEnabled: true,
    entityExtractionEnabled: true,
  },
  
  vectorSearch: {
    defaultTopK: 20,
    rerankingEnabled: true,
    diversityThreshold: 0.8,
    semanticThreshold: 0.6,
  },
  
  graphSearch: {
    enabled: true,
    maxTraversalDepth: 3,
    relationshipTypes: [
      'CALLS',
      'IMPORTS', 
      'EXTENDS',
      'IMPLEMENTS',
      'REFERENCES',
      'CONTAINS',
      'DEPENDS_ON'
    ],
    contextExpansionEnabled: true,
  },
  
  resultFusion: {
    defaultWeights: {
      semantic: 0.5,
      keyword: 0.2,
      graph: 0.3,
      personalization: 0.1,
      temporal: 0.05,
      popularity: 0.05,
    },
    adaptiveWeighting: true,
    diversityOptimization: true,
    maxResults: 50,
  },
  
  personalization: {
    enabled: true,
    learningRate: 0.1,
    minInteractions: 10,
    expertiseDecayRate: 0.01, // Weekly decay
  },
  
  caching: {
    enabled: true,
    ttl: 3600, // 1 hour in seconds
    maxCacheSize: 10000,
    semanticCaching: true,
    precomputePopular: true,
  },
  
  analytics: {
    enabled: true,
    trackingEnabled: true,
    metricsCalculationInterval: 300, // 5 minutes
    retentionDays: 90,
  },
};

// Environment-specific overrides
export const getSmartSearchConfig = (): SmartRetrievalConfig => {
  const config = { ...smartSearchConfig };
  
  // Development environment adjustments
  if (process.env.NODE_ENV === 'development') {
    config.caching.ttl = 300; // 5 minutes for development
    config.analytics.metricsCalculationInterval = 60; // 1 minute
  }
  
  // Production optimizations
  if (process.env.NODE_ENV === 'production') {
    config.caching.maxCacheSize = 50000;
    config.vectorSearch.defaultTopK = 30;
  }
  
  // Feature flags from environment
  if (process.env.SMART_RETRIEVAL_PERSONALIZATION === 'false') {
    config.personalization.enabled = false;
  }
  
  if (process.env.SMART_RETRIEVAL_GRAPH === 'false') {
    config.graphSearch.enabled = false;
  }
  
  if (process.env.SMART_RETRIEVAL_CACHE === 'false') {
    config.caching.enabled = false;
  }
  
  return config;
};

// Strategy-specific weight presets
export const searchStrategyPresets: Record<string, SearchWeights> = {
  // Favor semantic understanding
  semantic_heavy: {
    semantic: 0.7,
    keyword: 0.1,
    graph: 0.2,
    personalization: 0.05,
    temporal: 0.02,
    popularity: 0.03,
  },
  
  // Balance all sources
  balanced: {
    semantic: 0.4,
    keyword: 0.25,
    graph: 0.25,
    personalization: 0.1,
    temporal: 0.05,
    popularity: 0.05,
  },
  
  // Favor code relationships
  graph_heavy: {
    semantic: 0.3,
    keyword: 0.15,
    graph: 0.5,
    personalization: 0.05,
    temporal: 0.02,
    popularity: 0.03,
  },
  
  // Favor exact keyword matches
  keyword_heavy: {
    semantic: 0.2,
    keyword: 0.6,
    graph: 0.15,
    personalization: 0.05,
    temporal: 0.02,
    popularity: 0.03,
  },
  
  // Highly personalized
  personalized: {
    semantic: 0.3,
    keyword: 0.15,
    graph: 0.25,
    personalization: 0.25,
    temporal: 0.05,
    popularity: 0.1,
  },
};

// Cache configuration presets
export const cachePresets = {
  aggressive: {
    enabled: true,
    ttl: 7200, // 2 hours
    maxCacheSize: 100000,
    semanticCaching: true,
    precomputePopular: true,
  },
  
  conservative: {
    enabled: true,
    ttl: 600, // 10 minutes
    maxCacheSize: 5000,
    semanticCaching: false,
    precomputePopular: false,
  },
  
  development: {
    enabled: true,
    ttl: 60, // 1 minute
    maxCacheSize: 1000,
    semanticCaching: true,
    precomputePopular: false,
  },
};

export default smartSearchConfig;