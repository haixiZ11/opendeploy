import { describe, expect, it, vi } from 'vitest';
import {
  addSysReportFilterParametersTool,
  addSysReportColumnsTool
} from '../../src/main/agent/sysreport-config-tools';
import type { K3CloudConnector } from '../../src/main/erp/k3cloud/connector';
import type { BosRptKeyWordFieldElement } from '../../src/main/erp/k3cloud/rpc/sysreport-keyword-types';
import type { BosRptFilterGridFieldElement } from '../../src/main/erp/k3cloud/rpc/sysreport-gridfield-types';

/**
 * Tiny stand-in shaped to whatever the sysreport-config tools call. Cast to
 * K3CloudConnector at use-site since we only need a handful of methods.
 *
 * Mirrors `tests/agent/operation-tools.test.ts`'s factory.
 */
function makeFakeConnector(
  overrides: Partial<
    Pick<K3CloudConnector, 'addSysReportFilterParameters' | 'addSysReportColumns'>
  > = {}
): K3CloudConnector {
  return {
    addSysReportFilterParameters: vi.fn(async () => ({
      added: 0,
      isSuccess: true
    })),
    addSysReportColumns: vi.fn(async () => ({
      added: 0,
      isSuccess: true
    })),
    ...overrides
  } as unknown as K3CloudConnector;
}

const VALID_FORM_ID = 'k0077344db0ec4f16a39e1cdb95041b8c';

// ── addSysReportFilterParametersTool ─────────────────────────────────────

