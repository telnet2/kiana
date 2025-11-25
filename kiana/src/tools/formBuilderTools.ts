/**
 * Form Builder Tools for Kiana Agent
 *
 * Provides form building tools that can be injected into the Kiana agent.
 * Uses AI SDK v6's generative UI pattern where tool output drives client-side UI rendering.
 *
 * Example usage:
 * ```typescript
 * import { createFormBuilderTools } from '@byted/kiana/tools/formBuilderTools';
 *
 * const formTools = createFormBuilderTools();
 * const agent = await createKianaAgent(memtools, {
 *   instruction: 'Create a contact form',
 *   arkConfig: { ... },
 *   additionalTools: formTools,
 * });
 * ```
 *
 * The displayForm tool accepts raw HTML and renders it as an interactive form
 * on the client. When submitted, the form data is returned to the chat as JSON.
 */

import { tool } from 'ai';
import { z } from 'zod';

/**
 * Form data interface - passed to the client for rendering
 */
export interface FormDisplayData {
  formId: string;
  html: string;
  title?: string;
}

/**
 * Form submission result - returned when user submits the form
 */
export interface FormSubmissionResult {
  formId: string;
  data: Record<string, any>;
  submittedAt: string;
}

/**
 * Display form tool - renders HTML form on the client
 *
 * This tool accepts raw HTML string containing a form and renders it
 * as an interactive component. The HTML should include:
 * - Form elements (input, select, textarea, etc.)
 * - Submit button
 * - HTML5 validation attributes (required, pattern, min, max, etc.)
 *
 * When the form is submitted, the data is serialized to JSON and
 * sent back to the chat conversation.
 */
const createDisplayFormTool = () =>
  tool({
    description:
      'Display an interactive HTML form to the user. The form will be rendered in the browser and when submitted, the form data will be returned as JSON. Include HTML5 validation attributes like required, pattern, min, max for validation.',
    inputSchema: z.object({
      html: z
        .string()
        .describe(
          'The HTML string containing the form. Should include form elements with name attributes and a submit button. Example: <form><input type="email" name="email" required /><button type="submit">Submit</button></form>'
        ),
      title: z
        .string()
        .optional()
        .describe('Optional title to display above the form'),
    }),
    outputSchema: z.object({
      formId: z.string().describe('Unique identifier for this form instance'),
      rendered: z.boolean().describe('Whether the form was successfully rendered'),
      message: z.string().describe('Status message about the form display'),
    }),
    execute: async ({ html, title }: { html: string; title?: string }) => {
      // Generate a unique form ID
      const formId = `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        formId,
        rendered: true,
        message: `Form ${title ? `"${title}" ` : ''}is now being displayed. The user can fill it out and submit to return the data as JSON.`,
      };
    },
  });

/**
 * Create form builder tools for injection into Kiana agent
 *
 * The returned tools use AI SDK v6's generative UI pattern:
 * - displayForm: Renders an HTML form and returns submitted data as JSON
 *
 * When Kiana needs to collect user input:
 * 1. It calls displayForm with the HTML form string
 * 2. The client renders the form as an interactive UI component
 * 3. User fills out and submits the form
 * 4. Form data is serialized to JSON and returned to the chat
 *
 * @returns Record of tools ready to be injected via additionalTools option
 *
 * @example
 * ```typescript
 * const formTools = createFormBuilderTools();
 * const agent = await createKianaAgent(memtools, {
 *   instruction: 'Create a user registration form',
 *   arkConfig: arkConfig,
 *   additionalTools: formTools,
 * });
 * ```
 */
export const createFormBuilderTools = (): Record<string, any> => {
  return {
    displayForm: createDisplayFormTool(),
  };
};
