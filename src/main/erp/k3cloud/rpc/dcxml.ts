/**
 * BOS DCXML emitter — typed AST → SaveForIDEV9 ap0.__source__ string.
 *
 * Wire format reference: `.scratch/captures/decoded/req-*` real captures.
 * Schema reference: memory `bos_dcxml_element_schema.md`.
 *
 * Output structure (skipping declared but empty sections for brevity):
 *
 *   <?xml version="1.0" encoding="utf-16"?>
 *   <FormMetadata>
 *     <BusinessInfo><BusinessInfo><Elements>
 *       <Form action="edit" oid="BOS_BillModel" ElementType="100">
 *         <Id>{formId}</Id>
 *       </Form>
 *       {addFields rendered with no action attr (= add)}
 *       {removeFields rendered with action="remove" oid=...}
 *     </Elements></BusinessInfo></BusinessInfo>
 *     <LayoutInfos><LayoutInfo action="edit" oid="{layoutInfoOid}">
 *       <Appearances>
 *         {addAppearances rendered with type-specific extras}
 *       </Appearances>
 *     </LayoutInfo></LayoutInfos>
 *   </FormMetadata>
 *
 * Empirical: server SaveForIDEV9 accepts utf-8 bytes regardless of the
 * `encoding="utf-16"` declaration in the XML prolog (BOS XmlTextWriter
 * default). We emit utf-8 with the matching declaration to byte-match
 * original samples.
 */

import {
  BosFieldElement,
  BosFieldAppearance,
  BosPluginElement,
  BosRemoveElement,
  BosEntryElement,
  BosEntryAppearance,
  BosTabPageAppearance,
  BosTabControlAppearance,
  BosFormOperationElement,
  BosBarButtonElement,
  BosRemoveBarButton,
  BosDefValue,
  SaveExtensionRequest,
  FIELD_ELEMENT_TYPE,
} from './types';
import {
  BosRptKeyWordFieldElement,
  KEYWORD_KIND_TO_WIRE,
} from './sysreport-keyword-types';
import {
  BosRptFilterGridFieldElement,
  GRIDFIELD_CELLTYPE_TO_ELEMENTTYPE,
} from './sysreport-gridfield-types';

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 32-char hex GUID (no dashes) — matches BOS Designer's <Id> shape. */
export function newCompactGuid(): string {
  // Cheap GUID: random hex without dashes. crypto.randomUUID gives dashed,
  // strip them. Available without import in Node 19+.
  return globalThis.crypto.randomUUID().replace(/-/g, '');
}

/** Standard 8-4-4-4-12 dashed GUID — for layoutInfoOid etc. */
export function newDashedGuid(): string {
  return globalThis.crypto.randomUUID();
}

interface XmlWriter {
  push(s: string): void;
}

/** Render a child like `<Tag>value</Tag>`. Skips when value is undefined. */
function child(out: XmlWriter, tag: string, value: string | number | undefined): void {
  if (value === undefined || value === null) return;
  out.push(`<${tag}>${typeof value === 'string' ? xmlEscape(value) : value}</${tag}>`);
}

function renderFormRoot(
  out: XmlWriter,
  formId: string,
  formName: string | undefined,
  plugins: BosPluginElement[] | undefined,
  existingPluginsRaw: string[] | undefined,
  formOperations: BosFormOperationElement[] | undefined,
  existingFormOperationsRaw: string[] | undefined,
  /** Plan 7.2:List 插件(挂到 `<Form><ListPlugins>`,跟 FormPlugins 平级)。 */
  listPlugins?: BosPluginElement[] | undefined,
  existingListPluginsRaw?: string[] | undefined,
): void {
  out.push(`<Form action="edit" oid="BOS_BillModel" ElementType="100" ElementStyle="0">`);
  out.push(`<Id>${formId}</Id>`);
  // BOS server reads metadata.Name from this element, NOT from paras.Name —
  // omitting it makes the server fall back to the parent object's Name on
  // every save (so the extension shows up as "销售订单" instead of the
  // user-given "OpenDeploy 业务规则 demo"). Empirical evidence:
  // .scratch/probe-form-name.ts (2026-05-05). Skip when caller doesn't
  // know the name (rare; only old call sites that didn't pre-load it).
  if (formName) {
    out.push(`<Name>${xmlEscape(formName)}</Name>`);
  }
  const hasExistingOps = existingFormOperationsRaw && existingFormOperationsRaw.length > 0;
  const hasNewOps = formOperations && formOperations.length > 0;
  if (hasExistingOps || hasNewOps) {
    out.push(`<FormOperations>`);
    if (hasExistingOps) for (const raw of existingFormOperationsRaw!) out.push(raw);
    if (hasNewOps) for (const op of formOperations!) renderFormOperation(out, op);
    out.push(`</FormOperations>`);
  }
  const hasExisting = existingPluginsRaw && existingPluginsRaw.length > 0;
  const hasNew = plugins && plugins.length > 0;
  if (hasExisting || hasNew) {
    out.push(`<FormPlugins>`);
    if (hasExisting) for (const raw of existingPluginsRaw!) out.push(raw);
    if (hasNew) for (const p of plugins!) renderPluginElement(out, p);
    out.push(`</FormPlugins>`);
  }
  // Plan 7.2:ListPlugins 紧跟 FormPlugins(同一 <Form> 内,wire 实证
  // saleorder_parent.xml)。复用 renderPluginElement(schema 完全一致)。
  const hasExistingList = existingListPluginsRaw && existingListPluginsRaw.length > 0;
  const hasNewList = listPlugins && listPlugins.length > 0;
  if (hasExistingList || hasNewList) {
    out.push(`<ListPlugins>`);
    if (hasExistingList) for (const raw of existingListPluginsRaw!) out.push(raw);
    if (hasNewList) for (const p of listPlugins!) renderPluginElement(out, p);
    out.push(`</ListPlugins>`);
  }
  out.push(`</Form>`);
}

/**
 * Render one `<FormOperation>` registering a service name → built-in row
 * operation. Required for entry toolbar buttons (新增行 / 删除行) — the
 * BarButton's `<Parameters>["{service}"]</Parameters>` must match a
 * FormOperation's `<Operation>{service}</Operation>` for the runtime to
 * resolve the click into a row operation. Schema captured 2026-05-04.
 */
