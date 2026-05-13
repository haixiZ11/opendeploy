# Plan 7 — BOS 覆盖面扩展（v0.2 master plan）

> **本文件是 master plan**。按 6 个能力切成 6 个 sub-plan（含 1 个 v0.1 半成品收尾 + 5 个新能力），每个 sub-plan 自己的 doc 在 `docs/plans/` 平铺，命名 `2026-05-XX-plan-7.N-<topic>.md`。
>
> Sub-plan 在轮到它时再展开写——不一次写完，因为后段（账表 / 创建新对象）需要 Tier B 深度反编译产出来定接口。
>
> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`。Sub-plan 用 checkbox（`- [ ]`）跟踪。

**Goal:** v0.1.0-alpha.1 已发，覆盖了 BOS 二开里"扩展旧对象 + 字段 12 类 + 业务规则 2 个 ActionId + 操作/按钮 + 单据体 + 转换规则"这一档。v0.2 把覆盖面从"扩展"推进到"完整二开"——5 个 high-impact 缺口补上，让 OpenDeploy 能接更宽的客户实施需求。

**Architecture:** 沿用 v0.1 工具栈——`k3cloud-tools.ts` 注册所有 `k3cloud_*` 写工具；写路径走 **Route A（bos-bridge / .NET 桥）** 或 **Route B（TS envelope rebuild via SaveForIDEV9）**，新场景必走 A 或 B 二选一（参考 `docs/architecture/bos-write-routes.md`）。Plan 6 已经发版,L1-L4 护栏全到位（决策矩阵 doc / wire-replay 测试框架 / overlay 收编 / ESLint 护栏）。

**Tech Stack:** TypeScript + .NET 4.8 sidecar + Vitest（沿用 v0.1 栈，无新增）。新增的服务插件如果 C# 编译路径走得通会引入 csc.exe 调用。

**Scope 红线（本 plan 不做）：**
- 不做字段类型扩展（12 类外的图片 / 附件 / 富文本 / 颜色 / 手机号等）—— 用户决策 2026-05-11 暂留 backlog，等具体客户需求驱动再开
- 不做审批流 / 套打 / 实时预警 / 消息中心 / 编码规则 / 过滤方案 —— 按当前需求侦察留 v0.3+
- 账表（7.4）只做"简单单表查询型"账表 —— 多维分析 / 钻取 / 交叉表 留 v0.3
- 创建新对象（7.5）每个 metaobject 类型先做 P0 子集（BillForm 头表 + 主单据体；BaseDataForm 主表；DynamicFormModel 单表单页） —— 多 entity / 多视图 / 复杂权限留迭代

---

## 总体范围 & 依赖图

```
6 个 sub-plan 的依赖关系（→ 表示前置）:

7.0 转换规则通用化 ────────► v0.1 半成品收尾(原仅 SaleOrder-OutStock,现走 bos-bridge 通用化)
                            │
7.1 表单插件事件扩展 ──────► 独立可起（复用 register_python_plugins）
                            │
7.2 列表插件 ──────────────► 独立可起（类比 Form 插件，新 List 元数据领域）
                            │
7.3 服务插件 ──────────────► 反编译先行（确认 ServicePlugIn 是否吃 Python）
                            │
7.4 简单账表 ──────────────► Tier B 反编译 + recon spike 先行（新 metaobject 领域）
                            │
7.5 创建新对象 ────────────► 推到最后 / 或单开 Plan 8（最大跃迁，可逆性最差）
                            ▼
                  v0.2 release gate
