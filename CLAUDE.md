# CLAUDE.md

> 项目级上下文，每次会话自动加载。改动时保留密度、避免历史细节膨胀。

## 项目简介

**开达 OpenDeploy** — 开源的金蝶云星空实施交付智能体。让一个乙方实施顾问能完成原本必须找专业二开才做得了的需求。

- **架构哲学**：Harness（产品）+ Knowledge（产品+社区）+ LLM（用户自备：Claude / GPT / DeepSeek / Qwen / GLM / Kimi / 豆包 / 混元 / MiniMax / 百川 / Ollama）+ 零自营服务器（GitHub 托管知识库）
- **产品线**：Community Edition（MIT 开源，单顾问本地工具）/ Enterprise Edition（闭源付费，MVP-3+ 团队协作 Hub）

## 当前状态

- **版本**：v0.1.0-alpha.1（已发布 2026-05-09，GitHub Release）
- **分支**：`main`

**Plan 进度**：

| Plan | 主题 | 状态 |
|---|---|---|
| 1 | 项目引导 + 应用基础 + UI 壳 | ✅ |
| 2 | LLM 集成 + Agent Loop + 对话 UI | ✅ |
| 3 | 知识库（Skills）基础设施 | ✅ |
| 4 | 金蝶 K/3 Cloud 元数据只读 | ✅ |
| 5 | Python 代码生成 + Demo 闭环 | ✅ |
| 5.5–5.10（非正式） | BOS 写入 / Skills 架构重做 / 内容大扩张 / UX 修补 / 段批量化+实时 token | ✅（详见 commit history） |
| 5.11 | 多 model per provider | ✅ |
| 5.12 / 5.12.1 | 字段类型扩展（12 类） | ✅ |
| 5.12.3 / 5.12.3a / 5.12.3b | 业务规则（Tier B 实证 + 实施） | ✅ |
| 5.12.4 v1 / v2 | 转换规则只读 + 写入 | ✅（仅 SaleOrder-OutStock） |
| 5.12.6 | 操作 + 工具栏按钮 | ✅（2026-05-07 BarItemLink 真凶修完，e2e 全过） |
| 5.12.7 | 属性面板 5 条（MustInput / DefValue / IsShowSeq / OrgFieldKey / Entity.MustInput） | ✅ |
| **L1–L4（防 BOS 出错杠杆，2026-05-07）** | 决策矩阵 doc / wire-replay 测试框架 / 收编 overlay / ESLint 护栏 | ✅ 全部 |
| 5.14 | entry-support（EntryEntity / TabPage / TabControl × create+delete+rename = 9 工具 + entry-field 分支 + GetSequenceInt32 RPC + smoke-entry-lifecycle） | ✅ |
| **6** | **打包发布 + Alpha Release**（skills 仓库 push + 一次性清缓存策略 + electron NSIS installer） | ✅（2026-05-09 v0.1.0-alpha.1 发到 GitHub Release） |
| **7（v0.2 master）** | **BOS 覆盖面扩展 — v0.2 alpha 范围** — 7.0 转换规则通用化 ✅ / 7.1 表单插件事件参考扩到 30+ ✅ / 7.2 列表插件 + 列表菜单按钮 ✅ / 7.3 操作服务插件 events-reference + SKILL ✅ / 7.4 账表 knowledge bridge ✅(创建账表已被 7.6 解锁) / 7.5 → 拆 Plan 8。Master plan: `docs/plans/2026-05-11-plan-7-bos-coverage-expansion.md` | ✅(2026-05-11 全部完成,可发 v0.2 alpha) |
| **7.6** | 创建 metaobject(模板继承，SysReport + BillForm + BaseDataForm) | ✅(2026-05-13，2 工具 + 1 skill + 5 层测试全过) |
| **8（v0.3）** | 创建新 metaobject 高级子集 (DynamicForm + 树形/直接SQL/透视账表) | ⏳ 留 v0.3，Plan 7.6 反编译路线证明无需 user capture |

**测试**：73 test files / 883 tests，全绿。lint clean。

## 常用命令

```bash
pnpm dev                 # Electron 开发模式
pnpm build               # 生产构建 → out/
pnpm test                # Vitest（883 tests）
pnpm typecheck           # tsc --noEmit
pnpm lint                # ESLint flat config（含 BOS XML 护栏 L4）
pnpm format              # Prettier
pnpm knowledge:manifest  # 重算 knowledge/manifest.json SHA-256

# 真服务器 smoke（会写沙箱扩展 + 自清理）
pnpm tsx --tsconfig tsconfig.node.json scripts/bos-recon/smoke-toolbar-button-route-b.ts
pnpm tsx --tsconfig tsconfig.node.json scripts/bos-recon/smoke-5_12_7-property-grid.ts

# 真 LLM agent loop e2e（DeepSeek 自驱）
pnpm tsx --tsconfig tsconfig.node.json scripts/bos-recon/drive-5_12_6-7-via-agent.ts
```

