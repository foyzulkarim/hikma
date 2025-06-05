# Function Calling Guide for hikma

## Overview

Your hikma application now has a robust function calling system that can execute tools based on natural language prompts. The system has been enhanced with improved keyword matching and better LLM integration.

## What Was Fixed

### 1. **Improved Tool Matching Algorithm**
- **Before**: First-match system that would return the first tool with any keyword match
- **After**: Scoring-based system that finds the best match based on:
  - Length of matched keywords (longer = more specific)
  - Number of matched keywords (more matches = better score)
  - Only returns matches with reasonable confidence scores

### 2. **Enhanced Tool Keywords**
- Added more comprehensive keywords for existing tools
- `git_diff` now matches: `['diff', 'changes', 'git diff', 'check changes', 'show changes', 'what changed', 'changes made', 'modifications', 'git status changes', 'working directory changes']`

### 3. **Additional Tools Added**
- `git_status` - Show repository status
- `list_directory` - List files in current directory  
- `execute_command` - Execute arbitrary shell commands

### 4. **Fixed Duplicate Processing**
- Removed duplicate tool processing from main loop
- Now tool processing happens only in `ChatSession.sendMessage()`

### 5. **LLM Integration Enhancement**
- Added tool descriptions to system prompts
- LLM now knows about available tools and can suggest their usage

## Testing Your Function Calling

### Test Cases That Now Work:

```bash
# Your original prompt now works correctly:
"can you check the changes i made so far? probably you need to run git diff"
# → Executes git_diff tool

# Other working prompts:
"show me what changed"
"what modifications did I make?"
"git diff please"
"check the changes"
"show current git status"
"list files in this directory"
"what files are here?"
```

## Recommended LLM Models for Function Calling

### Best Models for Function Calling:

1. **Claude 3.5 Sonnet** (if using via API)
   - Excellent function calling capabilities
   - Great at understanding context and tool requirements
   - Available through Anthropic API

2. **GPT-4 / GPT-3.5-turbo** (if using via API)
   - Native function calling support
   - Good at tool selection and parameter extraction

3. **For Local Ollama Models:**

   **Highly Recommended:**
   - `llama3.2:3b-instruct` - Good balance of performance and function understanding
   - `llama3.1:8b-instruct` - Better reasoning, good for tool selection
   - `mistral:7b-instruct` - Fast and good at following instructions
   - `codegemma:7b-instruct` - Excellent for code-related tools

   **Download commands:**
   ```bash
   ollama pull llama3.2:3b-instruct
   ollama pull llama3.1:8b-instruct  
   ollama pull mistral:7b-instruct
   ollama pull codegemma:7b-instruct
   ```

   **Good Options:**
   - `qwen2.5:7b-instruct` - Good multilingual and reasoning
   - `phi3:3.8b` - Lightweight but capable
   - `gemma2:9b-instruct` - Good overall performance

### Model Configuration for Function Calling:

```bash
# Start with a good instruct model:
node src/index.js --model llama3.2:3b-instruct --temperature 0.3

# Lower temperature for more consistent tool selection:
node src/index.js --model mistral:7b-instruct --temperature 0.2
```

## Advanced Usage

### 1. **Add Custom Tools**

You can easily add new tools to `src/tools/ToolManager.js`:

```javascript
this.registerTool(
  'tool_name',
  this.handleToolName.bind(this),
  ['keyword1', 'keyword2', 'longer specific phrase'],
  'Description of what this tool does'
);
```

### 2. **Test Tool Matching**

```bash
# Test which tool matches your prompt:
node -e "
import { ToolManager } from './src/tools/ToolManager.js';
const tm = new ToolManager();
const prompt = 'your test prompt here';
const tool = tm.findMatchingTool(prompt);
console.log('Matched tool:', tool ? tool.name : 'none');
"
```

### 3. **Direct Tool Execution**

```bash
# Test tool execution directly:
node -e "
import { ToolManager } from './src/tools/ToolManager.js';
const tm = new ToolManager();
const result = await tm.executeToolFromPrompt('git diff');
console.log('Result:', result);
"
```

## Troubleshooting

### If Tools Aren't Being Triggered:

1. **Check Available Tools:**
   ```
   /tools
   ```

2. **Test Tool Matching:**
   Use the test script above to see which tool (if any) matches your prompt

3. **Add More Keywords:**
   If your prompt doesn't match, add more keywords to the relevant tool

4. **Check Model Performance:**
   Some models are better at understanding tool context. Try:
   - `llama3.2:3b-instruct` for better instruction following
   - Lower temperature (0.2-0.4) for more consistent responses

### Common Issues:

1. **Wrong Tool Selected:** Improve keyword specificity in `ToolManager.js`
2. **No Tool Selected:** Add more comprehensive keywords
3. **Tool Execution Fails:** Check that required commands (git, gh, etc.) are installed

## Example Session

```
You: can you check what changes I made?
Assistant (using git_diff): [Shows git diff output]

You: what's the status of my repository?  
Assistant (using git_status): [Shows git status output]

You: list the files here
Assistant (using list_directory): [Shows directory contents]

You: can you help me with JavaScript concepts?
Assistant: [Regular LLM response since no tool matches]
```

## Next Steps

1. **Test the improved system** with your original prompt
2. **Try different models** to see which works best for your use case
3. **Add custom tools** for your specific workflow needs
4. **Adjust keywords** if certain prompts aren't matching the right tools

The system now provides a much better balance between tool execution and regular LLM responses! 
