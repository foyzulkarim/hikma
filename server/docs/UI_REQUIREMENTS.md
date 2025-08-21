# Hikma Web Interface Requirements

## Overview
This document outlines the requirements for a simple web interface for the Hikma Agentic Code Intelligence Platform. The UI should provide a clean, intuitive way to interact with the backend API and test the core functionality.

## Technology Stack Recommendations
- **Frontend Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS or Material-UI
- **State Management**: React Query (TanStack Query) for API state
- **Routing**: React Router v6
- **HTTP Client**: Axios or Fetch API
- **Build Tool**: Vite or Create React App

---

## Core Features & Pages

### 1. Authentication Pages

#### Login Page (`/login`)
**Purpose**: User authentication  
**Components**:
- Email input field
- Password input field
- "Remember me" checkbox
- Login button
- "Forgot password?" link
- "Don't have an account? Register" link

**Functionality**:
- Form validation (email format, required fields)
- API call to `POST /api/v1/auth/login`
- Store JWT token in localStorage/sessionStorage
- Redirect to dashboard on success
- Display error messages for failed login

#### Registration Page (`/register`)
**Purpose**: New user registration  
**Components**:
- Name input field
- Email input field
- Password input field
- Confirm password field
- Organization input field (optional)
- Register button
- "Already have an account? Login" link

**Functionality**:
- Form validation (password strength, email format, password confirmation)
- API call to `POST /api/v1/auth/register`
- Auto-login after successful registration
- Display success/error messages

#### Forgot Password Page (`/forgot-password`)
**Purpose**: Password reset request  
**Components**:
- Email input field
- Send reset link button
- Back to login link

**Functionality**:
- API call to `POST /api/v1/auth/forgot-password`
- Display confirmation message
- Handle error states

---

### 2. Main Application Layout

#### Navigation Header
**Components**:
- Hikma logo/brand
- User profile dropdown
  - User name and email
  - Profile settings
  - Logout option
- Project selector dropdown
- Health status indicator (green/yellow/red dot)

#### Sidebar Navigation
**Menu Items**:
- Dashboard
- Projects
- Query Interface
- History
- Settings

---

### 3. Dashboard Page (`/dashboard`)

**Purpose**: Overview of system status and recent activity  

#### System Health Section
**Components**:
- Health status cards for each service:
  - Knowledge Service (embedding, vector store)
  - Agent Service (LLM, intent classifier)
  - Database Services (PostgreSQL, Redis, Neo4j)
- Overall system status indicator
- Last updated timestamp
- Refresh button

#### Recent Activity Section
**Components**:
- List of recent queries with:
  - Query text (truncated)
  - Timestamp
  - Response confidence score
  - Project name
  - Quick action buttons (view details, re-run)

#### Quick Stats Section
**Components**:
- Total queries processed
- Average response time
- Success rate percentage
- Active projects count

---

### 4. Projects Page (`/projects`)

**Purpose**: Project management interface  

#### Project List View
**Components**:
- "Create New Project" button
- Project cards/table with:
  - Project name and description
  - Repository URL/path
  - Last sync time
  - Sync status (active, syncing, error)
  - File count and total size
  - Action buttons (view, edit, sync, delete)

#### Create/Edit Project Modal
**Components**:
- Project name input
- Description textarea
- Repository URL input
- Repository path input (for local repos)
- Settings section:
  - Include patterns (file types)
  - Exclude patterns (directories/files)
  - Max file size
  - Auto-sync toggle
  - Sync interval
- Save/Cancel buttons

#### Project Details View
**Components**:
- Project information display
- Sync status and history
- File browser (tree view of indexed files)
- Sync logs
- Project settings
- Delete project button (with confirmation)

---

### 5. Query Interface Page (`/query`)

**Purpose**: Main interface for interacting with the AI agent  

#### Query Input Section
**Components**:
- Large text area for query input
- Project selector dropdown
- Query type selector (optional):
  - Code Explanation
  - Code Search
  - Documentation Search
  - Commit Analysis
  - General Query
- Submit button
- Clear button

#### Response Display Section
**Components**:
- Response text area (markdown support)
- Confidence score indicator
- Intent classification display
- Execution time
- Sources section:
  - List of source documents
  - File paths and relevance scores
  - Expandable content preview
- Feedback section:
  - Thumbs up/down buttons
  - Rating (1-5 stars)
  - Optional feedback text area

#### Conversation History
**Components**:
- Collapsible sidebar showing:
  - Previous queries in current session
  - Conversation threads
  - Quick access to re-run queries

---

### 6. History Page (`/history`)

**Purpose**: View and manage query history  

#### Filters Section
**Components**:
- Date range picker
- Project filter dropdown
- Intent type filter
- Confidence score range slider
- Search box for query text

#### History List
**Components**:
- Paginated list/table with:
  - Query text (truncated with expand option)
  - Timestamp
  - Project name
  - Intent classification
  - Confidence score
  - Response preview
  - Action buttons (view full, re-run, delete)

#### Batch Operations
**Components**:
- Select all/none checkboxes
- Bulk delete button
- Export selected button

---

### 7. Settings Page (`/settings`)

**Purpose**: User and system configuration  

#### User Profile Section
**Components**:
- Name and email display/edit
- Password change form
- Organization information

#### API Configuration Section
**Components**:
- API endpoint display
- API key generation/management
- Rate limiting information

#### Preferences Section
**Components**:
- Default response style (concise, detailed, technical)
- Include code examples toggle
- Include references toggle
- Max response length slider
- Theme selection (light/dark)

