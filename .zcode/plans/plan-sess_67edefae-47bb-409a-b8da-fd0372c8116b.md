# 四项优化实施计划

## 修复 1：模型不写死——自动获取 + 自定义输入兜底 + 连通性测试

**根因**：`providers.ts:199-211` 的 `resolveActiveModel` 把白名单外模型 id 静默丢弃回退推荐模型；下拉只渲染编译期写死的 `models[]`。main 端 `req.model` 直通无校验，只需放开 renderer。

### 1a. 自动获取模型列表
- main 端 `ipc-llm.ts` 新增 `llm:listModels`，按 format 分发：openai 兼容 9 家 + custom-openai 复用已有未接线的 `listOpenAiModels`（openai-client.ts:219）；anthropic 新增 `listAnthropicModels`（GET /v1/models）；ollama 新增 `listOllamaModels`（GET /api/tags）。统一入口 `listModelsForProvider()`（factory.ts），各配协议测试。
- preload + window.d.ts 暴露 `llmListModels`。
- 自动触发：SettingsPage 选中供应商且已存 key → 拉取；保存 key → 重拉；WizardPage key blur → 用输入的 key 拉取。持久缓存 `fetchedModelsByProvider`（settings 新字段），先显缓存后台刷新，失败静默回退内置列表。
- 下拉合并：去重(内置白名单 + 已拉取 id + 当前 stored)。

### 1b. 连通性测试
- 新模块 `src/main/llm/test-connection.ts`：`testProviderConnection({ providerId, apiKey, model, accessMode, baseUrlOverride?, fetchImpl? })` 发真实极小请求（openai: POST /chat/completions max_tokens=8；anthropic: POST /v1/messages；ollama: POST /api/chat），20s 超时，返回 `{ ok, latencyMs, error? }`；注入 fetchImpl 可单测。
- IPC `llm:testConnection` + preload `llmTestConnection`。
- UI：SettingsPage key 区与 WizardPage step1 加"测试连接"按钮 + 内联结果（绿 ✓ 连接成功 · xx ms / 红 ✗ 错误详情）；保存 key 后自动跑一次（向导 key blur 后与拉模型一起跑）。

### 1c. 自定义模型名（兜底）
- `resolveActiveModel` 放宽：白名单外 stored id 返回降级元数据 `{ id, label: id, hint: '自定义模型', contextWindow: 128_000 }`，不再丢弃。
- SettingsPage / WizardPage 模型下拉下方加"自定义模型名"输入框（Ollama 模式泛化），统一落盘 `modelByProvider[providerId]`。

### 1d. 测试
- 更新 `tests/renderer/providers-models.test.ts`（新行为 + custom-openai 豁免，顺带修掉 main 既有失败）；新增 test-connection 与 anthropic/ollama list 测试。

## 修复 2：API Key 查看/复制
- 新组件 `components/KeyInput.tsx`：眼睛切换（password↔text）+ 复制按钮（复用 ArtifactsPanel copied 回弹模式）。
- SettingsPage 按量/包月两个框 + WizardPage 一个框换用。
- i18n 补 showKey/hideKey/copyKey/copied/testConnection/testing/testOk/testFailed 等文案（zh/en 同步）。

## 修复 3：点豆包被弹回向导
**根因**：App.tsx:149-177 effect 依赖 `settings.llmProvider` 等；点卡片立即持久化 provider（无 key）→ 判定未配置 → `setPage('wizard')`，向导隐藏全部导航且无跳过。
1. effect 改一次性判定（依赖只留 `loaded`）：会话内切 provider 不再弹。
2. settings 新增 `onboardingDone?: boolean`：完成/跳过均持久化，重启不重拉。
3. WizardPage step0/step1 加"跳过，稍后在设置里配置"链接。
4. 顺手：向导 key 输入回填已保存 key。

## 修复 4：API URL 默认可见、可直接修改（按用户要求调整）
**现状**：默认端点写死在 main 端 `PROVIDER_CONFIGS`（types.ts:75-121）UI 不可见；包月模式悄悄换专属 URL 无提示；Base URL 输入框藏在折叠的"高级"区。
1. **renderer providers.ts 增加 `baseUrl` 字段**，provider-sync.test.ts 扩展为 baseUrl 双向同步校验（tokenPlan.baseUrl 本就双端同步）。
2. **SettingsPage 的 Base URL 输入框从折叠高级区提为常规可见字段**：
   - placeholder 显示当前供应商当前计费模式的默认 URL（如豆包按量 `https://ark.cn-beijing.volces.com/api/v3`，切包月自动变 `/api/coding/v3`）；
   - **留空 = 保持默认**（保存即清除覆盖）；**填了 = 按修改后的走**（沿用现有 `apiBaseUrlOverride` 存储，main 端零改动）；
   - 输入框下方 hint 显示当前实际生效的 URL；保留"恢复默认"一键清空按钮。
3. Wizard 保持精简不展示 URL 字段（首次配置走默认，设置页随时可改）。

## 验证
`tsc --noEmit`（node+web）+ 项目 lint + 全量 vitest（预期全绿，含修复 custom-openai 既有失败）。

## 涉及文件
providers.ts、SettingsPage.tsx、WizardPage.tsx、App.tsx、settings-store.ts、shared/types.ts、ipc-llm.ts、factory.ts、三个 llm client（list 函数）、新建 test-connection.ts、preload/index.ts、window.d.ts、i18n 两份、新建 components/KeyInput.tsx、tests（providers-models 更新 + provider-sync 扩展 + test-connection/list 新增）。