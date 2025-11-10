/**
 * Example usage of Kiana Agent with AI SDK v6 and ARK OpenAI compatible models
 */

import { runKianaV6 } from '../src/KianaAgentV6';
import { MemTools } from '../src/MemTools';
import { Writer } from '../src/Writer';

async function exampleARKUsage() {
  console.log('🤖 Kiana Agent with AI SDK v6 - ARK Example\n');

  // Initialize MemTools and Writer
  const memtools = new MemTools();
  const writer = new Writer();

  // Configure ARK model
  const arkConfig = {
    modelId: 'your-ark-model-id', // Replace with your ARK model ID
    apiKey: process.env.ARK_API_KEY || 'your-ark-api-key',
    baseURL: process.env.ARK_BASE_URL || 'https://ark-runtime-api.aiheima.com/v1'
  };

  // Example instruction
  const instruction = `
    Please analyze the current directory structure and provide:
    1. A list of all files and directories
    2. The total size of files in the directory
    3. Identify any large files (>1MB)
    4. Suggest any optimizations
  `;

  try {
    console.log('📝 Instruction:', instruction);
    console.log('🔄 Processing with ARK model...\n');

    // Run Kiana with ARK configuration
    const result = await runKianaV6({
      instruction,
      arkConfig,
      verbose: true, // Enable verbose logging
      stream: true,  // Enable streaming for real-time output
      maxRounds: 15  // Limit execution rounds
    }, memtools, writer);

    console.log('\n✅ Execution complete!');
    console.log('📊 Final result:', result);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  }
}

async function exampleOpenAIUsage() {
  console.log('🤖 Kiana Agent with AI SDK v6 - OpenAI Example\n');

  // Initialize MemTools and Writer
  const memtools = new MemTools();
  const writer = new Writer();

  // Example instruction for OpenAI
  const instruction = `
    Create a simple Node.js project structure with:
    1. A package.json file
    2. An src directory with an index.js file
    3. A README.md file
    4. Show me the final structure
  `;

  try {
    console.log('📝 Instruction:', instruction);
    console.log('🔄 Processing with OpenAI...\n');

    // Run Kiana with OpenAI (no arkConfig needed)
    const result = await runKianaV6({
      instruction,
      model: 'gpt-4o-mini', // Specify OpenAI model
      verbose: true,
      stream: false, // Non-streaming mode
      maxRounds: 10
    }, memtools, writer);

    console.log('\n✅ Execution complete!');
    console.log('📊 Final result:', result);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  }
}

async function exampleWithToolApproval() {
  console.log('🤖 Kiana Agent with Tool Approval Example\n');

  // This example shows how to implement tool approval
  // Note: This requires UI integration for approval handling

  const memtools = new MemTools();
  const writer = new Writer();

  // Example with sensitive operations that might need approval
  const instruction = `
    Please clean up the directory by:
    1. Finding all .log files
    2. Removing files older than 30 days
    3. Show me what was removed
  `;

  // This would require modifying the tool to include needsApproval
  // See KianaAgentV6.ts for how to implement this
  
  console.log('💡 Tool approval example - see code comments for implementation');
}

// Main execution
if (require.main === module) {
  // Run examples based on command line argument
  const example = process.argv[2];
  
  switch (example) {
    case 'ark':
      exampleARKUsage().catch(console.error);
      break;
    case 'openai':
      exampleOpenAIUsage().catch(console.error);
      break;
    case 'approval':
      exampleWithToolApproval().catch(console.error);
      break;
    default:
      console.log('Usage: node ark-usage-example.ts [ark|openai|approval]');
      console.log('Running ARK example by default...');
      exampleARKUsage().catch(console.error);
  }
}

export {
  exampleARKUsage,
  exampleOpenAIUsage,
  exampleWithToolApproval
};