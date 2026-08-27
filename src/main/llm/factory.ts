import type { LlmClient, ProviderConfig } from './types';
import { PROVIDER_CONFIGS } from './types';
import { createOpenAiClient } from './openai-client';
import { createAnthropicClient } from './anthropic-client';
import { createOllamaClient } from './ollama-client';

export type AccessMode = 'payg' | 'plan';

export interface ClientOptions {
  /**
   * 'payg' (default) hits the standard base URL.
   * 'plan' swaps to `ProviderConfig.tokenPlan.baseUrl` when the provider
   * declares one — for providers without a tokenPlan endpoint we silently
   * fall back to standard so the UI never traps a user in a broken state.
   */
  accessMode?: AccessMode;
  /**
   * Per-provider override (highest priority). Used by the Settings 高级 抽屉
   * for users who route through a corporate proxy or a third-party gateway
   * that doesn't fit either standard or plan endpoint.
   */
  baseUrlOverride?: string;
}

export interface ResolvedEndpoint {
  baseUrl: string;
  defaultModel: string;
  format: ProviderConfig['format'];
}

export function resolveProviderEndpoint(
  providerId: string,
  opts: ClientOptions = {}
): ResolvedEndpoint {
  const cfg = PROVIDER_CONFIGS[providerId];
  if (!cfg) throw new Error(`Unknown provider: ${providerId}`);

  if (opts.baseUrlOverride && opts.baseUrlOverride.trim() !== '') {
    return { baseUrl: opts.baseUrlOverride, defaultModel: cfg.defaultModel, format: cfg.format };
  }
  const baseUrl =
    opts.accessMode === 'plan' && cfg.tokenPlan
      ? cfg.tokenPlan.baseUrl
      : cfg.baseUrl;
  return { baseUrl, defaultModel: cfg.defaultModel, format: cfg.format };
}

export function createLlmClient(providerId: string, opts: ClientOptions = {}): LlmClient {
  const { baseUrl, defaultModel, format } = resolveProviderEndpoint(providerId, opts);

  switch (format) {
    case 'openai':
      return createOpenAiClient({ baseUrl, defaultModel });
    case 'anthropic':
      return createAnthropicClient({ baseUrl, defaultModel });
    case 'ollama':
      return createOllamaClient({ baseUrl, defaultModel });
  }
}
