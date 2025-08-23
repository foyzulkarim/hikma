export interface UserSessionStartedEvent {
  sessionId: string;
  userId?: string;
  timestamp: string;
}

export interface UserSessionEndedEvent {
  sessionId: string;
  userId?: string;
  timestamp: string;
}

export interface QueryProcessedEvent {
  queryId: string;
  result: any;
  metadata: Record<string, any>;
}

export interface DocumentIngestedEvent {
  documentId: string;
  projectId: string;
  type: string;
}

export interface WorkflowTriggeredEvent {
  workflowId: string;
  trigger: string;
  data: any;
}

export interface UserAuthenticatedEvent {
  userId: string;
  sessionId: string;
  timestamp: string;
}

export interface ProjectCreatedEvent {
  projectId: string;
  userId: string;
  projectName: string;
  timestamp: string;
}

export interface SyncJobStartedEvent {
  jobId: string;
  projectId: string;
  dataSourceType: string;
  timestamp: string;
}

export interface SyncJobCompletedEvent {
  jobId: string;
  projectId: string;
  status: 'success' | 'failed';
  documentsProcessed: number;
  timestamp: string;
}

export interface AgentToolExecutedEvent {
  toolName: string;
  queryId: string;
  input: any;
  output: any;
  executionTime: number;
  timestamp: string;
}

export interface ErrorOccurredEvent {
  error: Error;
  context: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}
