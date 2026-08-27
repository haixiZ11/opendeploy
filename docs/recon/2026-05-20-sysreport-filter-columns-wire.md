# SysReport 过滤参数 + 报表列 wire format 实证（Plan 7.8 Phase 0）

> 反编译 + 真机 capture 双层实证,Plan 7.8 Phase 1+2 emitter 实现（`k3cloud_add_sysreport_filter_parameters` + `k3cloud_add_sysreport_columns`）的事实来源。
> 标记约定:🟢 客户实证 / 🟡 主流程（反编译+capture）/ 🔴 骨架（仅反编译）

## §1 反编译类层级 🔴

反编译源：`D:/K3Cloud/WebSite/Bin/Kingdee.BOS.Core.dll`（ilspycmd 10.0.0），落点 `.scratch/decompile/sysreport-filter/`。

### §1.0 重要结论 — 类命名跟 prompt 预期不一致

**BOS 没有 `FormParameter` / `FormFilterParameter` / `ReportListColumn` / `ReportColumn` 这些类**（grep 全 assembly 0 命中）。SysReport 过滤参数与报表列的真实模型走 `RptKeyWordField` + `RptFilterGridField` + `RptFilterGroupField` 三件套，统一挂在 `SQLDataSource`（`ComplexProperty`）下。

Prompt 列的 6 个目标按实际类映射如下：

| Prompt 期望 | 实际类 | 全名 | 备注 |
|---|---|---|---|
| FormParameter | (不存在) | — | BOS metadata 无此类型 |
| FormFilterParameter | `RptKeyWordField` | `Kingdee.BOS.Core.Report.RptKeyWordField` | 真·过滤参数模型 |
| SysReportForm | `SysReportForm` | `Kingdee.BOS.Core.Metadata.FormElement.SysReportForm` | 容器顶层 |
| EasyReportSettingInfo | `EasyReportSettingInfo` | `Kingdee.BOS.Core.Report.EasyReport.EasyReportSettingInfo` | 仅 EasyReport 用；SysReport 不走 |
| PickedFieldInfo | `PickedFieldInfo` | `Kingdee.BOS.Core.Report.EasyReport.PickedFieldInfo` | 仅 EasyReport 字段拾取；SysReport 不走 |
| ReportListColumn | `RptFilterGridField` | `Kingdee.BOS.Core.Report.RptFilterGridField` | 真·报表列模型 |

### §1.1 SysReportForm 容器（Form 子类）

`SysReportForm` 继承自 `Form: Element`。**ElementType = 100** (Form 基类 `[DefaultValue(100)]`，子类不覆盖)。

`SysReportForm` 自身相对 `Form` 的 SimpleProperty 增量：

| 字段 | 类型 | 属性 | 说明 |
|---|---|---|---|
| `SysReportServicePlugins` | `List<PlugIn>` | `[CollectionProperty]` | 报表服务插件 |
| `SQLDataSource` | `SQLDataSource` | `[ComplexProperty]` | **过滤参数 + 报表列的承载容器** |
| `ReportSQL` | `ScriptString` | `[SimpleProperty]` | SQL 模板 |
| `MergerHeaders` | `string` | `[SimpleProperty]` `DefaultValue("")` | 表头合并 |
| `ReportSummarySetting` | `string` | `[SimpleProperty]` `DefaultValue("")` | 合计设置 JSON |
| `CustomDSFormIds` | `string` | `[SimpleProperty]` | 自定义数据源 FormId |
| `CustDSFlds` | `string` | `[SimpleProperty]` | `CustomDSFields` 字典 JSON 序列化 |
| `RptFieldRalationStr` | `string` | `[SimpleProperty]` | `RptFieldRalations` JSON 序列化 |
| `OrgIsolationKey` | `string` | `[SimpleProperty]` `DefaultValue("")` | 组织隔离字段 |

**关键发现**：`SysReportForm` 本身 **没有** FilterParameters / ReportColumns 顶级字段。所有过滤参数与报表列都在 `SQLDataSource` 的 collection 里。

### §1.2 SQLDataSource — 承载容器（`Kingdee.BOS.Core.Report`）

`[Serializable] public class SQLDataSource : ICloneable`

| 字段 | 类型 | 属性 | 用途 |
|---|---|---|---|
| `SQL` | `string` | `[SimpleProperty]` `DefaultValue("")` | 报表 SQL |
| `SQLType` | `int` | `[SimpleProperty]` | 1=普通 / 3=已加 dialect prefix（推测） |
| `IsStoredProc` | `bool` | `[SimpleProperty]` `DefaultValue(false)` | 存储过程 |
| **`FieldList`** | `List<RptFilterGridField>` | `[CollectionProperty]` | **报表列**（display columns） |
| **`KeyWordList`** | `List<RptKeyWordField>` | `[CollectionProperty]` | **过滤参数**（filter parameter 面板） |
| **`GroupFieldList`** | `List<RptFilterGroupField>` | `[CollectionProperty]` | 分组字段 |
| `TextFieldList` | `List<TextField>` | (非 KDDataElement 属性) | 运行期 — wire 中应不出现 |