describe('addSysReportFilterParametersTool', () => {
  it('registers as k3cloud_add_sysreport_filter_parameters and is NOT parallelSafe', () => {
    const tool = addSysReportFilterParametersTool(makeFakeConnector());
    expect(tool.definition.name).toBe('k3cloud_add_sysreport_filter_parameters');
    expect(tool.parallelSafe).toBe(false);
  });

  it('forwards filterParameters to connector and surfaces success summary', async () => {
    const fake = makeFakeConnector({
      addSysReportFilterParameters: vi.fn(async () => ({
        added: 5,
        isSuccess: true
      }))
    });
    const tool = addSysReportFilterParametersTool(fake);

    const params: BosRptKeyWordFieldElement[] = [
      {
        kind: 'date',
        keyWord: '@DateSample',
        name: [{ localeId: 2052, value: '日期参数' }],
        seq: 1
      },
      {
        kind: 'base_data',
        keyWord: '@CustomerSample',
        name: [{ localeId: 2052, value: '客户参数' }],
        seq: 2,
        refObjectId: 'BD_Customer'
      },
      {
        kind: 'text',
        keyWord: '@TextSample',
        name: [{ localeId: 2052, value: '文本参数' }],
        seq: 3,
        maxLength: 200
      },
      {
        kind: 'combo',
        keyWord: '@ComboSample',
        name: [{ localeId: 2052, value: '枚举参数' }],
        seq: 4,
        enumTypeId: 'enum-type-a'
      },
      {
        kind: 'decimal',
        keyWord: '@DecimalSample',
        name: [{ localeId: 2052, value: '数量参数' }],
        seq: 5,
        precision: 18,
        scale: 2
      }
    ];

    const raw = await tool.execute({
      formId: VALID_FORM_ID,
      filterParameters: params
    });

    expect(fake.addSysReportFilterParameters).toHaveBeenCalledWith({
      formId: VALID_FORM_ID,
      keyWordFields: params
    });
    const parsed = JSON.parse(raw);
    expect(parsed.ok).toBe(true);
    expect(parsed.formId).toBe(VALID_FORM_ID);
    expect(parsed.added).toBe(5);
    expect(parsed.message).toContain('5');
    expect(parsed.message).toContain('过滤参数');
  });

  it('rejects formId with bad format and does NOT call connector', async () => {
    const fake = makeFakeConnector();
    const tool = addSysReportFilterParametersTool(fake);

    // Missing
    await expect(
      tool.execute({
        filterParameters: [
          { kind: 'date', keyWord: '@x', name: [{ localeId: 2052, value: 'x' }], seq: 1 }
        ]
      })
    ).rejects.toThrow(/formId/);

    // Wrong prefix (no leading "k")
    await expect(
      tool.execute({
        formId: '0077344db0ec4f16a39e1cdb95041b8c',
        filterParameters: [
          { kind: 'date', keyWord: '@x', name: [{ localeId: 2052, value: 'x' }], seq: 1 }
        ]
      })
    ).rejects.toThrow(/formId/);

    // Uppercase hex
    await expect(
      tool.execute({
        formId: 'k0077344DB0EC4F16A39E1CDB95041B8C',
        filterParameters: [
          { kind: 'date', keyWord: '@x', name: [{ localeId: 2052, value: 'x' }], seq: 1 }
        ]
      })
    ).rejects.toThrow(/formId/);

    expect(fake.addSysReportFilterParameters).not.toHaveBeenCalled();
  });

  it('surfaces connector error when target is not a SysReport (modelTypeId mismatch)', async () => {
    const fake = makeFakeConnector({
      addSysReportFilterParameters: vi.fn(async () => {
        throw new Error(
          `${VALID_FORM_ID} 不是 SysReport(modelTypeId=100,期望 900)。本工具仅支持账表对象。`
        );
      })
    });
    const tool = addSysReportFilterParametersTool(fake);

    await expect(
      tool.execute({
        formId: VALID_FORM_ID,
        filterParameters: [
          { kind: 'date', keyWord: '@x', name: [{ localeId: 2052, value: 'x' }], seq: 1 }
        ]
      })
    ).rejects.toThrow(/不是 SysReport/);

    expect(fake.addSysReportFilterParameters).toHaveBeenCalledTimes(1);
  });

  it('rejects empty / non-array filterParameters and does NOT call connector', async () => {
    const fake = makeFakeConnector();
    const tool = addSysReportFilterParametersTool(fake);

    // Missing
    await expect(tool.execute({ formId: VALID_FORM_ID })).rejects.toThrow(/filterParameters/);

    // Empty array
    await expect(
      tool.execute({ formId: VALID_FORM_ID, filterParameters: [] })
    ).rejects.toThrow(/filterParameters/);

    // Non-array
    await expect(
      tool.execute({ formId: VALID_FORM_ID, filterParameters: 'not-an-array' })
    ).rejects.toThrow(/filterParameters/);

    expect(fake.addSysReportFilterParameters).not.toHaveBeenCalled();
  });

  it('rejects unsupported kind and does NOT call connector', async () => {
    const fake = makeFakeConnector();
    const tool = addSysReportFilterParametersTool(fake);

    await expect(
      tool.execute({
        formId: VALID_FORM_ID,
        filterParameters: [
          {
            kind: 'banana',
            keyWord: '@x',
            name: [{ localeId: 2052, value: 'x' }],
            seq: 1
          }
        ]
      })
    ).rejects.toThrow(/kind.*不支持/);

    // Missing kind
    await expect(
      tool.execute({
        formId: VALID_FORM_ID,
        filterParameters: [
          { keyWord: '@x', name: [{ localeId: 2052, value: 'x' }], seq: 1 }
        ]
      })
    ).rejects.toThrow(/kind.*不支持/);

    expect(fake.addSysReportFilterParameters).not.toHaveBeenCalled();
  });

  it('passes each of the 5 supported kinds through unchanged', async () => {
    const kinds: BosRptKeyWordFieldElement['kind'][] = [
      'date',
      'base_data',
      'text',
      'combo',
      'decimal'
    ];
    for (const kind of kinds) {
      const fake = makeFakeConnector({
        addSysReportFilterParameters: vi.fn(async () => ({ added: 1, isSuccess: true }))
      });
      const tool = addSysReportFilterParametersTool(fake);
      // Per-kind minimal payload — narrow union by adding required fields.
      let fp: BosRptKeyWordFieldElement;
      const base = { keyWord: '@x', name: [{ localeId: 2052, value: 'x' }], seq: 1 } as const;
      switch (kind) {
        case 'date':
          fp = { kind: 'date', ...base };
          break;
        case 'base_data':
          fp = { kind: 'base_data', ...base, refObjectId: 'BD_Customer' };
          break;
        case 'text':
          fp = { kind: 'text', ...base };
          break;
        case 'combo':
          fp = { kind: 'combo', ...base, enumTypeId: 'enum-1' };
          break;
        case 'decimal':
          fp = { kind: 'decimal', ...base };
          break;
      }

      const raw = await tool.execute({
        formId: VALID_FORM_ID,
        filterParameters: [fp]
      });
      const parsed = JSON.parse(raw);
      expect(parsed.ok).toBe(true);
      expect(fake.addSysReportFilterParameters).toHaveBeenCalledWith({
        formId: VALID_FORM_ID,
        keyWordFields: [fp]
      });
    }
  });
});

