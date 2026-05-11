/**
 * Plan 7.3 agent loop e2e — verify the LLM picks the right plugin path when
 * the scenario is **operation-level validation** (must be a service plugin,
 * not a form plugin, because the validation runs server-side when an
 * operation is dispatched — form plugins don't see audit/unaudit reliably).
 *
 * What we're testing:
 *   1. Does the agent route operation-level validation to
 *      `k3cloud_add_custom_operation(pyBody=..., pluginClassName=...)`
 *      (inline service plugin) instead of `k3cloud_register_python_plugins`
 *      (which would land in <FormPlugins> and miss audit-time hooks)?
 *   2. Does the IronPython code use `AbstractOperationServicePlugIn`
 *      (not `AbstractBillPlugIn`)?
 *   3. Does it pick a service-plugin event like `BeginOperationTransaction`
 *      / `BeforeExecuteOperationTransaction` (not `BeforeSave` / `AfterDoOperation`)?
 *
 * Costs ~$0.005 per run via DeepSeek.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { K3CloudConnector, setBundledConvertRuleTemplate } from '../../src/main/erp/k3cloud/connector';
import { ToolRegistry } from '../../src/main/agent/tools';
import { BUILTIN_TOOLS } from '../../src/main/agent/builtin-tools';
import { buildK3CloudTools } from '../../src/main/agent/k3cloud-tools';
import { buildBosRpcTools } from '../../src/main/agent/bos-rpc-tools';
import { runAgentLoop } from '../../src/main/agent/loop';
import { createLlmClient } from '../../src/main/llm/factory';
import { erpRulesFragment } from '../../src/main/agent/erp-rules';
import type { Message } from '../../src/shared/llm-types';
import type { Project } from '../../src/shared/erp-types';

setBundledConvertRuleTemplate(
  fs.readFileSync(
    path.resolve('src/main/erp/k3cloud/rpc/baselines/convert-rule-extension-template.xml'),
    'utf-8',
  ),
);

const settingsPath = path.join(os.homedir(), '.opendeploy', 'settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const project = settings.projects.find((p: Project) => p.id === settings.activeProjectId) ?? settings.projects.find((p: Project) => p.bos != null);
if (!project?.bos) {
  console.error('✗ no active project with bos creds.');
  process.exit(1);
}
const apiKey = settings.apiKeys?.deepseek;
if (!apiKey) {
  console.error('✗ no deepseek API key.');
  process.exit(1);
}

const PROMPTS_DIR = path.join(process.cwd(), 'src', 'main', 'agent', 'prompts');
const baseSystemPrompt = fs.readFileSync(path.join(PROMPTS_DIR, 'base-system.md'), 'utf8').trim();
const k3cloudRules = fs.readFileSync(path.join(PROMPTS_DIR, 'erp-rules', 'k3cloud.md'), 'utf8').trim();
const projectTagTpl = fs.readFileSync(path.join(PROMPTS_DIR, 'active-project-tag.md'), 'utf8').trim();

console.log('=== Connecting to K/3 Cloud ===');
const connector = new K3CloudConnector(project.bos, project.id);
await connector.connect();
console.log('✓ connected to', project.bos.baseUrl);
console.log();

const sessionMgr = {
  async getOrLogin(_projectId: string) {
    const s = connector.getSession();
    if (!s) throw new Error('connector has no session');
    return s;
  },
  invalidate(_projectId: string) {},
};

const registry = new ToolRegistry();
for (const t of BUILTIN_TOOLS) registry.register(t);
for (const t of buildK3CloudTools(connector)) registry.register(t);
for (const t of await buildBosRpcTools(connector, project.id, sessionMgr)) {
  registry.register(t);
}
console.log(`registered ${registry.definitions().length} tools`);
console.log();

const projectTag = projectTagTpl
  .replace('{{acctId}}', project.bos.acctId)
  .replace('{{baseUrl}}', project.bos.baseUrl)
  .replace('{{productName}}', '金蝶云星空 企业版/标准版');
const erpRules = erpRulesFragment('k3cloud', { k3cloud: k3cloudRules });
const systemPrompt = [baseSystemPrompt, erpRules, projectTag]
  .filter((s) => s && s.trim() !== '')
  .join('\n\n');

// Scenario: brand-new custom operation with inline logic — the textbook
// case for an inline service plugin (option B from SKILL.md "审核/反审核
// 拦截两条路径都通" guidance). The agent should pick
// add_custom_operation(pyBody=...) rather than splitting it into separate
// add_custom_operation + register_python_plugins calls.
const userPrompt = `在销售订单上**新建一个自定义操作**叫"标记为重点客户单",
点击后做两件事:
1. 把当前单据的备注字段 FNote 改成"重点客户订单"
2. 服务端事务里 INSERT 一条记录到日志表 T_OPD_HighlightLog
   (FBillNo, FUserID, FTime)

这两段逻辑跟这个操作**强绑定**:其他单据 / 其他操作完全用不到。

**禁止反问任何确认 / 方案征求意见的话**。日志表如果不存在你假定它已建好继续。
按你判断最常见 / 最简单的方案,直接 add_custom_operation + add_toolbar_button
+ 反查验证,做完闭环再给我交付总结。中间不要停下问我。`;

const initialMessages: Message[] = [
  {
    id: 'u_test',
    role: 'user',
    content: userPrompt,
    createdAt: new Date().toISOString(),
  },
];

// Track tool calls + check Python code for correct base class / event
const calledTools: string[] = [];
let inlineServicePluginUsed = false;
let standalonePythonPluginsUsed = false;
let pyBodyHasServiceBase = false;
let pyBodyHasFormBase = false;
let pyBodyHasServiceEvent = false;
let pyBodyHasFormEvent = false;

console.log('=== Running agent loop ===');
console.log('User prompt:');
console.log(userPrompt);
console.log();

const finalMessages = await runAgentLoop({
  client: createLlmClient('deepseek'),
  tools: registry,
  initialMessages,
  providerId: 'deepseek',
  apiKey,
  model: 'deepseek-v4-flash',
  systemPrompt,
  maxIterations: 20,
  conversationId: 'drive_7_3_' + Date.now(),
  onEvent: (e) => {
    if (e.type === 'tool_call') {
      calledTools.push(e.toolCall.name);
      const argsStr = JSON.stringify(e.toolCall.arguments).slice(0, 300);
      console.log(`\n[tool_call ${calledTools.length}] ${e.toolCall.name}(${argsStr}...)`);

      if (e.toolCall.name === 'k3cloud_add_custom_operation') {
        const a = e.toolCall.arguments as { pyBody?: string };
        if (a.pyBody && a.pyBody.trim() !== '') {
          inlineServicePluginUsed = true;
          // Verify base class + event
          if (/AbstractOperationServicePlugIn/.test(a.pyBody)) pyBodyHasServiceBase = true;
          if (/AbstractBillPlugIn|AbstractDynamicFormPlugIn/.test(a.pyBody)) pyBodyHasFormBase = true;
          if (/BeginOperationTransaction|BeforeExecuteOperationTransaction|OnAddValidators|OnPreparePropertys/.test(a.pyBody)) {
            pyBodyHasServiceEvent = true;
          }
          if (/BeforeSave|DataChanged|AfterBindData|AfterButtonClick/.test(a.pyBody)) pyBodyHasFormEvent = true;
        }
      }
      if (e.toolCall.name === 'k3cloud_register_python_plugins') {
        standalonePythonPluginsUsed = true;
      }
    } else if (e.type === 'tool_result') {
      const preview = String(e.content).slice(0, 400);
      console.log(`[tool_result] ${e.isError ? '✗ ERROR' : '✓ ok'} ${preview}`);
    } else if (e.type === 'delta') {
      process.stdout.write(e.content);
    } else if (e.type === 'error') {
      console.log(`\n[ERROR] ${e.error}`);
    }
  },
});

console.log('\n\n=== Final state ===');
console.log('total messages:', finalMessages.length);
console.log('tools called:', calledTools.join(' → '));

console.log('\n=== Verification ===');
const checks = [
  {
    name: 'inline service plugin via add_custom_operation(pyBody=...)',
    pass: inlineServicePluginUsed,
  },
  {
    name: 'NOT routed to register_python_plugins (would land in FormPlugins)',
    pass: !standalonePythonPluginsUsed,
  },
  {
    name: 'pyBody uses AbstractOperationServicePlugIn (not AbstractBillPlugIn)',
    pass: pyBodyHasServiceBase && !pyBodyHasFormBase,
  },
  {
    name: 'pyBody uses service-plugin event (BeginOperationTransaction / OnAddValidators / etc.)',
    pass: pyBodyHasServiceEvent && !pyBodyHasFormEvent,
  },
];
let allPassed = true;
for (const c of checks) {
  console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}`);
  if (!c.pass) allPassed = false;
}

const lastAssistant = finalMessages.filter((m) => m.role === 'assistant').slice(-1)[0];
if (lastAssistant) {
  console.log('\n=== Last assistant message ===');
  console.log(String(lastAssistant.content).slice(0, 1500));
}

await connector.disconnect();
console.log(`\n${allPassed ? '✓ all checks passed' : '✗ some checks failed — agent routing/coding need investigation'}`);
process.exit(allPassed ? 0 : 1);