工具映射：
- `k3cloud_add_sysreport_filter_parameters` → 往 `SQLDataSource.KeyWordList` 增 `RptKeyWordField`
- `k3cloud_add_sysreport_columns` → 往 `SQLDataSource.FieldList` 增 `RptFilterGridField`

### §1.3 RptKeyWordField — 过滤参数（filter parameter 单条）

`[Serializable] public class RptKeyWordField`（`Kingdee.BOS.Core.Report`）

| 字段 | 类型 | 属性 | 用途 |
|---|---|---|---|
| `Id` | `string` | `[SimpleProperty(true)]` | 自动 GUID |
| `KeyWord` | `string` | `[SimpleProperty]` | SQL 内占位符名（如 `@CustomerId`） |
| `Name` | `LocaleValue` | `[SimpleProperty]` | 显示名（双语；注意 K3 这里没用 ComplexProperty） |
| `ValueType` | `long` | `[SimpleProperty]` | **字段类型数值**（驱动 UI 渲染：1=Text / 4=Date / 13=BaseData / 等；与 BOS field ElementType 数值对齐） |
| `DataSource` | `string` | `[SimpleProperty]` | 数据源类型；`"-1"` = 系统变量（`SysVar_CurrentUserId`/`SysVar_CurrentOrgUnitId`/`SysVar_CurrentUserOrgIds`/`SysVar_LCID`/`CurrentDate`） |
| `FilterBDFieldName` | `string` | `[SimpleProperty]` | F8 lookup 时绑定的字段名 |
| `IsAllowInput` | `bool` | `[SimpleProperty]` | 是否允许手工输入 |
| `IsMustInput` | `bool` | `[SimpleProperty]` | 是否必填 |
| `IsMultiSelect` | `bool` | `[SimpleProperty]` | 多选（针对 BaseData / Combo） |
| `IsAllowNull` | `bool` | `[SimpleProperty]` | 允许 NULL |
| `DefaultValue` | `string` | `[SimpleProperty]` | 默认值（字面串；BaseData 时为 PK） |
| `AssistantID` | `string` | `[SimpleProperty]` | BaseData FormId（F8 引用基础资料时填，例如 `BD_Customer`） |
| `DSeq` | `long` | `[SimpleProperty]` | 显示顺序 |
| `CustomerBindKey` | `string` | `[SimpleProperty]` | 客户绑定键 |
| `IsUseOrgFilter` | `bool` | `[SimpleProperty]` | 是否启用组织过滤 |
| `Field` | `Field` | `[ComplexProperty]` | 内嵌字段元素（提供 ElementType / FieldName / Caption 等；运行期与 metadata 都需要） |
| `FieldAppearance` | `FieldAppearance` | `[ComplexProperty]` | 外观（位置/宽度/标签可见） |

**子类**：`RptKeyWordField` 自身没有 5 类（Date/BaseData/Text/Combo/Decimal）的派生子类 — 用 `ValueType` + 内嵌 `Field` 决定面板控件类型。这与 prompt 假设的 "5 种 FilterParameter 子类" 不同。

**关联类 `RptKeyWord: DynamicObjectView4Model`**：是运行期的 DynamicObject view（FName/FValueType/FAssistantID 等 F-前缀字段），不是 metadata；DCXML 里出现的是 `RptKeyWordField`，不是 `RptKeyWord`。

### §1.4 RptFilterGridField — 报表列（display column 单条）

`[Serializable] public class RptFilterGridField`（`Kingdee.BOS.Core.Report`）

| 字段 | 类型 | 属性 | 用途 |
|---|---|---|---|
| `Id` | `string` | `[SimpleProperty(true)]` | 自动 GUID |
| `Visible` | `bool` | `[SimpleProperty]` | 是否显示 |
| `Seq` | `int` | `[SimpleProperty]` | 排序 |
| `Field` | `Field` | `[ComplexProperty]` | 内嵌字段元素 — 决定列类型（ElementType）、FieldName、Caption |
| `FieldAppearance` | `FieldAppearance` | `[ComplexProperty]` | 列外观（宽度/对齐/标题） |
| `DefaultColWidth` | `int` | `[SimpleProperty]` | 默认列宽 |
| `ElementTypeId` | `int` | (非 simpleproperty getter) | 从 `Field.ElementType` 派生 |

**重要**：`Caption` 与 `FieldName` 都是 readonly getter，直接从 `Field.Name` / `Field.Key` 反射读，wire 不传这两个 — `Field` 子元素自身已含。

### §1.5 RptFilterGroupField — 分组字段（次要，本 Plan 不动）

| 字段 | 类型 | 属性 | 用途 |
|---|---|---|---|
| `Id` | `string` | `[SimpleProperty(true)]` | 自动 GUID |
| `Seq` | `int` | `[SimpleProperty]` | 排序 |
| `Field` | `Field` | `[ComplexProperty]` | 字段元素 |

### §1.6 Field 基类相关字段（`Kingdee.BOS.Core.Metadata.FieldElement.Field: Element`）

