import { describe, it, expect } from 'vitest';
import { buildOriginParas } from '../../../src/main/erp/k3cloud/rpc/build-origin-paras';
import type { RawConvertRule } from '../../../src/main/erp/k3cloud/rpc/convert-rules';
import { CONVERT_RULE_MODEL_TYPE_ID } from '../../../src/main/erp/k3cloud/rpc/save-convert-rules';

/**
 * Plan 7.0: build originParas from a live `getConvertRule` response so we
 * don't need per-rule baselines. v0.1 had a static dict with only
 * SaleOrder-OutStock; this builder generalizes to any rule.
 *
 * Field shape verified against `buildSaleOrderOutStockBaseline` (the v0.1
 * static baseline) in convert-rule-baselines.ts. wire format frozen by
 * capture #0081 / #0163 — see save-convert-rules.ts top-of-file.
 */

function makeLive(overrides: Partial<RawConvertRule> = {}): RawConvertRule {
  const base = {
    Id: 'PurchaseOrder-InStock',
    ModelTypeId: 790,
    Name: [
      { Key: 1033, Value: '' },
      { Key: 2052, Value: '采购订单至采购入库单' },
      { Key: 3076, Value: '' },
    ],
    SourceFormId: 'PUR_PurchaseOrder',
    BaseObjectId: ' ',
    SubSystemId: null,
    Version: '634703641059182961',
    MainVersion: '639131020995091913',
    HasExtends: false,
    InheritPath: ',PurchaseOrder-InStock,',
    FirstNonExtendObjectID: 'PurchaseOrder-InStock',
    IsInheritElement: false,
    Rule: { SourceFormId: 'PUR_PurchaseOrder', TargetFormId: 'STK_InStock' } as never,
    PackageId: 'K3Cloud_ERP',
    ...overrides,
  };
  return base as unknown as RawConvertRule;
}

describe('buildOriginParas', () => {
  it('maps the live RawConvertRule to ConvertRuleParas with fixed wire-format constants', () => {
    const p = buildOriginParas(makeLive());

    // Fixed wire-format values — never come from live.
    expect(p.ModelTypeId).toBe(CONVERT_RULE_MODEL_TYPE_ID);
    expect(p.DevType).toBe(0); // origin rule, not extension
    expect(p.HasExtends).toBe(false); // wire-format constraint (capture verified)
    expect(p.RunTime).toBe(false);
    expect(p.IsInheritElement).toBe(false);
    expect(p.ModelTypeSubId).toBe(0);
    expect(p.UpdateIdToKey).toBe(false);
    expect(p.SourceFormId).toBeNull();
    expect(p.LayoutViewId).toBeNull();
    expect(p.OldLayoutViewId).toBeNull();
    expect(p.LayoutViewVersion).toBeNull();
    expect(p.DependencyObjectId).toBeNull();

    // ISV — origin envelope uses the static Kingdee descriptor.
    expect(p.ISV.Name).toBe('Kingdee');
    expect(p.ISV.ISVSignal).toBe('Kingdee');
  });

  it('uses live Id for Id / OldId / FirstNonExtendObjectID / InheritPath fallback', () => {
    const p = buildOriginParas(makeLive());
    expect(p.Id).toBe('PurchaseOrder-InStock');
    expect(p.OldId).toBe('PurchaseOrder-InStock');
    expect(p.FirstNonExtendObjectID).toBe('PurchaseOrder-InStock');
    expect(p.InheritPath).toBe(',PurchaseOrder-InStock,');
  });

  it('forwards live Version / MainVersion / PackageId / SubSystemId / BaseObjectId', () => {
    const p = buildOriginParas(makeLive({ SubSystemId: 'PUR' }));
    expect(p.Version).toBe('634703641059182961');
    expect(p.MainVersion).toBe('639131020995091913');
    expect(p.PackageId).toBe('K3Cloud_ERP');
    expect(p.SubSystemId).toBe('PUR');
    expect(p.BaseObjectId).toBe(' ');
  });

  it('JSON-stringifies live Name (LocaleString[]) into paras.Name', () => {
    const p = buildOriginParas(makeLive());
    expect(p.Name).toBe(
      '[{"Key":1033,"Value":""},{"Key":2052,"Value":"采购订单至采购入库单"},{"Key":3076,"Value":""}]',
    );
  });

  it('synthesizes InheritPath as `,<id>,` when live.InheritPath is missing', () => {
    const p = buildOriginParas(makeLive({ InheritPath: undefined }));
    expect(p.InheritPath).toBe(',PurchaseOrder-InStock,');
  });

  it('falls back to live.Id for FirstNonExtendObjectID when live field missing', () => {
    const p = buildOriginParas(makeLive({ FirstNonExtendObjectID: undefined }));
    expect(p.FirstNonExtendObjectID).toBe('PurchaseOrder-InStock');
  });

  it('preserves BaseObjectId from live (single space for origin rules)', () => {
    const p = buildOriginParas(makeLive({ BaseObjectId: ' ' }));
    expect(p.BaseObjectId).toBe(' ');
  });

  it('defaults BaseObjectId to single space when live omits it', () => {
    const p = buildOriginParas(makeLive({ BaseObjectId: undefined }));
    expect(p.BaseObjectId).toBe(' ');
  });

  it('defaults SubSystemId / PackageId / Version / MainVersion to null when live omits them', () => {
    const p = buildOriginParas(
      makeLive({ SubSystemId: undefined, PackageId: undefined, Version: undefined, MainVersion: undefined }),
    );
    expect(p.SubSystemId).toBeNull();
    expect(p.PackageId).toBeNull();
    expect(p.Version).toBeNull();
    expect(p.MainVersion).toBeNull();
  });

  it('matches the shape of the v0.1 static SaleOrder-OutStock baseline (regression)', () => {
    // Verifies buildOriginParas produces the same shape v0.1 hardcoded for the
    // one rule it supported, so cutover doesn't break the existing case.
    const live = makeLive({
      Id: 'SaleOrder-OutStock',
      Name: [{ Key: 2052, Value: '销售订单至销售出库单' }],
      SourceFormId: 'SAL_SaleOrder',
      Rule: { SourceFormId: 'SAL_SaleOrder', TargetFormId: 'SAL_OUTSTOCK' } as never,
      InheritPath: ',SaleOrder-OutStock,',
      FirstNonExtendObjectID: 'SaleOrder-OutStock',
    });
    const p = buildOriginParas(live);
    expect(p.Id).toBe('SaleOrder-OutStock');
    expect(p.OldId).toBe('SaleOrder-OutStock');
    expect(p.BaseObjectId).toBe(' ');
    expect(p.InheritPath).toBe(',SaleOrder-OutStock,');
    expect(p.FirstNonExtendObjectID).toBe('SaleOrder-OutStock');
    expect(p.PackageId).toBe('K3Cloud_ERP');
    expect(p.Name).toBe('[{"Key":2052,"Value":"销售订单至销售出库单"}]');
  });
});
