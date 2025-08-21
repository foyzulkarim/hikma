// User types
export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  userId: string;
  dataSources: DataSource[];
}

export interface DataSource {
  id: string;
  type: 'GIT' | 'GITHUB' | 'JIRA' | 'SLACK';
  name: string;
  config: Record<string, any>;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastSyncAt?: string;
  projectId: string;
}

// Query types
export interface QueryRequest {
  query: string;
  projectId?: string;
  conversationId?: string;
  context?: Record<string, any>;
}

export interface QueryResponse {
  id: string;
  query: string;
  response: string;
  intent: string;
  sources: QuerySource[];
  metadata: Record<string, any>;
  conversationId?: string;
  createdAt: string;
}

export interface QuerySource {
  id: string;
  type: 'DOCUMENT' | 'CODE' | 'COMMIT' | 'ISSUE';
  title: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
}

// Conversation types
export interface Conversation {
  id: string;
  title: string;
  projectId?: string;
  queries: QueryResponse[];
  createdAt: string;
  updatedAt: string;
}

// Health types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    vectorDb: ServiceHealth;
    llm: ServiceHealth;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    statusCode: number;
  };
  timestamp: string;
  correlationId: string;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Form types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

// UI types
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  code?: string;
}

