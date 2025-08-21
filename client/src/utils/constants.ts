// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

// Authentication
export const AUTH_COOKIE_NAME = 'hikma_auth_token';
export const REFRESH_TOKEN_COOKIE_NAME = 'hikma_refresh_token';
export const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  DASHBOARD: '/dashboard',
  PROJECTS: '/projects',
  PROJECT_DETAIL: '/projects/:id',
  QUERY: '/query',
  HISTORY: '/history',
  SETTINGS: '/settings',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: `${API_PREFIX}/auth/login`,
    REGISTER: `${API_PREFIX}/auth/register`,
    LOGOUT: `${API_PREFIX}/auth/logout`,
    REFRESH: `${API_PREFIX}/auth/refresh`,
    PROFILE: `${API_PREFIX}/auth/profile`,
    CHANGE_PASSWORD: `${API_PREFIX}/auth/change-password`,
    FORGOT_PASSWORD: `${API_PREFIX}/auth/forgot-password`,
    RESET_PASSWORD: `${API_PREFIX}/auth/reset-password`,
  },
  // Projects
  PROJECTS: {
    LIST: `${API_PREFIX}/projects`,
    CREATE: `${API_PREFIX}/projects`,
    GET: (id: string) => `${API_PREFIX}/projects/${id}`,
    UPDATE: (id: string) => `${API_PREFIX}/projects/${id}`,
    DELETE: (id: string) => `${API_PREFIX}/projects/${id}`,
    SYNC: (id: string) => `${API_PREFIX}/projects/${id}/sync`,
  },
  // Queries
  QUERIES: {
    ASK: `${API_PREFIX}/query/ask`,
    BATCH: `${API_PREFIX}/query/batch`,
    CONVERSATION: `${API_PREFIX}/query/conversation`,
    HISTORY: `${API_PREFIX}/query/history`,
    FEEDBACK: (id: string) => `${API_PREFIX}/query/${id}/feedback`,
    METRICS: `${API_PREFIX}/query/metrics`,
  },
  // Health
  HEALTH: {
    STATUS: `${API_PREFIX}/health`,
    METRICS: `${API_PREFIX}/health/metrics`,
  },
} as const;

// UI Constants
export const TOAST_DURATION = {
  SUCCESS: 3000,
  ERROR: 5000,
  WARNING: 4000,
  INFO: 3000,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// Query Types
export const QUERY_INTENTS = {
  CODE_EXPLANATION: 'Code_Explanation',
  SEARCH: 'Search',
  DOCUMENTATION: 'Documentation',
  COMMIT_ANALYSIS: 'Commit_Analysis',
  GENERAL: 'General',
} as const;

// Data Source Types
export const DATA_SOURCE_TYPES = {
  GIT: 'GIT',
  GITHUB: 'GITHUB',
  JIRA: 'JIRA',
  SLACK: 'SLACK',
} as const;

// Status Types
export const STATUS_TYPES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
} as const;

// Theme
export const THEME = {
  COLORS: {
    PRIMARY: '#3b82f6',
    SECONDARY: '#64748b',
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    INFO: '#06b6d4',
  },
  BREAKPOINTS: {
    SM: '640px',
    MD: '768px',
    LG: '1024px',
    XL: '1280px',
    '2XL': '1536px',
  },
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'hikma_user_preferences',
  RECENT_PROJECTS: 'hikma_recent_projects',
  QUERY_HISTORY: 'hikma_query_history',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied. You do not have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'An internal server error occurred. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Successfully logged in!',
  LOGOUT_SUCCESS: 'Successfully logged out!',
  REGISTER_SUCCESS: 'Account created successfully!',
  PROJECT_CREATED: 'Project created successfully!',
  PROJECT_UPDATED: 'Project updated successfully!',
  PROJECT_DELETED: 'Project deleted successfully!',
  PASSWORD_CHANGED: 'Password changed successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
} as const;

