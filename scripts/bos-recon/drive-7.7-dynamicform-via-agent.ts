/**
 * Plan 7.7 — agent loop e2e (REAL K/3 server) for DynamicForm scenarios.
 *
 * Mirrors `drive-create-metaobjects-via-agent.ts` (Plan 7.6) but covers only
 * the 3 new DynamicForm (ModelType=500) routing scenarios. Run separately so
 * we don't re-spend on the already-validated 7.6 four scenarios.
 *
 * 3 scenarios:
 *   1. dynamicform-common-filter      → BOS_CommonFilter
 *   2. dynamicform-wizard             → BOS_WIZARDFORMTPL
 *   3. dynamicform-billtype-param     → BOS_BILLTYPEPARAMODEL
 *
 * Each scenario:
 *   1. DeepSeek receives Chinese user prompt + tool catalog
 *   2. LLM must route to k3cloud_create_from_template with correct templateId
 *   3. Tool executes against real K/3 (creates sandbox extension)
 *   4. Readback verifies oid in FKERNELXML
 *   5. Cleanup (finally) deletes extension regardless of outcome
 *
 * Cost: ~$0.005 / scenario × 3 ≈ $0.015 total.
 *
 * Usage:
 *   pnpm tsx --tsconfig tsconfig.node.json scripts/bos-recon/drive-7.7-dynamicform-via-agent.ts
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
import { login } from '../../src/main/erp/k3cloud/rpc/login';
import { deleteExtension } from '../../src/main/erp/k3cloud/rpc/delete-extension';
import { getBusinessObjectMetaData } from '../../src/main/erp/k3cloud/rpc/metadata';
import { extractKernelXml } from '../../src/main/erp/k3cloud/rpc/metadata-xml';
import { getExpectedReadbackOid } from '../../src/main/erp/k3cloud/rpc/create-from-template';
import { buildSkillsContext } from '../../src/main/agent/skills-integration';
import type { Message } from '../../src/shared/llm-types';
import type { Project } from '../../src/shared/erp-types';

// ─── Init ────────────────────────────────────────────────────────────────────

setBundledConvertRuleTemplate(
  fs.readFileSync(
    path.resolve('src/main/erp/k3cloud/rpc/baselines/convert-rule-extension-template.xml'),
    'utf-8',
  ),
);

const settingsPath = path.join(os.homedir(), '.opendeploy', 'settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const project: Project =
  settings.projects.find((p: Project) => p.id === settings.activeProjectId) ??
  settings.projects.find((p: Project) => p.bos != null);
if (!project?.bos) {
  console.error('✗ no active project with bos creds. Configure via app first.');
  process.exit(1);
}
const apiKey: string = settings.apiKeys?.deepseek;
if (!apiKey) {
  console.error('✗ no deepseek API key in settings.apiKeys.deepseek');
  process.exit(1);
}

// ─── Connector ───────────────────────────────────────────────────────────────

console.log('=== Connecting to K/3 Cloud ===');
const connector = new K3CloudConnector(project.bos, project.id);
await connector.connect();
console.log('✓ connected to', project.bos.baseUrl);
console.log();

const loginResult = await login({
  baseUrl: project.bos.baseUrl,
  acctId: project.bos.acctId,
  username: project.bos.username,
  password: project.bos.password,
  lcid: 2052,
});
if (!loginResult.isSuccess || !loginResult.session) {
  console.error('✗ login failed for cleanup session:', loginResult.message);
  process.exit(1);
}
const cleanupSession = loginResult.session;
const isvForDelete = {
  devCode: project.bos.devCode,
  name: project.bos.devCode,
  isvSignal: 'Kingdee' as const,
  packageSignal: '',
  id: project.bos.devCode,
};

// ─── ToolRegistry (with skills) ───────────────────────────────────────────────

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

const skillsCatalogIntro = fs.readFileSync(
  path.join(process.cwd(), 'src', 'main', 'agent', 'prompts', 'skills-catalog-intro.md'),
  'utf8',
);
const skillsCtx = await buildSkillsContext({
  activeErpProvider: 'k3cloud',
  catalogIntro: skillsCatalogIntro,
});
registry.register(skillsCtx.loadSkillTool);
registry.register(skillsCtx.loadSkillFileTool);
console.log(`registered ${registry.definitions().length} tools`);
console.log();

// ─── System prompt ────────────────────────────────────────────────────────────

const PROMPTS_DIR = path.join(process.cwd(), 'src', 'main', 'agent', 'prompts');
const baseSystemPrompt = fs.readFileSync(path.join(PROMPTS_DIR, 'base-system.md'), 'utf8').trim();
const k3cloudRules = fs.readFileSync(path.join(PROMPTS_DIR, 'erp-rules', 'k3cloud.md'), 'utf8').trim();
const projectTagTpl = fs.readFileSync(path.join(PROMPTS_DIR, 'active-project-tag.md'), 'utf8').trim();

const projectTag = projectTagTpl
  .replace('{{acctId}}', project.bos.acctId)
  .replace('{{baseUrl}}', project.bos.baseUrl)
  .replace('{{productName}}', '金蝶云星空 企业版/标准版');
const erpRules = erpRulesFragment('k3cloud', { k3cloud: k3cloudRules });
const systemPrompt = [baseSystemPrompt, erpRules, projectTag, skillsCtx.systemPromptFragment]
  .filter((s) => s && s.trim() !== '')
  .join('\n\n');

// ─── Scenarios ───────────────────────────────────────────────────────────────

interface ScenarioSpec {
  name: string;
  userPrompt: string;
  acceptableTemplateIds: string[];
}

const SCENARIOS: ScenarioSpec[] = [
  {
    name: 'dynamicform-common-filter',
    userPrompt:
      '帮我建一个动态表单,用作给我们家的销售订单账表挂的"公共过滤面板",名字叫"OD E2E 销售公共过滤"。' +
      '选最合适的 BOS 模板直接建,不用询问确认,建完告诉我 FormID。',
    acceptableTemplateIds: ['BOS_CommonFilter'],
  },
  {
    name: 'dynamicform-wizard',
    userPrompt:
      '帮我建一个动态表单,要做成多步骤向导(下一步/上一步那种界面)用,名字叫"OD E2E 数据导入向导"。' +
      '选最合适的 BOS 模板直接建,不用询问确认,建完告诉我 FormID。',
    acceptableTemplateIds: ['BOS_WIZARDFORMTPL'],
  },
  {
    name: 'dynamicform-billtype-param',
    userPrompt:
      '帮我建一个动态表单,作为"单据类型参数配置对话框"用(给业务单据设参数那种),名字叫"OD E2E 单据类型参数面板"。' +
      '选最合适的 BOS 模板直接建,不用询问确认,建完告诉我 FormID。',
    acceptableTemplateIds: ['BOS_BILLTYPEPARAMODEL'],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function tryDeleteFormId(formId: string): Promise<void> {
  try {
    const r = await deleteExtension(cleanupSession, formId, isvForDelete);
    if (r.ok) {
      console.log(`  [CLEANUP] deleted ${formId}`);
    } else {
      console.warn(`  [CLEANUP WARN] delete not-ok: ${r.message ?? r.responseBody}`);
    }
  } catch (e) {
    console.warn(
      `  [CLEANUP FAILED] ${formId}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function readbackHasOid(formId: string, expectedOid: string): Promise<boolean> {
  try {
    const session = connector.getSession();
    if (!session) return false;
    const md = await getBusinessObjectMetaData(session, formId, []);
    const xml = extractKernelXml(md.metaData) ?? '';
    const escapedOid = expectedOid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`oid="${escapedOid}"`).test(xml);
  } catch {
    return false;
  }
}

// ─── Runner ──────────────────────────────────────────────────────────────────

interface ScenarioResult {
  pass: boolean;
  createdFormIds: string[];
  notes: string[];
}

async function runScenario(sc: ScenarioSpec): Promise<ScenarioResult> {
  const result: ScenarioResult = { pass: false, createdFormIds: [], notes: [] };
  const calledTools: string[] = [];
  let routedCorrectly = false;
  let templateIdUsed = '';

  const initialMessages: Message[] = [
    {
      id: 'u_test',
      role: 'user',
      content: sc.userPrompt,
      createdAt: new Date().toISOString(),
    },
  ];

  try {
    await runAgentLoop({
      client: createLlmClient('deepseek'),
      tools: registry,
      initialMessages,
      providerId: 'deepseek',
      apiKey,
      model: 'deepseek-v4-flash',
      systemPrompt,
      maxIterations: 20,
      conversationId: `drive_7_7_${sc.name}_${Date.now()}`,
      onEvent: (e) => {
        if (e.type === 'tool_call') {
          calledTools.push(e.toolCall.name);
          const argsStr = JSON.stringify(e.toolCall.arguments).slice(0, 300);
          console.log(`  [tool_call ${calledTools.length}] ${e.toolCall.name}(${argsStr}...)`);

          if (e.toolCall.name === 'k3cloud_create_from_template') {
            const a = e.toolCall.arguments as Record<string, unknown>;
            const tid = String(a.templateId ?? '');
            templateIdUsed = tid;
            if (sc.acceptableTemplateIds.includes(tid)) {
              routedCorrectly = true;
            }
            const nfid = String(a.newFormId ?? '');
            if (nfid && /^k[a-f0-9]{32}$/.test(nfid)) {
              if (!result.createdFormIds.includes(nfid)) {
                result.createdFormIds.push(nfid);
              }
            }
          }
        } else if (e.type === 'tool_result') {
          const preview = String(e.content).slice(0, 300);
          console.log(`  [tool_result] ${e.isError ? '✗ ERROR' : '✓ ok'} ${preview}`);
        } else if (e.type === 'delta') {
          process.stdout.write(e.content);
        } else if (e.type === 'error') {
          console.log(`\n  [ERROR] ${e.error}`);
        }
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  [AGENT ERROR] ${msg}`);
    result.notes.push(`agent loop threw: ${msg}`);
  }

  console.log(`\n  tools called: ${calledTools.join(' → ')}`);

  if (!routedCorrectly) {
    result.notes.push(
      `[ROUTE FAIL] expected templateId in [${sc.acceptableTemplateIds.join('|')}], got "${templateIdUsed}"`,
    );
    return result;
  }
  console.log(`  [ROUTE PASS] templateId="${templateIdUsed}"`);

  if (result.createdFormIds.length === 0) {
    result.notes.push('[EXEC FAIL] no valid newFormId captured');
    return result;
  }

  const formId = result.createdFormIds[result.createdFormIds.length - 1];
  console.log(`  [EXEC] formId=${formId} (last of ${result.createdFormIds.length} attempt(s))`);

  const expectedOid = getExpectedReadbackOid(templateIdUsed);
  const hasOid = await readbackHasOid(formId, expectedOid);
  if (!hasOid) {
    result.notes.push(
      `[READBACK FAIL] oid="${expectedOid}" not found in FKERNELXML for ${formId}`,
    );
    return result;
  }
  console.log(`  [READBACK PASS] oid="${expectedOid}" found in FKERNELXML`);

  result.pass = true;
  result.notes.push(`PASS templateId=${templateIdUsed} formId=${formId}`);
  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════════');
console.log('  Plan 7.7 — DynamicForm agent loop e2e (REAL K/3 server)');
console.log('═══════════════════════════════════════════════════════════════');
console.log();

let totalPass = 0;
let totalFail = 0;
const summary: Array<{ name: string; pass: boolean; notes: string[] }> = [];

for (const sc of SCENARIOS) {
  console.log(`\n===== Scenario: ${sc.name} =====`);
  console.log(`  User prompt: "${sc.userPrompt.slice(0, 100)}..."`);
  console.log();

  let scenarioResult: ScenarioResult = { pass: false, createdFormIds: [], notes: [] };
  try {
    scenarioResult = await runScenario(sc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [SCENARIO FATAL] ${msg}`);
    scenarioResult.notes.push(`scenario threw: ${msg}`);
  } finally {
    for (const fid of scenarioResult.createdFormIds) {
      await tryDeleteFormId(fid);
    }
  }

  if (scenarioResult.pass) {
    totalPass++;
    console.log(`\n  => PASS`);
  } else {
    totalFail++;
    console.log(`\n  => FAIL: ${scenarioResult.notes.join('; ')}`);
  }
  summary.push({ name: sc.name, pass: scenarioResult.pass, notes: scenarioResult.notes });
}

console.log('\n\n════════════════════════════════════════════════════');
console.log(`  Summary: ${totalPass} PASS / ${totalFail} FAIL / ${SCENARIOS.length} total`);
console.log('════════════════════════════════════════════════════');
for (const s of summary) {
  const icon = s.pass ? '✓' : '✗';
  console.log(`  ${icon} ${s.name}${s.pass ? '' : ': ' + s.notes.join('; ')}`);
}

await connector.disconnect();
process.exit(totalFail > 0 ? 1 : 0);
