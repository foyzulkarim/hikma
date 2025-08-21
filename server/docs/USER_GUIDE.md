# Hikma User Guide

This guide provides an overview of how to interact with the Hikma Agentic Code Intelligence Platform from a user's perspective. It covers the core functionalities exposed via the API, which would typically be consumed by a frontend application or other automated systems.

## 1. Core Concepts

Before diving into specific actions, let's understand some core concepts:

*   **User**: An individual who interacts with the Hikma platform. Users can create and manage projects.
*   **Project**: A logical container for your codebase(s) and associated knowledge. Each project can have multiple data sources (e.g., Git repositories).
*   **Data Source**: A connection to an external system (like a Git repository) from which Hikma ingests code and other information.
*   **Query**: A question or request sent to Hikma to retrieve information or insights from your codebase.
*   **Agent**: The intelligent component of Hikma that processes your queries, leverages the knowledge base, and generates responses.

## 2. Getting Started: User Authentication

To use Hikma, you first need to register and log in. All interactions with protected endpoints require an authentication token.

### 2.1. Registration

To create a new user account, you will typically provide:
*   **Email**: Your unique email address.
*   **Username**: A unique username for your account.
*   **Password**: A strong password.
*   **First Name (Optional)**
*   **Last Name (Optional)**

Upon successful registration, you will receive an access token and a refresh token. The access token should be included in the `Authorization` header of subsequent requests (e.g., `Bearer YOUR_ACCESS_TOKEN`).

### 2.2. Login

If you already have an account, you can log in using your email and password. This will also return new access and refresh tokens.

### 2.3. Token Refresh

Access tokens have a limited lifespan for security reasons. When your access token expires, you can use your refresh token to obtain a new access token without re-authenticating with your credentials.

### 2.4. Logout

To securely end your session, you can log out. This invalidates your current tokens.

### 2.5. Profile Management

*   **Get Profile**: Retrieve your user details.
*   **Change Password**: Update your password, requiring your current password and a new one.

## 3. Managing Projects

Projects are central to organizing your codebases and knowledge within Hikma.

### 3.1. Create a Project

When creating a project, you will typically provide:
*   **Name**: A human-readable name for your project (e.g., 

