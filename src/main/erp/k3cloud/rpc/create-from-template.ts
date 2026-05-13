import { randomUUID } from 'node:crypto';

export interface CreateFromTemplateInput {
  templateId: string;
  newFormId: string;
  name: string;
  subSystemId: string;
  mainVersion: string;
  layoutOid?: string;
  appearanceOid?: string;
}

export interface CreateFromTemplateEnvelope {
  endpoint: 'SaveForIDEV9';
  envelope: {
    ap0: {
      __source__: 'DCXML';
      __paras__: {
        DevType: 0;
        ISVSignal: 'Kingdee';
        BaseObjectId: string;
        MainVersion: string;
        DomainModelType: number;
      };
      '2052': '';
    };
    ap1_dcxml: string;
  };
}

interface TemplateRegistryEntry {
  modelType: number;
  rootTag: string;
  /** Optional template-specific extra wire emitted inside FormAppearance, before Caption */
  appearanceExtras?: string;
}

// modelType values from MDLEnums.Enu_DomainModelType (BOSEnums.cs:450-457):
//   100=KdBillForm / 400=KdBaseForm / 500=KdDynamicForm / 900=KdReportForm

/**
 * Map known BOS_* template IDs to their (ModelType, rootTag, optional wire extras).
 * Based on 2026-05-13 spike: getObjectTypes RPC dump + 2 user-built sample captures.
 * For unknown templateIds, default to (modelType=900, rootTag='Form') — server will
 * reject with a clear error if wrong, which is preferable to client-side white-listing.
 */
const TEMPLATE_REGISTRY: Record<string, TemplateRegistryEntry> = {
  // SysReport (900)
  BOS_SimpleSysReport: { modelType: 900, rootTag: 'SysReportForm' },
  BOS_MoveSysReport: {
    modelType: 900,
    rootTag: 'SysReportForm',
    appearanceExtras: '<ModeTypeSubId>902</ModeTypeSubId>',
  },
  BOS_TreeSysReport: { modelType: 900, rootTag: 'SysReportForm' },
  BOS_EasyDetailReport: { modelType: 900, rootTag: 'EasyDetailReportForm' },
  BOS_EasySummaryReport: { modelType: 900, rootTag: 'EasySummaryReportForm' },
  BOS_EasyCrossReport: { modelType: 900, rootTag: 'EasyCrossReportForm' },

  // BillForm (100) — rootTag pending Task 4 smoke verification
  BOS_BillModel: { modelType: 100, rootTag: 'BillForm' },
  BOS_BillWithEntryModel: { modelType: 100, rootTag: 'BillForm' },
  BOS_BusinessBillModel: { modelType: 100, rootTag: 'BillForm' },
  BOS_BuinessBillWithEntryModel: { modelType: 100, rootTag: 'BillForm' },
  BOS_SCMBillTemplate: { modelType: 100, rootTag: 'BillForm' },

  // BaseDataForm (400) — rootTag pending Task 4 smoke verification
  BOS_BaseDataModel: { modelType: 400, rootTag: 'BaseDataForm' },
  BOS_NoOrgControlBDModel: { modelType: 400, rootTag: 'BaseDataForm' },
  BOS_PagedNoOrgControlBDModel: { modelType: 400, rootTag: 'BaseDataForm' },
  BOS_OrgControlBDModel: { modelType: 400, rootTag: 'BaseDataForm' },
  BOS_PageOrgControlBDModel: { modelType: 400, rootTag: 'BaseDataForm' },
  BOS_SubordinateBaseData: { modelType: 400, rootTag: 'BaseDataForm' },
  BOS_BaseNoFieldModel: { modelType: 400, rootTag: 'BaseDataForm' },
};

function escapeXml(s: string): string {
  return s.replace(
    /[<>&"']/g,
    (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
}

export function buildCreateFromTemplateEnvelope(
  input: CreateFromTemplateInput,
): CreateFromTemplateEnvelope {
  const reg = TEMPLATE_REGISTRY[input.templateId] ?? { modelType: 900, rootTag: 'Form' };
  const layoutOid = input.layoutOid ?? randomUUID();
  const appearanceOid = input.appearanceOid ?? randomUUID();
  const safeName = escapeXml(input.name);
  const extras = reg.appearanceExtras ?? '';

  const dcxml =
    `<FormMetadata>` +
    `<BusinessInfo><BusinessInfo><Elements>` +
    `<${reg.rootTag} action="edit" oid="${input.templateId}" ElementType="${reg.modelType}" ElementStyle="0">` +
    `<Id>${input.newFormId}</Id>` +
    `<SubsysId>${input.subSystemId}</SubsysId>` +
    `<Name>${safeName}</Name>` +
    `</${reg.rootTag}>` +
    `</Elements></BusinessInfo></BusinessInfo>` +
    `<LayoutInfos>` +
    `<LayoutInfo action="edit" oid="${layoutOid}">` +
    `<Appearances>` +
    `<FormAppearance action="edit" oid="${appearanceOid}" ElementType="${reg.modelType}" ElementStyle="1">` +
    `${extras}` +
    `<Caption>${safeName}</Caption>` +
    `</FormAppearance>` +
    `</Appearances>` +
    `</LayoutInfo>` +
    `</LayoutInfos>` +
    `</FormMetadata>`;

  return {
    endpoint: 'SaveForIDEV9',
    envelope: {
      ap0: {
        __source__: 'DCXML',
        __paras__: {
          DevType: 0,
          ISVSignal: 'Kingdee',
          BaseObjectId: input.templateId,
          MainVersion: input.mainVersion,
          DomainModelType: reg.modelType,
        },
        '2052': '',
      },
      ap1_dcxml: dcxml,
    },
  };
}
