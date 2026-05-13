/**
 * Plan 7.6 Task 5 — Register a Python plugin on an existing SysReport object.
 *
 * Wire target: `SysReportForm.SysReportServicePlugins` (decompiled
 * Kingdee.BOS.Core.Metadata.FormElement.SysReportForm:20).
 * Base class for Python proxy: `AbstractSysReportServicePlugIn`.
 * Python runtime class: `PythonReportPlugIn`.
 *
 * Key wire-format notes (from Task 4 + create-from-template.ts + smoke discovery):
 *   - This is a DIRECT EDIT of an existing SysReport object (DevType=0).
 *   - DCXML root element is always `<Form>` for write operations.
 *   - `oid` in the DCXML `<Form action="edit" oid="...">` is the TEMPLATE
 *     baseline (e.g. "BOS_SimpleSysReport"), NOT the formId. The server loads
 *     the template as the DCXML baseline to diff against. This `oid` equals
 *     the `BaseObjectId` in `__paras__` and must be read from the SysReport's
 *     FKERNELXML (the `oid` attribute of the root element).
 *   - `__paras__.Id` = formId (the SysReport being edited).
 *   - `__paras__.OldId` = formId (non-null for existing objects; null triggers
 *     the server's "唯一标识已经存在" create-uniqueness check).
 *   - `<SysReportServicePlugins>` mirrors the CollectionProperty name exactly.
 *   - PlugIn schema: identical to FormPlugins PlugIn (ClassName/PlugInType/PyScript).
 *   - `__paras__` must be JSON.stringify'd (double-encoded string-in-JSON).
 *   - No separate ap1 field — ap0Plain only.
 */

import {
  callKdsvc,
  encodeApField,
  applySetCookieToSession,
  parseJsonResponse,
  type KdSession,
} from './http-client';

const METADATA_SERVICE = 'Kingdee.BOS.ServiceFacade.ServicesStub.Metadata.MetadataService';

export interface RegisterSysReportPluginInput {
  /** The existing SysReport formId (k + 32 hex chars). */
  formId: string;
  /**
   * The template OID this SysReport was created from (e.g. "BOS_SimpleSysReport").
   * This is the `oid` attribute of the root element in the SysReport's FKERNELXML
   * readback. It serves as the DCXML baseline the server diffs against.
   * If not provided, the caller must fetch it from metadata first.
   */
  baseObjectId: string;
  /** Plugin class name (short identifier, e.g. "SmokeReportPlugin"). */
  className: string;
  /** IronPython 2.7 source code. Inherits AbstractSysReportServicePlugIn. */
  pyBody: string;
  /**
   * Optional mainVersion string. Defaults to empty string (null maps to
   * JSONObject in K/3's JSON parser → String cast failure, so we use '').
   */
  mainVersion?: string;
  /** Optional display name for the SysReport (used in __paras__ Name field). */
  formName?: string;
}

/**
 * The ap0 plaintext shape for a register-sysreport-plugin SaveForIDEV9 call.
 * Mirrors CreateFromTemplateEnvelope — same wire contract.
 */
export interface RegisterSysReportPluginEnvelope {
  endpoint: 'SaveForIDEV9';
  ap0Plain: {
    __source__: string;
    __paras__: string;
    '2052': '';
  };
}

export interface RegisterSysReportPluginResult {
  isSuccess: boolean;
  funcResult: boolean;
  messageTitle: string | null;
  messageDetail: string | null;
}

function escapeXml(s: string): string {
  return s.replace(
    /[<>&"']/g,
    (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
}

export function buildRegisterSysReportPluginEnvelope(
  input: RegisterSysReportPluginInput,
): RegisterSysReportPluginEnvelope {
  const safeClassName = escapeXml(input.className);
  // CDATA guard: split ]]> sequences to avoid closing the CDATA early
  const safePyBody = input.pyBody.replace(/]]>/g, ']]]]><![CDATA[>');

  // DCXML: edit the existing SysReport object directly.
  // - action="edit" oid="${baseObjectId}": server loads the template as DCXML baseline.
  //   The oid must be the template (e.g. "BOS_SimpleSysReport"), NOT the formId.
  //   Using formId as oid triggers "唯一标识已经存在" — server tries to create new.
  // - ElementType="900": SysReport domain model (KdReportForm).
  // - <Id> = formId (the SysReport being edited).
  // - <SysReportServicePlugins> is the CollectionProperty name from SysReportForm.cs:20.
  // - PlugIn schema is identical to FormPlugins PlugIn: ClassName/PlugInType/PyScript.
  const dcxml =
    `<FormMetadata>` +
    `<BusinessInfo><BusinessInfo><Elements>` +
    `<Form action="edit" oid="${escapeXml(input.baseObjectId)}" ElementType="900" ElementStyle="0">` +
    `<Id>${input.formId}</Id>` +
    `<SysReportServicePlugins>` +
    `<PlugIn ElementType="0" ElementStyle="0">` +
    `<ClassName>${safeClassName}</ClassName>` +
    `<PlugInType>1</PlugInType>` +
    `<PyScript><![CDATA[${safePyBody}]]></PyScript>` +
    `</PlugIn>` +
    `</SysReportServicePlugins>` +
    `</Form>` +
    `</Elements></BusinessInfo></BusinessInfo>` +
    `<LayoutInfos/>` +
    `</FormMetadata>`;

  // __paras__: DevType=0 = direct object edit (not extension/DevType=2).
  // BaseObjectId = baseObjectId (template OID, matches DCXML oid).
  // Id = formId (existing SysReport being edited).
  // OldId = formId (non-null for existing objects — null triggers create path).
  // MainVersion: null → JSONObject cast failure in K/3; use empty string.
  // Name: required — LocaleValue JSON array.
  const displayName = input.formName ?? input.formId;
  const nameJson = JSON.stringify([{ Key: 2052, Value: displayName }]);
  const parasObj = {
    ModelTypeId: 900,
    BaseObjectId: input.baseObjectId,
    DevType: 0,
    SubSystemId: '23',
    UpdateIdToKey: false,
    MainVersion: input.mainVersion ?? '',
    Name: nameJson,
    FirstNonExtendObjectID: input.baseObjectId,
    ISV: null,
    Version: null,
    PackageId: null,
    OldId: input.formId,
    Id: input.formId,
    HasExtends: false,
    RunTime: false,
    LayoutViewId: null,
    OldLayoutViewId: null,
    LayoutViewVersion: null,
    DependencyObjectId: null,
    SourceFormId: null,
    InheritPath: null,
    IsInheritElement: false,
    ModelTypeSubId: 900,
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

export async function callRegisterSysReportPlugin(
  session: KdSession,
  input: RegisterSysReportPluginInput,
): Promise<RegisterSysReportPluginResult> {
  const envelope = buildRegisterSysReportPluginEnvelope(input);
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
