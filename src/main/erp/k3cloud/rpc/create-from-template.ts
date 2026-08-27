import { randomUUID } from 'node:crypto';
import {
  callKdsvc,
  encodeApField,
  applySetCookieToSession,
  parseJsonResponse,
  type KdSession,
} from './http-client';

const METADATA_SERVICE = 'Kingdee.BOS.ServiceFacade.ServicesStub.Metadata.MetadataService';

export interface CreateFromTemplateInput {
  templateId: string;
  newFormId: string;
  name: string;
  subSystemId: string;
  mainVersion: string | null;
  layoutOid?: string;
  appearanceOid?: string;
}

/**
 * The ap0 plaintext shape for a create-from-template SaveForIDEV9 call.
 *
 * Wire format (matches save-for-ide.ts `buildAp0Plain` pattern, verified
 * against BOS Designer captures):
 *   - `__source__`: the DCXML content (full FormMetadata XML string)
 *   - `__paras__`: a JSON-STRINGIFIED string (double-encoded) containing the
 *     metadata parameters — NOT an inline object.
 *   - `"2052"`: always empty string (locale slot).
 *
 * This whole ap0Object is then JSON.stringify'd and app-layer encoded as ap0.
 * There is NO separate ap1 field for create-from-template.
 */
export interface CreateFromTemplateEnvelope {
  endpoint: 'SaveForIDEV9';
  /**
   * The plaintext ap0 object before JSON.stringify + app-layer encoding.
   * `__paras__` is already JSON.stringify'd (string-in-string) to match
   * the BOS wire protocol.
   */
  ap0Plain: {
    __source__: string;  // the DCXML XML content
    __paras__: string;   // JSON.stringify'd parameters object
    '2052': '';
  };
}

export interface CreateFromTemplateResult {
  isSuccess: boolean;
  funcResult: boolean;
  messageTitle: string | null;
  messageDetail: string | null;
}

export async function callCreateFromTemplate(
  session: KdSession,
  input: CreateFromTemplateInput,
): Promise<CreateFromTemplateResult> {
  const envelope = buildCreateFromTemplateEnvelope(input);
  // Encode the whole ap0 object (which already has __paras__ as a JSON string)
  const ap0Encoded = encodeApField(envelope.ap0Plain);
  const res = await callKdsvc(session, METADATA_SERVICE, 'SaveForIDEV9', {
    apFields: { ap0: ap0Encoded },
  });
  applySetCookieToSession(session, res.setCookieHeaders);
  const parsed = parseJsonResponse<{
    IsSuccess: boolean;
    FuncResult: boolean;
    MessageTitle: string | null;
    MessageDetail: string | null;
  }>(res.bodyText);
  return {
    isSuccess: parsed.IsSuccess,
    funcResult: parsed.FuncResult,
    messageTitle: parsed.MessageTitle,
    messageDetail: parsed.MessageDetail,
  };
}

interface TemplateRegistryEntry {
  modelType: number;
  /** Optional template-specific extra wire emitted inside FormAppearance, before Caption */
  appearanceExtras?: string;
  /**
   * The oid that the server stores in FKERNELXML readback after create.
   * For sub-templates (e.g. BOS_BillWithEntryModel), the server resolves
   * to the root ancestor template (e.g. BOS_BillModel). When present,
   * callers should assert readback contains this oid instead of templateId.
   * When absent, assume readback oid === templateId (SysReport behavior).
   */
  readbackOid?: string;
}

// modelType values from MDLEnums.Enu_DomainModelType (BOSEnums.cs:450-457):
//   100=KdBillForm / 400=KdBaseForm / 500=KdDynamicForm / 900=KdReportForm

/**
 * Map known BOS_* template IDs to their ModelType (and optional wire extras).
 *
 * Root DCXML element tag: always `Form` — verified by decompiling
 * DomainModleDcxmlBinder (2026-05-13). The DcxmlBinder does not register
 * type-specific root tags like `SysReportForm`/`BillForm`/`BaseDataForm` —
 * those appear only in the FKERNELXML *readback* (server serialization output),
 * not in the create/edit *input* wire. The `ModelTypeId` in `__paras__` is what
 * selects the correct domain model and binder on the server side.
 *
 * For unknown templateIds, default to modelType=900 (SysReport) — server will
 * reject with a clear error if wrong, which is preferable to silent success
 * with incorrect metadata.
 */