function renderFormOperation(out: XmlWriter, op: BosFormOperationElement): void {
  out.push(`<FormOperation>`);
  child(out, 'Id', op.service);
  child(out, 'Operation', op.service);
  out.push(`<BeforeOpAlterInfo/>`);
  out.push(`<AfterOpAlterInfo/>`);
  out.push(`<AfterOpFailedInfo action="setnull"/>`);
  child(out, 'OperationId', op.operationId);
  child(out, 'OperationName', op.operationName);
  out.push(`<Parmeter>`);
  out.push(`<OperationParameter>`);
  child(out, 'Id', op.operationParameterId ?? newDashedGuid());
  if (op.entryKey) child(out, 'OperationObjectKey', op.entryKey);
  if (op.expressValue) child(out, 'ExpressValue', op.expressValue);
  out.push(`</OperationParameter>`);
  out.push(`</Parmeter>`);
  // OperEleIds is entry-level metadata — emit only for entry ops; absent
  // on header-level custom operations (recon req-212 OperationId=45 ship
  // ships an empty OperEleIds, BOS Designer treats absence equivalently).
  if (op.operEleIds !== undefined || op.entryKey) {
    child(out, 'OperEleIds', op.operEleIds ?? 35);
  }
  child(out, 'LoadKeys', '[]');
  // ServicePlugins — inline IronPython plugin attached to this op
  // (recon §3.4 / capture req-212). Order: inside FormOperation, after
  // LoadKeys per BOS Designer wire.
  if (op.servicePlugin) {
    out.push(`<ServicePlugins>`);
    out.push(`<PlugIn ElementType="0" ElementStyle="0">`);
    child(out, 'ClassName', op.servicePlugin.className);
    out.push(`<PlugInType>1</PlugInType>`);
    if (op.servicePlugin.pyBody) {
      const safe = op.servicePlugin.pyBody.replace(/]]>/g, ']]]]><![CDATA[>');
      out.push(`<PyScript><![CDATA[${safe}]]></PyScript>`);
    }
    out.push(`</PlugIn>`);
    out.push(`</ServicePlugins>`);
  }
  out.push(`</FormOperation>`);
}

/**
 * Render a single `<PlugIn ElementType="0" ElementStyle="0">` block. Order
 * matches captured req-75: ClassName → PlugInType → PyScript. PyScript wraps
 * the body in CDATA so script content with `<` / `>` / `&` flows through
 * without XML escaping.
 *
 * Note: capture only confirmed Python (PlugInType=1). DLL plugins use
 * PlugInType=0 with the .NET fully-qualified type as ClassName and an
 * `<OrderId>` child — not yet supported here.
 */
function renderPluginElement(out: XmlWriter, p: BosPluginElement): void {
  out.push(`<PlugIn ElementType="0" ElementStyle="0">`);
  child(out, 'ClassName', p.className);
  out.push(`<PlugInType>${p.type === 'python' ? 1 : 0}</PlugInType>`);
  // CDATA — never escape; rely on the rare `]]>` substring case to be
  // accidental in user-given scripts. If it ever becomes a real problem
  // we'll split the CDATA section, but Python doesn't naturally produce
  // `]]>` so this is fine for now.
  out.push(`<PyScript><![CDATA[${p.pyScript}]]></PyScript>`);
  out.push(`</PlugIn>`);
}

/**
 * Render one field element with its baseline + type-specific children.
 * Order matches what BOS Designer emits (we match for byte-level diff
 * stability against captures).
 *
 * EntityKey injection: when `f.entityKey` is set (i.e. the field belongs to
 * an EntryEntity / 单据体), `<EntityKey>{entityKey}</EntityKey>` is rendered
 * immediately after `<PropertyName>`, preserving the BOS Designer-emitted
 * order. Implemented as a post-write rewrite to keep each type's
 * type-specific child order intact without duplicating switch arms.
 */
