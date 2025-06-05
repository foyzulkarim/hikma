# hikma - Command Line Interface with Tab Completion

A command-line interface for chatting with Ollama LLM with conversation memory and command tab completion.

## Features

- Chat with Ollama LLM models
- Persistent conversation memory
- Command history
- **Tab completion for commands**
- Context management
- Multiple conversation support
- Token usage tracking
- Tool integration system
- Shell command execution
- GitHub CLI integration
- Fallback model support

## Prerequisites

1. **Node.js**: Version 16.x or higher
2. **Ollama**: Must be installed and running locally
   - [Install Ollama](https://ollama.ai/download)
   - Start Ollama and pull a model: `ollama pull llama3`

## Installation

```bash
npm install
```

## Usage

```bash
npm start
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
npm start -- --model llama3 --temperature 0.8 --persist
```

## Tab Completion

The CLI supports tab completion for commands. Type a forward slash (/) followed by the beginning of a command and press Tab to see available completions.

For example:
- Type `/c` and press Tab to see completions like `/context`, `/clear`, etc.
- Type `/context` and press Tab to see subcommands like `/context show`, `/context add`, etc.

## Special Command Prefixes

- `!<command>` - Execute a bash command directly from the chat interface
  - Example: `!ls -la` will list files in the current directory
- `gh:<command>` - Execute a GitHub CLI command
  - Example: `gh:pr list` will list pull requests
  - Example: `gh:pr view 123` will show details for PR #123

## Available Commands

- `/help` - Display help message
- `/history` - Show conversation history
- `/new` - Start a new conversation
- `/list` - List all conversations
- `/switch <id>` - Switch to a different conversation
- `/delete <id>` - Delete a conversation
- `/system <prompt>` - Update the system prompt
- `/temp <value>` - Update the temperature setting
- `/model <n>` - Change the model
- `/models` - List all available models
- `/context` - Manage context files and hooks for the chat session
- `/tools` - List available tools and their keywords
- `/usage` - Display token usage statistics
- `/exit` - Exit the chat

### Context Commands

- `/context help` - Show context help
- `/context show` - Display current context configuration
- `/context tokens` - Display token counts for context files
- `/context add <file1> [file2...]` - Add file(s) to context
- `/context rm <file1> [file2...]` - Remove file(s) from context
- `/context clear` - Clear all files from current context
- `/context hooks` - View and manage context hooks

## Token Usage Tracking

hikma tracks token usage for both prompts and completions. You can view your current token usage statistics with the `/usage` command, which displays:

- Prompt tokens used
- Completion tokens used
- Total tokens used

## Tool System

hikma includes a tool system that allows the LLM to use specialized tools for specific tasks. Tools are automatically detected based on keywords in user messages. Use the `/tools` command to see available tools and their associated keywords.

## Memory Management

The application implements two types of memory managers:

1. **MemoryManager**: In-memory storage for conversation history
2. **SqliteMemoryManager**: Persistent storage using SQLite database

Both managers provide the same interface for:
- Creating and managing conversations
- Adding and retrieving messages
- Formatting conversation history for LLM context

## Context Management

The context management feature allows you to add files to your chat sessions, providing the LLM with additional context when responding to your queries. This is particularly useful for:

- Code review and analysis
- Documentation questions
- Project-specific inquiries
- File-based discussions

### Context Features

1. **File Context**: Add any text-based file to provide context to the LLM
2. **Per-Conversation Context**: Each conversation maintains its own context files
3. **Automatic Cleanup**: Context is automatically cleaned when conversations are deleted
4. **File Type Support**: Supports common programming languages, configuration files, and text files
5. **Size Limits**: Files are limited to 1MB to ensure optimal performance
6. **Context Hooks**: Advanced feature for dynamic context generation
