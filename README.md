# Hikma CLI

CLI chat interface for Ollama with conversation memory.

## Environment Variables

You can configure the application using environment variables in a `.env` file:

```
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
```

## Usage

```bash
# Start with default settings from .env file
npm start

# Override settings from command line
npm start -- --model llama3.2:3b-instruct --temperature 0.3
```

## Available Commands

Type `/help` in the chat interface to see all available commands.