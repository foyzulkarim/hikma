# Hikma Configuration Guide

This document explains how to configure Hikma, including environment variables, configuration files, and command-line options.

## Configuration Priority

Hikma loads configuration from multiple sources with the following priority (highest to lowest):

1. Command line arguments
2. Environment variables
3. Local `.env` file in the current directory
4. Global config file (`~/.hikma/config.env`)
5. Default values

## Environment Variables

### Ollama Configuration

```
OLLAMA_BASE_URL=http://localhost:11434/api
OLLAMA_DEFAULT_MODEL=llama3.2:latest
```

### Memory Configuration

```
PERSIST_MEMORY=true
MAX_MESSAGES=100
SUMMARIZE_THRESHOLD=50
```

### Settings

```
TEMPERATURE=0.7
MAX_TOKENS=30000
SYSTEM_PROMPT="You are a helpful assistant. Respond concisely and accurately."
INCLUDE_SYSTEM_PROMPT=true
```

## Configuration Files

### Local Configuration

Create a `.env` file in your current working directory:

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
INCLUDE_SYSTEM_PROMPT=true
```

### Global Configuration

Hikma also supports a global configuration file located at `~/.hikma/config.env`. This file follows the same format as the local `.env` file.

You can manage this global configuration using the `hikma config` commands:

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

## Command Line Options

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

# Enable persistent memory
hikma --persist
```

## Configuration Keys

Here's a complete list of configuration keys and their default values:

| Configuration Key | Default Value | Description |
|------------------|---------------|-------------|
| `ollama.baseUrl` | `http://localhost:11434/api` | Ollama API base URL |
| `ollama.defaultModel` | `llama3.2:latest` | Default model to use |
| `memory.persistMemory` | `true` | Whether to persist conversations |
| `memory.maxMessages` | `100` | Maximum messages per conversation |
| `memory.summarizeThreshold` | `50` | When to summarize conversation |
| `settings.includeSystemPrompt` | `true` | Whether to include system prompt |
| `settings.systemPrompt` | `"You are a helpful assistant..."` | System prompt |
| `settings.temperature` | `0.7` | Temperature for generation |
| `settings.maxTokens` | `30000` | Maximum tokens for generation |

## Using in Scripts

When using Hikma in scripts or other applications, you can set environment variables programmatically:

```javascript
// Set environment variables before requiring Hikma
process.env.OLLAMA_DEFAULT_MODEL = 'llama3.2:latest';
process.env.TEMPERATURE = '0.8';

// Then import and use Hikma
import { ChatSession } from 'hikma';
```

## Docker Usage

When using Hikma with Docker, you can pass environment variables using the `-e` flag:

```bash
docker run -it --rm \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434/api \
  -e OLLAMA_DEFAULT_MODEL=llama3.2:latest \
  -e TEMPERATURE=0.8 \
  -v ~/.hikma:/root/.hikma \
  hikma
```