```

**关键观察**：
- **7.0 优先级最高** —— 补 v0.1 已发布版本的半成品（转换规则只覆盖 1 对），现在 bos-bridge 已就位（2026-05-07 spike 通过），通用化是 unblocked 的低垂果实
- 7.1 / 7.2 是已有能力的横向扩展，工程量小，可用作"消化 v0.1 wire 知识"的短跑热身
- 7.3 / 7.4 都需先做反编译 spike，不要直接动工具
- 7.5 是基础能力跃迁，建议留到 7.0-7.4 完成、wire 经验厚之后再啃；或评估后单开 Plan 8 给完整研发空间

---

## Sub-plan 范围概览

每个 sub-plan 的细节 plan doc 单独写。这里只给 scope summary + Tier B 依赖 + 关键风险。

### 7.0 转换规则通用化（v0.1 半成品收尾，最高优先级）

**Tier B 侦察需求**：中（反编译 `DcxmlSerializer` + `SaveRulesV9` 调用链确认 bridge 最小 .NET 表面）

**当前状态**：v0.1 写入只支持 `SaleOrder-OutStock` 一对（静态 baseline 字典 + `UnsupportedConvertRuleError` 硬拒其他规则）。读取是全的。

**为何 v0.1 只做 1 对**：BOS Designer 的 `DcxmlSerializer` 是 .NET 私有序列化器，TS 端无法直接复用，必须 capture 每对规则的 baseline XML。v0.1 时 bos-bridge 还没有，只好走"capture 1 对静态 baseline"的最小成本路径。

**通用化路径**：走 **Route A（bos-bridge）** —— bridge 加 op 调用 BOS 真正的 `DcxmlSerializer`，参数化任意 ruleId。

**Sub-plan**：`docs/plans/2026-05-11-plan-7.0-convert-rules-generalization.md`

**关键风险**：DcxmlSerializer 输入构造复杂度未知，Phase 0 反编译 spike 是硬性决策点。

---

### 7.1 表单插件事件扩展（独立，预估短跑）

**Tier B 侦察需求**：低（反编译 `Kingdee.BOS.Core.Bill.PlugIn.AbstractBillPlugIn` 基类，列全 OnXxx 事件枚举半天即可）

**当前状态**：`register_python_plugins` 已支持几个核心事件（AfterConvert / 表单按钮触发等客户实战 idiom），但 BOS 表单插件事件总数有几十个（OnButtonClick / OnFieldChange / OnBarItemClick / OnSave / OnAddNew / OnLoad / DataChanged / BeforeF7Select 等）。客户实施里事件覆盖不全就用不了。

**P0 事件清单**（待反编译列全后裁剪）：
- 数据生命周期：OnAddNew / OnInitialize / AfterBindData / BeforeClosed
- 字段交互：DataChanged / BeforeF7Select / EntryButtonClickEvent
- 按钮/操作：BarItemClick / ButtonClick / BeforeDoOperation / AfterDoOperation
- 保存提交：BeforeSave / AfterSave / SubmitOperationBefore / AuditOperationBefore
- 单据体：BeforeRowSelected / RowChange / AfterEntryDataReturn

**新工具**：保持 `register_python_plugins` 入口不变，扩 schema 让 LLM 能选事件 + 注入对应 Python 函数骨架。

**关键风险**：客户实战 idiom 要列全（参考 memory `reference_customer_k3_plugin_projects`，sarcah / 天宇药业项目里的真实事件用法）；prompt 引导不到位 LLM 会瞎选事件。

---

### 7.2 列表插件（独立，类比表单插件）

**Tier B 侦察需求**：中（List 元数据领域跟 Form 不同。反编译 `AbstractListPlugIn` + ListView 事件链 + 列表元数据 schema）

**当前状态**：v0.1 完全没碰 List。客户场景里"列表里加按钮 / 列表 toolbar / 双击事件"很常见。

**P0 范围**：
- 列表插件注册（类比 register_python_plugins，但绑定到 ListView 而非 BillForm）
- List 工具栏按钮（类比 5.12.6 BarItemLink，但 List 元数据结构不同）
- ListView 事件：ItemFilterChanged / BarItemClick / DoubleClick / SelectedRowsChange

**新工具**（待 spike 后定）：
- `k3cloud_register_list_plugin(formId, entryFile, event)`
- `k3cloud_add_list_button(formId, ...)`（如果 List 跟 Form 的 BarItemLink wire 差异够大就拆分新工具，否则复用）

**关键风险**：List 元数据 schema 跟 Form 看似平行实际差异多（List 的 FormMetadata.ListMeta 节点结构不同，参考 memory `bos_multi_layer_ext_and_list_menu`）。先 recon 几个客户真实 List 二开 capture 再定接口。

---

### 7.3 服务插件（反编译先行）

**Tier B 侦察需求**：高（必须先反编译 `Kingdee.BOS.Core.AbstractServicePlugin` 或对应基类，确认是否吃 IronPython —— 如果只吃 C# 编译产物，工程量翻倍）

**当前状态**：v0.1 完全没碰服务插件。Service Plugin 是 BOS 后台二开点（定时任务 / 操作前后服务端 hook / 提交时强校验等），跟表单插件并列但更"重"。

**Spike 优先级最高**：在写工具前必须先反编译确认：
- ServicePlugIn 基类是否支持 IronPython 注入（如果支持，复用 v0.1 Python 插件路径）
- 不支持的话：是否走 C# .cs 源码 + csc.exe 编译 dll → 注册路径？还是必须开发商证书签名 dll？
- 服务插件部署位置（GAC？特定目录？）

**新工具**（待 spike 后定）：
- `k3cloud_register_service_plugin(operationId, ...)` —— 形态待 spike 决定

**关键风险**：反编译可能发现服务插件根本不支持 IronPython —— 那要么放弃，要么做 C# 编译路径（工程量 +1 周）；或者只支持特定子集（提交校验等"轻"场景）。

---

### 7.4 简单账表（新元数据领域）

**Tier B 侦察需求**：高（账表是独立 metaobject + 数据源 RPC，跟单据 Form 完全不同领域，必须先反编译 ReportPlugIn / 账表元数据 schema + capture 一份真实账表 wire）

**当前状态**：v0.1 完全没碰账表。客户场景里"按业务员看销售汇总 / 按月看库存进出 / 自定义统计单"非常多。

**P0 范围**（待 spike 后裁剪）：
- 单表查询型账表（一个数据源 + 列定义 + 过滤条件 + 排序）
- 数据源：固定 SQL 模板（参数化）/ 或调 BOS LoadList RPC
- 不做多维 / 钻取 / 交叉表

**新工具**（待 spike 后定）：
- `k3cloud_create_simple_report(name, dataSource, columns, filters)` —— 接口形态强依赖 spike 输出

**关键风险**：账表元数据领域跟 Form 几乎没交集，wire 完全要从 0 实证；账表客户端运行时还涉及报表引擎（不同 BOS 版本差异大）。

---

### 7.6 创建新 metaobject（模板继承，v0.2 范围扩张，2026-05-13 加入）

**Tier B 侦察需求**: 反编译 + 真服务器 spike，均通过

**当前状态**: ✅ 完成。2 个新工具(`k3cloud_create_from_template` + `k3cloud_register_sysreport_python_plugins`)+ 1 个新 skill(`metaobject-creation-index`)+ 5 层测试全过(wire-replay 5 fixture + smoke 4 scenario + agent loop e2e 4 scenario)。Plan 7.5 spike 报告"0 capture / 真未知"被反编译 + RPC 实证路线 unblock — 直接读 BOS server 拿全 19 个 BOS_* 模板字典。

**红线**: 工具不固化 P0 — `templateId: string` 接受任意合法 BOS_* 模板，LLM 根据用户场景选(memory `feedback_dont_decide_for_customer`)。

---

### 7.5 创建新对象（BillForm / BaseDataForm / DynamicFormModel）

**Tier B 侦察需求**：最高（v0.1 所有工具都是在"父对象"基础上加扩展，从 0 创建新对象的 SaveForIDEV9 wire 跟 baseline 完全不同；可逆性最差）

**当前状态**：v0.1 只能给 SAL_SaleOrder / BD_Customer 之类**已有**对象加扩展。客户场景里"我要一张全新的单据 / 一个新的基础资料类型 / 一个独立录入界面"非常常见。

**P0 范围**：
- **BillForm**（单据）：头表 + 1 个主单据体，预置字段约 5-8 个，挂菜单 + 列表
- **BaseDataForm**（基础资料）：主表，预置字段 5-8 个，挂菜单 + 列表
- **DynamicFormModel**（动态表单）：单表单页，预置字段 5-8 个

**关键 wire 问题**（待 spike）：
- 创建新对象的 SaveForIDEV9 wire 长什么样（vs 改扩展的 delta XML 形态完全不同？还是带 `action="add"`？）
- 新对象需要哪些配套：菜单注册（哪张元数据表）/ 列表元数据 / 默认布局 / 权限项注册
- BaseDataForm 是否需要建对应的物理 SQL Server 表（FBillNo / FSeq 等系统字段）；如果需要，这跟 CLAUDE.md "产品永不触碰客户数据库" 红线冲突，要走 RPC 而不能走 SQL —— **必须实证 RPC 路径能否独立完成建表**

**新工具**（待 spike 后定）：
- `k3cloud_create_bill_form(...)` / `k3cloud_create_basedata_form(...)` / `k3cloud_create_dynamic_form(...)`

**关键风险**：
- wire 复杂度可能比扩展旧对象高 N 倍 —— 单独 sub-plan 可能要拆 3-5 个 phase 才做完
- 可逆性差（删新建对象有 SVN 撞车风险，参考 memory `bos_designer_svn_kills_delete`）
- 如果反编译发现需要直连 SQL Server 建物理表才能完整跑通，要么砍 scope（只做 DynamicFormModel 这种不入库的），要么等 v0.3+ 做完整方案
- 建议评估完 spike 结果后，**单开 Plan 8** 给充裕研发空间，不挤进 Plan 7

---

## 排序建议

| 阶段 | sub-plan | 理由 |
|---|---|---|
| **Phase 1** | **7.0** 转换规则通用化 | 补 v0.1 半成品,bos-bridge 已就位,unblocked 的低垂果实 |
| Phase 2 | **7.1** 表单插件事件扩展 | 工程量小、复用 v0.1 路径、立即提升客户场景覆盖 |
| Phase 3 | **7.2** 列表插件 | 类比 7.1，把已有能力 mirror 到 List 元数据 |
| Phase 4 | **7.3 spike** 服务插件反编译 | 决策点：能不能做 / 走 Python 还是 C# |
| Phase 5 | **7.3** 服务插件（如 spike 通过）| 否则跳过留 v0.3 |
| Phase 6 | **7.4 spike** 账表反编译 | 决策点：单表查询型可行性 |
| Phase 7 | **7.4** 简单账表（如 spike 通过）| 否则砍 scope 或推迟 |
| Phase 8 | **7.5 spike** 创建新对象反编译 | 决策点 + Plan 8 是否拆出去 |
| Phase 9 | **7.5** 创建新对象 或拆出 Plan 8 | 视 spike 复杂度 |
| **Phase 10** | **7.6** 创建新 metaobject（模板继承）| ✅ 2026-05-13 完成。反编译路线 unblock，无需 user capture |

---

## 测试梯度（沿用 v0.1 5 层防护）

每个 sub-plan 必须保证：

1. **静态** —— typecheck + ESLint（含 L4 BOS XML 护栏）
2. **单元/快照** —— Vitest + wire-replay snapshot（新写场景必加 fixture）
3. **Connector 集成** —— mocked HTTP 抓 envelope
4. **真服务器 smoke** —— `scripts/bos-recon/smoke-7.N-*.ts`，沙箱扩展真打 K/3 server
5. **真 LLM agent loop**（发版前）—— `scripts/bos-recon/drive-7.N-*.ts`，DeepSeek 自驱

新场景必落 wire-replay fixture（参考 `docs/architecture/bos-write-routes.md` §5 checklist 第 4 步）。

---

## 文档维护

每个 sub-plan 完成后：
- 更新 CLAUDE.md "Plan 进度" 表对应行
- 关键 wire / 反编译实证写入 `MEMORY.md` 索引
- 涉及 BOS 私有 schema 的反编译结果落 `docs/recon/2026-05-XX-plan-7.N-spike.md`
