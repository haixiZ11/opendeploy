# SysReport 过滤参数 + 报表列配置

> 本文件是 `metaobject-creation-index` 的子文件。按需加载。
>
> 来源:Plan 7.8 Phase 0 反编译 `Kingdee.BOS.Core.dll` + bos-bridge `probe_sysreport_wire` 真服务器实证(2026-05-20);完整 wire 实证见 `docs/recon/2026-05-20-sysreport-filter-columns-wire.md`。

---

## 何时用本 references

Agent 在**已建** SysReport(用 `k3cloud_create_from_template(templateId=BOS_SimpleSysReport / BOS_MoveSysReport, ...)`)之后,要给账表配过滤参数面板 + 报表列时拉本文件。

这一步是 v0.2 alpha 验收暴露的"阶段二全手动"缺口闭合 — 之前账表建好后过滤参数 + 报表列必须顾问去 BOS Designer 手动拖,Plan 7.8 把这两块也工具化。

---

## 两个工具

| 工具 | 用途 | 前置 |
|---|---|---|
| `k3cloud_add_sysreport_filter_parameters` | 往账表加过滤参数(KeyWordList,SQL 占位符 `@xxx` + UI 控件) | 已有 SysReport formId |
| `k3cloud_add_sysreport_columns` | 往账表加报表列(FieldList,显示列定义) | 已有 SysReport formId |

两者底层都走 **Route B**(`rpc/save-for-ide.ts`),wire 路径同 `k3cloud_create_from_template` + `k3cloud_register_sysreport_python_plugins`。

---

## 端到端 pipeline

🟡 主流程实证(反编译 + Phase 0 spike,fetched 2026-05-20)

```
Step 1  k3cloud_create_from_template(
            templateId  = "BOS_SimpleSysReport",   ← 或 BOS_MoveSysReport(分页)
            newFormId   = "k" + randomUUID().replace(/-/g, ""),
            name        = "客户销售汇总账表",
            subSystemId = "23"
        )
        → 返回 { ok, newFormId }

Step 2  k3cloud_add_sysreport_filter_parameters(
            formId           = <Step 1 newFormId>,
            filterParameters = [
              { kind: "date",      keyWord: "@StartDate",    name: "起始日期", ... },
              { kind: "date",      keyWord: "@EndDate",      name: "结束日期", ... },
              { kind: "base_data", keyWord: "@CustomerId",   name: "客户",
                refObjectId: "BD_Customer", isMultiSelect: true },
              { kind: "text",      keyWord: "@BillNo",       name: "单号" },
            ]
        )

Step 3  k3cloud_add_sysreport_columns(
            formId  = <Step 1 newFormId>,
            columns = [
              { fieldKey: "FBillNo",       cellType: "text",            caption: "单号",   width: 150 },
              { fieldKey: "FCustomerName", cellType: "text",            caption: "客户名", width: 180 },
              { fieldKey: "FQty",          cellType: "integer",         caption: "数量",   width: 100 },
              { fieldKey: "FAmount",       cellType: "decimal",         caption: "金额",   width: 120 },
              { fieldKey: "FDate",         cellType: "date",            caption: "日期",   width: 120 },
              { fieldKey: "FDeptId",       cellType: "base_data_lookup",caption: "部门",
                refObjectId: "BD_Department",                                    width: 120 },
            ]
        )

Step 4  k3cloud_register_sysreport_python_plugins(
            formId    = <Step 1 newFormId>,
            className = "CustomerSalesReportPlugin",
            pyBody    = <IronPython 2.7 源码,读 Step 2 的过滤参数,
                         写到 Step 3 的报表列 temp table>
        )
```

**顺序硬约束**:Step 2/3 必须在 Step 1 之后(formId 依赖)。Step 2/3 彼此独立可换序。Step 4 通常放最后(插件代码引用前 3 步定义的 keyWord / fieldKey)。

---

## 过滤参数:5 种 kind 怎么选

🟡 主流程(反编译 RptKeyWordField + 5 种 capture 实证,fetched 2026-05-20)

