/**
 * Kiana Agent - AI SDK v6 Implementation
 * 
 * Modern implementation using AI SDK v6 with ToolLoopAgent for better
 * performance, maintainability, and ARK OpenAI compatible model support.
 */

import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { MemTools } from './MemTools';
import { Writer } from './Writer';

/**
 * ARK Configuration Interface
 */
export interface ARKConfig {
  modelId: string;
  apiKey: string;
  baseURL: string;
}

/**
 * Options for running Kiana agent with AI SDK v6
 */
export interface KianaOptionsV6 {
  /** User instruction/task (optional for Agent UI runs) */
  instruction?: string;
  /** System prompt (defaults to DEFAULT_SYSTEM_PROMPT) */
  systemPrompt?: string;
  /** Model to use (defaults to gpt-4o-mini for OpenAI) */
  model?: string;
  /** Maximum tool-call rounds (maps to stopWhen) */
  maxRounds?: number;
  /** Verbose logging */
  verbose?: boolean;
  /** ARK configuration for ARK models */
  arkConfig?: ARKConfig;
  /** Enable streaming mode */
  stream?: boolean;
}

/**
 * Default system prompt for Kiana agent
 * (Preserved from original implementation)
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Kiana, an expert software engineer with access to an in-memory filesystem.

You have access to the memfs_exec tool which executes shell commands in the in-memory filesystem.

Available commands:
- File operations: ls, cat, touch, rm, write
- Directory operations: pwd, cd, mkdir
- Text processing: echo, grep, sed, diff, patch, find, jqn, wc
- Utilities: date, man
- JSON processing: jqn (JSON query with jq syntax)
- Network: curl (transfer data using URLs)
- I/O: import, export (between MemFS and real filesystem)
- Execution: node (sandboxed JavaScript execution)

The filesystem supports:
- Pipelines: cmd1 | cmd2
- Redirections: cmd > file, cmd >> file, cmd << EOF
- Operators: cmd1 && cmd2, cmd1 || cmd2, cmd1 ; cmd2
- Wildcards: *.txt, file?.js
- Command substitution: $(command) - replaces with command output

Useful patterns:
- Count files: ls | wc -l
- Query JSON: echo '{"name":"John"}' | jqn .name
- Make HTTP requests: curl http://example.com or curl -X POST -d "data" http://api.example.com
- Complex filtering: grep pattern file.txt | wc -l

Best practices:
1. Use 'ls' and 'cat' to verify your work
2. Break complex tasks into steps
3. Check command output before proceeding
4. Use command substitution for dynamic values: echo "Today is $(date)"
5. Use pipes to chain operations efficiently
6. Use 'man <command>' or '<command> --help' to see detailed command documentation
7. Provide a summary when complete

When you finish the task, provide a clear summary of what you accomplished.`;

/**
 * Create ARK OpenAI-compatible provider
 */
const createARKProvider = (config: ARKConfig) => {
  return createOpenAICompatible({
    baseURL: config.baseURL,
    name: 'ark',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });
};

/**
 * Convert MemTools to ai-sdk tool format
 */
const createMemfsTool = (memtools: MemTools) => 
  tool({
    description: 'Execute shell commands in the in-memory filesystem',
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute'),
    }),
    outputSchema: z.object({
      result: z.string(),
      success: z.boolean(),
    }),
    execute: async ({ command }) => {
      try {
        const result = memtools.exec(command);
        return { result, success: true };
      } catch (error) {
        return { 
          result: `ERROR: ${error instanceof Error ? error.message : String(error)}`, 
          success: false 
        };
      }
    },
  });

/**
 * Create Kiana agent with AI SDK v6
 */