function renderFieldElement(out: XmlWriter, f: BosFieldElement): void {
  const elemType = FIELD_ELEMENT_TYPE[f.type];
  const id = f.id ?? newCompactGuid();

  // Capture this field's children into a local writer so we can splice the
  // EntityKey directly after PropertyName regardless of type-specific order.
  const inner: string[] = [];
  const innerOut: XmlWriter = { push: (s) => inner.push(s) };

  // Plan 5.12.7 — `<MustInput>1</MustInput>` emitted by switch cases right
  // after `<FieldName>` (capture req-103). BasePropertyField has no
  // FieldName and no MustInput in the wire format, so it skips this.
  const renderMustInput = () => {
    if (f.mustInput) child(innerOut, 'MustInput', 1);
  };
  // Plan 5.12.7 — DefValue position is type-specific but always BEFORE
  // `<PropertyName>`. Each switch case calls this where capture data shows
  // it should land. BasePropertyField doesn't support DefValue.
  const renderDefValueIfSet = () => {
    if (f.type !== 'BasePropertyField' && (f as { defValue?: BosDefValue }).defValue) {
      renderDefValue(innerOut, (f as { defValue?: BosDefValue }).defValue!);
    }
  };

  // Render order: type-specific prefix → common prefix → name/id/key suffix.
  // Captured samples follow this rough shape, e.g. BaseDataField puts
  // LookUpObjectID before PropertyName; ComboField puts EnumType first.
  switch (f.type) {
    case 'TextField':
    case 'IntegerField':
    case 'DateField': {
      child(innerOut, 'ConditionType', 0);
      renderDefValueIfSet();
      child(innerOut, 'PropertyName', f.key);
      child(innerOut, 'FieldName', f.key.toUpperCase());
      renderMustInput();
      break;
    }
    case 'DecimalField':
    case 'PriceField':
    case 'AmountField': {
      child(innerOut, 'ConditionType', 0);
      child(innerOut, 'FieldScale', f.fieldScale);
      child(innerOut, 'FieldPrecision', f.fieldPrecision);
      renderDefValueIfSet();
      child(innerOut, 'PropertyName', f.key);
      child(innerOut, 'FieldName', f.key.toUpperCase());
      renderMustInput();
      break;
    }
    case 'QtyField': {
      child(innerOut, 'ConditionType', 0);
      child(innerOut, 'FieldScale', f.fieldScale);
      child(innerOut, 'FieldPrecision', f.fieldPrecision);
      renderDefValueIfSet();
      child(innerOut, 'PropertyName', f.key);
      child(innerOut, 'ControlFieldKey', f.controlFieldKey);
      child(innerOut, 'FieldName', f.key.toUpperCase());
      renderMustInput();
      break;
    }
    case 'CheckBoxField': {
      child(innerOut, 'Editlen', 20);
      renderDefValueIfSet();
      child(innerOut, 'PropertyName', f.key);
      child(innerOut, 'FieldName', f.key.toUpperCase());
      renderMustInput();
      child(innerOut, 'ConditionType', 0);
      child(innerOut, 'DefaultCondition', f.defaultCondition ?? 0);
      break;
    }
    case 'ComboField': {
      child(innerOut, 'EnumType', f.enumTypeId);
      child(innerOut, 'Editlen', 20);
      renderDefValueIfSet();
      child(innerOut, 'PropertyName', f.key);
      child(innerOut, 'FieldName', f.key.toUpperCase());
      renderMustInput();
      child(innerOut, 'FieldType', 167);
      child(innerOut, 'ConditionType', 5);
      child(innerOut, 'DefaultCondition', f.defaultCondition ?? 0);
      break;
    }
    case 'BaseDataField': {
      child(innerOut, 'ConditionType', 0);
      child(innerOut, 'AllowEditGroup', 0);
      child(innerOut, 'LookUpObjectID', f.lookUpObjectId);
      child(innerOut, 'SrcFindFieldName', f.srcFindFieldName ?? 'FNUMBER');
      child(innerOut, 'SrcDisplayFieldName', f.srcDisplayFieldName ?? 'FNAME');
      // OrgFieldKey + DefValue both land between SrcDisplayFieldName and
      // PropertyName per capture req-77/103. Order: OrgFieldKey first, then
      // DefValue (matches `<OrgFieldKey>...</OrgFieldKey><DefValue>...` in
      // capture).
      if (f.orgFieldKey) child(innerOut, 'OrgFieldKey', f.orgFieldKey);
      renderDefValueIfSet();
      child(innerOut, 'PropertyName', f.key);
      child(innerOut, 'FieldName', f.key.toUpperCase());
      renderMustInput();
      child(innerOut, 'FieldType', 56);
      break;
    }
    case 'BasePropertyField': {
      // BasePropertyField is unique: NO FieldName, NO FieldType, no MustInput,
      // no DefValue support per captures. mustInput / defValue silently
      // ignored here even if set on the typed AST.
      child(innerOut, 'SrcDisplayFieldName', f.srcDisplayFieldName ?? 'FName');
      child(innerOut, 'DefaultCondition', f.defaultCondition ?? 67);
      child(innerOut, 'ConditionType', 0);
      child(innerOut, 'PropertyName', f.key);
      child(innerOut, 'ControlFieldKey', f.controlFieldKey);
      break;
    }
    case 'UnitField': {
      child(innerOut, 'UnitTypeKey', f.unitTypeKey);
      child(innerOut, 'ConditionType', 0);
      child(innerOut, 'LookUpObjectID', f.lookUpObjectId);
      renderDefValueIfSet();
      child(innerOut, 'PropertyName', f.key);
      child(innerOut, 'FieldName', f.key.toUpperCase());
      renderMustInput();
      child(innerOut, 'FieldType', 127);
      break;
    }
  }

  child(innerOut, 'ListTabIndex', f.listTabIndex);
  child(innerOut, 'Name', f.caption);
  child(innerOut, 'Id', id);
  child(innerOut, 'Key', f.key);

  out.push(`<${f.type} ElementType="${elemType}" ElementStyle="0">`);
  if (f.entityKey) {
    // Splice <EntityKey>...</EntityKey> immediately after the first
    // <PropertyName>...</PropertyName>, matching captured entry-field shape.
    const propTag = `<PropertyName>${xmlEscape(f.key)}</PropertyName>`;
    let spliced = false;
    for (const piece of inner) {
      out.push(piece);
      if (!spliced && piece === propTag) {
        out.push(`<EntityKey>${xmlEscape(f.entityKey)}</EntityKey>`);
        spliced = true;
      }
    }
  } else {
    for (const piece of inner) out.push(piece);
  }
  out.push(`</${f.type}>`);
}

/**
 * Render `<DefValue>...</DefValue>` polymorphically per `BosDefValue.kind`:
 *   literal  → `<DefaultValue><Value>X</Value></DefaultValue>`
 *   function → `<FunctionDefaultValue><FunctionId/><FunctionName/>
 *                [Value][Parameter]</FunctionDefaultValue>`
 *
 * Wire shape verified 2026-05-04 capture req-103. The outer `<DefValue>`
 * wrapper is always present; the inner element class differs by kind to match
 * BOS's DCXML polymorphic serializer dispatch.
 */
function renderDefValue(out: XmlWriter, dv: BosDefValue): void {
  out.push('<DefValue>');
  if (dv.kind === 'literal') {
    out.push('<DefaultValue>');
    child(out, 'Value', dv.value);
    out.push('</DefaultValue>');
  } else {
    out.push('<FunctionDefaultValue>');
    child(out, 'FunctionId', dv.functionId);
    child(out, 'FunctionName', dv.functionName);
    if (dv.value !== undefined) child(out, 'Value', dv.value);
    if (dv.parameter !== undefined) child(out, 'Parameter', dv.parameter);
    out.push('</FunctionDefaultValue>');
  }
  out.push('</DefValue>');
}

function renderRemoveElement(out: XmlWriter, r: BosRemoveElement): void {
  out.push(`<${r.tagName} action="remove" oid="${xmlEscape(r.oid)}" />`);
}

function renderAppearance(out: XmlWriter, a: BosFieldAppearance): void {
  const elemType = FIELD_ELEMENT_TYPE[a.type];
  const tag = `${a.type}Appearance`;
  const id = a.id ?? newCompactGuid();
  const isEntryField = !!a.entityKey;
  out.push(`<${tag} ElementType="${elemType}" ElementStyle="1">`);

  // BasePropertyFieldAppearance unique: <Locked>-1</Locked> at the front.
  if (a.type === 'BasePropertyField') {
    out.push(`<Locked>-1</Locked>`);
  }
  // CheckBoxField has no EmptyText; everyone else does.
  if (a.type !== 'CheckBoxField') {
    out.push(`<EmptyText action="setnull" />`);
  }
  child(out, 'Key', a.key);
  // DateField has Mask + DisplayFormatString right after Key.
  if (a.type === 'DateField') {
    child(out, 'Mask', a.mask);
    child(out, 'DisplayFormatString', a.displayFormatString);
  }
  child(out, 'ListDefaultWidth', a.listDefaultWidth ?? 100);
  if (isEntryField) {
    // Entry-field cells are positioned by the parent EntryEntityAppearance,
    // not absolute coords — emit EntityKey + Tabindex + size, omit
    // Container / ZOrderIndex / Left / Top.
    out.push(`<EntityKey>${xmlEscape(a.entityKey!)}</EntityKey>`);
    child(out, 'Tabindex', a.tabindex);
  } else {
    child(out, 'Container', a.container);
    child(out, 'ZOrderIndex', a.zOrderIndex);
    child(out, 'Tabindex', a.tabindex);
    child(out, 'Left', a.left);
    child(out, 'Top', a.top);
  }
  child(out, 'LabelWidth', a.labelWidth ?? 100);
  child(out, 'Width', a.width ?? (isEntryField ? 150 : 300));
  child(out, 'Visible', a.visible ?? 1023);
  child(out, 'VisibleExt', a.visibleExt ?? 100);
  child(out, 'Caption', a.caption);
  child(out, 'Id', id);
  out.push(`</${tag}>`);
}

