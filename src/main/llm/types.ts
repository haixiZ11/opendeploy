import type { ChatRequest, StreamEvent } from '@shared/llm-types';
import type { RawCapture } from './raw-dump';

export interface StreamOptions {
  abortSignal?: AbortSignal;
  /**
   * Plan 5.13 — when present, the client emits the raw request body + each
   * SSE chunk into the capture. Caller (`ipc-llm.ts`) builds one capture
   * per turn when `settings.llmRawDump` is on; passes `undefined` otherwise
   * so the client incurs no overhead.
   */
  rawCapture?: RawCapture;
}

export interface LlmClient {
  /**
   * Stream a chat completion. Caller iterates the returned AsyncIterable
   * to receive deltas, tool calls, and the final done event.
   * Throws if request preparation fails (before streaming starts).
   *
   * The legacy `(request, abortSignal)` shape is preserved by accepting
   * either an AbortSignal or a StreamOptions bag for back-compat with
   * existing callers / tests.
   */
  stream(
    request: ChatRequest,
    optsOrSignal?: AbortSignal | StreamOptions
  ): AsyncIterable<StreamEvent>;
}

/** Resolve the legacy 2-arg call site to a normalized opts object. */
export function resolveStreamOpts(
  optsOrSignal?: AbortSignal | StreamOptions
): StreamOptions {
  if (!optsOrSignal) return {};
  if (optsOrSignal instanceof AbortSignal) {
    return { abortSignal: optsOrSignal };
  }
  return optsOrSignal;
}

export interface ProviderConfig {
  id: string;                    // e.g., 'deepseek', 'claude', 'ollama'
  baseUrl: string;
  defaultModel: string;
  /** OpenAI-compatible endpoint format vs Anthropic vs Ollama */
  format: 'openai' | 'anthropic' | 'ollama';
  /**
   * Optional Token Plan / Coding Plan subscription endpoint.
   * When the user picks `accessMode: 'plan'` in settings, the factory swaps
   * `baseUrl` for `tokenPlan.baseUrl`. The plan API key lives in
   * `AppSettings.planApiKeys[id]` — separate bucket from `apiKeys[id]`
   * (per-厂家实证: e.g. 小米 tp-xxxx vs sk-xxxx 互不混用).
   * If undefined, the provider does not advertise a plan endpoint and the
   * Wizard / Settings UI hides the mode toggle.
   */
  tokenPlan?: {
    baseUrl: string;
    /** Expected key prefix, e.g. 'tp-'. Used for a soft format hint (not blocking). */
    keyPrefix?: string;
    /** Public docs URL — surfaced as a help link beside the toggle. */
    docsUrl?: string;
  };
}

/**
 * Map provider id → config. Each entry used by factory to build correct client.
 *
 * `defaultModel` is the backend fallback used when `LlmChatRequest.model` is
 * undefined (old renderer / tests / partial settings). It MUST stay aligned
 * with the `recommended: true` model id in `src/renderer/data/providers.ts`,
 * otherwise the LLM will respond as a different model than what the StatusBar
 * displays — and worse, the id may not exist on the provider at all.
 */
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  deepseek: { id: 'deepseek', baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-v4-flash', format: 'openai' },
  qwen:     { id: 'qwen',     baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen3.6-flash', format: 'openai',
    // 阿里百炼 Coding Plan 官方文档实证 (2026-05-29):专属 base URL + sk-sp- 前缀,
    // 跟按量 sk-xxxxx + dashscope.aliyuncs.com 严格不互通。
    // https://help.aliyun.com/zh/model-studio/coding-plan
    tokenPlan: {
      baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
      keyPrefix: 'sk-sp-',
      docsUrl: 'https://help.aliyun.com/zh/model-studio/coding-plan'
    } },
  glm:      { id: 'glm',      baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4.7-flashx', format: 'openai',
    // 智谱 GLM Coding Plan 官方文档实证 (2026-05-29):专属 base URL,
    // "Coding API 端点仅限 Coding 场景,并不适用通用 API 场景"。
    // key 前缀未公开,留空。https://docs.bigmodel.cn/cn/guide/develop/http/introduction
    tokenPlan: {
      baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
      docsUrl: 'https://docs.bigmodel.cn/cn/guide/develop/http/introduction'
    } },
  kimi:     { id: 'kimi',     baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'kimi-k2.6', format: 'openai',
    // Kimi Code CLI 官方配置文档实证 (2026-05-29):跟普通 Moonshot API
    // 区分两套独立平台 (Kimi Code platform vs Moonshot AI Open Platform)。
    // https://moonshotai.github.io/kimi-cli/en/configuration/providers.html
    tokenPlan: {
      baseUrl: 'https://api.kimi.com/coding/v1',
      docsUrl: 'https://platform.kimi.com/docs'
    } },
  doubao:   { id: 'doubao',   baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-seed-2-0-pro-260215', format: 'openai',
    // 火山方舟 Coding Plan 多源教程一致 (2026-05-29):/api/coding/v3 OpenAI 兼容,
    // /api/coding Anthropic 兼容。官方 docs 详情页待逐字复核,先按教程数据上线,
    // 若用户反馈 404 切到 /api/coding。https://www.volcengine.com/docs/82379/1925114
    tokenPlan: {
      baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
      docsUrl: 'https://www.volcengine.com/docs/82379/1925114'
    } },
  hunyuan:  { id: 'hunyuan',  baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', defaultModel: 'hunyuan-turbos-latest', format: 'openai' },
  minimax:  { id: 'minimax',  baseUrl: 'https://api.minimax.chat/v1', defaultModel: 'MiniMax-M2.7', format: 'openai' },
  mimo:     { id: 'mimo',     baseUrl: 'https://api.xiaomimimo.com/v1', defaultModel: 'mimo-v2.5-pro', format: 'openai',
    tokenPlan: {
      baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
      keyPrefix: 'tp-',
      docsUrl: 'https://platform.xiaomimimo.com/docs/zh-CN/price/tokenplan/subscription'
    } },
  gpt:      { id: 'gpt',      baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-5.5', format: 'openai' },
  claude:   { id: 'claude',   baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-haiku-4-5-20251001', format: 'anthropic' }, // recommended in providers.ts is haiku-4.5; opus-4-7 → 4-8 (2026-05-29)
  ollama:   { id: 'ollama',   baseUrl: 'http://localhost:11434', defaultModel: 'qwen2.5-coder', format: 'ollama' }
};