## 技术栈

- Electron 41 + electron-vite 5（preload 输出 `.mjs`，主进程 `sandbox: false`）
- React 19 + TS 6 + Vite 7 + react-i18next + Zustand
- Vitest 4；pnpm 10（必保留 `pnpm.onlyBuiltDependencies: ["electron", "esbuild"]`）
- Tailwind 4 (`@tailwindcss/postcss`) + 设计系统 CSS（2134 行 oklch）
- ERP：HTTP RPC 直打 K/3 Cloud Web 服务器(读写全 RPC,commit `029bacf` 起切完);**产品代码不连客户 SQL Server**(没 import mssql,运行时也没装)
- **.NET 4.8 sidecar `bos-bridge/`**（~3000 行 C#）—— 用于转换规则 / 业务规则的 DcxmlSerializer 反序列化

## 目录结构（精简版，只列高频入口）

```
src/
├── shared/{types,llm-types}.ts                # 跨进程契约
├── main/
│   ├── agent/{loop,tools,builtin-tools,skills-integration}.ts
│   ├── agent/{k3cloud-tools,bos-rpc-tools,operation-tools,business-rule-tools}.ts  # 33 个 k3cloud_* tools
│   ├── agent/prompts/{base-system,erp-rules/k3cloud,active-project-tag,skills-catalog-intro}.md
│   ├── erp/{types,active}.ts                  # ErpConnector 接口 + 活动项目单例
│   ├── erp/k3cloud/connector.ts               # K3CloudConnector(BOS RPC)
│   ├── erp/k3cloud/fkernel-parsers.ts         # 解析 FKERNELXML（read 路径）
│   ├── erp/k3cloud/rpc/{save-for-ide,dcxml,types,codec,login,http-client}.ts  # Route B 写
│   ├── erp/k3cloud/rpc/{operation-parser,existing-elements,layout-discovery}.ts  # 解析
│   ├── erp/k3cloud/rpc/{convert-rules,save-convert-rules,extend-convert-rule}.ts
│   ├── erp/k3cloud/rpc/{business-rule-overlay,business-rule-parser}.ts
│   ├── erp/k3cloud/bridge/{client,index}.ts   # bos-bridge sidecar TS 端
│   ├── llm/{openai,anthropic,ollama}-client.ts
│   ├── skills/{registry,manager,downloader,seed,integrity}.ts
│   ├── plugins/store.ts
│   └── conversations/store.ts
├── preload/index.ts
└── renderer/                                  # React + Zustand + i18n + design-system.css

bos-bridge/                                    # .NET 4.8 console
├── BosContext{,.BusinessRules,.Operations,.Reflection}.cs
└── Program.cs                                 # NDJSON dispatcher (21 ops)

tests/                                          # 73 files / 883 tests
└── erp/wire-replay/                            # L2 框架(__snapshots__/route-b/*)

docs/
├── architecture/bos-write-routes.md           # ← BOS 写入路径决策矩阵（必读）
├── plans/                                     # 各 Plan step-by-step
└── recon/                                     # 反编译 + capture 实证

scripts/bos-recon/                              # 真服务器 smoke + agent-loop driver
.scratch/                                       # gitignore；capture / decompile / 调试
```

## 架构硬红线（不要违反）

1. **产品永不触碰客户业务数据** — 架构上不连客户数据库：
   - 读 / 写**全部**走 BOS HTTP RPC(`SaveForIDEV9` / `SaveRulesV9` / `GetBusinessObjectMetaData` 等)。产品代码 0 处 `import mssql`,运行时也没装 mssql 包。
   - K/3 服务端 RPC 自身就受 BOS 内部权限框架约束 — 拿到的 metadata XML 只能改扩展(挂在 `BaseObjectId` 下),改不了原厂对象;碰业务表(`T_SAL_*` / `T_BD_*` 等)在 RPC 层根本没接口。
   - 历史包袱:`commit 029bacf` 之前曾走 SQL 直写,那时计划过"SQL 白名单"。切 RPC 之后该 gate 已经**架构性消除**(2026-05-09 复核)。
