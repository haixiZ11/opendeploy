# BOS 模板字典

> 本文件是 `metaobject-creation-index` 的子文件。按需加载。
>
> 来源:`.scratch/captures/bos-templates.json` 全量模板列表(约 767 候选)+ 反编译 `create-from-template.ts` TEMPLATE_REGISTRY 实证(2026-05-13)。

---

## 账表 (ModelType=900) — 7 个核心模板

🟡 主流程已整理(BOS Designer 向导 + 反编译实证)

| templateId | 中文名 | 适用场景 |
|---|---|---|
| `BOS_SimpleSysReport` | 简单账表模板 | **首选**。客户要"单表数据查询"型账表,无分页需求 |
| `BOS_MoveSysReport` | 分页账表模板 | 数据量大,前端需要分页加载(服务端分页)。wire 有额外 `<ModeTypeSubId>902</ModeTypeSubId>` |
| `BOS_TreeSysReport` | 树形账表模板 | 层级展开结构(部门 → 员工 → 工时 / 分类 → 子分类) |
| `BOS_EasyDetailReport` | 明细报表模板 | EasyReport 系列 — 拖拽配置,Designer 里可视化布局 |
| `BOS_EasySummaryReport` | 汇总报表模板 | EasyReport 系列 — 自动汇总,按维度分组统计 |
| `BOS_EasyCrossReport` | 交叉报表模板 | EasyReport 系列 — 交叉表(行维度 × 列维度 = 值) |
| `BOS_CrossReportTemplate` | 透视表模板 | 透视表形态。与 BOS_EasyCrossReport 关系待实证;**不确定时优先用 BOS_EasyCrossReport** |

**账表 Python 插件基类**:`AbstractSysReportServicePlugIn`(命名空间 `Kingdee.BOS.Core.Report.PlugIn`)
**Python 代理类**:`PythonReportPlugIn`
**注册工具**:`k3cloud_register_sysreport_python_plugins`

---

## 单据 (ModelType=100) — 5 个核心模板

🟡 主流程已整理(BOS Designer 向导树形菜单 + 反编译 create-from-template.ts)

| templateId | BOS 向导编号 | 中文名 | 适用场景 |
|---|---|---|---|
| `BOS_BillModel` | 1. | 单据模板 | **根模板**。最 minimal,无分录。客户要最基础的单据头表 |
| `BOS_BillWithEntryModel` | 1.1 | 带分录单据模板 | 单据 + 明细行(典型:销售订单头 + 订单明细分录) |
| `BOS_BusinessBillModel` | 1.2 | 业务单据模板 | 单据 + 业务流转(内置审核 / 反审核 / 提交操作钩子) |
| `BOS_BuinessBillWithEntryModel` | 1.2.1 | 带分录业务单据模板 | 业务单据 + 明细行。注意:SDK 自身将"Business"拼为"Buiness",**templateId 必须照抄** |
| `BOS_SCMBillTemplate` | 1.2.5 | 供应链业务单据模板 | 供应链场景专用,自动对接库存核算链路 |

**readbackOid 说明**:子模板(`BOS_BillWithEntryModel` 等)继承 `BOS_BillModel`。服务端 FKERNELXML readback 的 `oid` 属性会解析为 `BOS_BillModel`,不是子模板 ID。用 `getExpectedReadbackOid()` 获取期望值。

**单据表单插件注册**:建完后用 `k3cloud_register_python_plugins`(不是 sysreport 版本)。

---

## 基础资料 (ModelType=400) — 7 个核心模板

🟡 主流程已整理(BOS Designer 向导 + 反编译 TEMPLATE_REGISTRY)

| templateId | BOS 向导编号 | 中文名 | 适用场景 |
|---|---|---|---|
| `BOS_BaseDataModel` | 1. | 基础资料模板 | **根模板**,最 minimal。不确定选哪个时从这里开始 |
| `BOS_NoOrgControlBDModel` | 1.1 | 不受组织控制 | 全公司共享的基础资料(如系统配置项、颜色码表、材质类型) |
| `BOS_PagedNoOrgControlBDModel` | 1.1.1 | 多页签不受组织控制 | 同上 + UI 多页签布局 |
| `BOS_OrgControlBDModel` | 1.2 | 组织控制基础资料 | **客户实战最常见**。按组织隔离:A公司的供应商≠B公司的供应商 |
| `BOS_PageOrgControlBDModel` | 1.2.1 | 多页签组织控制 | 同上 + UI 多页签布局 |
| `BOS_SubordinateBaseData` | 2. | 从属型基础资料 | 从属于另一个基础资料(如客户的联系人、商品的规格参数) |
| `BOS_BaseNoFieldModel` | 3. | 基础资料无字段 | 只用脚本驱动,不配置标准字段,完全自定义 |

**readbackOid 说明**:所有基础资料子模板 readback oid 解析为 `BOS_BaseDataModel`。