/**
 * Render an EntryEntity element. Goes inside `<Elements>`.
 *
 * Element child order observed in capture (req #1334 etc.):
 *   ConditionType=0 → EntryName → EntryPkFieldName → Seq → TableName →
 *   GroupColumnInfo → Name → Id → Key
 */
function renderEntryEntity(out: XmlWriter, e: BosEntryElement): void {
  const id = e.id ?? newCompactGuid();
  const groupId = e.groupColumnInfoId ?? newDashedGuid();
  out.push(`<EntryEntity ElementType="35" ElementStyle="0">`);
  child(out, 'ConditionType', 0);
  child(out, 'EntryName', e.entryName);
  child(out, 'EntryPkFieldName', e.entryPkFieldName ?? 'FEntryID');
  child(out, 'Seq', e.seq);
  child(out, 'TableName', e.tableName);
  out.push(
    `<GroupColumnInfo><GroupColumnInfo><Id>${xmlEscape(groupId)}</Id></GroupColumnInfo></GroupColumnInfo>`,
  );
  // Plan 5.12.7 — Entity.MustInput renders right after GroupColumnInfo,
  // before Name (capture req-103).
  if (e.mustInput) child(out, 'MustInput', 1);
  child(out, 'Name', e.name);
  child(out, 'Id', id);
  child(out, 'Key', e.key);
  out.push(`</EntryEntity>`);
}

/**
 * Default service-name conventions for a freshly-created entry's row buttons.
 * Service names must be unique within a Form (BOS resolves clicks by service
 * name → FormOperation lookup), so we derive them from the entry key.
 * Returns the pair the BarButtons + FormOperations both need.
 */
export function defaultEntryServiceNames(entryKey: string): {
  insert: string;
  delete: string;
  toolbarKey: string;
  newButtonKey: string;
  delButtonKey: string;
} {
  return {
    insert: `Insert_${entryKey}`,
    delete: `Delete_${entryKey}`,
    toolbarKey: `${entryKey}_TB`,
    newButtonKey: `${entryKey}_NEW`,
    delButtonKey: `${entryKey}_DEL`,
  };
}

/**
 * Render the entry's `<Menu><BarDataManager>...</BarDataManager></Menu>`
 * block holding default 新增行 + 删除行 buttons + their BarItemLinks tying
 * each button to the ToolBar container.
 *
 * Schema captured from BOS Designer (2026-05-04 manual save vs ours):
 * - Direct `<BarItems>` under `<EntryEntityAppearance>` is **not** how BOS
 *   serializes — the Menu/BarDataManager wrapper is required so the
 *   reflection deserializer hits `EntryEntityAppearance.Menu`
 *   (ComplexProperty of type BarDataManager).
 * - `<BarItemLinks>` is what physically attaches buttons to the ToolBar;
 *   without it the buttons exist in metadata but render nowhere.
 * - Each BarButton's `<Parameters>["{service}"]</Parameters>` must match a
 *   `<FormOperation>` registered on the Form root — the toolbar wiring
 *   alone is inert without the FormOperation registration.
 */
function renderDefaultEntryMenu(out: XmlWriter, entryKey: string): void {
  const names = defaultEntryServiceNames(entryKey);
  out.push('<Menu>');
  out.push('<BarDataManager>');
  child(out, 'Id', newDashedGuid());
  out.push('<BarItems>');
  // ToolBar container. Description/Caption "工具栏" matches BOS Designer.
  out.push('<ToolBar ElementType="2001" ElementStyle="1">');
  child(out, 'Name', names.toolbarKey);
  out.push('<Shortcut/>');
  child(out, 'Seq', 1);
  child(out, 'Description', '工具栏');
  child(out, 'Caption', '工具栏');
  child(out, 'Id', newCompactGuid());
  child(out, 'Key', names.toolbarKey);
  child(out, 'ElementType', 2001);
  out.push('</ToolBar>');
  // 新增行 button
  out.push('<BarButtonItem ElementType="2005" ElementStyle="1">');
  out.push('<Shortcut/>');
  child(out, 'Seq', 1);
  child(out, 'Description', '按钮');
  child(out, 'IsShowTitle', 'True');
  out.push('<ClickActions>');
  out.push('<FormBusinessService>');
  out.push('<ConfirmInfo/>');
  // Parameters is a literal JSON array — emit raw so double quotes survive.
  out.push(`<Parameters>["${xmlEscape(names.insert)}"]</Parameters>`);
  child(out, 'ActionId', 23);
  child(out, 'Description', '调用表格服务--新增记录');
  child(out, 'Id', newDashedGuid());
  out.push('</FormBusinessService>');
  out.push('</ClickActions>');
  child(out, 'Caption', '新增行');
  child(out, 'Id', newCompactGuid());
  child(out, 'Key', names.newButtonKey);
  out.push('</BarButtonItem>');
  // 删除行 button
  out.push('<BarButtonItem ElementType="2005" ElementStyle="1">');
  out.push('<Shortcut/>');
  child(out, 'Seq', 2);
  child(out, 'Description', '按钮');
  child(out, 'IsShowTitle', 'True');
  out.push('<ClickActions>');
  out.push('<FormBusinessService>');
  out.push('<ConfirmInfo/>');
  out.push(`<Parameters>["${xmlEscape(names.delete)}"]</Parameters>`);
  child(out, 'ActionId', 23);
  child(out, 'Description', '调用表格服务--删除记录');
  child(out, 'Id', newDashedGuid());
  out.push('</FormBusinessService>');
  out.push('</ClickActions>');
  child(out, 'Caption', '删除行');
  child(out, 'Id', newCompactGuid());
  child(out, 'Key', names.delButtonKey);
  out.push('</BarButtonItem>');
  out.push('</BarItems>');
  // BarItemLinks: attach each button to the ToolBar via ParentKey.
  out.push('<BarItemLinks>');
  out.push('<BarItemLink>');
  child(out, 'Id', newDashedGuid());
  child(out, 'BarItemKey', names.newButtonKey);
  child(out, 'ParentKey', names.toolbarKey);
  out.push('</BarItemLink>');
  out.push('<BarItemLink>');
  child(out, 'Id', newDashedGuid());
  child(out, 'BarItemKey', names.delButtonKey);
  child(out, 'ParentKey', names.toolbarKey);
  out.push('</BarItemLink>');
  out.push('</BarItemLinks>');
  out.push('</BarDataManager>');
  out.push('</Menu>');
}