export const createKianaAgent = async (
  memtools: MemTools,
  options: KianaOptionsV6
) => {
  const verbose = options.verbose || false;
  const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const maxRounds = options.maxRounds || 20;

  // Setup model provider
  let model;
  
  if (options.arkConfig) {
    if (verbose) {
      console.log(`[Kiana] Using ARK model: ${options.arkConfig.modelId}`);
      console.log(`[Kiana] ARK Base URL: ${options.arkConfig.baseURL}`);
    }
    const ark = createARKProvider(options.arkConfig);
    model = ark.chatModel(options.arkConfig.modelId);
  } else {
    // Fallback to OpenAI
    if (verbose) {
      console.log(`[Kiana] Using OpenAI model: ${options.model || 'gpt-4o-mini'}`);
    }
    const { openai } = await import('@ai-sdk/openai');
    model = openai(options.model || 'gpt-4o-mini');
  }

  if (verbose) {
    console.log(`[Kiana] Creating ToolLoopAgent with maxRounds: ${maxRounds}`);
  }

  return new ToolLoopAgent({
    model,
    instructions: systemPrompt,
    tools: {
      memfs_exec: createMemfsTool(memtools),
    },
    stopWhen: stepCountIs(maxRounds),
  });
};

/**
 * Run Kiana agent with AI SDK v6 (Streaming Mode)
 */
async function runKianaStreaming(
  agent: any, // Use any to avoid complex typing issues
  instruction: string,
  writer: Writer,
  verbose: boolean
): Promise<string> {
  if (verbose) {
    console.log('[Kiana] Starting streaming execution...');
  }

  const result = await agent.stream({
    prompt: instruction,
  });

  writer.write('Assistant: ');
  
  for await (const textPart of result.textStream) {
    writer.write(textPart);
  }
  
  writer.write('\n');
  
  const finalText = await result.text;
  const usage = await result.usage;
  
  if (verbose) {
    console.log(`[Kiana] Execution complete. Usage:`, usage);
  }
  
  return finalText;
}

/**
 * Run Kiana agent with AI SDK v6 (Non-Streaming Mode)
 */
async function runKianaRegular(
  agent: any, // Use any to avoid complex typing issues
  instruction: string,
  writer: Writer,
  verbose: boolean
): Promise<string> {
  if (verbose) {
    console.log('[Kiana] Starting regular execution...');
  }

  const result = await agent.generate({
    prompt: instruction,
  });

  writer.write('Assistant: ');
  writer.write(result.text);
  writer.write('\n');
  
  if (verbose) {
    console.log(`[Kiana] Execution complete. Usage:`, result.usage);
  }
  
  return result.text;
}

/**
 * Main function to run Kiana agent with AI SDK v6
 */
export async function runKianaV6(
  options: KianaOptionsV6,
  memtools: MemTools,
  writer: Writer
): Promise<string> {
  try {
    // Validate instruction
    if (!options.instruction || options.instruction.trim() === '') {
      throw new Error('Instruction is required');
    }

    // Create the agent
    const agent = await createKianaAgent(memtools, options);
    
    if (options.verbose) {
      console.log('[Kiana] Agent created successfully');
      console.log(`[Kiana] Instruction: ${options.instruction}`);
    }

    // Use the instruction
    const instruction = options.instruction;
    // Execute based on streaming preference
    if (options.stream) {
      return await runKianaStreaming(
        agent, 
        instruction, 
        writer, 
        options.verbose || false
      );
    } else {
      return await runKianaRegular(
        agent, 
        instruction, 
        writer, 
        options.verbose || false
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    writer.writeLine(`\n[Kiana] Error: ${errorMsg}`);
    
    if (options.verbose) {
      console.error('[Kiana] Full error:', error);
    }
    
    throw error;
  }
}

/**
 * Compatibility wrapper for existing API
 * Maintains backward compatibility with the original runKiana function
 */
export async function runKiana(
  options: KianaOptionsV6,
  memtools: MemTools,
  writer: Writer
): Promise<string> {
  // Map old options to new format (handle legacy apiKey)
  const legacyOptions = options as any;
  const v6Options: KianaOptionsV6 = {
    instruction: options.instruction,
    systemPrompt: options.systemPrompt,
    model: options.model,
    maxRounds: options.maxRounds,
    verbose: options.verbose,
    stream: false, // Default to non-streaming for compatibility
    // Map API key to ARK config if provided
    arkConfig: legacyOptions.apiKey ? {
      modelId: options.model || 'gpt-4o-mini',
      apiKey: legacyOptions.apiKey,
      baseURL: process.env.ARK_BASE_URL || 'https://ark-runtime-api.aiheima.com/v1'
    } : undefined
  };

  return runKianaV6(v6Options, memtools, writer);
}