2. **凭据只在用户本机** — LLM API Key + K/3 凭据明文存 `settings.json`（Community 版接受）；renderer 进程永远不接触，走 IPC
3. **目标 ERP 仅 K/3 Cloud V9.x 私有部署** — 不支持 SaaS / 苍穹（V2）/ 精斗云 / KIS。命名统一 `k3cloud`，`K3CloudConnector` 单类跑所有 V9/V10 + standard/enterprise 组合
4. **Multi-ERP Provider 架构** — 实现 `ErpConnector` 接口（`src/main/erp/types.ts`）插入 `src/main/erp/<name>/`，主应用 ERP 中立
5. **社区版零服务器** — 知识库 GitHub `qiaolei227/opendeploy-skills` + Gitee `QiaOo/opendeploy-skills` fallback；HTTPS tarball 拉取，零 git 客户端依赖
6. **新增 agent 工具必须决定 `parallelSafe`**（`src/main/agent/tools.ts`）— 只读 / 幂等 → `true`；写 DB / 写文件 / 改连接状态留空。`loop.ts` 一批 tool_calls 全 safe 才 `Promise.all`，否则整批串行

## BOS 写入路径决策（**必读 `docs/architecture/bos-write-routes.md`**）

只有 2 条活跃路径（Route C overlay 已 2026-05-07 全废止）：

| 路径 | 位置 | 用于 |
|---|---|---|
| **Route A — bridge** | `bos-bridge/` (.NET) + `src/main/erp/k3cloud/bridge/` | 转换规则 / 业务规则（DcxmlSerializer 友好） |
| **Route B — TS envelope rebuild** | `rpc/save-for-ide.ts` + `rpc/dcxml.ts` + `rpc/types.ts` | 字段 / 操作 / 按钮 / Python 插件 / 扩展生命周期 / entry / tabpage |

加新写入能力前先读决策矩阵 §2 决策树 + §4 失败模式表（F1/F2/F4/F5）+ §5 checklist。**新场景必走 A 或 B，不许开第 3 路**。L4 ESLint 规则会抓裸 BOS XML 字符串拼接（白名单：`bos-bridge` / `dcxml.ts` / `business-rule-overlay.ts` / `save-for-ide.ts` / 几个 parser）。

**已知 bridge bug（生产已绕开）**：`list_operations` 调 `DcxmlSerializer.DeserializeFromString` 不传 baseline → 静默 drop `<Form action="edit">` 内容。`connector.listOperations` 已切到 TS-side `operation-parser.ts`，bridge 这条 op 留 dead code 待真修。

## 测试梯度（5 层防护）

任何 BOS 写入 wire 改动都会撞这梯队的某层：

1. **静态** — typecheck + ESLint（含 L4 BOS XML 护栏） — `pnpm typecheck && pnpm lint`，<30s
2. **单元/快照** — Vitest 883 tests + wire-replay fixtures（`tests/erp/wire-replay/`，包含 5 个 Plan 7.6 新增），5s。snapshot 漂移在 PR 显式 review
3. **Connector 集成** — mocked HTTP（`tests/erp/connector-bar-button-flow.test.ts` 等），抓 envelope F5（漏 `existingXxxRaw`）
4. **真服务器 smoke**（手动）— `scripts/bos-recon/smoke-*.ts`，沙箱扩展真打 K/3 server + raw FKERNELXML 字节验证
5. **真 LLM agent loop**（手动，发版前）— `scripts/bos-recon/drive-*.ts`，DeepSeek 自驱选 tool 编排顺序，~$0.005/run

加 case：决策矩阵 §5 checklist 第 4 步要求新写场景必落 wire-replay fixture。

## 编码风格

- **i18n**：UI 100% 中英双语；新增 i18n key 必须两个 locale 都加（i18n 测试检 parity）
- **TS strict**，避 `any`；shared/types.ts 是跨进程契约，改了同步 preload + window 类型
- **TDD**：业务逻辑先写 `tests/`，再实现；UI 组件视觉验证 + typecheck
- **提交**：Conventional Commits（`feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:`）。每个逻辑单元一个 commit，prefer 小而多
- **文件 < 300 行为宜**；职责单一
- **路径别名**：`@main/*` / `@preload/*` / `@renderer/*` / `@shared/*`

## 关键 UX 决策

