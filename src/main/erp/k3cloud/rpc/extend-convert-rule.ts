/**
 * Convert-rule extension lifecycle. Server diffs `oldIds` vs `__rules__.Id`:
 * id absent from rules ⇒ delete; rule with `paras.OldId=null` ⇒ create.
 * See `save-convert-rules.ts` for the wire format.
 */

import {
  saveConvertRules,
  buildNewExtensionParas,
  type ConvertRuleEnvelope,
  type ConvertRuleParas,
  type IsvDescriptor,
  type SaveConvertRulesResult,
} from './save-convert-rules';
import type { KdSession } from './http-client';
import { DEFAULT_LOCALE_SLOTS } from './convert-rule-baselines';
import { newCompactGuid } from './dcxml';

export interface ExtendConvertRuleArgs {
  /**
   * Origin rule paras — caller builds via `buildOriginParas(live)` from a live
   * `getConvertRule(originRuleId)` response. Plan 7.0 通用化:不再依赖静态 baseline。
   */
  originParas: ConvertRuleParas;
  isv: IsvDescriptor;
  /** zh-CN extension name shown in BOS Designer. Defaults to `转换规则`. */
  displayName?: string;
}

export interface ExtendConvertRuleResult extends SaveConvertRulesResult {
  newExtensionId: string;
  /** The DCXML we sent as the extension's `__source__` in SaveRulesV9. */
  extensionXml: string;
}

/**
 * Minimal "origin envelope" — declares the rule's Id+Key and resets Status,
 * but doesn't carry the full rule body. Sending the cached 100KB origin XML
 * triggers a server-side modify of the standard rule using whatever fields
 * differ from the live state, which has been observed to silently flip
 * `<IsDefault>` / `<Status>` based on stale baseline content (e.g. the
 * standard rule getting marked "(stopped)" after our save). The minimal
 * shape lets the server treat the entry as "no-op presence" — enough to
 * anchor the new extension's lineage via `oldIds`, without rewriting the
 * standard rule's body.
 *
 * Exported for callers that need to build envelopes outside this module
 * (Plan 7.0: connector.patchExtXml uses this so the patch flow's origin
 * envelope matches the extend flow's shape — was previously sending the
 * full 100KB baseline.originXml, see `connector.ts:patchExtXml`).
 */
export function buildMinimalOriginXml(originRuleId: string): string {
  return (
    '<?xml version="1.0" encoding="utf-16"?>' +
    '<ConvertRuleMetaData><Rule><ConvertRule ElementType="6000" ElementStyle="0">' +
    '<Status action="reset" />' +
    `<Id>${originRuleId}</Id>` +
    `<Key>${originRuleId}</Key>` +
    '</ConvertRule></Rule></ConvertRuleMetaData>'
  );
}

function originEnvelope(paras: ConvertRuleParas): ConvertRuleEnvelope {
  return {
    localeSlots: DEFAULT_LOCALE_SLOTS,
    source: buildMinimalOriginXml(paras.Id),
    paras,
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Minimal extension source XML — based on BOS Designer pattern (capture #81)
 * with two OpenDeploy-specific deviations:
 *
 *   1. `<Name>` is set explicitly. paras.Name only drives the tree node
 *      label on first render; the "规则名称" textbox in Designer reads from
 *      the source XML's `<Name>` element. Without it, the textbox shows the
 *      default ("转换规则") and on next Designer load the tree re-reads
 *      from that, silently renaming the user's displayName away. Native
 *      didn't hit this because its paras.Name was the parent's name —
 *      already matched the default.
 *
 *   2. `<Status>True</Status>` instead of `<Status action="reset" />`.
 *      Native creates extensions disabled (action="reset" → default false)
 *      because BOS Designer expects the human to review before enabling.
 *      OpenDeploy is agent-driven — creating an extension IS an act of
 *      review, so auto-enable; user can disable later if not happy.
 */
function buildMinimalExtensionXml(newExtensionId: string, displayName: string): string {
  return (
    '<?xml version="1.0" encoding="utf-16"?>' +
    '<ConvertRuleMetaData><Rule><ConvertRule ElementType="6000" ElementStyle="0">' +
    '<Status>True</Status>' +
    `<Name>${escapeXml(displayName)}</Name>` +
    `<Id>${newExtensionId}</Id>` +
    `<Key>${newExtensionId}</Key>` +
    '</ConvertRule></Rule></ConvertRuleMetaData>'
  );
}

export async function extendConvertRule(
  session: KdSession,
  args: ExtendConvertRuleArgs,
): Promise<ExtendConvertRuleResult> {
  const { originParas, isv, displayName } = args;
  const newExtensionId = newCompactGuid();
  const effectiveName = displayName ?? '转换规则';
  const newExtEnv: ConvertRuleEnvelope = {
    localeSlots: DEFAULT_LOCALE_SLOTS,
    source: buildMinimalExtensionXml(newExtensionId, effectiveName),
    paras: buildNewExtensionParas({
      newRuleId: newExtensionId,
      baseObjectId: originParas.Id,
      isv,
      displayName: effectiveName,
    }),
  };

  const result = await saveConvertRules(session, {
    rules: [originEnvelope(originParas), newExtEnv],
    oldIds: [originParas.Id],
    isv,
  });
  return { ...result, newExtensionId, extensionXml: newExtEnv.source };
}

export interface DeleteConvertRuleExtensionArgs {
  originParas: ConvertRuleParas;
  extId: string;
  isv: IsvDescriptor;
}

export async function deleteConvertRuleExtension(
  session: KdSession,
  args: DeleteConvertRuleExtensionArgs,
): Promise<SaveConvertRulesResult> {
  const { originParas, extId, isv } = args;
  return saveConvertRules(session, {
    rules: [originEnvelope(originParas)],
    oldIds: [originParas.Id, extId],
    isv,
  });
}