---

## 动态表单 (ModelType=500) — 9 个核心模板(Plan 7.7)

🟡 主流程已整理(`.scratch/captures/bos-templates.json` 客户使用量 TOP 实证 + 反编译 `Kingdee.BOS.Core.DynamicForm`)

DynamicForm 跟单据/基础资料/账表本质不同 — 是**配套辅助 UI 模板**(过滤器、向导、列表底盘、参数对话框、卡片菜单),不是独立业务对象。客户使用量超过单据 + 基础资料 + 账表之和(4283 实例,远多于其他)。

| templateId | 中文名 | 适用场景 |
|---|---|---|
| `BOS_CommonFilter` | 公共过滤 | **首选**。客户使用量最大(441 实例)。给报表 / 列表挂自定义过滤条件用 |
| `BOS_StandardFilter` | 列表过滤 | 标准列表的过滤面板。配合 K/3 列表用 |
| `BOS_OrgIsolationFilter` | 列表过滤(带组织) | 同 StandardFilter,但内置组织隔离 |
| `BOS_ForceOrgIsolationFilter` | 列表过滤(强制带组织) | OrgIsolation 升级版,组织字段必填强制 |
| `BOS_EasyReportCommonFilter` | 简单报表过滤 | 专给 EasyReport 系列账表挂的过滤面板 |
| `BOS_List` | 列表 | 独立的列表 DynamicForm(不挂在标准列表里) |
| `BOS_WIZARDFORMTPL` | 向导动态表单模板 | 多步骤向导(Step1 → Step2 → Step3)型 UI |
| `BOS_BILLTYPEPARAMODEL` | 单据类型参数模板 | 单据类型配置对话框(参数面板形态) |
| `BOS_BASECLOUDPART` | 页面部件动态表单基类 | 嵌入式 UI 部件,挂在其他表单的容器里 |

**readbackOid 说明**:DynamicForm 模板**彼此平级**,没有"根模板收敛"。每个 BOS_* 模板创建后 FKERNELXML readback 的 `oid` 就等于 templateId(区别于 BillForm 都收敛到 `BOS_BillModel`、BaseDataForm 都收敛到 `BOS_BaseDataModel`)。

**DynamicForm 表单插件注册**:走 `k3cloud_register_python_plugins`(跟单据/基础资料同款,不是 sysreport 版本)。

**v0.2 未注册的模板**:`.scratch/captures/bos-templates.json` 里还有 26 个 BOS_* DynamicForm 模板(BOS_AIPrivacy / BOS_HtmlConsole / BOS_TeamWorkMainConsole 等),这些场景特殊性强,需要时再扩展 `TEMPLATE_REGISTRY` 即可,wire 路径不变。

---

## 决策原则

1. **客户需求驱动,不要替客户预选** — 先问清楚客户的业务场景再选模板。不同的组织控制模式、是否要分录、是否要审核流,都决定模板选型。让客户确认。

2. **遵循 BOS 编号约定** — 模板名前的"1. / 1.1 / 1.2.1"是 BOS Designer 树形菜单层级。数字越深越具体,继承链越长。不确定时选编号更浅的祖先模板,后续加能力更灵活。

3. **不确定时选最根模板** — `BOS_BillModel` / `BOS_BaseDataModel` / `BOS_SimpleSysReport` 是各自类的根,最 minimal、最灵活,后续能在 BOS Designer 里继续扩充能力。

---

## 场景 → 模板 快速对照

| 用户说 | 应该选 |
|---|---|
| "建一个最简单的台账查询账表" | `BOS_SimpleSysReport` |
| "数据量大需要分页的账表" | `BOS_MoveSysReport` |
| "建一个汇总统计报表" | `BOS_EasySummaryReport` |
| "建一个交叉/透视报表" | `BOS_EasyCrossReport` |
| "建一个销售订单,带订单明细行" | `BOS_BillWithEntryModel` 或 `BOS_BuinessBillWithEntryModel`(有审核流选后者) |
| "建一个只有头表的简单单据" | `BOS_BillModel` |
| "建一个客户档案(有组织隔离)" | `BOS_OrgControlBDModel` |
| "建一个 SKU 颜色码表,全公司共享" | `BOS_NoOrgControlBDModel` |
| "建一个系统参数配置表" | `BOS_NoOrgControlBDModel` |
| "建一个供应商联系人(从属于供应商)" | `BOS_SubordinateBaseData` |
| "给账表做个自定义过滤面板" | `BOS_CommonFilter` 或 `BOS_EasyReportCommonFilter`(EasyReport 系列报表) |
| "做一个多步骤向导界面" | `BOS_WIZARDFORMTPL` |
| "建一个参数配置对话框" | `BOS_BILLTYPEPARAMODEL` |
| "做一个独立的列表查询界面" | `BOS_List` |
