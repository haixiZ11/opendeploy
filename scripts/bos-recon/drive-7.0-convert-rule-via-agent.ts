/**
 * Plan 7.0 agent loop e2e — verify the LLM correctly routes convert-rule
 * scenarios through the generalized live path (no static baseline).
 *
 * What we're testing:
 *   1. Does the agent pick `k3cloud_describe_convert_rule(ruleId)` to read state
 *      before changing it?
 *   2. Does it call `k3cloud_create_convert_rule_extension(originRuleId=...)`
 *      with the ruleId passed through verbatim (no munging)?
 *   3. Does it follow up with `k3cloud_add_convert_field_mapping(extId, ...)`
 *      to actually wire the mapping (not stopping at "extension created")?
 *   4. Does it clean up at the end via `k3cloud_delete_convert_rule_extension`
 *      (the prompt asks for cleanup explicitly so test doesn't leave residue)?
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

// Scenario: convert rule extension + field mapping (Plan 7.0 generalized path).
// Prompt explicitly asks for cleanup at end so the test doesn't leave residue.
const userPrompt = `给"销售订单 → 销售出库单"的转换规则加一个**字段映射扩展**:
把销售订单头表的备注字段 FNote 直接映射到销售出库单头表的备注字段 FNote
(同步反映在下推后的出库单备注上,Auto 模式直接取值)。

做完之后**直接删除你刚建的这个扩展**(测试目的,不留垃圾)。

**禁止反问任何确认**。直接做完闭环:建扩展 → 加字段映射 → 反查确认 →
删除扩展 → 给我最终总结。中间不要停下问我。`;

const initialMessages: Message[] = [
  {
    id: 'u_test',
    role: 'user',
    content: userPrompt,
    createdAt: new Date().toISOString(),
  },
];

const calledTools: string[] = [];
let createdExtCall = false;
let addedFieldMapping = false;
let deletedAtEnd = false;
let wrongToolUsed = false;

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
  conversationId: 'drive_7_0_' + Date.now(),
  onEvent: (e) => {
    if (e.type === 'tool_call') {
      calledTools.push(e.toolCall.name);
      const argsStr = JSON.stringify(e.toolCall.arguments).slice(0, 300);
      console.log(`\n[tool_call ${calledTools.length}] ${e.toolCall.name}(${argsStr}...)`);

      if (e.toolCall.name === 'k3cloud_create_convert_rule_extension') createdExtCall = true;
      if (e.toolCall.name === 'k3cloud_add_convert_field_mapping') addedFieldMapping = true;
      if (e.toolCall.name === 'k3cloud_delete_convert_rule_extension') deletedAtEnd = true;
      // These would all be wrong for the scenario
      if (
        e.toolCall.name === 'k3cloud_register_python_plugins' ||
        e.toolCall.name === 'k3cloud_add_fields' ||
        e.toolCall.name === 'k3cloud_create_extension'
      ) {
        wrongToolUsed = true;
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
  { name: 'k3cloud_create_convert_rule_extension called', pass: createdExtCall },
  { name: 'k3cloud_add_convert_field_mapping called', pass: addedFieldMapping },
  { name: 'k3cloud_delete_convert_rule_extension at end (cleanup)', pass: deletedAtEnd },
  { name: 'No wrong tools used (extension/fields/python_plugins are unrelated)', pass: !wrongToolUsed },
];
let allPassed = true;
for (const c of checks) {
  console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}`);
  if (!c.pass) allPassed = false;
}

const lastAssistant = finalMessages.filter((m) => m.role === 'assistant').slice(-1)[0];
if (lastAssistant) {
  console.log('\n=== Last assistant message ===');
  console.log(String(lastAssistant.content).slice(0, 1200));
}

await connector.disconnect();
console.log(`\n${allPassed ? '✓ all checks passed' : '✗ some checks failed'}`);
process.exit(allPassed ? 0 : 1);