/**
 * Render an EntryEntityAppearance. Goes inside `<Appearances>`.
 *
 * Defaults (BOS Designer's first-save shape): PageRows=100, Dock=5 (Fill),
 * Width=300, Height=65, BarItems=[新增行, 删除行].
 */
function renderEntryEntityAppearance(out: XmlWriter, a: BosEntryAppearance): void {
  const id = a.id ?? newCompactGuid();
  out.push(`<EntryEntityAppearance ElementType="35" ElementStyle="1">`);
  // Child order matches BOS Designer (2026-05-04 capture): Menu first, then
  // Caption / PageRows / Dock / Container / Height / Width / Id / Key.
  // Left/Top intentionally omitted — Dock=5 (Fill) makes them irrelevant and
  // BOS Designer drops them.
  if (a.includeDefaultBarItems !== false) {
    renderDefaultEntryMenu(out, a.key);
  }
  child(out, 'Caption', a.caption);
  // Plan 5.12.7 — IsShowSeq renders right after Caption, before PageRows
  // (capture req-103). Bool wire format uses capitalized "True" / "False"
  // (different from MustInput which is int 0/1).
  if (a.isShowSeq !== undefined) {
    out.push(`<IsShowSeq>${a.isShowSeq ? 'True' : 'False'}</IsShowSeq>`);
  }
  child(out, 'PageRows', a.pageRows ?? 100);
  child(out, 'Dock', a.dock ?? 5);
  child(out, 'Container', a.container);
  child(out, 'Height', a.height ?? 65);
  child(out, 'Width', a.width ?? 300);
  child(out, 'Id', id);
  child(out, 'Key', a.key);
  out.push(`</EntryEntityAppearance>`);
}

/**
 * Render a `<FormAppearance|EntryEntityAppearance action="edit">` overlay
 * adding one BarButton + matching BarItemLink. Goes inside `<Appearances>`.
 *
 * Wire shape verified against capture req-96 (BOS Designer 2026-05-06).
 * Migrated from Route C `buildAddToolbarButtonOverlay` 2026-05-07 (lever 3
 * followup). Same wire output, but emitted by typed input so wire-replay
 * regression tests + ESLint guard cover it.
 */
function renderAddBarButton(out: XmlWriter, b: BosBarButtonElement): void {
  const seq = b.seq ?? 1;
  const wrapper = b.menuWrapper ?? 'Menu';
  // Parameters is a JSON-array literal — emit raw so the inner double quotes
  // survive (same trick as renderDefaultEntryMenu).
  const paramsJson = `["${xmlEscape(b.boundOperationKey)}"]`;
  out.push(`<${b.appearanceKind} action="edit" oid="${xmlEscape(b.appearanceOid)}" ElementType="${b.appearanceElementType}" ElementStyle="1">`);
  out.push(`<${wrapper}>`);
  out.push('<BarDataManager>');
  child(out, 'Id', b.barDataManagerId);
  out.push('<BarItems>');
  out.push('<BarButtonItem ElementType="2005" ElementStyle="1">');
  out.push('<Shortcut/>');
  child(out, 'Seq', seq);
  child(out, 'Description', '按钮');
  child(out, 'IsShowTitle', 'True');
  out.push('<ClickActions>');
  out.push('<FormBusinessService>');
  out.push('<ConfirmInfo/>');
  out.push(`<Parameters>${paramsJson}</Parameters>`);
  child(out, 'ActionId', 23);
  child(out, 'Description', `调用表单操作--${b.boundOperationName}`);
  child(out, 'Id', b.formBusinessServiceId);
  out.push('</FormBusinessService>');
  out.push('</ClickActions>');
  child(out, 'Caption', b.caption);
  child(out, 'Id', b.buttonId);
  child(out, 'Key', b.buttonKey);
  out.push('</BarButtonItem>');
  out.push('</BarItems>');
  out.push('<BarItemLinks>');
  out.push('<BarItemLink>');
  child(out, 'Id', b.barItemLinkId);
  child(out, 'BarItemKey', b.buttonKey);
  // ParentKey on the form-level toolbar is intentionally OMITTED — capture
  // req-96 (BOS Designer 2026-05-06 manual save of UNW_tbButton on
  // FormAppearance) shipped the BarItemLink with NO <ParentKey>. Including
  // one whose value doesn't match an in-wire BarItem of type ToolBar makes
  // the server strip the entire <BarItemLinks> block (real-server smoke
  // 2026-05-07 step 6 + memory `bos_smoke_findings_2026_05_07` finding 3).
  // Entry-level toolbars ship their own ToolBar element via
  // renderDefaultEntryMenu and DO need ParentKey — that path stays intact.
  if (b.appearanceKind === 'EntryEntityAppearance') {
    child(out, 'ParentKey', b.toolbarKey);
  }
  out.push('</BarItemLink>');
  out.push('</BarItemLinks>');
  out.push('</BarDataManager>');
  out.push(`</${wrapper}>`);
  out.push(`</${b.appearanceKind}>`);
}

/**
 * Render a `<FormAppearance|EntryEntityAppearance action="edit">` overlay
 * containing declarative BarButton + BarItemLink removal markers. Migrated
 * from Route C `buildRemoveToolbarButtonOverlay` 2026-05-07.
 */
function renderRemoveBarButton(out: XmlWriter, b: BosRemoveBarButton): void {
  const wrapper = b.menuWrapper ?? 'Menu';
  out.push(`<${b.appearanceKind} action="edit" oid="${xmlEscape(b.appearanceOid)}" ElementType="${b.appearanceElementType}" ElementStyle="1">`);
  out.push(`<${wrapper}>`);
  out.push('<BarDataManager>');
  out.push('<BarItems>');
  out.push(`<BarButtonItem action="remove" oid="${xmlEscape(b.buttonId)}"/>`);
  out.push('</BarItems>');
  out.push('<BarItemLinks>');
  out.push(`<BarItemLink action="remove" oid="${xmlEscape(b.barItemLinkId)}"/>`);
  out.push('</BarItemLinks>');
  out.push('</BarDataManager>');
  out.push(`</${wrapper}>`);
  out.push(`</${b.appearanceKind}>`);
}

