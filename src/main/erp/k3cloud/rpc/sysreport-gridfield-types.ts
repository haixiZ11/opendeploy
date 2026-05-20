// src/main/erp/k3cloud/rpc/sysreport-gridfield-types.ts
/**
 * Plan 7.8 — SysReport report column (RptFilterGridField) input model.
 *
 * Real BOS shape (Phase 0 spike commit e05edf0 §1.4 + §3.F):
 *   - Single class RptFilterGridField + embedded `Field` ComplexProperty.
 *   - Caption / FieldName on RptFilterGridField are readonly getter — they
 *     reflect through to Field.Name / Field.Key, so wire only ships
 *     Field's values.
 *   - cellType maps to embedded Field.ElementType (same numeric table as
 *     KEYWORD_KIND_TO_WIRE in sysreport-keyword-types.ts), plus 1 extra
 *     cellType 'integer' that filter params don't have.
 */

import type { BosLocalizedString } from './types';

interface BosRptFilterGridFieldBase {
  /** Field key (Field.Key). Must match the column name produced by the
   *  Python report plugin's BuilderReportSqlAndTempTable temp table
   *  (e.g. "FCustName") — otherwise the column displays blank. */
  fieldKey: string;
  /** Bilingual display header (Field.Name: LocaleValue). zh-CN required. */
  caption: BosLocalizedString[];
  /** 1-based column order (RptFilterGridField.Seq). */
  seq: number;
  /** RptFilterGridField.Visible. Default true. */
  visible?: boolean;
  /** RptFilterGridField.DefaultColWidth (px). */
  width?: number;
}

export interface BosGridFieldText extends BosRptFilterGridFieldBase {
  cellType: 'text';
  /** Embedded TextField.Editlen ([SimpleProperty] [DefaultValue(50)]).
   *  Decompile-verified — same property as filter keyword text uses. */
  maxLength?: number;
}

export interface BosGridFieldInteger extends BosRptFilterGridFieldBase {
  cellType: 'integer';
}

export interface BosGridFieldDecimal extends BosRptFilterGridFieldBase {
  cellType: 'decimal';
  /** Embedded DecimalField.FieldPrecision (decompile-verified). */
  precision?: number;
  /** Embedded DecimalField.FieldScale (decompile-verified). */
  scale?: number;
}

export interface BosGridFieldDate extends BosRptFilterGridFieldBase {
  cellType: 'date';
}

export interface BosGridFieldBaseDataLookup extends BosRptFilterGridFieldBase {
  cellType: 'base_data_lookup';
  /** Referenced base-data form id, e.g. "BD_Customer".
   *  Pushed to embedded BaseDataField.LookUpObjectID. */
  refObjectId: string;
}

export type BosRptFilterGridFieldElement =
  | BosGridFieldText
  | BosGridFieldInteger
  | BosGridFieldDecimal
  | BosGridFieldDate
  | BosGridFieldBaseDataLookup;

/**
 * cellType → embedded Field.ElementType. Numbers are Phase 0 spike-verified
 * (commit e05edf0 §2 table). Shares KEYWORD_KIND_TO_WIRE numeric heritage
 * plus integer=3 (IntegerField, only used in gridfields here).
 */
export const GRIDFIELD_CELLTYPE_TO_ELEMENTTYPE: Record<
  BosRptFilterGridFieldElement['cellType'],
  number
> = {
  text: 1,
  integer: 3,
  decimal: 2,
  date: 4,
  base_data_lookup: 13,
};
