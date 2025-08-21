# Hikma Platform

This repository contains the full-stack implementation of the Hikma Agentic Code Intelligence Platform, with independent client and server projects.

## Project Structure

- **`server/`**: The Fastify + TypeScript backend API - a complete independent Node.js project
- **`client/`**: The React + TypeScript single-page application (SPA) - a complete independent React project

## Getting Started

Each project is completely independent and can be developed, built, and deployed separately:

### Server
```bash
cd server
npm install
npm run dev
```

### Client
```bash
cd client
npm install
npm run dev
```

For detailed setup instructions, refer to the `README.md` files within each directory:

- [**Server README**](./server/README.md)
- [**Client README**](./client/README.md)

## Project Status

For an overview of the project's development status, completed phases, and future plans, please see the [**PROJECT_STATUS.md**](./server/docs/PROJECT_STATUS.md) document located in the `server/docs` directory.

## Documentation

All comprehensive documentation, including setup guides, architecture details, API specifications, and UI requirements, can be found in the `server/docs` directory:

- [**Setup Guide**](./server/docs/SETUP_GUIDE.md)
- [**Architecture**](./server/docs/ARCHITECTURE.md)
- [**UI Requirements**](./server/docs/UI_REQUIREMENTS.md)
- [**API Documentation**](./server/docs/API_DOCUMENTATION.md)
- [**User Guide**](./server/docs/USER_GUIDE.md)
