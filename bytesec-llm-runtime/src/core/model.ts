import type { ModelConfig, ModelConnection, ModelProvider } from "../types";

export type ModelRegistry = {
  register: (provider: ModelProvider) => void;
  list: () => ReadonlyArray<ModelProvider>;
  get: (id: string) => ModelProvider | undefined;
  connect: (id: string, config: ModelConfig) => Promise<ModelConnection>;
};

export const createModelRegistry = (
  providers: ReadonlyArray<ModelProvider> = []
): ModelRegistry => {
  const map = new Map<string, ModelProvider>();
  for (const provider of providers) {
    map.set(provider.id, provider);
  }

  const register = (provider: ModelProvider) => {
    if (map.has(provider.id)) {
      throw new Error(`Provider already registered: ${provider.id}`);
    }
    map.set(provider.id, provider);
  };

  const list = () => Array.from(map.values());

  const get = (id: string) => map.get(id);

  const connect = (id: string, config: ModelConfig) => {
    const provider = map.get(id);
    if (!provider) {
      throw new Error(`Unknown provider: ${id}`);
    }
    return provider.connect(config);
  };

  return { register, list, get, connect };
};
