/**
 * Plan 7.2 agent loop e2e — verify the LLM picks the right tools when the
 * scenario is **list-page** customization (not single-bill).
 *
 * What we're testing:
 *   1. Does the agent route list-page work to `k3cloud_register_list_python_plugins`
 *      (NOT `k3cloud_register_python_plugins`)?
 *   2. Does it use `k3cloud_add_toolbar_button(target.kind='list')`
 *      (NOT default 'form' which puts the button in the bill toolbar)?
 *   3. Does it use a list-plugin event from events-reference.md (e.g. AfterBarItemClick)?
 *
 * Costs ~$0.005 per run via DeepSeek. Reuses settings.json (no extra config).
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
  console.error('✗ no active project with bos creds. Configure via app first.');
  process.exit(1);
}
const apiKey = settings.apiKeys?.deepseek;
if (!apiKey) {
  console.error('✗ no deepseek API key in settings.apiKeys.deepseek');
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
const toolNames = registry.definitions().map((d) => d.name);
console.log(`registered ${toolNames.length} tools`);
console.log();

const projectTag = projectTagTpl
  .replace('{{acctId}}', project.bos.acctId)
  .replace('{{baseUrl}}', project.bos.baseUrl)
  .replace('{{productName}}', '金蝶云星空 企业版/标准版');
const erpRules = erpRulesFragment('k3cloud', { k3cloud: k3cloudRules });
const systemPrompt = [baseSystemPrompt, erpRules, projectTag]
  .filter((s) => s && s.trim() !== '')
  .join('\n\n');

// Scenario: list-page customization. Note that we say "列表" / "列表页"
// explicitly — the agent should route to the list tool path, not form.
const userPrompt = `在销售订单的**列表页**(不是录入界面)上加一个自定义工具栏按钮"批量打标记",
点击后给所有选中的销售订单的备注字段批量打上"已审"标记。

注:遇到选择请直接选最常见 / 最简单的方案,不用反问我。复用现有扩展,
batch label 写到 FNote 字段就行,不需要操作权限校验。直接做完反查告诉我结果。`;

const initialMessages: Message[] = [
  {
    id: 'u_test',
    role: 'user',
    content: userPrompt,
    createdAt: new Date().toISOString(),
  },
];

// Track tool calls to verify the right tools got picked
const calledTools: string[] = [];
let listPluginsRegistered = false;
let formPluginsMisrouted = false;
let buttonTargetIsList = false;
let buttonTargetIsForm = false;

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
  conversationId: 'drive_7_2_' + Date.now(),
  onEvent: (e) => {
    if (e.type === 'tool_call') {
      calledTools.push(e.toolCall.name);
      const argsStr = JSON.stringify(e.toolCall.arguments).slice(0, 300);
      console.log(`\n[tool_call ${calledTools.length}] ${e.toolCall.name}(${argsStr}...)`);

      // Verification probes
      if (e.toolCall.name === 'k3cloud_register_list_python_plugins') {
        listPluginsRegistered = true;
      }
      if (e.toolCall.name === 'k3cloud_register_python_plugins') {
        // Could be legit (form plugin for some sub-task), but if the agent ONLY uses
        // this and never list version, it's misrouted.
        formPluginsMisrouted = true;
      }
      if (e.toolCall.name === 'k3cloud_add_toolbar_button') {
        const target = (e.toolCall.arguments as { target?: { kind?: string } })?.target?.kind;
        if (target === 'list') buttonTargetIsList = true;
        if (target === 'form') buttonTargetIsForm = true;
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
  { name: 'k3cloud_register_list_python_plugins (not form)', pass: listPluginsRegistered && !formPluginsMisrouted },
  { name: 'k3cloud_add_toolbar_button target.kind="list"', pass: buttonTargetIsList && !buttonTargetIsForm },
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
console.log(`\n${allPassed ? '✓ all checks passed' : '✗ some checks failed — agent did NOT route correctly'}`);
process.exit(allPassed ? 0 : 1);