`Field` 是 `Element` 子类；内嵌进 `RptKeyWordField.Field` / `RptFilterGridField.Field` 时它的 ElementType 决定 DCXML 子元素结构（参考 memory `bos_dcxml_element_schema` 的数值表 TextField=1 / DateField=4 / ComboField=9 / BaseDataField=13 / BasePropertyField=14 / DecimalField / UnitField=46 …）。

`Field` 自身核心可继承字段（节选，CollectionProperty/SimpleProperty/ComplexProperty）：
- `Key` / `Name`（来自 `Element`） — C-identifier 与双语名
- `EntityKey` (`[DefaultValue("FBillHead")]`) — 挂哪个 entity
- `FieldName` — 数据库列名（SysReport SQL 列）
- `FieldType` / `DatabaseType` — 数据类型枚举
- `DefValue` `[ComplexProperty]` — 默认值（多态：`DefaultValue` 字面 vs `FunctionDefaultValue` 函数；见 memory `bos_property_grid_inventory`）
- `MustInput` (int) — 必输（注意 0/1 编码，跟 RptKeyWordField.IsMustInput bool 不一样，见 memory `bos_property_grid_inventory`）
- `UpdateActions: List<FormBusinessService>` `[CollectionProperty]`

### §1.7 EasyReport 体系（参照，本 Plan 不实现）

EasyReport 是 SysReport 的子类：`EasyReportFormBase: SysReportForm`，加 `[ComplexProperty] EasyReportSettingInfo SettingInfo`。

`EasyReportSettingInfo` 字段：
- `ReportType: EasyReportType` (Summary=0 / Detail=1 / Cross=2)
- `SourceFormId: string`
- `SelectedFields / SortedFields / RowTitleFields / ColTitleFields / AggregateFields: List<PickedFieldInfo>` (all `[CollectionProperty]`)
- `GroupColumnInfo: GroupColumnInfo` `[ComplexProperty]`

`PickedFieldInfo` 字段（`Kingdee.BOS.Core.Report.EasyReport.PickedFieldInfo: ICloneable`）：
`Id` / `FieldElementType: int` / `FieldKey: string` / `FieldName: string` / `Caption: string` / `Seq: int` / `SelectKey: string` / `BindingFieldName: string` / `BaseDataFormId: string` / `SumType: int` / `CanFilter: bool` / `DisplayFormatString: string` / `FieldVisibleType: int` (enum: None=0 / Disp=3) — 全部 `[SimpleProperty]`。

`PickedFieldInfo` 是 EasyReport 自有抽象 — SysReport 不用，Plan 7.8 仅记录以正本清源。

### §1.8 KDDataElementType 注解

对 6 个目标类执行 `grep -rln "KDDataElementType" .scratch/decompile/sysreport-filter/Kingdee.BOS.Core.Report*` **零命中**。说明这些类不靠 `[KDDataElementType("...")]` 注解驱动 DCXML element name — element 名取自类名（`<RptKeyWordField>` / `<RptFilterGridField>` / `<SQLDataSource>` 等），将在 §2 真机 capture 中确认。

### §1.9 给 Phase 1 emitter 的契约（§1 直接结论）

1. `SysReportForm` 用 ComplexProperty `<SQLDataSource>` 作为承载容器（不是 SysReportForm 顶级）
2. 过滤参数 emitter 在 `<SQLDataSource><KeyWordList>` 下注入 `<RptKeyWordField>` 列表
3. 报表列 emitter 在 `<SQLDataSource><FieldList>` 下注入 `<RptFilterGridField>` 列表
4. 两者都需要内嵌一个 `<Field>` ComplexProperty 子元素（ElementType 数值表沿用 memory `bos_dcxml_element_schema`）— 这是 5.12 字段工具同款逻辑，可复用 emitter
5. `RptKeyWordField.ValueType` 必须跟内嵌 `Field.ElementType` 数值对齐（**两处冗余存储**，Phase 1 测试要 cross-check）
6. `RptKeyWordField.AssistantID` 仅 BaseData / BasePropertyField 类型才填，其余为空
7. **没有 5 种子类** — emitter 用单一 RptKeyWordField + ValueType 分支即可，Phase 0 spike 重点修正

### §1.10 DCXML 序列化器行为（`DcxmlSerializerWriteImplement` + `LazyWriteTaskManager`，2026-05-20 反编译实证）

反编译源：`Kingdee.BOS.DataEntity.dll` (DeskClient 9.0.553.12) → `.scratch/decompile/sysreport-filter/DcxmlSerializerWriteImplement.cs` + `LazyWriteTaskManager.cs` + `DcxmlAction.cs`。

**核心调用链** (`SerializeToString(currentEntity, baseEntity=null)`)：

