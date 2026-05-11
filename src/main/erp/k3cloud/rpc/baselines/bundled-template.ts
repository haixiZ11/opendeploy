/**
 * Vite-side bundle of the Plan 7.0 generic convert-rule extension template.
 *
 * Imported only via dynamic import in `connector.ts` (production path);
 * scripts (tsx) inject the file content via `setBundledConvertRuleTemplate`
 * to avoid touching this module entirely — Node ESM rejects `?raw` so this
 * file lives separated from the rest of the rpc module.
 */
import templateXml from './convert-rule-extension-template.xml?raw';

export const bundledConvertRuleTemplate = templateXml;