const TEMPLATE_REGISTRY: Record<string, TemplateRegistryEntry> = {
  // SysReport (900)
  BOS_SimpleSysReport: { modelType: 900 },
  BOS_MoveSysReport: {
    modelType: 900,
    appearanceExtras: '<ModeTypeSubId>902</ModeTypeSubId>',
  },
  BOS_TreeSysReport: { modelType: 900 },
  BOS_EasyDetailReport: { modelType: 900 },
  BOS_EasySummaryReport: { modelType: 900 },
  BOS_EasyCrossReport: { modelType: 900 },

  // BillForm (100)
  // BOS_BillModel is the root BillForm template; sub-templates (BillWithEntry, etc.)
  // inherit from it. Server resolves to BOS_BillModel in FKERNELXML readback.
  BOS_BillModel: { modelType: 100 },
  BOS_BillWithEntryModel: { modelType: 100, readbackOid: 'BOS_BillModel' },
  BOS_BusinessBillModel: { modelType: 100, readbackOid: 'BOS_BillModel' },
  BOS_BuinessBillWithEntryModel: { modelType: 100, readbackOid: 'BOS_BillModel' },
  BOS_SCMBillTemplate: { modelType: 100, readbackOid: 'BOS_BillModel' },

  // BaseDataForm (400)
  // BOS_BaseDataModel is the root BaseDataForm template.
  BOS_BaseDataModel: { modelType: 400 },
  BOS_NoOrgControlBDModel: { modelType: 400, readbackOid: 'BOS_BaseDataModel' },
  BOS_PagedNoOrgControlBDModel: { modelType: 400, readbackOid: 'BOS_BaseDataModel' },
  BOS_OrgControlBDModel: { modelType: 400, readbackOid: 'BOS_BaseDataModel' },
  BOS_PageOrgControlBDModel: { modelType: 400, readbackOid: 'BOS_BaseDataModel' },
  BOS_SubordinateBaseData: { modelType: 400, readbackOid: 'BOS_BaseDataModel' },
  BOS_BaseNoFieldModel: { modelType: 400, readbackOid: 'BOS_BaseDataModel' },

  // DynamicForm (500) — Plan 7.7
  // DynamicForm 跟 SysReport/BillForm/BaseDataForm 本质不同:不是独立业务对象,
  // 而是 BOS 配套辅助 UI 模板(过滤器/向导/列表底盘/参数对话框/卡片菜单)。
  // 客户使用量 TOP 9(by `.scratch/captures/bos-templates.json`)。
  // readbackOid 默认 = templateId — DynamicForm 模板彼此平级,无"根模板收敛"
  // (区别于 BillForm 都收敛到 BOS_BillModel、BaseDataForm 都收敛到 BOS_BaseDataModel)。
  BOS_CommonFilter: { modelType: 500 },           // 公共过滤(441 客户实例,最常用)
  BOS_StandardFilter: { modelType: 500 },         // 列表过滤
  BOS_OrgIsolationFilter: { modelType: 500 },     // 列表过滤(带组织)
  BOS_ForceOrgIsolationFilter: { modelType: 500 },// 列表过滤(强制带组织)
  BOS_EasyReportCommonFilter: { modelType: 500 }, // 简单报表过滤
  BOS_List: { modelType: 500 },                   // 列表
  BOS_WIZARDFORMTPL: { modelType: 500 },          // 向导动态表单模板
  BOS_BILLTYPEPARAMODEL: { modelType: 500 },      // 单据类型参数模板
  BOS_BASECLOUDPART: { modelType: 500 },          // 页面部件动态表单基类
};

/**
 * For a given templateId, return the oid that the server will store in
 * FKERNELXML after create-from-template. For most templates this equals
 * templateId, but sub-templates (BOS_BillWithEntryModel etc.) resolve to
 * their root ancestor (BOS_BillModel / BOS_BaseDataModel).
 *
 * Smoke tests and readback assertions should use this instead of templateId.
 */
