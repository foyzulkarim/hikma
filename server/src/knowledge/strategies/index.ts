/**
 * Strategy Pattern Exports
 * 
 * Centralizes all search strategy implementations for the smart retrieval system.
 */

// Vector Search Strategies
export * from './vector-search.strategy';
export * from './graph-traversal.strategy';
export * from './hybrid-search.strategy';

// Import centralized strategy types
import type { SearchStrategy } from '../types/smart-retrieval';

// Strategy base interface
export interface StrategyBase {
  name: string;
  description: string;
}

// Strategy Registry
export class StrategyRegistry {
  private vectorStrategies: Map<string, any> = new Map();
  private graphStrategies: Map<string, any> = new Map();
  private hybridStrategies: Map<string, any> = new Map();

  registerVectorStrategy(name: string, strategy: any): void {
    this.vectorStrategies.set(name, strategy);
  }

  registerGraphStrategy(name: string, strategy: any): void {
    this.graphStrategies.set(name, strategy);
  }

  registerHybridStrategy(name: string, strategy: any): void {
    this.hybridStrategies.set(name, strategy);
  }

  getVectorStrategy(name: string): any {
    return this.vectorStrategies.get(name);
  }

  getGraphStrategy(name: string): any {
    return this.graphStrategies.get(name);
  }

  getHybridStrategy(name: string): any {
    return this.hybridStrategies.get(name);
  }

  getAllStrategies(): {
    vector: string[];
    graph: string[];
    hybrid: string[];
  } {
    return {
      vector: Array.from(this.vectorStrategies.keys()),
      graph: Array.from(this.graphStrategies.keys()),
      hybrid: Array.from(this.hybridStrategies.keys()),
    };
  }
}

// Global strategy registry instance
export const strategyRegistry = new StrategyRegistry();