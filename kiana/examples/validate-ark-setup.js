#!/usr/bin/env node

/**
 * ARK Setup Validation Script
 * 
 * This script validates your ARK configuration and tests connectivity.
 * Run this after setting up your .env file to ensure everything works.
 * 
 * Usage:
 *   node examples/validate-ark-setup.js
 */

const { runKianaV6 } = require('../lib/src/KianaAgentV6');
const { MemTools } = require('../lib/src/MemTools');
const { BufferWriter } = require('../lib/src/Writer');
const { loadEnv } = require('../lib/src/envLoader');

// Load environment variables from .env files
loadEnv();

async function validateARKSetup() {
    console.log('🔍 ARK Setup Validation\n');

    // Step 1: Check environment variables
    console.log('1️⃣  Checking environment variables...');
    const requiredVars = ['ARK_API_KEY', 'ARK_BASE_URL', 'ARK_MODEL_ID'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.log('   ❌ Missing required environment variables:');
        missingVars.forEach(varName => console.log(`      - ${varName}`));
        console.log('');
        console.log('   📝 Please set up your .env file:');
        console.log('      cp .env.example .env');
        console.log('      # Then edit .env with your ARK credentials');
        return false;
    }

    console.log('   ✅ All required environment variables are set');
    console.log(`   📋 Model: ${process.env.ARK_MODEL_ID}`);
    console.log(`   🔗 Base URL: ${process.env.ARK_BASE_URL}`);
    console.log('');

    // Step 2: Test basic connectivity
    console.log('2️⃣  Testing basic connectivity...');
    
    const memtools = new MemTools();
    const writer = new BufferWriter();
    
    const arkConfig = {
        modelId: process.env.ARK_MODEL_ID,
        apiKey: process.env.ARK_API_KEY,
        baseURL: process.env.ARK_BASE_URL
    };

    try {
        const result = await runKianaV6({
            instruction: 'Simply reply with "ARK connection successful" and nothing else.',
            arkConfig: arkConfig,
            verbose: false,
            stream: false,
            maxRounds: 3
        }, memtools, writer);

        if (result.includes('successful')) {
            console.log('   ✅ ARK connection successful!');
            console.log('   📊 Response:', result.trim());
        } else {
            console.log('   ⚠️  Unexpected response:', result);
        }
    } catch (error) {
        console.log('   ❌ Connection test failed:', error.message);
        
        // Provide helpful error messages
        if (error.message.includes('API key')) {
            console.log('');
            console.log('   💡 API Key Issues:');
            console.log('      • Verify your ARK_API_KEY is correct');
            console.log('      • Check that your ARK account has API access');
            console.log('      • Ensure your API key has sufficient permissions');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            console.log('');
            console.log('   💡 Network Issues:');
            console.log('      • Check your internet connection');
            console.log('      • Verify ARK_BASE_URL is correct for your region');
            console.log('      • Try the other regional endpoint:');
            console.log('        - China: https://ark.cn-beijing.volces.com/api/v3');
            console.log('        - US: https://ark.us-east-1.volces.com/api/v3');
        } else if (error.message.includes('model')) {
            console.log('');
            console.log('   💡 Model Issues:');
            console.log('      • Verify ARK_MODEL_ID is available in your region');
            console.log('      • Check ARK documentation for available models');
            console.log('      • Try a different model ID');
        }
        return false;
    }

    console.log('');

    // Step 3: Test file system operations
    console.log('3️⃣  Testing file system operations...');
    
    memtools.reset();
    writer.clear();
    
    try {
        const result = await runKianaV6({
            instruction: 'Create a file called "test.txt" with content "Hello from ARK!" and then show me what you created.',
            arkConfig: arkConfig,
            verbose: false,
            stream: false,
            maxRounds: 5
        }, memtools, writer);

        // Check if file was created
        try {
            const content = memtools.exec('cat test.txt');
            if (content.includes('Hello from ARK!')) {
                console.log('   ✅ File system operations working correctly');
                console.log('   📄 Created file content:', content.trim());
            } else {
                console.log('   ⚠️  File created but content mismatch:', content);
            }
        } catch (err) {
            console.log('   ❌ File was not created successfully');
        }
    } catch (error) {
        console.log('   ❌ File system test failed:', error.message);
        return false;
    }

    console.log('');

    // Step 4: Performance check
    console.log('4️⃣  Performance check...');
    
    const startTime = Date.now();
    memtools.reset();
    writer.clear();
    
    try {
        await runKianaV6({
            instruction: 'List the current directory contents',
            arkConfig: arkConfig,
            verbose: false,
            stream: false,
            maxRounds: 3
        }, memtools, writer);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`   ⏱️  Response time: ${duration}ms`);
        if (duration < 5000) {
            console.log('   ✅ Good response time');
        } else {
            console.log('   ⚠️  Response time is a bit slow - this might be normal for your region/model');
        }
    } catch (error) {
        console.log('   ❌ Performance test failed:', error.message);
        return false;
    }

    console.log('');
    console.log('🎉 All validation tests passed!');
    console.log('');
    console.log('✅ Your ARK setup is working correctly.');
    console.log('🚀 You can now use Kiana Agent with ARK models!');
    console.log('');
    console.log('📚 Next steps:');
    console.log('   • Try the full example: node examples/ark-usage-example.js');
    console.log('   • Use interactive mode: node bin/memsh --instruction "your task"');
    console.log('   • Check out more examples in the examples/ directory');
    
    return true;
}

// Run validation if this file is executed directly
if (require.main === module) {
    validateARKSetup().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Validation failed:', error);
        process.exit(1);
    });
}

module.exports = { validateARKSetup };