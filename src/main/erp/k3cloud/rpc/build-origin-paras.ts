/**
 * Plan 7.0 通用化:从 `getConvertRule` 的 live 响应构造 `originEnvelope` 用的
 * `ConvertRuleParas`,替代 v0.1 静态 baseline 字典(`buildSaleOrderOutStockBaseline`)。
 *
 * 14 个字段里大部分是固定 wire 常量(ModelTypeId=790 / DevType=0 / RunTime=false
 * 等),其余从 live RawConvertRule 取。`Name` 字段做了 LocaleString[] → JSON 字符串
 * 转换以匹配 wire 格式。`HasExtends` 永远 false —— 这是 wire 约束(capture 实证),
 * 与 live 真值无关。
 */

import type { RawConvertRule } from './convert-rules';
import { KINGDEE_ISV_DESCRIPTOR } from './convert-rule-baselines';
import { CONVERT_RULE_MODEL_TYPE_ID, type ConvertRuleParas } from './save-convert-rules';

/**
 * RawConvertRule 的 typed interface 没列 PackageId(在 `[k: string]: unknown`
 * overflow 里),这里类型辅助一下。
 */
type LiveWithPackage = RawConvertRule & { PackageId?: string | null };

export function buildOriginParas(live: RawConvertRule): ConvertRuleParas {
  const withPackage = live as LiveWithPackage;
  return {
    Id: live.Id,
    OldId: live.Id,
    ModelTypeId: CONVERT_RULE_MODEL_TYPE_ID,
    BaseObjectId: live.BaseObjectId ?? ' ',
    DevType: 0,
    SubSystemId: live.SubSystemId ?? null,
    Version: live.Version ?? null,
    MainVersion: live.MainVersion ?? null,
    PackageId: withPackage.PackageId ?? null,
    HasExtends: false,
    RunTime: false,
    LayoutViewId: null,
    OldLayoutViewId: null,
    LayoutViewVersion: null,
    DependencyObjectId: null,
    FirstNonExtendObjectID: live.FirstNonExtendObjectID ?? live.Id,
    ISV: KINGDEE_ISV_DESCRIPTOR,
    UpdateIdToKey: false,
    SourceFormId: null,
    InheritPath: live.InheritPath ?? `,${live.Id},`,
    IsInheritElement: false,
    ModelTypeSubId: 0,
    Name: JSON.stringify(live.Name ?? []),
  };
}