- **Wizard 触发**：`!llmProvider || (provider !== 'ollama' && !apiKeys[provider])`
- **Projects 激活**：单例 `K3CloudConnector` 持 BOS HTTP session；切项目 teardown 重连，`erp:connection-state` IPC 推 StatusBar
- **Agent 工具动态注册**：每次 `llm:send` fresh 构建 ToolRegistry。内置 + load_skill + k3cloud_*（项目活跃才注入）+ bos-rpc/operation/business-rule tools
- **System Prompt 外部化**（`src/main/agent/prompts/`，Vite `?raw` 导入）：`base-system.md`(ERP 无关) + `erp-rules/<provider>.md`(动态选) + `active-project-tag.md`(占位 `{{database}}`) + `skills-catalog-intro.md`
- **Skill 可见性按命名空间**：`system/*` 不进 catalog 但可按名加载；`common/*` 始终；`<erp>/*` 仅活动项目 ERP 匹配
- **插件产物路径**：`~/.opendeploy/projects/<id>/plugins/<name>.py`（ASCII + .py + 无路径分隔符）；renderer 只读
- **对话持久化**：`~/.opendeploy/conversations/*.md`（人可读可编辑）；切对话 `loadConversation` 重水 artifacts panel

## K/3 Cloud BOS 二开（核心知识，详见 memory）

- **扩展机制**：Python 表单插件 / 自定义操作 / 工具栏按钮 / 字段 / entry 都挂在"扩展对象"上（`T_META_OBJECTTYPE` 新行 `FBASEOBJECTID = 'SAL_SaleOrder'`）。完整建扩展 8 表 91 行，事务包裹（参考 `scripts/create-extension-full.ts`）
- **FSUPPLIERNAME = NULL**（不盖开发商章，2026-04-23 实证）；FUSERID 机制作废
- **缓存刷新规则**：BOS Designer 扩展列表缓存（F5 刷）；客户端表单缓存（**关闭客户端整个登出再登回来**才看新字段，2026-04-26 实证）；`bos_metadata_cache_invalidation` 服务端 cache bump 套路
- **wire 协议**：`MetadataServiceV9Proxy.SaveForIDEV9` HTTP RPC，ap0 JSON = `{__source__: DCXML, __paras__: JSON, "<lcid>": ""}`；DCXML 是 **stateful baseline diff vs 父对象**（`action="edit|remove|setnull"`，**没 add**：加东西靠 ship 完整 element）
- **常见踩坑**（memory `bos_smoke_findings_2026_05_07` 等）：
  - `<Form action="edit">` 没 baseline → `DcxmlSerializer` 静默 drop（bridge bug 真凶）
  - 重复 `<Form>` sibling → server 只保第 1 个
  - fresh extension 缺 `<LayoutInfos>` → silent drop add
  - envelope 漏 `existingXxxRaw` → 该类元素全抹（F5）
  - BarItemLink ParentKey 引用不在 wire 的 BarItem → 整段 `<BarItemLinks>` 被 strip

## Skills 架构（Plan 5.8 后定型，10 个 bundled / 57 md / 10638 行 / catalog ~1735 tokens）

- 命名空间 = 可见性：`system/*`(不进 catalog) / `common/*`(始终) / `<erp>/*`(匹配活动项目)
- 文件结构：`<ns>/<name>/SKILL.md`(必需,索引 + 子文件导航) + `prompts/*.md`(过程性) + `references/*.md`(查阅性)
- Agent 流：catalog 列 skill → `load_skill(id)` 拿 SKILL.md → body 显式引 `load_skill_file(id, 'references/foo')`
- 三级实证标记（`knowledge/CONTRIBUTING.md` 强制）：🟢 客户实证 / 🟡 主流程（公开手册整理） / 🔴 骨架。每条带 source URL + fetched 日期
- 纪律：不搞 recipe；Layer 2 不承诺工具做不到的能力；`SKILL.md` 第 1 行必须是 `---` frontmatter
- **目标仓库**：`qiaolei227/opendeploy-skills`(GitHub) + `QiaOo/opendeploy-skills`(Gitee 镜像) — Plan 6 内 push

## 新 Claude 首次进来该读

1. 本文件（CLAUDE.md）
2. `docs/architecture/bos-write-routes.md` — BOS 写入路径决策矩阵
3. `src/main/agent/prompts/base-system.md` + `erp-rules/k3cloud.md` — agent 系统提示词
4. memory（`MEMORY.md` 索引 + 具体 md 按需）：`project_current_state` / `bos_extension_recipe` / `skill_architecture` / `bos_write_routes_doc` / `bos_smoke_findings_2026_05_07`
5. `docs/2026-04-19-设计文档.md` — 产品定位 / 商业化 / 数据红线
6. `docs/plans/` 最新 Plan
