import { z } from "zod";

const ConfigSchema = z.object({
  openaiKey: z.string().optional(),
  anthropicKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

export type ResolvedConfig = z.infer<typeof ConfigSchema>;

export const loadConfig = (overrides: Partial<ResolvedConfig> = {}): ResolvedConfig => {
  const envConfig = {
    openaiKey: Bun.env.OPENAI_API_KEY ?? Bun.env.OPENAI_APIKEY,
    anthropicKey: Bun.env.ANTHROPIC_API_KEY,
    baseUrl: Bun.env.MYCODE_BASE_URL,
  } satisfies Partial<ResolvedConfig>;

  const merged = {
    ...envConfig,
    ...overrides,
  } satisfies Partial<ResolvedConfig>;

  return ConfigSchema.parse(merged);
};