// ── addSysReportColumnsTool ─────────────────────────────────────────────

describe('addSysReportColumnsTool', () => {
  it('registers as k3cloud_add_sysreport_columns and is NOT parallelSafe', () => {
    const tool = addSysReportColumnsTool(makeFakeConnector());
    expect(tool.definition.name).toBe('k3cloud_add_sysreport_columns');
    expect(tool.parallelSafe).toBe(false);
  });

  it('forwards columns to connector and surfaces success summary', async () => {
    const fake = makeFakeConnector({
      addSysReportColumns: vi.fn(async () => ({
        added: 5,
        isSuccess: true
      }))
    });
    const tool = addSysReportColumnsTool(fake);

    const cols: BosRptFilterGridFieldElement[] = [
      {
        cellType: 'text',
        fieldKey: 'FCustName',
        caption: [{ localeId: 2052, value: '客户名称' }],
        seq: 1
      },
      {
        cellType: 'integer',
        fieldKey: 'FOrderCount',
        caption: [{ localeId: 2052, value: '订单数' }],
        seq: 2
      },
      {
        cellType: 'decimal',
        fieldKey: 'FTotalAmount',
        caption: [{ localeId: 2052, value: '金额合计' }],
        seq: 3,
        precision: 18,
        scale: 2
      },
      {
        cellType: 'date',
        fieldKey: 'FBizDate',
        caption: [{ localeId: 2052, value: '业务日期' }],
        seq: 4
      },
      {
        cellType: 'base_data_lookup',
        fieldKey: 'FCustomer',
        caption: [{ localeId: 2052, value: '客户' }],
        seq: 5,
        refObjectId: 'BD_Customer'
      }
    ];

    const raw = await tool.execute({
      formId: VALID_FORM_ID,
      columns: cols
    });

    expect(fake.addSysReportColumns).toHaveBeenCalledWith({
      formId: VALID_FORM_ID,
      filterGridFields: cols
    });
    const parsed = JSON.parse(raw);
    expect(parsed.ok).toBe(true);
    expect(parsed.formId).toBe(VALID_FORM_ID);
    expect(parsed.added).toBe(5);
    expect(parsed.message).toContain('5');
    expect(parsed.message).toContain('报表列');
  });

  it('rejects formId with bad format and does NOT call connector', async () => {
    const fake = makeFakeConnector();
    const tool = addSysReportColumnsTool(fake);

    // Missing
    await expect(
      tool.execute({
        columns: [
          { cellType: 'text', fieldKey: 'F1', caption: [{ localeId: 2052, value: 'x' }], seq: 1 }
        ]
      })
    ).rejects.toThrow(/formId/);

    // Wrong prefix (no leading "k")
    await expect(
      tool.execute({
        formId: '0077344db0ec4f16a39e1cdb95041b8c',
        columns: [
          { cellType: 'text', fieldKey: 'F1', caption: [{ localeId: 2052, value: 'x' }], seq: 1 }
        ]
      })
    ).rejects.toThrow(/formId/);

    // Uppercase hex
    await expect(
      tool.execute({
        formId: 'k0077344DB0EC4F16A39E1CDB95041B8C',
        columns: [
          { cellType: 'text', fieldKey: 'F1', caption: [{ localeId: 2052, value: 'x' }], seq: 1 }
        ]
      })
    ).rejects.toThrow(/formId/);

    expect(fake.addSysReportColumns).not.toHaveBeenCalled();
  });

  it('surfaces connector error when target is not a SysReport (modelTypeId mismatch)', async () => {
    const fake = makeFakeConnector({
      addSysReportColumns: vi.fn(async () => {
        throw new Error(
          `${VALID_FORM_ID} 不是 SysReport(modelTypeId=100,期望 900)。本工具仅支持账表对象。`
        );
      })
    });
    const tool = addSysReportColumnsTool(fake);

    await expect(
      tool.execute({
        formId: VALID_FORM_ID,
        columns: [
          { cellType: 'text', fieldKey: 'F1', caption: [{ localeId: 2052, value: 'x' }], seq: 1 }
        ]
      })
    ).rejects.toThrow(/不是 SysReport/);

    expect(fake.addSysReportColumns).toHaveBeenCalledTimes(1);
  });

  it('rejects empty / non-array columns and does NOT call connector', async () => {
    const fake = makeFakeConnector();
    const tool = addSysReportColumnsTool(fake);

    // Missing
    await expect(tool.execute({ formId: VALID_FORM_ID })).rejects.toThrow(/columns/);

    // Empty array
    await expect(
      tool.execute({ formId: VALID_FORM_ID, columns: [] })
    ).rejects.toThrow(/columns/);

    // Non-array
    await expect(
      tool.execute({ formId: VALID_FORM_ID, columns: 'not-an-array' })
    ).rejects.toThrow(/columns/);

    expect(fake.addSysReportColumns).not.toHaveBeenCalled();
  });

  it('rejects unsupported cellType and does NOT call connector', async () => {
    const fake = makeFakeConnector();
    const tool = addSysReportColumnsTool(fake);

    await expect(
      tool.execute({
        formId: VALID_FORM_ID,
        columns: [
          {
            cellType: 'banana',
            fieldKey: 'F1',
            caption: [{ localeId: 2052, value: 'x' }],
            seq: 1
          }
        ]
      })
    ).rejects.toThrow(/cellType.*不支持/);

    // Missing cellType
    await expect(
      tool.execute({
        formId: VALID_FORM_ID,
        columns: [
          { fieldKey: 'F1', caption: [{ localeId: 2052, value: 'x' }], seq: 1 }
        ]
      })
    ).rejects.toThrow(/cellType.*不支持/);

    expect(fake.addSysReportColumns).not.toHaveBeenCalled();
  });

  it('rejects base_data_lookup missing refObjectId at the tool layer (fail-fast)', async () => {
    const fake = makeFakeConnector();
    const tool = addSysReportColumnsTool(fake);

    await expect(
      tool.execute({
        formId: VALID_FORM_ID,
        columns: [
          {
            cellType: 'base_data_lookup',
            fieldKey: 'FCust',
            caption: [{ localeId: 2052, value: 'x' }],
            seq: 1
            // refObjectId missing
          }
        ]
      })
    ).rejects.toThrow(/refObjectId/);

    // Empty refObjectId equally rejected
    await expect(
      tool.execute({
        formId: VALID_FORM_ID,
        columns: [
          {
            cellType: 'base_data_lookup',
            fieldKey: 'FCust',
            caption: [{ localeId: 2052, value: 'x' }],
            seq: 1,
            refObjectId: ''
          }
        ]
      })
    ).rejects.toThrow(/refObjectId/);

    expect(fake.addSysReportColumns).not.toHaveBeenCalled();
  });

  it('passes each of the 5 supported cellTypes through unchanged', async () => {
    const cellTypes: BosRptFilterGridFieldElement['cellType'][] = [
      'text',
      'integer',
      'decimal',
      'date',
      'base_data_lookup'
    ];
    for (const cellType of cellTypes) {
      const fake = makeFakeConnector({
        addSysReportColumns: vi.fn(async () => ({ added: 1, isSuccess: true }))
      });
      const tool = addSysReportColumnsTool(fake);
      // Per-cellType minimal payload — narrow union by adding required fields.
      let col: BosRptFilterGridFieldElement;
      const base = {
        fieldKey: 'F1',
        caption: [{ localeId: 2052, value: 'x' }],
        seq: 1
      } as const;
      switch (cellType) {
        case 'text':
          col = { cellType: 'text', ...base };
          break;
        case 'integer':
          col = { cellType: 'integer', ...base };
          break;
        case 'decimal':
          col = { cellType: 'decimal', ...base };
          break;
        case 'date':
          col = { cellType: 'date', ...base };
          break;
        case 'base_data_lookup':
          col = { cellType: 'base_data_lookup', ...base, refObjectId: 'BD_Customer' };
          break;
      }

      const raw = await tool.execute({
        formId: VALID_FORM_ID,
        columns: [col]
      });
      const parsed = JSON.parse(raw);
      expect(parsed.ok).toBe(true);
      expect(fake.addSysReportColumns).toHaveBeenCalledWith({
        formId: VALID_FORM_ID,
        filterGridFields: [col]
      });
    }
  });
});