1. **元素名 = 类名**。`_binder.BindToName(dt)` 返回 `IDataEntityType.Name`，对 CLR-backed type = .NET `Type.Name`（即类名，不含命名空间）。`SysReportForm` / `SQLDataSource` / `RptKeyWordField` / `RptFilterGridField` / `DateField` 等元素名 = 类名一致 — 与 §1.8 "0 个 KDDataElementType 命中" 一致。
2. **action / oid 属性的发射条件**（`LazyWriteTaskManager.WriteStartEntityElement` 行 311-367）：
   - `action == ListAction_Add` **或** `action == null + baseEntity == null`（root 调用）→ **不写** `action="add"`、不写 `oid`。
   - 其他 action（`edit` / `remove` / `clear` / `setnull`）→ 写 `action="<name>"` 属性。
   - 含义：**fresh "add-everything" baseline 的 DCXML 全程无 `action=` 属性**（与本节实测一致）；只有跟 baseEntity diff 时才出现 `action="edit"` 包络。
3. **SimpleProperty 发射**（`WriteSimpleProperties` 行 557-582）：
   - 通过 `GetEqualsFunc(propertyType)` 比较 currentValue vs baseValue；相等 → 不写。
   - currentValue == null（且 base != null）→ `<PropName action="setnull"/>`。
   - `ShouldSerializeValue(entity) == false`（即默认值，由 `[DefaultValue(x)]` 决定）→ `<PropName action="reset"/>`（baseEntity 不为 null）或**直接跳过**（baseEntity == null，因为不会进 WriteSimpleProperties_S）。
   - **本节实测**:`IsMustInput=False` / `IsMultiSelect=False` / `IsUseOrgFilter=False` / `IsStoredProc=False` 全部从输出消失 — 因为 bool 默认值是 false。**Phase 1 emitter 想强制写 false 不可行** — 需要服务端自己识别"缺省=false"。
4. **ComplexProperty 发射**（`WriteComplexProperties_S` 行 456-474）：
   - 输出 `<PropName><InnerClassName>...children...</InnerClassName></PropName>` — **两层嵌套**(外层是属性名，内层是实际类名)。
   - 本节实测：`<SQLDataSource><SQLDataSource>...</SQLDataSource></SQLDataSource>`、`<Field><DateField .../></Field>`、`<FieldAppearance><FieldAppearance .../></FieldAppearance>`。
   - 这是 §3 各 sub-section 看到的"外层属性名+内层类名"双重 wrapping 的根因。
5. **CollectionProperty 发射**（`WriteCollectionProperty` 行 316-341）：
   - 空 list（`Count == 0`）跳过整个 `<PropName>` — **不发射空容器**。
   - 非空：`<PropName><ItemClassName .../>...</PropName>` 平铺所有 item，item 是 `add` action → 无 `action=` 属性。
6. **bool 编码 = `True` / `False`**（首字母大写）。来自 `WritePrimitiveObject` → `Convert.ToString(value, _binder.Culture)`，对 bool 直接 `.NET Boolean.ToString()` 返回 capitalized。**这跟 memory `bos_property_grid_inventory` 提到的 "MustInput=0/1 vs IsShowSeq=True/False 不一致" 中的 `True/False` 路径一致** — `RptKeyWordField` 全部 bool 走 capitalized。`Field.MustInput` 是 `int` 不是 `bool`(0/1)；本节涉及的 SQLDataSource / KeyWord / GridField 全部 bool 都走 capitalized。
7. **LocaleValue 编码**（依赖 `_binder.BindEqualsFunc` + `ILocaleValue` 分支，行 561-564 + 724）：
   - **单 locale** → 直接 `<PropName>纯文本</PropName>`（本节实测：`<Name>日期参数</Name>`）。
   - **多 locale**（未实测，记忆 `bos_property_grid_inventory` + memory `bos_save_for_ide_v9_wire_format`）→ `<PropName><Localvalue LCID="2052">中文</Localvalue><Localvalue LCID="1033">English</Localvalue></PropName>`。
   - Phase 1 emitter 决策：**至少 2052**(zh-CN) 必填，**1033** 推荐填(memory `bos_save_for_ide_v9_wire_format` 显示真机 ap0 含 lang_copies)。
8. **ID 自动生成**。`RptKeyWordField.Id` / `RptFilterGridField.Id` / `FieldAppearance.Id` 都是 `[SimpleProperty(true)]` (primaryKey)，getter 实证 (`RptKeyWordField.cs:13-19`): `id = (string.IsNullOrEmpty(id) ? Guid.NewGuid().ToString() : id);` — 第一次访问时分配。emitter 可以**不填**，序列化器会自动塞 GUID。
9. **`action="setnull"` 自动出现**（本节实测末尾 `<ReportSQL action="setnull"/><MergerHeaders action="setnull"/>...`）— 这些是 SysReportForm 顶级的 SimpleProperty，CurrentValue=null，BaseEntity=null 时**仍然出现** action=setnull。看似矛盾(行 568 `value == null` 在 `if (!equalsFunc(value, value2))` 内才进，equalsFunc(null, null) 应=true 跳过)，但 root 调用走 `WriteSimpleProperties_S` 路径不走 diff — root 是 `null` 时也写 `action="setnull"`。**Phase 1 不用管这些 setnull**，它们是 baseline 不影响 BOS 接收。

**emitter 直接结论**：

