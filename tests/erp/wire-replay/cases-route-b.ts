/**
 * Route B (envelope rebuild) wire-replay fixtures.
 *
 * Each case = one frozen input that we run through `buildAp0Plain` and
 * `toMatchFileSnapshot` against. See README.md in this directory for the
 * full convention. Adding a case → add an entry here + commit the
 * resulting snapshot file from your first `pnpm test wire-replay` run.
 */

import type { SaveExtensionRequest } from '../../../src/main/erp/k3cloud/rpc/types';

export interface RouteBCase {
  name: string;
  whyMatters: string;
  input: SaveExtensionRequest;
}

const BASELINE_EXT: SaveExtensionRequest['extension'] = {
  formId: '00000000000000000000000000000001',
  baseObjectId: 'SAL_SaleOrder',
  modelTypeId: 100,
  subSystemId: '23',
  name: [{ localeId: 2052, value: '销售订单扩展(test)' }],
  isv: { devCode: 'TEST', name: 'TEST', isvSignal: 'Kingdee' },
};

export const ROUTE_B_CASES: RouteBCase[] = [
  {
    name: 'isnew-empty',
    whyMatters:
      'Smallest baseline — Form root + LayoutInfo only. Catches refactor that ' +
      'changes Form scaffolding shape (oid="BOS_BillModel", ElementType="100"). ' +
      'Per docs/architecture/bos-write-routes.md §3 Route B: every save ships a Form node.',
    input: {
      extension: BASELINE_EXT,
      isNew: true,
      layoutInfoOid: 'aaaa-bbbb-cccc-dddd',
    },
  },

  {
    name: 'add-textfield-basic',
    whyMatters:
      'Most common write: one TextField. Catches dcxml.ts emitter regressions ' +
      'on field shape (FieldName casing, key/Id duplication, baseline 7 children). ' +
      'Memory bos_dcxml_element_schema.md spells out the canonical shape.',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      addFields: [
        {
          type: 'TextField',
          key: 'FOpenDeployTest',
          caption: '测试字段',
          listTabIndex: 100,
          id: '11111111-1111-1111-1111-111111111111',
        },
      ],
      addAppearances: [
        {
          type: 'TextField',
          key: 'FOpenDeployTest',
          caption: '测试字段',
          tabindex: 100,
        },
      ],
    },
  },

  {
    name: 'add-custom-operation-with-python-plugin',
    whyMatters:
      'Plan 5.12.6 hotfix #4 case — addFormOperations + ServicePlugin Python inline. ' +
      'Catches F5 (envelope-existingXxx omitted): if the case ever stops emitting ' +
      'every existingXxxRaw bucket the test catches it. ' +
      'Source pattern: connector.addCustomOperation() at connector.ts:1135-1163.',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      // Real connector usage extracts these from the live extension via
      // extractExistingExtensionElements; we hard-code 1 of each here so the
      // snapshot proves they round-trip into the right buckets.
      existingFieldsRaw: ['<TextField oid="FExistingFieldA" />'],
      existingPluginsRaw: ['<PlugIn oid="ExistingPluginA"><ClassName>X</ClassName></PlugIn>'],
      existingFormOperationsRaw: ['<FormOperation oid="ExistingOp"><Id>ExistingOp</Id></FormOperation>'],
      addFormOperations: [
        {
          service: 'OpdpTest',
          operationId: 45,
          operationName: '测试操作',
          operationParameterId: '11111111-2222-3333-4444-555555555555',
          servicePlugin: {
            className: 'OpdpTestPlugin',
            pyBody: '#test py body\nprint("hello")',
          },
        },
      ],
    },
  },

  {
    name: 'register-python-plugin-fresh-extension',
    whyMatters:
      'register_python_plugins production-proven first-write case — Form-level ' +
      'plugin on a brand-new extension. Catches F4 (LayoutInfos missing on fresh ext) ' +
      'by ensuring layoutInfoOid is wired through. Production scenario stable since Plan 5.',
    input: {
      extension: BASELINE_EXT,
      isNew: true,
      layoutInfoOid: 'fresh-ext-layout-oid',
      addPlugins: [
        {
          type: 'python',
          className: 'AfterConvertHandler',
          pyScript: '#after convert\npass',
        },
      ],
    },
  },

  {
    name: 'register-list-plugin-fresh-extension',
    whyMatters:
      'Plan 7.2 — register_list_python_plugins wire shape. Same BosPluginElement ' +
      'schema as Form plugins but wrapped in <ListPlugins> instead of <FormPlugins>. ' +
      'Capture-verified saleorder_parent.xml: ListPlugins sits inside <Form> sibling ' +
      'to FormPlugins. This case locks the wrapper-name diff so future refactors do ' +
      'not silently re-route List plugins into the FormPlugins collection.',
    input: {
      extension: BASELINE_EXT,
      isNew: true,
      layoutInfoOid: 'fresh-ext-layout-oid',
      addListPlugins: [
        {
          type: 'python',
          className: 'list_export_validator',
          pyScript: '#list plugin\npass',
        },
      ],
    },
  },

  {
    name: 'add-toolbar-button-form-level',
    whyMatters:
      'Lever 3 followup (2026-05-07) — addToolbarButton migrated from Route C ' +
      'overlay to Route B envelope rebuild via addBarButtons[]. This case ' +
      'locks the wire shape: BarButton lives in `<FormAppearance action="edit" ' +
      'oid={parent}>` overlay sibling to existingAppearancesRaw, with full ' +
      'BarDataManager/BarItems/BarItemLinks structure. Migrated wire equivalent ' +
      'of the deleted Route C `add-toolbar-button-form-level` case.',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      addBarButtons: [
        {
          appearanceOid: '22222222-3333-4444-5555-666666666666',
          appearanceKind: 'FormAppearance',
          appearanceElementType: 100,
          buttonKey: 'OpdpTestBtn',
          buttonId: '33333333333333333333333333333333',
          caption: '测试按钮',
          seq: 1,
          boundOperationKey: 'OpdpTest',
          boundOperationName: '测试操作',
          toolbarKey: 'tbToolBar',
          barDataManagerId: '44444444-5555-6666-7777-888888888888',
          formBusinessServiceId: '55555555-6666-7777-8888-999999999999',
          barItemLinkId: '66666666-7777-8888-9999-aaaaaaaaaaaa',
        },
      ],
    },
  },

  {
    name: 'add-toolbar-button-list-menu',
    whyMatters:
      '2026-05-08 follow-up — list-menu support added (FormAppearance.ListMenu). ' +
      'Reflection of Kingdee.BOS.Core.Metadata.FormElement.FormAppearance shows ' +
      '`Menu` and `ListMenu` are sibling [ComplexProperty] BarDataManager fields ' +
      'with identical schema; only wrapper tag differs. This case locks that the ' +
      'wire ships `<FormAppearance ...><ListMenu><BarDataManager>...</BarDataManager></ListMenu></FormAppearance>` ' +
      'when menuWrapper="ListMenu" — diverging from the default `<Menu>` shape.',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      addBarButtons: [
        {
          appearanceOid: '22222222-3333-4444-5555-666666666666',
          appearanceKind: 'FormAppearance',
          menuWrapper: 'ListMenu',
          appearanceElementType: 100,
          buttonKey: 'OpdpListBtn',
          buttonId: '77777777777777777777777777777777',
          caption: '列表菜单按钮',
          seq: 1,
          boundOperationKey: 'OpdpTest',
          boundOperationName: '测试操作',
          toolbarKey: 'FToolBar',
          barDataManagerId: '88888888-9999-aaaa-bbbb-cccccccccccc',
          formBusinessServiceId: '99999999-aaaa-bbbb-cccc-dddddddddddd',
          barItemLinkId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        },
      ],
    },
  },

  {
    name: 'remove-toolbar-button-list-menu',
    whyMatters:
      '2026-05-08 — remove path companion. Locks `<FormAppearance ...><ListMenu>` ' +
      'wrapper for declarative remove markers (BarButtonItem action="remove" + ' +
      'matching BarItemLink). Same wrapper logic as add — driven by menuWrapper.',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      removeBarButtons: [
        {
          appearanceOid: '22222222-3333-4444-5555-666666666666',
          appearanceKind: 'FormAppearance',
          menuWrapper: 'ListMenu',
          appearanceElementType: 100,
          buttonId: '77777777777777777777777777777777',
          barItemLinkId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        },
      ],
    },
  },

  {
    name: 'remove-toolbar-button-form-level',
    whyMatters:
      'Lever 3 followup (2026-05-07) — removeToolbarButton migrated from Route C ' +
      'overlay to Route B envelope rebuild via removeBarButtons[]. Locks the ' +
      'declarative remove markers wrapped in `<FormAppearance action="edit">`.',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      removeBarButtons: [
        {
          appearanceOid: '22222222-3333-4444-5555-666666666666',
          appearanceKind: 'FormAppearance',
          appearanceElementType: 100,
          buttonId: '33333333333333333333333333333333',
          barItemLinkId: '66666666-7777-8888-9999-aaaaaaaaaaaa',
        },
      ],
    },
  },

  {
    name: 'plan-5_12_7-textfield-mustinput-defvalue-literal',
    whyMatters:
      'Plan 5.12.7 — Field.MustInput int 0/1 (NOT True/False) + DefValue ' +
      'literal wire (TextField uses `<DefValue><DefaultValue><Value>X</Value>' +
      '</DefaultValue></DefValue>`). Locks the position: MustInput right ' +
      'after FieldName, DefValue between FieldName and ListTabIndex per ' +
      'capture req-77. Catches mistakes that mix bool encodings or shift ' +
      'wire position (BOS server is strict about both).',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      addFields: [
        {
          type: 'TextField',
          key: 'FOpdpRequired',
          caption: '必录测试',
          listTabIndex: 100,
          id: '11111111-1111-1111-1111-111111111111',
          mustInput: true,
          defValue: { kind: 'literal', value: 'DEFAULT_TEXT' },
        },
      ],
      addAppearances: [
        {
          type: 'TextField',
          key: 'FOpdpRequired',
          caption: '必录测试',
          tabindex: 100,
        },
      ],
    },
  },

  {
    name: 'plan-5_12_7-basedatafield-orgfieldkey-defvalue-function',
    whyMatters:
      'Plan 5.12.7 — BaseDataField.OrgFieldKey (multi-org enterprise) + ' +
      'DefValue function-form (FunctionDefaultValue with FunctionId=15 ' +
      'GetBaseData). OrgFieldKey lands between SrcDisplayFieldName and ' +
      'PropertyName per capture req-77. Locks the polymorphic DefValue ' +
      'wrapper (literal vs function differs by field type).',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      addFields: [
        {
          type: 'BaseDataField',
          key: 'FOpdpCust',
          caption: '客户(默认 01)',
          listTabIndex: 200,
          id: '22222222-2222-2222-2222-222222222222',
          lookUpObjectId: 'BD_Customer-guid-here',
          orgFieldKey: 'FSaleOrgId',
          defValue: { kind: 'function', functionId: 15, functionName: 'GetBaseData', value: '01' },
        },
      ],
      addAppearances: [
        {
          type: 'BaseDataField',
          key: 'FOpdpCust',
          caption: '客户(默认 01)',
          tabindex: 200,
        },
      ],
    },
  },

  {
    name: 'plan-7_8-add-sysreport-keyword-date',
    whyMatters:
      'Plan 7.8 Phase 1 Task 1.2 — renderAddKeyWordField (Date kind). Wire bytes ' +
      'mirror Phase 0 spike probe .scratch/captures/sysreport-filter-wire-probe/' +
      'probe-date.dcxml.txt §3.A. Locks <SysReportForm action="edit">/<SQLDataSource ' +
      'action="edit">/<SQLDataSource>/<KeyWordList> 4-layer envelope + Date-specific ' +
      'ConditionType=2 + ValueType=4 + Field.ElementType=4 alignment (F-SR-1).',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      sysReportEnvelopeOid: 'k_sample_sysreport_envelope_oid_x',
      sqlDataSourceOid: 'sqlds-oid-aaaa-bbbb-cccc-dddd',
      addKeyWordFields: [
        {
          kind: 'date',
          keyWord: '@DateSample',
          name: [{ localeId: 2052, value: '日期参数' }],
          seq: 1,
        },
      ],
    },
  },

  {
    name: 'plan-7_8-add-sysreport-keyword-basedata',
    whyMatters:
      'Plan 7.8 Phase 1 Task 1.2 — BaseData kind. Mirrors §3.B. Locks both ' +
      'AssistantID + Field.LookUpObjectID dual storage of refObjectId (F-SR-2) ' +
      'and IsMultiSelect=True (default false dropped per §1.10 #3). ValueType=13 ' +
      'and Field.ElementType=13 alignment.',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      sysReportEnvelopeOid: 'k_sample_sysreport_envelope_oid_x',
      sqlDataSourceOid: 'sqlds-oid-aaaa-bbbb-cccc-dddd',
      addKeyWordFields: [
        {
          kind: 'base_data',
          keyWord: '@CustomerSample',
          name: [{ localeId: 2052, value: '客户参数' }],
          seq: 1,
          refObjectId: 'BD_Customer',
          multiSelect: true,
        },
      ],
    },
  },

  {
    name: 'plan-7_8-add-sysreport-keyword-text',
    whyMatters:
      'Plan 7.8 Phase 1 Task 1.2 — Text kind. Mirrors §3.C. Locks ConditionType=0 ' +
      '+ ValueType=1 + Field.ElementType=1. MaxLength NOT shipped (probe §3.C ' +
      'concern — emitter TODO for Task 4 smoke). Empty AssistantID self-close.',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      sysReportEnvelopeOid: 'k_sample_sysreport_envelope_oid_x',
      sqlDataSourceOid: 'sqlds-oid-aaaa-bbbb-cccc-dddd',
      addKeyWordFields: [
        {
          kind: 'text',
          keyWord: '@TextSample',
          name: [{ localeId: 2052, value: '文本参数' }],
          seq: 1,
        },
      ],
    },
  },

  {
    name: 'plan-7_8-add-sysreport-keyword-combo',
    whyMatters:
      'Plan 7.8 Phase 1 Task 1.2 — Combo kind. Mirrors §3.D. Combo is the only ' +
      'kind WITHOUT a Field.ConditionType sub-element (§2 note + §3.D). ValueType=9 ' +
      'and Field.ElementType=9 alignment. enumTypeId rides on RptKeyWordField.AssistantID.',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      sysReportEnvelopeOid: 'k_sample_sysreport_envelope_oid_x',
      sqlDataSourceOid: 'sqlds-oid-aaaa-bbbb-cccc-dddd',
      addKeyWordFields: [
        {
          kind: 'combo',
          keyWord: '@ComboSample',
          name: [{ localeId: 2052, value: '枚举参数' }],
          seq: 1,
          enumTypeId: 'sample_enum_type_id',
        },
      ],
    },
  },

  {
    name: 'plan-7_8-add-sysreport-keyword-decimal',
    whyMatters:
      'Plan 7.8 Phase 1 Task 1.2 — Decimal kind. Mirrors §3.E. ConditionType=1 ' +
      '+ ValueType=2 + Field.ElementType=2 (the only kind sharing ElementType=2; ' +
      'distinct from TextField=1 / DateField=4). Precision/Scale NOT shipped ' +
      '(probe §3.E concern — emitter TODO for Task 4 smoke).',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      sysReportEnvelopeOid: 'k_sample_sysreport_envelope_oid_x',
      sqlDataSourceOid: 'sqlds-oid-aaaa-bbbb-cccc-dddd',
      addKeyWordFields: [
        {
          kind: 'decimal',
          keyWord: '@DecimalSample',
          name: [{ localeId: 2052, value: '数量参数' }],
          seq: 1,
        },
      ],
    },
  },

  {
    name: 'plan-5_12_7-entry-mustinput-isshowseq',
    whyMatters:
      'Plan 5.12.7 — Entity.MustInput (int 0/1) + EntityAppearance.IsShowSeq ' +
      '(bool **True/False capitalized**, NOT 0/1). The two encodings are ' +
      'intentionally different per capture req-103 — easy to mix up.',
    input: {
      extension: BASELINE_EXT,
      isNew: false,
      layoutInfoOid: 'L1',
      addEntries: [
        {
          key: 'FOpdpEntry',
          name: '必录明细',
          entryName: 'OPDP_Cust_Entry1',
          tableName: 'OPDP_t_Cust_Entry1',
          seq: 5,
          mustInput: true,
        },
      ],
      addEntryAppearances: [
        {
          key: 'FOpdpEntry',
          caption: '必录明细',
          container: 'FTab1_OPDP_P_abc',
          isShowSeq: true,
        },
      ],
    },
  },
];