/**
 * Plan 7.8 — render one `<RptKeyWordField>` block as a child of
 * `<SQLDataSource><SQLDataSource><KeyWordList>`. The 5 user-facing kinds
 * (date / base_data / text / combo / decimal) collapse to single class +
 * ValueType + embedded `<Field>` per KEYWORD_KIND_TO_WIRE.
 *
 * Wire shape verified against Phase 0 spike probes:
 *   .scratch/captures/sysreport-filter-wire-probe/probe-{date,base_data,text,combo,decimal}.dcxml.txt
 * Recon doc: docs/recon/2026-05-20-sysreport-filter-columns-wire.md §3.A-§3.E.
 *
 * Child order (RptKeyWordField direct children) — driven by BOS reflection
 * property order, byte-stable:
 *   <Id> · <DataSource/> · <FilterBDFieldName/> · <IsAllowInput>True</…> ·
 *   <KeyWord> · <Name>{zh-CN}</…> · <ValueType>{N}</…> · <DefaultValue.../> ·
 *   <AssistantID.../> · [IsMultiSelect when true] · <IsAllowNull>{bool}</…> ·
 *   <DSeq> · <CustomerBindKey/> · <Field><{KindField}/></Field> ·
 *   <FieldAppearance><FieldAppearance/></FieldAppearance>
 *
 * Notes (also see §4 F-SR-1..5):
 *   - LocaleValue `<Name>` is single-locale plain text (zh-CN) per §1.10 #7.
 *     Phase 0 probe used single locale and that's what we mirror. Multi-locale
 *     `<Localvalue LCID="...">` is documented but not exercised here.
 *   - `<IsAllowInput>True</IsAllowInput>` is hardcoded — every BOS-Designer-
 *     authored sample we captured has it True, matching the runtime default
 *     for filter input controls.
 *   - `<IsMustInput>` / `<IsMultiSelect>` follow §1.10 #3 "default false bools
 *     are silently dropped". Phase 1 emitter only ships when explicitly true.
 *   - Embedded `<Field>` reuses the existing 5.12 field-emitter approach for
 *     type-specific sub-elements (ConditionType / LookUpObjectID etc.) but
 *     does NOT call renderFieldElement directly: filter-Field shape is a
 *     subset (no PropertyName, no MustInput, no ListTabIndex, no DefValue)
 *     and reusing renderFieldElement would force schema-coupling that breaks
 *     when filter and bill-field shapes diverge. Inline write here keeps the
 *     wire byte-stable against §3 captures.
 */
function renderAddKeyWordField(out: XmlWriter, k: BosRptKeyWordFieldElement): void {
  const wire = KEYWORD_KIND_TO_WIRE[k.kind];
  const id = newDashedGuid();
  const zhCn = k.name.find((n) => n.localeId === 2052)?.value ?? k.name[0]?.value ?? '';
  const fieldName = k.keyWord.startsWith('@')
    ? 'F' + k.keyWord.slice(1)
    : 'F' + k.keyWord;
  // DataSource — base_data 类型上的 RptKeyWordField.AssistantID 是引用基础资料
  // FormId(spike §3.B `BD_Customer`). combo 类型的 enumTypeId 也走 AssistantID
  // (spike note §3.D + sysreport-keyword-types.ts line 61). 其他类型留空。
  const assistantId =
    k.kind === 'base_data' ? k.refObjectId : k.kind === 'combo' ? k.enumTypeId : '';

  out.push('<RptKeyWordField>');
  out.push(`<Id>${id}</Id>`);
  out.push('<DataSource />');
  out.push('<FilterBDFieldName />');
  out.push('<IsAllowInput>True</IsAllowInput>');
  child(out, 'KeyWord', k.keyWord);
  child(out, 'Name', zhCn);
  child(out, 'ValueType', wire.valueType);
  out.push('<DefaultValue />');
  // AssistantID — non-empty only for base_data + combo per §3.B/§3.D.
  if (assistantId) {
    child(out, 'AssistantID', assistantId);
  } else {
    out.push('<AssistantID />');
  }
  // IsMultiSelect — base_data only, default false dropped per §1.10 #3.
  if (k.kind === 'base_data' && k.multiSelect) {
    out.push('<IsMultiSelect>True</IsMultiSelect>');
  }
  // IsAllowNull — default behavior matches probe (allowNull undefined → True),
  // user setting false → dropped (default false in serializer view). Phase 0
  // probe set true so the spike samples all show True.
  if (k.allowNull !== false) {
    out.push('<IsAllowNull>True</IsAllowNull>');
  }
  child(out, 'DSeq', k.seq);
  out.push('<CustomerBindKey />');

  // <Field><{KindField} ElementType="N" ElementStyle="0">...</> two-layer wrap
  // per §1.10 #4 ComplexProperty rule. ElementType numeric matches §2 table.
  const fieldClassName =
    k.kind === 'date'
      ? 'DateField'
      : k.kind === 'base_data'
        ? 'BaseDataField'
        : k.kind === 'text'
          ? 'TextField'
          : k.kind === 'combo'
            ? 'ComboField'
            : 'DecimalField';
  const fieldId = newCompactGuid();
  out.push('<Field>');
  out.push(`<${fieldClassName} ElementType="${wire.fieldElementType}" ElementStyle="0">`);
  // Type-specific sub-elements per §3.A-§3.E. ConditionType placement is
  // first within the field; Combo has no ConditionType (§3.D + §2 table note).
  switch (k.kind) {
    case 'date':
      out.push('<ConditionType>2</ConditionType>');
      break;
    case 'base_data':
      out.push('<ConditionType>0</ConditionType>');
      child(out, 'LookUpObjectID', k.refObjectId);
      break;
    case 'text':
      out.push('<ConditionType>0</ConditionType>');
      // Editlen — TextField's [SimpleProperty] with [DefaultValue(50)].
      // Decompile-verified (.scratch/decompile/field-properties/Kingdee.BOS.Core.Metadata.FieldElement/TextField.cs:24).
      // Probe initially used the wrong name "MaxLength" — corrected here.
      if (k.maxLength !== undefined && k.maxLength !== 50) {
        child(out, 'Editlen', k.maxLength);
      }
      break;
    case 'combo':
      // Combo intentionally has NO <ConditionType> per §3.D and §2 note.
      // Combo's enumTypeId rides on RptKeyWordField.AssistantID (above).
      break;
    case 'decimal':
      out.push('<ConditionType>1</ConditionType>');
      // FieldPrecision / FieldScale — DecimalField's [SimpleProperty] pair,
      // no default value annotation (decompile-verified
      // .scratch/decompile/field-properties/Kingdee.BOS.Core.Metadata.FieldElement/DecimalField.cs:540-544).
      // Probe initially used "Precision" / "Scale" — corrected here.
      if (k.precision !== undefined) child(out, 'FieldPrecision', k.precision);
      if (k.scale !== undefined) child(out, 'FieldScale', k.scale);
      break;
  }
  child(out, 'FieldName', fieldName);
  child(out, 'Name', zhCn);
  out.push(`<Id>${fieldId}</Id>`);
  child(out, 'Key', fieldName);
  out.push(`</${fieldClassName}>`);
  out.push('</Field>');

  // FieldAppearance — empty defaults per §3.A-E probe output (Key empty,
  // ListDefaultWidth=100, Width empty, auto-GUID Id). Same two-layer wrap.
  const apprId = newCompactGuid();
  out.push('<FieldAppearance>');
  out.push('<FieldAppearance>');
  out.push('<Key />');
  out.push('<ListDefaultWidth>100</ListDefaultWidth>');
  out.push('<Width />');
  out.push(`<Id>${apprId}</Id>`);
  out.push('</FieldAppearance>');
  out.push('</FieldAppearance>');

  out.push('</RptKeyWordField>');
}