- 不需要手填 `Id`(GUID 自动)、`ElementType`(数值)、`ElementStyle="0"`；序列化器自填。
- 必填的 SimpleProperty 只有：`KeyWord`、`Name`(LocaleValue)、`ValueType`、`DSeq`、内嵌 `Field`(ComplexProperty)。
- 默认 false 的 bool 不需要发射 — 服务端 deserialize 走默认值。
- `<Field>` ComplexProperty wrapper 两层嵌套必须有，emitter 不能扁平化成单层 `<Field><FieldName>...</FieldName></Field>` — 必须 `<Field><DateField>...</DateField></Field>`。

---

## §2 ValueType + Field.ElementType 数值表 🟢

通过 bos-bridge `probe_sysreport_wire` op 实证（`scripts/bos-recon/probe-sysreport-wire.ts` + `.scratch/captures/sysreport-filter-wire-probe/`）。**数值取自 SerializeToString 实际输出**，非推断。

| 参数类型 | ValueType (RptKeyWordField) | Field 类 | Field.ElementType (Field 子元素 attr) | 内嵌 Field 关键子元素 |
|---|---|---|---|---|
| **Date** | `4` | `DateField` | `4` | `ConditionType=2` / `FieldName` / `Name` |
| **Text** | `1` | `TextField` | `1` | `ConditionType=0` / `FieldName` / `Name` (+ MaxLength 如果设) |
| **Combo** | `9` | `ComboField` | `9` | `FieldName` / `Name` (**无 ConditionType**) |
| **BaseData** | `13` | `BaseDataField` | `13` | `ConditionType=0` / `LookUpObjectID="<FormId>"` / `FieldName` / `Name` |
| **Decimal** | `2` | `DecimalField` | `2` | `ConditionType=1` / `FieldName` / `Name` (+ Precision/Scale) |
| **Integer** | `3` | `IntegerField` | `3` | `ConditionType=1` / `FieldName` / `Name` |

**重要**：

1. ValueType 与 Field.ElementType **总是相等** — `RptKeyWordField` 实例化时不强制约束(类型是 `long`/`int`)，但 BOS 服务端的运行期解析依赖二者对齐(见 `RptKeyWordField.Add(RptKeyWord)` 第 86 行 `ValueType = keyWord.FValueType` 也是从 DynamicObject 同步过来)。**emitter 不对齐 → undefined behavior，认为 silent-drop 风险**。
2. `ElementStyle="0"` 是 `Element` 基类常量 `[DefaultValue(0)]`，序列化器在 root 节点附带；emitter 不需要管。
3. Combo 类型**没有** `ConditionType` 子元素 — Combo 不是范围/区间查询，无须 condition。emitter 加 Combo 时不要发射 ConditionType。

---

## §3 完整 DCXML 范本 🟢

所有 sub-section 取自 `scripts/bos-recon/probe-sysreport-wire.ts` 输出（落 `.scratch/captures/sysreport-filter-wire-probe/probe-<kind>.dcxml.txt`），节选 KeyWordList / FieldList 段。完整 file 是 SerializeToString fresh "add-everything" 模式，没 `action=` 属性 — Phase 1 emitter 反向：扩展场景需 wrap 进 `<SysReportForm action="edit" oid="<extId>">` 包络外，内部 KeyWordList 内每个 item 也要带 `<RptKeyWordField action="add" oid="<auto-guid>">`（按 5.12 字段同款规则；本节 capture 没显示因为是 root baseline）。

### §3.A Date 过滤参数

```xml
<RptKeyWordField>
  <Id>909ca350-8700-4532-be29-39aafb973023</Id>   <!-- auto-GUID -->
  <DataSource />                                   <!-- empty string, not setnull -->
  <FilterBDFieldName />
  <IsAllowInput>True</IsAllowInput>                 <!-- 非默认才出现；默认 false 跳过 -->
  <KeyWord>@DateSample</KeyWord>                    <!-- SQL 占位符 -->
  <Name>日期参数</Name>                              <!-- LocaleValue 单 locale 直渲文本 -->
  <ValueType>4</ValueType>                          <!-- 对齐 DateField -->
  <DefaultValue />
  <AssistantID />                                   <!-- Date 不引基础资料，留空 -->
  <IsAllowNull>True</IsAllowNull>
  <DSeq>1</DSeq>
  <CustomerBindKey />
  <Field>                                           <!-- ComplexProperty 两层嵌套 -->
    <DateField ElementType="4" ElementStyle="0">
      <ConditionType>2</ConditionType>              <!-- Date 特有：区间查询 -->
      <FieldName>FDateSample</FieldName>            <!-- 物理列名 (来 SQL SELECT 列) -->
      <Name>日期参数</Name>
      <Id>4243ae06592b4af996fe03bd7fcc2690</Id>
      <Key>FDateSample</Key>                        <!-- C-identifier，唯一 -->
    </DateField>
  </Field>
  <FieldAppearance>                                 <!-- 两层嵌套同 Field -->
    <FieldAppearance>
      <Key />
      <ListDefaultWidth>100</ListDefaultWidth>      <!-- 默认值 from FieldAppearance ctor -->
      <Width />
      <Id>39a0dd57118d47b5915205d3a126a939</Id>
    </FieldAppearance>
  </FieldAppearance>
</RptKeyWordField>
```

