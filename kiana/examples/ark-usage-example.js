#!/usr/bin/env node

/**
 * ARK LLM Usage Example
 * 
 * This example demonstrates how to use Kiana Agent with ARK models.
 * Make sure you have set up your .env file with ARK credentials first.
 * 
 * Usage:
 *   node examples/ark-usage-example.js
 * 
 * Or with custom configuration:
 *   ARK_MODEL_ID=doubao-pro-32k ARK_API_KEY=your-key node examples/ark-usage-example.js
 */

const { runKianaV6 } = require('../lib/KianaAgentV6');
const { MemTools } = require('../lib/MemTools');
const { BufferWriter } = require('../lib/Writer');

// Load environment variables
require('dotenv').config();

async function arkExample() {
    console.log('🚀 Kiana Agent - ARK LLM Usage Example\n');

    // Check if ARK credentials are available
    if (!process.env.ARK_API_KEY) {
        console.log('❌ ARK_API_KEY not found in environment variables.');
        console.log('📝 Please copy .env.example to .env and fill in your ARK credentials.');
        console.log('   Then run: cp .env.example .env && edit .env');
        return;
    }

    // Setup tools and writer
    const memtools = new MemTools();
    const writer = new BufferWriter();

    // Configure ARK options
    const arkConfig = {
        modelId: process.env.ARK_MODEL_ID || 'doubao-pro-32k',
        apiKey: process.env.ARK_API_KEY,
        baseURL: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
    };

    console.log('📋 Configuration:');
    console.log(`   Model: ${arkConfig.modelId}`);
    console.log(`   Base URL: ${arkConfig.baseURL}`);
    console.log(`   Max Rounds: ${process.env.MAX_ROUNDS || 10}`);
    console.log(`   Verbose: ${process.env.VERBOSE === 'true'}`);
    console.log('');

    // Example 1: Simple file system analysis
    console.log('🔍 Example 1: File System Analysis');
    console.log('   Instruction: List all files in the current directory and show their sizes');
    
    try {
        const result1 = await runKianaV6({
            instruction: 'List all files in the current directory and show their sizes',
            arkConfig: arkConfig,
            verbose: process.env.VERBOSE === 'true',
            stream: false,
            maxRounds: parseInt(process.env.MAX_ROUNDS) || 10
        }, memtools, writer);

        console.log('   Result:', result1.substring(0, 200) + '...');
        console.log('   ✓ Success!\n');
    } catch (error) {
        console.log('   ❌ Error:', error.message);
        console.log('');
    }

    // Reset tools for next example
    memtools.reset();
    writer.clear();

    // Example 2: Code analysis with streaming
    console.log('🔍 Example 2: Code Analysis (Streaming)');
    console.log('   Instruction: Analyze the main entry point of this project and explain what it does');
    
    try {
        const result2 = await runKianaV6({
            instruction: 'Analyze the main entry point of this project (index.js) and explain what it does',
            arkConfig: arkConfig,
            verbose: false,
            stream: true, // Enable streaming
            maxRounds: 15
        }, memtools, writer);

        console.log('   Result:', result2.substring(0, 300) + '...');
        console.log('   ✓ Success!\n');
    } catch (error) {
        console.log('   ❌ Error:', error.message);
        console.log('');
    }

    // Example 3: Complex task with multiple steps
    console.log('🔍 Example 3: Multi-step Task');
    console.log('   Instruction: Create a simple Node.js project structure with package.json and a basic server');
    
    try {
        const result3 = await runKianaV6({
            instruction: 'Create a simple Node.js project structure with package.json and a basic HTTP server file. Use Express if available.',
            arkConfig: arkConfig,
            verbose: process.env.VERBOSE === 'true',
            stream: false,
            maxRounds: 20
        }, memtools, writer);

        console.log('   Result: Project structure created');
        
        // Show what was created
        const files = memtools.exec('find . -type f');
        console.log('   Created files:', files);
        console.log('   ✓ Success!\n');
    } catch (error) {
        console.log('   ❌ Error:', error.message);
        console.log('');
    }

    // Example 4: Error handling demonstration
    console.log('🔍 Example 4: Error Handling');
    console.log('   Instruction: Try to access a non-existent file and handle the error gracefully');
    
    try {
        const result4 = await runKianaV6({
            instruction: 'Try to read a file called "nonexistent.txt" and explain what happens',
            arkConfig: arkConfig,
            verbose: false,
            stream: false,
            maxRounds: 5
        }, memtools, writer);

        console.log('   Result:', result4);
        console.log('   ✓ Success!\n');
    } catch (error) {
        console.log('   ❌ Error:', error.message);
        console.log('');
    }

    console.log('🎉 All examples completed!');
    console.log('');
    console.log('💡 Tips for using ARK models:');
    console.log('   • Use doubao-lite models for faster, cheaper responses');
    console.log('   • Use doubao-pro models for more complex reasoning tasks');
    console.log('   • Enable streaming for real-time responses');
    console.log('   • Set appropriate maxRounds for your use case');
    console.log('   • Monitor your API usage in the ARK dashboard');
    console.log('');
    console.log('📚 Next steps:');
    console.log('   • Try different ARK models by changing ARK_MODEL_ID');
    console.log('   • Experiment with different instructions and tasks');
    console.log('   • Use the interactive mode: node bin/memsh --instruction "your task"');
    console.log('   • Check out more examples in the examples/ directory');
}

// Run the example if this file is executed directly
if (require.main === module) {
    arkExample().catch(console.error);
}

module.exports = { arkExample };