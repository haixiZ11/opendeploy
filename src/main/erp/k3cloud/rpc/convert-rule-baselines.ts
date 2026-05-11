/**
 * Convert-rule wire-format constants.
 *
 * Plan 7.0(2026-05-11):原 v0.1 静态 baseline 字典(buildSaleOrderOutStockBaseline /
 * ConvertRuleBaseline interface / UnsupportedConvertRuleError)全部退役,通用化
 * 路径在 connector 里直接调 `getConvertRule(ruleId)` → `buildOriginParas(live)`。
 * 这个文件只保留所有 ConvertRule wire 都共享的常量。
 */

import type { IsvDescriptor } from './save-convert-rules';

/** zh-CN locale slot — BOS Designer always emits `"2052": ""` in rule envelopes. */
export const DEFAULT_LOCALE_SLOTS: Readonly<Record<string, string>> = Object.freeze({
  '2052': '',
});

/**
 * Origin envelope ISV — wire 实证 SaveRulesV9 的 `__rules__[0].__paras__.ISV`
 * 永远是 Kingdee descriptor(不论 caller 用什么 devCode),因为它代表原厂规则
 * 的开发商身份。caller-provided ISV 只填顶层 `__isv__` 和 extension paras.ISV。
 */
export const KINGDEE_ISV_DESCRIPTOR: IsvDescriptor = {
  Id: null,
  Name: 'Kingdee',
  ISVSignal: 'Kingdee',
  PackageSignal: '',
  DevCode: null,
};