### §3.B BaseData 过滤参数（含 IsMultiSelect + AssistantID + LookUpObjectID）

```xml
<RptKeyWordField>
  <Id>7913c9f6-...</Id>
  <DataSource />
  <FilterBDFieldName />
  <IsAllowInput>True</IsAllowInput>
  <KeyWord>@CustomerSample</KeyWord>
  <Name>客户参数</Name>
  <ValueType>13</ValueType>                         <!-- 对齐 BaseDataField -->
  <DefaultValue />
  <AssistantID>BD_Customer</AssistantID>            <!-- BaseData 必填 = 引用的 FormId -->
  <IsMultiSelect>True</IsMultiSelect>               <!-- 多选启用；默认 false 才出现 -->
  <IsAllowNull>True</IsAllowNull>
  <DSeq>1</DSeq>
  <CustomerBindKey />
  <Field>
    <BaseDataField ElementType="13" ElementStyle="0">
      <ConditionType>0</ConditionType>              <!-- BaseData 等于查询 -->
      <LookUpObjectID>BD_Customer</LookUpObjectID>  <!-- 必填 = AssistantID 重复，两处冗余 -->
      <FieldName>FCustomerSample</FieldName>
      <Name>客户参数</Name>
      <Id>2f8fee31fd674faeb4f254a9592eb8d5</Id>
      <Key>FCustomerSample</Key>
    </BaseDataField>
  </Field>
  <FieldAppearance>...</FieldAppearance>
</RptKeyWordField>
```

**关键**：`AssistantID`（在 RptKeyWordField 顶层）与 `LookUpObjectID`（在 Field 内）**都填同一个 FormId** — 双重存储。Phase 1 emitter 不对齐 → BaseData F8 lookup 行为待研。

### §3.C Text 过滤参数

```xml
<RptKeyWordField>
  <Id>1c830b57-...</Id>
  <DataSource />
  <FilterBDFieldName />
  <IsAllowInput>True</IsAllowInput>
  <KeyWord>@TextSample</KeyWord>
  <Name>文本参数</Name>
  <ValueType>1</ValueType>
  <DefaultValue />
  <AssistantID />
  <IsAllowNull>True</IsAllowNull>
  <DSeq>1</DSeq>
  <CustomerBindKey />
  <Field>
    <TextField ElementType="1" ElementStyle="0">
      <ConditionType>0</ConditionType>
      <FieldName>FTextSample</FieldName>
      <Name>文本参数</Name>
      <Id>2fded1b6df6e4fa28b9dd1f3d2b6afe4</Id>
      <Key>FTextSample</Key>
    </TextField>
  </Field>
  <FieldAppearance>...</FieldAppearance>
</RptKeyWordField>
```

**MaxLength**：本节 probe 设 `MaxLength=200` 走 `TrySetProperty` 但**未出现在输出** — 说明 TextField 默认值就是 200(已等)，或属性名不对(待 Phase 1 加 Text 时实测，可暴露)。

### §3.D Combo 过滤参数

```xml
<RptKeyWordField>
  <Id>963e238f-...</Id>
  ...
  <KeyWord>@ComboSample</KeyWord>
  <Name>枚举参数</Name>
  <ValueType>9</ValueType>
  ...
  <Field>
    <ComboField ElementType="9" ElementStyle="0">
      <!-- 无 ConditionType !!! Combo 特有 -->
      <FieldName>FComboSample</FieldName>
      <Name>枚举参数</Name>
      <Id>db0f0d6327fd46bba497bfe06e21885c</Id>
      <Key>FComboSample</Key>
    </ComboField>
  </Field>
  <FieldAppearance>...</FieldAppearance>
</RptKeyWordField>
```

**ComboItems**：本 probe 没填 ComboField.ComboItems 列表，输出**完全不含** `<ComboItems>` collection wrapper — 印证 §1.10 第 5 条 "空 list 跳过"。Phase 1 emitter 加 Combo 时必须填 ComboItem 列表，否则枚举下拉是空的（不是 silent-drop，但运行期 UI 失败）。

### §3.E Decimal 过滤参数

```xml
<RptKeyWordField>
  <Id>5af19bee-...</Id>
  ...
  <KeyWord>@DecimalSample</KeyWord>
  <Name>数量参数</Name>
  <ValueType>2</ValueType>
  ...
  <Field>
    <DecimalField ElementType="2" ElementStyle="0">
      <ConditionType>1</ConditionType>             <!-- Decimal 走范围 -->
      <FieldName>FDecimalSample</FieldName>
      <Name>数量参数</Name>
      <Id>6038f8ab19f549a1b938291fd3386296</Id>
      <Key>FDecimalSample</Key>
    </DecimalField>
  </Field>
</RptKeyWordField>
```