export function getExpectedReadbackOid(templateId: string): string {
  const reg = TEMPLATE_REGISTRY[templateId];
  return reg?.readbackOid ?? templateId;
}

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
  const reg = TEMPLATE_REGISTRY[input.templateId] ?? { modelType: 900 };
  const layoutOid = input.layoutOid ?? randomUUID();
  const appearanceOid = input.appearanceOid ?? randomUUID();
  const safeName = escapeXml(input.name);
  const extras = reg.appearanceExtras ?? '';

  // DCXML goes in __source__ (the full FormMetadata XML string).
  // Wire format matches regular SaveForIDEV9: __source__ = DCXML content,
  // __paras__ = JSON.stringify'd parameters (double-encoded string-in-JSON).
  //
  // Root DCXML element is always `Form` — the DomainModleDcxmlBinder does
  // not register type-specific root tags like SysReportForm/BillForm/BaseDataForm.
  // Those only appear in server FKERNELXML readback output. On the write side,
  // `Form` is the universal root tag regardless of ModelTypeId. The ModelTypeId
  // in __paras__ selects the correct domain model on the server.
  const dcxml =
    `<FormMetadata>` +
    `<BusinessInfo><BusinessInfo><Elements>` +
    `<Form action="edit" oid="${input.templateId}" ElementType="${reg.modelType}" ElementStyle="0">` +
    `<Id>${input.newFormId}</Id>` +
    `<SubsysId>${input.subSystemId}</SubsysId>` +
    `<Name>${safeName}</Name>` +
    `</Form>` +
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

  // __paras__ must be a JSON-stringified string (same double-encoding as
  // save-for-ide.ts buildParas). Server reads it as a JSON string, then
  // deserializes it again. Sending an inline object causes K/3's JSON
  // library to treat object fields as JSONObject → String cast failures.
  //
  // Key fields (from decompiled AbstractBusinessMetadata.DeserExtendProperties 2026-05-13):
  //   ModelTypeId          — selects DomainModel + DcxmlBinder
  //   BaseObjectId         — template formId; server loads it as DCXML baseline
  //   DevType=0            — "create from template" path (vs DevType=2 for extensions)
  //   UpdateIdToKey        — read via GetBool; false is correct for create
  //   MainVersion          — must be string (JSON null → K/3 JSONObject cast failure)
  //   Name                 — REQUIRED: JSON-stringified LocaleValue array
  //                          JsonConvert.DeserializeObject<LocaleValue>(props.GetString("Name"))
  //                          throws "value cannot be null" if absent
  //   SubSystemId          — form's subsystem; passed through to DCXML
  //   FirstNonExtendObjectID — equals BaseObjectId for create-from-template
  //   ISV                  — developer identity (Id/Name/ISVSignal/PackageSignal/DevCode)
  //   null-safe strings    — Version/PackageId/LayoutViewId etc returned via GetString → ok null
  const nameJson = JSON.stringify([{ Key: 2052, Value: input.name }]);
  const parasObj = {
    ModelTypeId: reg.modelType,
    BaseObjectId: input.templateId,
    DevType: 0,
    SubSystemId: input.subSystemId,
    UpdateIdToKey: false,
    // mainVersion null → empty string: K/3 maps JSON null to JSONObject,
    // which fails a String cast on the server side.
    MainVersion: input.mainVersion ?? '',
    Name: nameJson,
    FirstNonExtendObjectID: input.templateId,
    // null is valid: server skips ISV block (decompile AbstractBusinessMetadata.cs).
    // Create-from-template intentionally registers no ISV identity — it's user customization,
    // not vendor/ISV development.
    ISV: null,
    Version: null,
    PackageId: null,
    OldId: null,
    Id: input.newFormId,
    HasExtends: false,
    RunTime: false,
    LayoutViewId: null,
    OldLayoutViewId: null,
    LayoutViewVersion: null,
    DependencyObjectId: null,
    SourceFormId: null,
    InheritPath: null,
    IsInheritElement: false,
    ModelTypeSubId: reg.modelType,
  };

  return {
    endpoint: 'SaveForIDEV9',
    ap0Plain: {
      __source__: dcxml,
      __paras__: JSON.stringify(parasObj),
      '2052': '',
    },
  };
}
