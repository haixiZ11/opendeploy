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

---

## §2 真机 capture（Task 0.2 待填）🟡

待 capture-proxy + decode-capture 抓 BOS Designer "向导生成的 SysReport" Save 一次，落到 `.scratch/captures/decoded/sysreport-filter-baseline/`。

子任务：
- §2.1 SysReportForm baseline DCXML 元素树（含空 SQLDataSource）
- §2.2 加 1 个 Date 过滤参数后的 envelope diff
- §2.3 加 1 个 BaseData 过滤参数（带 AssistantID + IsMultiSelect=true）的 envelope diff
- §2.4 加 1 列 RptFilterGridField 后的 envelope diff
- §2.5 element 名称大小写 / `action=edit` 是否复用 5.12 规则

---

## §3 ValueType 数值表 → 内嵌 Field ElementType 对照（Task 0.3 待填）🟡

§1 已确定二者必须对齐，Task 0.3 用 capture 实证各类型的 ValueType 与 Field 子元素 schema：

| 参数类型 | ValueType | Field ElementType | 内嵌 Field 子元素 |
|---|---|---|---|
| Date | ? | 4 | DefValue / Mask / ... |
| BaseData | ? | 13 | LookUpObjectID / ControlFieldKey / ... |
| Text | ? | 1 | MaxLength / ... |
| Combo | ? | 9 | ComboItems / ... |
| Decimal | ? | (查找) | Precision / Scale / ... |

---

## §4 Wire 失败模式（Task 0.4 待填）🟡

参考 memory `bos_smoke_findings_2026_05_07` / `bos_silent_drop_findings_2026_05_09` — 候选 silent-drop 假设：
- F-SR-1：`<SQLDataSource>` 无 baseline → 整段 strip？
- F-SR-2：`RptKeyWordField.ValueType` 与 `Field.ElementType` 不对齐 → 哪个 wins？
- F-SR-3：`RptFilterGridField` 漏 `<FieldAppearance>` 是否服务端兜底？

---

## §5 Phase 1 emitter checklist（Task 0.5 待填）🔴

- [ ] Route B（TS envelope rebuild）or A（.NET bridge）？建议 B（schema 不复杂，跟 5.12 字段同款）
- [ ] wire-replay fixture：`tests/erp/wire-replay/__snapshots__/route-b/sysreport-filter-*.snap`
- [ ] L4 ESLint XML 护栏白名单是否需要加 `rpc/save-for-ide.ts` 新分支
- [ ] smoke：`scripts/bos-recon/smoke-sysreport-filter-route-b.ts`
- [ ] agent-loop e2e：`scripts/bos-recon/drive-sysreport-via-agent.ts`