**Precision/Scale**：probe 设 Precision=18 / Scale=2 走 TrySetProperty 但**未出现** — 同 §3.C 现象（属性名待 Phase 1 加 Decimal 时反编译 DecimalField 确认）。

### §3.F GridFields（报表列，4 列混合 text/text/integer/decimal）

```xml
<FieldList>
  <RptFilterGridField>
    <Id>ae2bd144-...</Id>
    <Visible>True</Visible>
    <Seq>1</Seq>
    <Field><TextField ElementType="1" ElementStyle="0"><ConditionType>0</ConditionType><FieldName>FCustomerName</FieldName><Name>客户名</Name>...<Key>FCustomerName</Key></TextField></Field>
    <FieldAppearance>...</FieldAppearance>
    <DefaultColWidth>150</DefaultColWidth>          <!-- RptFilterGridField 特有 -->
  </RptFilterGridField>
  <RptFilterGridField>
    <Id>ddeb77c3-...</Id>
    <Visible>True</Visible>
    <Seq>2</Seq>
    <Field><TextField .../></Field>
    <DefaultColWidth>120</DefaultColWidth>
  </RptFilterGridField>
  <RptFilterGridField>
    <Id>dac916a4-...</Id>
    <Visible>True</Visible>
    <Seq>3</Seq>
    <Field><IntegerField ElementType="3" ElementStyle="0"><ConditionType>1</ConditionType>...<Key>FQty</Key></IntegerField></Field>
    <DefaultColWidth>100</DefaultColWidth>
  </RptFilterGridField>
  <RptFilterGridField>
    <Id>e7f8c927-...</Id>
    <Visible>True</Visible>
    <Seq>4</Seq>
    <Field><DecimalField ElementType="2" ElementStyle="0"><ConditionType>1</ConditionType>...<Key>FAmount</Key></DecimalField></Field>
    <DefaultColWidth>120</DefaultColWidth>
  </RptFilterGridField>
</FieldList>
```

**对比 §3.A-E**：`RptFilterGridField` 比 `RptKeyWordField` **简单**得多 — 只有 `Visible` / `Seq` / `Field`(ComplexProperty) / `FieldAppearance` / `DefaultColWidth`，没有 ValueType / KeyWord / AssistantID / IsMultiSelect 等过滤参数特有字段。`Caption` 和 `FieldName` 是 readonly getter（§1.4），不在 wire 出现，由 `<Field>` 内嵌的 Name/Key 提供。

---

## §4 Wire 失败模式 🟡

§1.10 + §3 实证综合，**Phase 1 emitter 需要规避**的 silent-drop / undefined behavior：

- **F-SR-1: ValueType 与 Field.ElementType 不对齐**。RptKeyWordField 实例化时 schema 不约束（类型是 `long` vs `int`），但 BOS 服务端解析二者都用 — `RptKeyWordField.Add(RptKeyWord)` 行 86 实证 `ValueType = keyWord.FValueType` 不做 cross-check。运行期渲染走 `Field.ElementType`，SQL 参数绑定可能走 `ValueType` — 不对齐 → undefined。**emitter 强制对齐**（§2 数值表 6 行为 white list）。
- **F-SR-2: BaseData 类型 `AssistantID` ↔ `Field.LookUpObjectID` 不同步**。§3.B 实证两处冗余存储同一 FormId。BOS 服务端 F8 弹窗读哪个待 Phase 1 真服务器验证 — emitter **保守做法 = 两处都填**（值一致）。
- **F-SR-3: 空 List 跳过整段 wrapper**。§1.10 第 5 条 + §3.D ComboItems 实证：emitter 想覆盖父对象现有 `<ComboItems>` 必须发射**至少一个 `action="remove"`** dummy item 才能触发整段 collection wrapper 发射；纯空 list 服务端看不到 → 父对象旧值保留。
- **F-SR-4: 默认值 bool 缺失**。§1.10 第 3 条 + §3 全节实测：`IsMustInput=False` / `IsMultiSelect=False` / `IsAllowNull=False` 等默认 false 的 bool **永远不会出现在 baseline DCXML**。Phase 1 wire-replay snapshot 不要 assert 这些字段存在。要把 IsMustInput 从 true 改 false → 需要 baseline diff 路径(`<IsMustInput action="reset"/>`)，emitter 在扩展场景必须显式 ship `<IsMustInput>False</IsMustInput>`(因为 baseEntity 来自父对象，diff 比较时 currentValue=false ≠ baseValue=true → 写)。
- **F-SR-5: LocaleValue 缺 zh-CN(2052) → 整 `<Name>` 不显示中文 UI**。§1.10 第 7 条 + memory `bos_save_for_ide_v9_wire_format`(ap0 lang_copies)。emitter 必须至少 2052 slot 必填；建议 + 1033 兜底英文 UI。

---

## §5 Phase 1 emitter checklist 🟢

5 个 Plan 7.8 §5 列出的问题，基于 §1-§4 实证回答：

