# Hikma

A CLI chat interface for Ollama with conversation memory.

## Installation

```bash
npm install -g hikma
```

## Usage

Simply run:

```bash
hikma
```

### Command Line Options

```
Options:
  -m, --model <model>          Specify the model to use
  -t, --temperature <temp>     Set the temperature (0.0-1.0)
  -p, --persist                Enable persistent memory storage
  -s, --system <prompt>        Set a custom system prompt
  -n, --no-system              Disable system prompt
  -c, --config <path>          Path to config file
  -h, --help                   Display help information
```

### Chat Commands

Once in the chat interface, you can use these commands:

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
- `/exit` - Exit the chat

### Special Prefixes

- `!<command>` - Execute a bash command
- `gh:<command>` - Execute a GitHub CLI command

## Requirements

- Node.js >= 14.16
- Ollama running locally (default: http://localhost:11434)

## License

MIT
