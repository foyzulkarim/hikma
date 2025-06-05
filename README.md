# Hikma

A CLI chat interface for Ollama with conversation memory and context management.

## Features

- Chat with Ollama LLMs from your terminal
- Persistent conversation memory
- Multiple conversation support
- Context management (add files to chat context)
- Global configuration support
- Command-line options for customization

## Installation

### Global Installation

```bash
npm install -g hikma
```

### Local Installation

```bash
npm install hikma
```

## Usage

### Basic Usage

```bash
hikma
```

### Command Line Options

```bash
# Use a specific model
hikma --model llama3.2:latest

# Set temperature
hikma --temperature 0.8

# Use a custom system prompt
hikma --system "You are a helpful coding assistant."

# Disable system prompt
hikma --no-system

# Specify Ollama API URL
hikma --base-url http://localhost:11434/api
```

## Environment Variables

Hikma supports configuration through environment variables:

```bash
# Ollama configuration
OLLAMA_BASE_URL=http://localhost:11434/api
OLLAMA_DEFAULT_MODEL=llama3.2:latest

# Memory configuration
PERSIST_MEMORY=true
MAX_MESSAGES=100
SUMMARIZE_THRESHOLD=50

# Settings
TEMPERATURE=0.7
MAX_TOKENS=30000
SYSTEM_PROMPT="You are a helpful assistant. Respond concisely and accurately."
INCLUDE_SYSTEM_PROMPT=true
```

## Configuration

Hikma loads configuration from multiple sources with the following priority (highest to lowest):

1. Command line arguments
2. Environment variables
3. Local `.env` file in the current directory
4. Global config file (`~/.hikma/config.env`)
5. Default values

### Managing Global Configuration

```bash
# Show current configuration
hikma config get

# Show specific configuration value
hikma config get ollama.defaultModel

# Set configuration value
hikma config set ollama.defaultModel llama3.2:latest
hikma config set settings.temperature 0.8

# Initialize global configuration interactively
hikma config init
```

## Chat Commands

Once in the chat interface, you can use the following commands:

- `/help` - Display help message
- `/history` - Show conversation history
- `/new` - Start a new conversation
- `/list` - List all conversations
- `/switch <id>` - Switch to a different conversation
- `/delete <id>` - Delete a conversation
- `/system <prompt>` - Update the system prompt
- `/temp <value>` - Update the temperature setting
- `/model <name>` - Change the model
- `/models` - List all available models
- `/context` - Manage context files and hooks
- `/tools` - List available tools
- `/usage` - Display token usage statistics
- `/config` - Show config command help
- `/exit` - Exit the chat

### Context Management

- `/context help` - Show context help
- `/context show` - Display current context configuration
- `/context tokens` - Display token counts for context files
- `/context add <file1> [file2...]` - Add file(s) to context
- `/context rm <file1> [file2...]` - Remove file(s) from context
- `/context clear` - Clear all files from current context
- `/context hooks` - View and manage context hooks

## License

MIT