1. **Route B（TS envelope rebuild）or A（.NET bridge）？** → **Route B**。理由：
   - SysReportForm 是 `Form` 子类，跟 5.12.6 操作 + 7.2 列表插件 + 7.3 操作服务插件同款路径(`rpc/save-for-ide.ts` typed dcxml emitter)。
   - §3 实证 schema 简单(KeyWordList / FieldList 都是平铺 collection，无 reference 跨实体)，TS 模板字符串可以承担。
   - Bridge spike 已经证 SerializeToString 是 ground truth — Phase 1 emitter 输出可以用 wire-replay fixture 跟本节 §3 范本 byte-级对比（Route B 单测路径 5.12 已有）。
   - 不走 Route A 的原因：bridge 跑 SerializeToString 需要先反序列化父对象 baseline，但扩展 SysReportForm 父对象往往是个 minimal stub（用户跑 capture 拿到的可能只含 `<Form Key="...">` 标记），bridge DcxmlSerializer 对 minimal baseline 经常 silent-drop（memory `bos_bridge_list_operations_silent_drop`），Route A 在这里反而风险大。

2. **wire-replay fixture 路径？** → `tests/erp/wire-replay/__snapshots__/route-b/sysreport-filter-{date,basedata,text,combo,decimal}.snap` + `sysreport-columns-mixed.snap`。每个 snap 是 SaveForIDEV9 envelope 的 ap0 DCXML segment（5.12.6 同款格式）。fixture 文本可以从本节 §3.A-F 切片直接抄。

3. **L4 ESLint XML 护栏白名单是否需要加？** → 视实现方式。如果 emitter 在 `rpc/save-for-ide.ts` 加一个 `sysreport-filter-emitter.ts` 兄弟文件并 export typed 接口（推荐），可加入白名单(`save-for-ide.ts` / `dcxml.ts` 同级)；如果 emitter 在工具层(`bos-rpc-tools.ts`)直接拼字符串则违反护栏 — 把 emitter 抽到 rpc/ 层即可。

4. **smoke 脚本？** → `scripts/bos-recon/smoke-sysreport-filter-route-b.ts`(模板 5.12.6 smoke 同款)：
   - 真服务器 sandbox extension → add 5 个 KeyWord(各类型 1 个) + 4 列 GridField → 抓 SaveForIDEV9 raw 字节 → assert §3 各 sub-section 完整出现。
   - 加 cleanup(delete extension)。
   - 跑 1 次成本 ≈ 0 RMB（不写客户数据，仅 metadata extension）。

5. **agent-loop e2e？** → `scripts/bos-recon/drive-sysreport-via-agent.ts`(模板 `drive-7.3-service-plugin-via-agent.ts` 同款)：
   - 给 DeepSeek 自然语言 prompt："给【SAL_SaleOrder 销售订单】的账表加 3 个过滤参数：销售订单号(Text)、客户(BaseData=BD_Customer)、单据日期(Date)；再加 4 列报表列：客户名称、订单号、数量、金额"。
   - 让 agent 选 `k3cloud_add_sysreport_filter_parameters` + `k3cloud_add_sysreport_columns` 自驱编排，验证 routing 正确性(memory `feedback_agent_loop_reveals_routing_bugs` — 这是 BOS write 工具唯一能揭 routing bug 的层)。
   - 成本 ~$0.005/run。Phase 2 前置 gate。

**复用 5.12 字段 emitter 接入点**：

- `<Field>` ComplexProperty 内嵌的 `<DateField>` / `<TextField>` / `<ComboField>` / `<BaseDataField>` / `<DecimalField>` / `<IntegerField>` block 跟 5.12.1 字段创建工具走完全一致 schema(同样 Element / ElementStyle / Key / Name / FieldName / ConditionType / LookUpObjectID 等)。Phase 1 直接 import `rpc/dcxml.ts` 的现有 field-emitter helper(命名待查；如果没暴露则提取出来)，包一层即可。
- `<FieldAppearance>` ControlAppearance 子类同款 — 5.12.7 属性面板工具有 emitter(`rpc/dcxml.ts` 内)，复用同款。
- 不需要新增 `rpc/sysreport-*.ts` 独立 emitter 文件 — 把 `RptKeyWordField` / `RptFilterGridField` 当 5.12 字段的 wrapper 处理即可。

---

## §6 反编译artifacts / 实证 artifacts 索引

- 反编译落点 `.scratch/decompile/sysreport-filter/`：
  - `DcxmlSerializerWriteImplement.cs`(858 行) / `LazyWriteTaskManager.cs` / `DcxmlAction.cs` / `LocaleValue.cs` / `DataEntityType.cs` / `CLRDataEntityType.cs` — §1.10 反编译源
  - `RptKeyWordField.cs` / `RptFilterGridField.cs` / `SQLDataSource.cs` / `SysReportForm.cs` — §1.1-§1.4 反编译源(Task 0.1)
- Probe 工具：`bos-bridge/BosContext.SysReport.cs`(op `probe_sysreport_wire`) + `scripts/bos-recon/probe-sysreport-wire.ts`
- Probe 输出 6 文件落 `.scratch/captures/sysreport-filter-wire-probe/probe-{date,base_data,text,combo,decimal,gridfields}.dcxml.txt`
