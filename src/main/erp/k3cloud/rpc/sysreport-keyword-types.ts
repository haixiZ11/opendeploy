// src/main/erp/k3cloud/rpc/sysreport-keyword-types.ts
/**
 * Plan 7.8 — SysReport filter parameter (RptKeyWordField) input model.
 *
 * Real BOS shape (Phase 0 spike commit e05edf0,
 * docs/recon/2026-05-20-sysreport-filter-columns-wire.md §1.3 + §3):
 *
 *   - Single class RptKeyWordField with `ValueType: long` + embedded
 *     `Field` ComplexProperty.
 *   - NO 5-class subtype hierarchy in BOS. The 5 user-facing kinds below
 *     are an ergonomic DX layer that the emitter collapses to
 *     (ValueType, Field.ElementType, type-specific Field sub-elements)
 *     per KEYWORD_KIND_TO_WIRE mapping table.
 */

import type { BosLocalizedString } from './types';

interface BosRptKeyWordFieldBase {
  /** SQL placeholder name (RptKeyWordField.KeyWord), e.g. "@CustomerId".
   *  Plain C-identifier or @-prefixed. Unique within the SysReport's KeyWordList. */
  keyWord: string;
  /** Bilingual display name (RptKeyWordField.Name: LocaleValue). zh-CN required. */
  name: BosLocalizedString[];
  /** 1-based ordering in the filter panel (RptKeyWordField.DSeq). */
  seq: number;
  /** RptKeyWordField.IsMustInput. */
  mustInput?: boolean;
  /** RptKeyWordField.IsAllowNull. */
  allowNull?: boolean;
}

export interface BosKeyWordDate extends BosRptKeyWordFieldBase {
  kind: 'date';
  /** RptKeyWordField.DefaultValue. Semantic helpers ("today" / "month_start" /
   *  "year_start") get expanded by emitter; literal ISO date passes through. */
  defaultValue?: 'today' | 'month_start' | 'year_start' | string;
}

export interface BosKeyWordBaseData extends BosRptKeyWordFieldBase {
  kind: 'base_data';
  /** RptKeyWordField.AssistantID = referenced base-data formId, e.g. "BD_Customer". */
  refObjectId: string;
  /** RptKeyWordField.IsMultiSelect. */
  multiSelect?: boolean;
  /** Optional: RptKeyWordField.FilterBDFieldName for downstream F8 filter chain. */
  filterBDFieldName?: string;
}

export interface BosKeyWordText extends BosRptKeyWordFieldBase {
  kind: 'text';
  /** Pushed into embedded TextField's MaxLength sub-element.
   *  Phase 0 §3.C confirmed this lives on the embedded Field, not on RptKeyWordField. */
  maxLength?: number;
}

export interface BosKeyWordCombo extends BosRptKeyWordFieldBase {
  kind: 'combo';
  /** RptKeyWordField.AssistantID = existing enum type id
   *  (caller is expected to ensure it exists via k3cloud_list_enum_types
   *  or k3cloud_create_enum_type before this is called). */
  enumTypeId: string;
}

export interface BosKeyWordDecimal extends BosRptKeyWordFieldBase {
  kind: 'decimal';
  /** Pushed into embedded DecimalField's Precision/Scale sub-elements. */
  precision?: number;
  scale?: number;
}

export type BosRptKeyWordFieldElement =
  | BosKeyWordDate
  | BosKeyWordBaseData
  | BosKeyWordText
  | BosKeyWordCombo
  | BosKeyWordDecimal;

/**
 * kind → (ValueType, Field.ElementType) mapping table.
 *
 * Numbers are Phase 0 spike实证 (commit e05edf0 §2 table). Do not change
 * without re-running scripts/bos-recon/probe-sysreport-wire.ts and updating
 * the recon doc.
 */
export const KEYWORD_KIND_TO_WIRE: Record<
  BosRptKeyWordFieldElement['kind'],
  { valueType: number; fieldElementType: number }
> = {
  date: { valueType: 4, fieldElementType: 4 },
  base_data: { valueType: 13, fieldElementType: 13 },
  text: { valueType: 1, fieldElementType: 1 },
  combo: { valueType: 9, fieldElementType: 9 },
  decimal: { valueType: 2, fieldElementType: 2 },
};
