#!/usr/bin/env node

/**
 * Example: Using MemTools with OpenAI Responses API (Function Calling)
 *
 * This example demonstrates how to use MemTools as an OpenAI function/tool
 * to give the LLM access to an in-memory file system.
 *
 * Install: npm install openai
 * Usage: OPENAI_API_KEY=sk-xxx node examples/llm-tool-openai.js
 */

const { MemTools } = require('../src/MemTools');
const OpenAILib = require('openai');

async function main() {
    // Initialize MemTools
    const memtools = new MemTools();

    // Get tool definition for OpenAI and adapt to Responses API expected shape
    const legacyTool = memtools.getOpenAIToolDefinition();
    const tool = {
        type: 'function',
        name: legacyTool.function.name,
        description: legacyTool.function.description,
        parameters: legacyTool.function.parameters,
    };

    console.log('=== OpenAI Tool Definition ===');
    console.log(JSON.stringify(tool, null, 2));
    console.log('');

    // Create OpenAI client (requires OPENAI_API_KEY in environment)
    const OpenAI = OpenAILib.OpenAI || OpenAILib;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Initial conversation
    const instructions = 'You are a helpful assistant with access to an in-memory file system. Use the memfs_exec tool to create, read, and manipulate files.';
    const userPrompt = 'Create a JavaScript file called hello.js that prints "Hello from LLM!" and then execute it.';

    console.log('=== Step 1: LLM decides to create file ===');
    const response1 = await openai.responses.create({
        model: 'gpt-4o',
        instructions,
        input: userPrompt,
        tools: [tool]
    });

    // Extract the tool/function call from the Responses API output
    const functionCallItem = (response1.output || []).find(item => item.type === 'function_call');
    if (!functionCallItem) {
        console.log('No tool call returned by the model. Full response:');
        console.log(JSON.stringify(response1, null, 2));
        return;
    }

    console.log('\nLLM wants to call:', functionCallItem.name);
    console.log('With arguments:', functionCallItem.arguments);

    // Execute the tool call
    const args = JSON.parse(functionCallItem.arguments || '{}');
    const result1 = memtools.exec(args.command);

    console.log('\n=== Tool Execution Result ===');
    console.log('Command:', args.command);
    console.log('Output:', result1 || '(success - no output)');

    // Submit the tool output back to the Responses API to let the model continue
    const followUpMessages = [
        functionCallItem,
        {
            type: 'function_call_output',
            call_id: functionCallItem.call_id,
            output: result1 || '(success - no output)'
        }
    ];

    const response2 = await openai.responses.create({
        model: 'gpt-4o',
        tools: [tool],
        previous_response_id: response1.id,
        input: followUpMessages
    });

    console.log('\n=== Assistant Follow-up (after tool output) ===');
    // Some SDKs expose a convenience field; otherwise print the structured output
    if (response2.output_text) {
        console.log(response2.output_text);
    } else {
        console.log(JSON.stringify(response2.output, null, 2));
    }

    // Second local step: execute the created file (outside LLM, for demo)
    console.log('\n=== Step 2: Execute the created file ===');
    const result2 = memtools.exec('node hello.js');
    console.log('Command: node hello.js');
    console.log('Output:', result2);

    // Show file system state
    console.log('\n=== Current File System State ===');
    const files = memtools.exec('ls -l');
    console.log(files);

    console.log('\n=== File Contents ===');
    const content = memtools.exec('cat hello.js');
    console.log(content);

    // Example: Complex multi-step File Processing
    console.log('\n=== Example: Multi-step File Processing ===');

    // Create data file
    memtools.exec(`cat > data.txt << EOF
INFO: Application started
ERROR: Connection failed
WARN: Retrying connection
ERROR: Timeout occurred
INFO: Application stopped
EOF`);

    // Filter errors
    memtools.exec('cat data.txt | grep ERROR > errors.txt');

    // Show results
    console.log('Created data.txt and filtered errors:');
    console.log(memtools.exec('cat errors.txt'));

    // Export state for persistence
    console.log('\n=== Export File System State ===');
    const state = memtools.exportState();
    console.log('State exported. Files in root:', state.root.children.map(c => c.name).join(', '));

    console.log('\n=== Integration Complete ===');
    console.log('The LLM can now:');
    console.log('- Create and manipulate files');
    console.log('- Execute JavaScript code');
    console.log('- Use pipes and text processing');
    console.log('- Maintain state across multiple tool calls');
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };
