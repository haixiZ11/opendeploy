import { describe, it, expect } from 'vitest';
import { resolveProviderEndpoint } from '../../src/main/llm/factory';
import { PROVIDER_CONFIGS } from '../../src/main/llm/types';

/**
 * Token Plan / Coding Plan UX 的核心契约:同一 provider 下根据 accessMode 切 base URL。
 * 资源 baseUrlOverride 始终优先级最高 — 这是"高级"抽屉里给奇葩厂家的逃生口。
 *
 * factory 内部用 `resolveProviderEndpoint` 这个纯函数去决策,本测试直打它。
 */
describe('resolveProviderEndpoint', () => {
  it('returns standard baseUrl when no opts given (back-compat)', () => {
    const r = resolveProviderEndpoint('mimo');
    expect(r.baseUrl).toBe(PROVIDER_CONFIGS.mimo.baseUrl);
  });

  it("returns standard baseUrl when accessMode='payg' explicitly", () => {
    const r = resolveProviderEndpoint('mimo', { accessMode: 'payg' });
    expect(r.baseUrl).toBe('https://api.xiaomimimo.com/v1');
  });

  it("returns tokenPlan.baseUrl when accessMode='plan' and provider declares one", () => {
    const r = resolveProviderEndpoint('mimo', { accessMode: 'plan' });
    expect(r.baseUrl).toBe('https://token-plan-cn.xiaomimimo.com/v1');
  });

  it("falls back to standard baseUrl when accessMode='plan' but provider has no tokenPlan", () => {
    // DeepSeek 没声明 tokenPlan,plan 模式优雅降级而不是 throw
    const r = resolveProviderEndpoint('deepseek', { accessMode: 'plan' });
    expect(r.baseUrl).toBe(PROVIDER_CONFIGS.deepseek.baseUrl);
  });

  it('baseUrlOverride wins over both standard and tokenPlan endpoints', () => {
    const override = 'https://proxy.example.com/v1';
    const r1 = resolveProviderEndpoint('mimo', { baseUrlOverride: override });
    expect(r1.baseUrl).toBe(override);
    const r2 = resolveProviderEndpoint('mimo', { accessMode: 'plan', baseUrlOverride: override });
    expect(r2.baseUrl).toBe(override);
  });

  it('keeps defaultModel + format unchanged regardless of mode', () => {
    const r = resolveProviderEndpoint('mimo', { accessMode: 'plan' });
    expect(r.defaultModel).toBe(PROVIDER_CONFIGS.mimo.defaultModel);
    expect(r.format).toBe('openai');
  });

  it('throws for unknown providerId', () => {
    expect(() => resolveProviderEndpoint('bogus')).toThrow(/Unknown provider/);
  });
});
