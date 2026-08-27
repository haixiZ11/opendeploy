import { describe, it, expect } from 'vitest';
import { PROVIDER_CONFIGS } from '../../src/main/llm/types';
import { PROVIDERS } from '../../src/renderer/data/providers';

/**
 * Token Plan UI metadata lives in two places by design:
 *   - `PROVIDER_CONFIGS[id].tokenPlan.{baseUrl, keyPrefix, docsUrl}` — main side,
 *     used by `createLlmClient` to swap base URL when accessMode='plan'.
 *   - `PROVIDERS.find(id).tokenPlan.{keyPrefix, docsUrl}` — renderer side,
 *     used by Wizard + SettingsPage to gate the access-mode toggle and
 *     surface a help link.
 *
 * baseUrl stays main-only (renderer never calls upstream directly). But
 * `keyPrefix` / `docsUrl` MUST agree across both files — otherwise the
 * Wizard's "view plan" link would 404 or the soft-format hint would
 * suggest the wrong prefix. This护栏 fails when someone updates one side
 * and forgets the other.
 */
describe('provider tokenPlan metadata sync (main ↔ renderer)', () => {
  it('every renderer-side tokenPlan has a matching main-side tokenPlan', () => {
    for (const p of PROVIDERS) {
      if (!p.tokenPlan) continue;
      const main = PROVIDER_CONFIGS[p.id]?.tokenPlan;
      expect(main, `PROVIDER_CONFIGS.${p.id}.tokenPlan missing`).toBeDefined();
      expect(main!.keyPrefix).toBe(p.tokenPlan.keyPrefix);
      expect(main!.docsUrl).toBe(p.tokenPlan.docsUrl);
    }
  });

  it('every main-side tokenPlan has a matching renderer-side tokenPlan', () => {
    for (const id of Object.keys(PROVIDER_CONFIGS)) {
      const main = PROVIDER_CONFIGS[id].tokenPlan;
      if (!main) continue;
      const renderer = PROVIDERS.find((p) => p.id === id)?.tokenPlan;
      expect(renderer, `PROVIDERS[${id}].tokenPlan missing`).toBeDefined();
      expect(renderer!.keyPrefix).toBe(main.keyPrefix);
      expect(renderer!.docsUrl).toBe(main.docsUrl);
    }
  });
});