---

## Technical Requirements

### State Management
- **Authentication State**: User info, tokens, login status
- **Project State**: Current project, project list, project details
- **Query State**: Current query, response, conversation history
- **UI State**: Loading states, error states, modal visibility

### API Integration
- **Base URL Configuration**: Environment-based API endpoint
- **Authentication**: JWT token management and automatic refresh
- **Error Handling**: Global error handling with user-friendly messages
- **Loading States**: Loading indicators for all API calls
- **Retry Logic**: Automatic retry for failed requests

### Responsive Design
- **Mobile-First**: Design for mobile devices first
- **Breakpoints**: Support for tablet and desktop layouts
- **Touch-Friendly**: Appropriate touch targets for mobile
- **Accessibility**: WCAG 2.1 AA compliance

### Performance
- **Code Splitting**: Lazy load pages and components
- **Caching**: Cache API responses where appropriate
- **Optimization**: Minimize bundle size and optimize images
- **Progressive Loading**: Show content as it loads

---

## User Experience Requirements

### Navigation
- **Intuitive Flow**: Clear navigation between pages
- **Breadcrumbs**: Show current location in deep pages
- **Back Button**: Proper browser back button support
- **Keyboard Navigation**: Full keyboard accessibility

### Feedback
- **Loading States**: Clear loading indicators
- **Success Messages**: Confirmation for successful actions
- **Error Messages**: Clear, actionable error messages
- **Progress Indicators**: For long-running operations

### Data Visualization
- **Charts**: Simple charts for metrics and statistics
- **Status Indicators**: Visual status indicators (colors, icons)
- **Progress Bars**: For sync operations and loading
- **Tooltips**: Helpful tooltips for complex features

---

## Security Considerations

### Authentication
- **Token Storage**: Secure token storage (httpOnly cookies preferred)
- **Auto-Logout**: Automatic logout on token expiration
- **Session Management**: Proper session handling
- **CSRF Protection**: Cross-site request forgery protection

### Data Protection
- **Input Validation**: Client-side validation for all inputs
- **XSS Prevention**: Proper sanitization of user content
- **Secure Communication**: HTTPS only in production
- **Error Handling**: Don't expose sensitive information in errors

---

## Development Guidelines

### Code Organization
```
src/
├── components/          # Reusable UI components
│   ├── common/         # Generic components (Button, Input, etc.)
│   ├── auth/           # Authentication components
│   ├── projects/       # Project-related components
│   └── query/          # Query interface components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API service functions
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── constants/          # Application constants
└── styles/             # Global styles and themes
```

### Component Guidelines
- **Functional Components**: Use function components with hooks
- **TypeScript**: Full TypeScript implementation
- **Props Interface**: Define interfaces for all component props
- **Error Boundaries**: Implement error boundaries for error handling
- **Testing**: Unit tests for components and utilities

### API Service Layer
```typescript
// Example API service structure
export class ApiService {
  private baseURL: string;
  private token: string | null;

  // Authentication methods
  login(credentials: LoginCredentials): Promise<AuthResponse>
  register(userData: RegisterData): Promise<AuthResponse>
  logout(): Promise<void>

  // Project methods
  getProjects(): Promise<Project[]>
  createProject(project: CreateProjectData): Promise<Project>
  updateProject(id: string, updates: UpdateProjectData): Promise<Project>
  deleteProject(id: string): Promise<void>
  syncProject(id: string, options: SyncOptions): Promise<SyncResult>

  // Query methods
  submitQuery(query: QueryData): Promise<QueryResponse>
  getQueryHistory(filters: HistoryFilters): Promise<QueryHistory>
  submitFeedback(queryId: string, feedback: Feedback): Promise<void>

  // Health methods
  getHealthStatus(): Promise<HealthStatus>
  getMetrics(): Promise<SystemMetrics>
}
```

---

## Testing Requirements

### Unit Testing
- **Component Testing**: Test all components with React Testing Library
- **Hook Testing**: Test custom hooks
- **Utility Testing**: Test utility functions
- **Service Testing**: Mock API calls and test service functions

### Integration Testing
- **User Flows**: Test complete user workflows
- **API Integration**: Test API integration with mock server
- **Error Scenarios**: Test error handling and edge cases

### E2E Testing
- **Critical Paths**: Test authentication, project creation, query submission
- **Cross-Browser**: Test on major browsers
- **Mobile Testing**: Test responsive design on mobile devices

---

## Deployment Considerations

### Build Configuration
- **Environment Variables**: Support for different environments
- **Asset Optimization**: Minification and compression
- **Source Maps**: Generate source maps for debugging
- **Bundle Analysis**: Analyze bundle size and dependencies

### Hosting
- **Static Hosting**: Can be deployed to static hosting services
- **CDN**: Use CDN for asset delivery
- **Caching**: Proper cache headers for static assets
- **HTTPS**: Enforce HTTPS in production

---

## Future Enhancements

### Advanced Features
- **Real-time Updates**: WebSocket integration for live updates
- **Advanced Search**: Full-text search across queries and responses
- **Data Export**: Export query history and analytics
- **Collaboration**: Multi-user project collaboration
- **Integrations**: GitHub, Jira, Slack integrations

### Analytics
- **Usage Analytics**: Track user behavior and feature usage
- **Performance Monitoring**: Monitor frontend performance
- **Error Tracking**: Automatic error reporting
- **A/B Testing**: Framework for testing UI variations

This UI will provide a comprehensive interface for testing and using the Hikma system while maintaining simplicity and usability.