| kind | 适用场景 | 必填参数 | 备注 |
|---|---|---|---|
| `date` | 时间范围筛选(订单审核日 / 创建日期 / 业务日) | `keyWord` / `name` / `dseq` | 服务端 `ConditionType=2`(区间) |
| `base_data` | F7 基础资料选择(客户 / 物料 / 部门 / 业务员) | + `refObjectId`(基础资料 FormId,如 `BD_Customer` / `BD_MATERIAL` / `BD_Department`) | 可选 `isMultiSelect=true` 多选;`AssistantID` + `LookUpObjectID` 两处同值 |
| `text` | 自由文本搜索(单号 / 备注 / 自定义编码) | `keyWord` / `name` / `dseq` | 模糊查询自行在 Python 插件里组 `LIKE '%' + value + '%'` |
| `combo` | 下拉枚举(订单状态 / 业务类型) | + `enumTypeId`(必须先存在;空 list 服务端 silent-drop) | **调用前**必先 `k3cloud_list_enum_types` 确认 enum 存在;不存在用 `k3cloud_create_enum_type` |
| `decimal` | 数字范围(金额 / 数量 / 价格区间) | `keyWord` / `name` / `dseq` | 服务端 `ConditionType=1`(范围) |

**判断顺序**:
1. 客户描述时间维度 → `date`
2. 客户描述选某个档案 → `base_data` + 问清是哪个档案(客户?物料?部门?)
3. 客户描述选状态/类型 → `combo`(先看 enum 是否存在)
4. 客户描述输金额/数量 → `decimal`
5. 兜底自由文本 → `text`

不要替客户预选 — 跟客户确认每个过滤项的语义(memory `feedback_dont_decide_for_customer`)。

---

## 报表列:5 种 cellType 怎么选

🟡 主流程(反编译 RptFilterGridField + capture 实证)

| cellType | 适用 | 必填参数 |
|---|---|---|
| `text` | 字符串列(单号 / 名称 / 备注) | `fieldKey` / `caption` |
| `integer` | 整数列(行号 / 数量 / 件数) | `fieldKey` / `caption` |
| `decimal` | 小数列(金额 / 价格 / 比率) | `fieldKey` / `caption`(可加 `precision` / `scale`) |
| `date` | 日期列 | `fieldKey` / `caption` |
| `base_data_lookup` | F7 lookup 列(显示客户名 / 部门名,点击跳详情) | + `refObjectId`(基础资料 FormId) |

---

## fieldKey 约定 — 顾问最易踩的坑

🟡 主流程(Phase 0 实证 + memory `bos_dcxml_element_schema`)

**fieldKey 必须等于 Python 插件 `BuilderReportSqlAndTempTable` 写入 temp table 的列名(字面字符串严格匹配)**,不一致则该列在前端显示**空白**(运行时静默,服务端不报错,日志也无提示)。

```
列定义:        { fieldKey: "FCustomerName", cellType: "text", caption: "客户名" }
                                  ↓ 必须严格等于
Python 插件:   sqlBuilder.Append("SELECT cust.FName AS FCustomerName FROM ...")
                                                             ↑↑↑↑↑↑↑↑↑↑↑↑
                                                             temp table 列名
```

**常见错误**:
- 列定义 `fieldKey="FCustomerName"`,插件里 SQL `AS FCustName` → 列空
- 列定义 `fieldKey="FQty"`,插件里 `AS fqty` → 列空(大小写敏感)

**纠错办法**:跑一次空数据 → BOS 客户端开 SQL Profiler 看 temp table 实际 schema → 跟 columns[] 字面对齐。

---

## Python 插件读 filter param 的代码片段

🟡 主流程(memory `reference_customer_k3_plugin_projects` 客户实战 idiom)