/**
 * Plan 7.8 Phase 2 — render one `<RptFilterGridField>` block as a child of
 * `<SQLDataSource><SQLDataSource><FieldList>`. The 5 user-facing cellTypes
 * (text / integer / decimal / date / base_data_lookup) collapse to single
 * class + embedded `<Field>` per GRIDFIELD_CELLTYPE_TO_ELEMENTTYPE.
 *
 * Wire shape verified against Phase 0 spike probe:
 *   .scratch/captures/sysreport-filter-wire-probe/probe-gridfields.dcxml.txt §3.F
 *
 * Child order (RptFilterGridField direct children) — driven by BOS reflection
 * property order, byte-stable per probe (text+text+integer+decimal sample):
 *   <Id> · <Visible>True</…> · <Seq> · <Field><{KindField}/></Field> ·
 *   <FieldAppearance><FieldAppearance/></FieldAppearance> · <DefaultColWidth>
 *
 * Notes:
 *   - <Visible>True</Visible> is emitted UNCONDITIONALLY when visible is undefined
 *     or true. Probe consistently shows `<Visible>True</Visible>` even for
 *     default-true — Phase 0 spike §3.F. Setting visible=false emits "False".
 *   - <DefaultColWidth> comes LAST (after FieldAppearance), per probe byte
 *     order — distinct from KeyWordField shape.
 *   - Embedded `<Field>` shape: <ConditionType> first (except not for combo —
 *     combo isn't a valid gridfield cellType anyway), then type-specific
 *     sub-elements, then FieldName / Name / Id / Key.
 *   - text=ConditionType 0, integer=1, decimal=1 (all probe-verified).
 *     date / base_data_lookup not in probe — use 0 (display semantic, not
 *     range filter — distinct from KeyWordField where date=2).
 */
function renderAddFilterGridField(out: XmlWriter, gf: BosRptFilterGridFieldElement): void {
  const fieldElementType = GRIDFIELD_CELLTYPE_TO_ELEMENTTYPE[gf.cellType];
  const id = newDashedGuid();
  const zhCn = gf.caption.find((c) => c.localeId === 2052)?.value ?? gf.caption[0]?.value ?? '';
  const fieldId = newCompactGuid();
  const fieldClassName =
    gf.cellType === 'text'
      ? 'TextField'
      : gf.cellType === 'integer'
        ? 'IntegerField'
        : gf.cellType === 'decimal'
          ? 'DecimalField'
          : gf.cellType === 'date'
            ? 'DateField'
            : 'BaseDataField';

  out.push('<RptFilterGridField>');
  out.push(`<Id>${id}</Id>`);
  // Probe consistently emits <Visible>True</Visible>; only suppress to False
  // when caller explicitly sets visible=false.
  out.push(`<Visible>${gf.visible === false ? 'False' : 'True'}</Visible>`);
  child(out, 'Seq', gf.seq);

  // Embedded <Field><{Kind}Field>...</{Kind}Field></Field>. ConditionType first,
  // then type-specific, then FieldName / Name / Id / Key — per probe.
  const conditionType =
    gf.cellType === 'integer' || gf.cellType === 'decimal' ? 1 : 0;
  out.push('<Field>');
  out.push(`<${fieldClassName} ElementType="${fieldElementType}" ElementStyle="0">`);
  child(out, 'ConditionType', conditionType);
  switch (gf.cellType) {
    case 'text':
      if (gf.maxLength !== undefined && gf.maxLength !== 50) {
        child(out, 'Editlen', gf.maxLength);
      }
      break;
    case 'integer':
      // IntegerField — no extra sub-elements (probe shows ConditionType/
      // FieldName/Name/Id/Key only).
      break;
    case 'decimal':
      if (gf.precision !== undefined) child(out, 'FieldPrecision', gf.precision);
      if (gf.scale !== undefined) child(out, 'FieldScale', gf.scale);
      break;
    case 'date':
      break;
    case 'base_data_lookup':
      child(out, 'LookUpObjectID', gf.refObjectId);
      break;
  }
  child(out, 'FieldName', gf.fieldKey);
  child(out, 'Name', zhCn);
  out.push(`<Id>${fieldId}</Id>`);
  child(out, 'Key', gf.fieldKey);
  out.push(`</${fieldClassName}>`);
  out.push('</Field>');

  // FieldAppearance — empty defaults per probe (Key empty, ListDefaultWidth=100,
  // Width empty, auto-GUID Id). Same two-layer wrap as KeyWordField.
  const apprId = newCompactGuid();
  out.push('<FieldAppearance>');
  out.push('<FieldAppearance>');
  out.push('<Key />');
  out.push('<ListDefaultWidth>100</ListDefaultWidth>');
  out.push('<Width />');
  out.push(`<Id>${apprId}</Id>`);
  out.push('</FieldAppearance>');
  out.push('</FieldAppearance>');

  // DefaultColWidth comes LAST per probe byte order — distinct from KeyWord
  // shape where there's no DefaultColWidth at all.
  if (gf.width !== undefined) child(out, 'DefaultColWidth', gf.width);

  out.push('</RptFilterGridField>');
}

