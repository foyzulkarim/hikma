# Ollama Chat Memory

A full-featured Node.js application for chatting with Ollama LLMs with robust conversation memory capabilities, built from scratch without external AI frameworks.

## Features

- **Persistent Conversation Memory**: Store and retrieve chat history across sessions
- **Multiple Conversation Support**: Create, switch between, and manage multiple conversations
- **Memory Management**: In-memory and SQLite storage options
- **Context Preservation**: Maintain conversation context for more coherent responses
- **Command Interface**: Rich set of commands for managing conversations and settings
- **No External AI Frameworks**: Built from scratch without LangChain or LangGraph

## Prerequisites

1. **Node.js**: Version 16.x or higher
2. **Ollama**: Must be installed and running locally
   - [Install Ollama](https://ollama.ai/download)
   - Start Ollama and pull a model: `ollama pull llama3`

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ollama-chat-memory.git
   cd ollama-chat-memory
   ```
2. Install dependencies:

```bash
npm install
```

## Usage

### Starting the Chat

```bash
node src/index.js
```

### Command Line Options

- `-m, --model <model>`: Specify the Ollama model to use (default: llama3)
- `-t, --temperature <value>`: Set the temperature (0.0-1.0)
- `-p, --persist`: Enable persistent memory storage with SQLite
- `-s, --system <prompt>`: Set a custom system prompt
- `-n, --no-system`: Disable system prompt
- `-c, --config <path>`: Path to config file

Example:
```bash
node src/index.js --model llama3 --temperature 0.8 --persist
```

### Chat Commands

Once in the chat interface, you can use the following commands:

- `/help`: Display available commands
- `/history`: Show conversation history
- `/new`: Start a new conversation
- `/list`: List all conversations
- `/switch <id>`: Switch to a different conversation
- `/delete <id>`: Delete a conversation
- `/system <prompt>`: Update the system prompt
- `/temp <value>`: Update the temperature setting
- `/model <name>`: Change the model
- `/exit`: Exit the chat

## How It Works

### Memory Management

The application implements two types of memory managers:

1. **MemoryManager**: In-memory storage for conversation history
2. **SqliteMemoryManager**: Persistent storage using SQLite database

Both managers provide the same interface for:
- Creating and managing conversations
- Adding and retrieving messages
- Formatting conversation history for LLM context

### Chat Session

The `ChatSession` class integrates memory management with the Ollama API:

1. It maintains the active conversation state
2. Handles user messages and sends them to Ollama
3. Stores responses in the memory manager
4. Provides methods for conversation management

### Ollama Integration

The `OllamaClient` class handles communication with the Ollama API:

1. Sends prompts to Ollama with conversation history as context
2. Formats messages for optimal context understanding
3. Handles API responses and errors

## Extending the Project

### Adding New Memory Backends

Create a new class that extends `MemoryManager` and implements the required methods:

```javascript
import { MemoryManager } from './MemoryManager.js';

export class CustomMemoryManager extends MemoryManager {
  // Override methods as needed
}
```

### Adding New LLM Providers

Create a new client class similar to `OllamaClient` and update the `ChatSession` to use it:

```javascript
export class CustomLLMClient {
  // Implement methods for the new LLM provider
}
```

## Testing

Run the memory manager tests:

```bash
npm test
```

This will test both in-memory and SQLite-based memory managers, including persistence.

## Dependencies

- **axios**: HTTP client for API requests
- **better-sqlite3**: SQLite database interface
- **chalk**: Terminal text styling
- **commander**: Command-line interface
- **dotenv**: Environment variable management
- **inquirer**: Interactive command-line user interface
- **nanoid**: Unique ID generation

## License

MIT