```python
import clr
clr.AddReference('Kingdee.BOS.Core')
from Kingdee.BOS.Core.Report.PlugIn import AbstractSysReportServicePlugIn

class CustomerSalesReportPlugin(AbstractSysReportServicePlugIn):

    def BeginFilter(self, e):
        # 读过滤参数面板的输入(Step 2 定义的 keyWord 必须严格匹配)
        self.cust_id    = e.Filter.GetValue("@CustomerId")    # BaseData 返回 PK long
        self.start_date = e.Filter.GetValue("@StartDate")     # Date 返回 DateTime
        self.end_date   = e.Filter.GetValue("@EndDate")
        self.bill_no    = e.Filter.GetValue("@BillNo")        # Text 返回 string

    def BuilderReportSqlAndTempTable(self, e):
        # 拼 SQL,把结果写到 e.ReportTempTableName 这个 temp table
        # 列名必须严格等于 Step 3 columns[] 里的 fieldKey
        sql = """
        SELECT
            bill.FBillNo            AS FBillNo,
            cust.FName              AS FCustomerName,
            entry.FQty              AS FQty,
            entry.FAmount           AS FAmount,
            bill.FDate              AS FDate,
            entry.FDeptId           AS FDeptId
        INTO """ + e.ReportTempTableName + """
        FROM T_SAL_ORDER bill
        JOIN T_BD_CUSTOMER cust ON bill.FCustId = cust.FCUSTID
        WHERE bill.FDate BETWEEN @StartDate AND @EndDate
        """
        if self.cust_id:
            sql += " AND bill.FCustId = " + str(self.cust_id)
        if self.bill_no:
            sql += " AND bill.FBillNo LIKE N'%" + self.bill_no + "%'"
        e.SqlString = sql
```

**注意**:`@KeyWord` 占位符在 SQL 模板里是字面字符串,服务端 BOS 报表引擎会把 `e.Filter.GetValue(...)` 的返回值替换进去 — Python 插件**不需要**手动 string replace。

---

## 常见踩坑

🟡 主流程(Phase 0 spike + 客户实证整理)

- **filter param 加完没生效** → 过滤参数是 metadata 驱动,BOS Designer 按 F5 即可重新拉。**不需要**客户端关闭重登(跟字段不一样,memory `bos_client_cache_relogin` **不适用**)。
- **列显示空白(数据正常,只是这一列空)** → fieldKey 与 Python 插件 temp table 列名不匹配(字面字符串严格,区分大小写)。
- **combo 调用报错 "enum type not found"** → 先 `k3cloud_list_enum_types` 看有没有,没有就 `k3cloud_create_enum_type` 创建,再回头调 `add_sysreport_filter_parameters`。
- **base_data 过滤生效但 F7 弹窗为空** → `refObjectId` 写错(填的 FormId 不存在 / 拼写错误)。注意大小写(memory `bos_form_id_case_pitfall`):`BD_Customer` / `BD_MATERIAL` / `BD_Department` 必须用 `connector.getObject()` 返回的 id,而非乱填。
- **decimal 过滤填了但 SQL 拿到 null** → SQL 模板里的 `@xxx` 占位符必须出现在 WHERE 子句,服务端才会做绑定;只在 SELECT 里出现不会绑。
- **报表列宽度不生效** → 客户端首次打开记住列宽到本地配置,改了 `width` 后需在客户端"列设置 → 恢复默认"才会重读 metadata。

---

## 已知 silent-drop 风险

完整列表见 `docs/architecture/bos-write-routes.md` §4 失败模式(编号 F-SR-1 ~ F-SR-5)。本工具内部已规避前 4 条,F-SR-5(combo enumTypeId 不存在)由调用前置检查规避。

---

## 相关 references / memory

- `references/template-catalog` — 7 个 SysReport 模板的选型(BOS_SimpleSysReport 首选 / BOS_MoveSysReport 分页)
- `references/wire-format` — SaveForIDEV9 envelope + DCXML 根标签 `<Form>`
- `prompts/when-to-create-new-vs-extend` — 新建 vs 扩展决策树
- memory `bos_dcxml_element_schema` — ElementType 数值表(text=1 / decimal=2 / integer=3 / date=4 / combo=9 / base_data=13)
- memory `reference_customer_k3_plugin_projects` — 客户实战 K/3 报表插件代码
- memory `feedback_dont_decide_for_customer` — 工具不替客户预选,让 LLM 根据场景决策