/** Render a self-built TabControlAppearance. ElementType=1005. */
function renderTabControlAppearance(out: XmlWriter, a: BosTabControlAppearance): void {
  const id = a.id ?? newCompactGuid();
  out.push(`<TabControlAppearance ElementType="1005" ElementStyle="1">`);
  child(out, 'Key', a.key);
  child(out, 'Container', a.container);
  child(out, 'Caption', a.caption);
  child(out, 'Id', id);
  out.push(`</TabControlAppearance>`);
}

/** Render a TabPageAppearance under a TabControl. ElementType=1004. */
function renderTabPageAppearance(out: XmlWriter, a: BosTabPageAppearance): void {
  const id = a.id ?? newCompactGuid();
  out.push(`<TabPageAppearance ElementType="1004" ElementStyle="1">`);
  child(out, 'Key', a.key);
  child(out, 'Container', a.container);
  // PageIndex = "页签序号" shown in BOS Designer's UI (user-facing).
  // ZOrderIndex = internal stacking sort key. Both are emitted together
  // — BOS Designer's parent SAL_SaleOrder tabs all carry both with the same
  // value, and missing PageIndex defaults to 0 in the UI label even when
  // ZOrderIndex is set correctly.
  child(out, 'PageIndex', a.pageIndex);
  child(out, 'ZOrderIndex', a.zOrderIndex);
  child(out, 'Caption', a.caption);
  child(out, 'Id', id);
  out.push(`</TabPageAppearance>`);
}

/** Build the SaveForIDEV9 ap0.__source__ DCXML string. */
export function buildDcxmlSource(req: SaveExtensionRequest): string {
  const parts: string[] = [];
  const out: XmlWriter = { push: (s) => parts.push(s) };

  out.push(`<?xml version="1.0" encoding="utf-16"?>`);
  out.push(`<FormMetadata>`);
  out.push(`<BusinessInfo><BusinessInfo><Elements>`);
  const zhName = req.extension.name.find((n) => n.localeId === 2052)?.value;
  renderFormRoot(
    out,
    req.extension.formId,
    zhName,
    req.addPlugins,
    req.existingPluginsRaw,
    req.addFormOperations,
    req.existingFormOperationsRaw,
    req.addListPlugins,
    req.existingListPluginsRaw,
  );
  for (const raw of req.existingFieldsRaw ?? []) out.push(raw);
  for (const f of req.addFields ?? []) renderFieldElement(out, f);
  for (const raw of req.existingEntriesRaw ?? []) out.push(raw);
  for (const e of req.addEntries ?? []) renderEntryEntity(out, e);
  for (const r of req.removeFields ?? []) renderRemoveElement(out, r);
  // Re-emit any prior HeadEntity overlay (extension-side EntityServiceRules)
  // so envelope-rebuild round-trips don't silently drop them. See
  // SaveExtensionRequest.existingHeadEntityRaw doc.
  if (req.existingHeadEntityRaw) out.push(req.existingHeadEntityRaw);
  // Plan 7.8 — SysReportForm 包络承载 KeyWordList(过滤参数)/ FieldList(报表列).
  // 仅当任一相关 add* / existing* 非空时输出,避免在 BillForm / BaseDataForm
  // 扩展上误发 wire(服务端 deserializer 看见 SysReportForm 块会直接报错
  // ModelTypeId 不匹配)。同一次调用可以同时加过滤参数 + 列(共用 envelope)。
  //
  // 子元素顺序:按 SQLDataSource 类属性声明顺序(spike doc §1.2),FieldList
  // 在 KeyWordList **之前**。BOS reflection 序列化器按属性声明顺序输出,反
  // 序列化时同样顺序敏感。
  const hasKeyWordChanges =
    (req.addKeyWordFields && req.addKeyWordFields.length > 0) ||
    !!req.existingKeyWordListRaw;
  const hasFieldListChanges =
    (req.addFilterGridFields && req.addFilterGridFields.length > 0) ||
    !!req.existingFieldListRaw;
  if (hasKeyWordChanges || hasFieldListChanges) {
    const envOid = req.sysReportEnvelopeOid ?? '';
    const sqlOid = req.sqlDataSourceOid ?? '';
    out.push(`<SysReportForm action="edit" oid="${xmlEscape(envOid)}">`);
    out.push(`<SQLDataSource action="edit" oid="${xmlEscape(sqlOid)}">`);
    out.push(`<SQLDataSource>`);
    if (hasFieldListChanges) {
      out.push(`<FieldList>`);
      if (req.existingFieldListRaw) out.push(req.existingFieldListRaw);
      for (const gf of req.addFilterGridFields ?? []) renderAddFilterGridField(out, gf);
      out.push(`</FieldList>`);
    }
    if (hasKeyWordChanges) {
      out.push(`<KeyWordList>`);
      if (req.existingKeyWordListRaw) out.push(req.existingKeyWordListRaw);
      for (const k of req.addKeyWordFields ?? []) renderAddKeyWordField(out, k);
      out.push(`</KeyWordList>`);
    }
    out.push(`</SQLDataSource>`);
    out.push(`</SQLDataSource>`);
    out.push(`</SysReportForm>`);
  }
  out.push(`</Elements></BusinessInfo></BusinessInfo>`);
  out.push(`<LayoutInfos><LayoutInfo action="edit" oid="${xmlEscape(req.layoutInfoOid)}">`);
  out.push(`<Appearances>`);
  for (const raw of req.existingAppearancesRaw ?? []) out.push(raw);
  for (const a of req.addAppearances ?? []) renderAppearance(out, a);
  for (const raw of req.existingTabControlsRaw ?? []) out.push(raw);
  for (const a of req.addTabControls ?? []) renderTabControlAppearance(out, a);
  for (const raw of req.existingTabPagesRaw ?? []) out.push(raw);
  for (const a of req.addTabPages ?? []) renderTabPageAppearance(out, a);
  for (const raw of req.existingEntryAppearancesRaw ?? []) out.push(raw);
  for (const a of req.addEntryAppearances ?? []) renderEntryEntityAppearance(out, a);
  // BarButton overlays: each emits a `<FormAppearance|EntryEntityAppearance
  // action="edit" oid=...>` block siblings to existingAppearancesRaw. Server
  // applies as a baseline-diff edit on the named parent appearance.
  for (const b of req.addBarButtons ?? []) renderAddBarButton(out, b);
  for (const b of req.removeBarButtons ?? []) renderRemoveBarButton(out, b);
  out.push(`</Appearances>`);
  out.push(`</LayoutInfo></LayoutInfos>`);
  out.push(`</FormMetadata>`);

  return parts.join('');
}
