import type { LlmClient } from './types';
import { PROVIDER_CONFIGS, type RuntimeProviderConfig } from './types';
import { createOpenAiClient } from './openai-client';
import { createAnthropicClient } from './anthropic-client';
import { createOllamaClient } from './ollama-client';

export function createLlmClient(
  providerId: string,
  runtimeOverride?: Partial<Pick<RuntimeProviderConfig, 'baseUrl' | 'defaultModel'>>
): LlmClient {
  const baseCfg = PROVIDER_CONFIGS[providerId];
  const cfg = baseCfg
    ? {
        ...baseCfg,
        ...(runtimeOverride?.baseUrl !== undefined ? { baseUrl: runtimeOverride.baseUrl } : {}),
        ...(runtimeOverride?.defaultModel !== undefined ? { defaultModel: runtimeOverride.defaultModel } : {})
      }
    : undefined;
  if (!cfg) throw new Error(`Unknown provider: ${providerId}`);

  switch (cfg.format) {
    case 'openai':
      return createOpenAiClient({ baseUrl: cfg.baseUrl, defaultModel: cfg.defaultModel });
    case 'anthropic':
      return createAnthropicClient({ baseUrl: cfg.baseUrl, defaultModel: cfg.defaultModel });
    case 'ollama':
      return createOllamaClient({ baseUrl: cfg.baseUrl, defaultModel: cfg.defaultModel });
  }
}
