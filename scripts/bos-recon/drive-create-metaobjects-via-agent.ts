/**
 * Plan 7.6 Task 8 — agent loop e2e: DeepSeek 自驱 4 场景
 *
 * 验证 LLM 从中文自然语言正确路由到:
 *   - k3cloud_create_from_template（模板 ID 选择）
 *   - k3cloud_register_sysreport_python_plugins（账表挂插件，场景 4 链式调用）
 *
 * 4 个场景:
 *   1. create-billform-with-entry       — BOS_BillWithEntryModel (or BOS_BuinessBillWithEntryModel)
 *   2. create-basedata-org-control      — BOS_OrgControlBDModel
 *   3. create-simple-report             — BOS_SimpleSysReport
 *   4. create-paged-report-with-plugin  — BOS_MoveSysReport + register_sysreport_python_plugins
 *
 * 每个场景:
 *   1. 发自然语言 user prompt 给 DeepSeek agent loop
 *   2. 拦截 tool_call 验证路由正确（templateId 合规 + 工具名正确）
 *   3. 让 tool 真实执行打到 K/3 server（创建真实对象）
 *   4. Readback 验证 oid 存在
 *   5. Cleanup（finally block 必跑）
 *
 * 费用估算: ~$0.005–0.01 / 场景, 4 场景合计 ~$0.02–0.04
 *
 * Usage:
 *   pnpm tsx --tsconfig tsconfig.node.json scripts/bos-recon/drive-create-metaobjects-via-agent.ts
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
import type { Message } from '../../src/shared/llm-types';
import type { Project } from '../../src/shared/erp-types';

// ─── Initialise ──────────────────────────────────────────────────────────────

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

// ─── K/3 Cloud connector ─────────────────────────────────────────────────────

console.log('=== Connecting to K/3 Cloud ===');
const connector = new K3CloudConnector(project.bos, project.id);
await connector.connect();
console.log('✓ connected to', project.bos.baseUrl);
console.log();

// Login once for cleanup calls (uses same session as connector but we need
// the raw KdSession for deleteExtension RPC)
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

// ─── ToolRegistry ─────────────────────────────────────────────────────────────

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
const systemPrompt = [baseSystemPrompt, erpRules, projectTag]
  .filter((s) => s && s.trim() !== '')
  .join('\n\n');

// ─── Scenario definitions ─────────────────────────────────────────────────────

interface ScenarioSpec {
  name: string;
  userPrompt: string;
  /** Primary tool that must be called */
  expectedTool: string;
  /** Acceptable templateId values for the primary tool */
  acceptableTemplateIds: string[];
  /** Display-name regex sanity check */
  expectedDisplayName: RegExp;
  /** Additional required tool (for chained scenario 4) */
  extraRequiredTool?: string;
  /** className that must appear in pyBody / as argument */
  expectedClassName?: string;
}

const SCENARIOS: ScenarioSpec[] = [
  {
    name: 'create-billform-with-entry',
    userPrompt:
      '帮我建一个销售订单类型的单据,带订单明细行。名字叫"OD E2E 测试销售单"。' +
      '不用反问,不用询问确认,选最常见模板直接建,建完告诉我新对象的 FormID。',
    expectedTool: 'k3cloud_create_from_template',
    acceptableTemplateIds: ['BOS_BillWithEntryModel', 'BOS_BuinessBillWithEntryModel'],
    expectedDisplayName: /销售|测试/,
  },
  {
    name: 'create-basedata-org-control',
    userPrompt:
      '帮我建一个客户档案基础资料,要按组织隔离。名字叫"OD E2E 测试客户档案"。' +
      '选最合适的 BOS 模板直接建,建完告诉我 FormID,不用询问。',
    expectedTool: 'k3cloud_create_from_template',
    acceptableTemplateIds: ['BOS_OrgControlBDModel'],
    expectedDisplayName: /客户|档案/,
  },
  {
    name: 'create-simple-report',
    userPrompt:
      '帮我建一个简单的台账查询账表,名字叫"OD E2E 简单账表"。' +
      '选适合单表查询的最简单 BOS 模板,直接建,不用反问,不用询问确认,建完告诉我 FormID。',
    expectedTool: 'k3cloud_create_from_template',
    acceptableTemplateIds: ['BOS_SimpleSysReport'],
    expectedDisplayName: /账表|查询/,
  },
  {
    name: 'create-paged-report-with-plugin',
    userPrompt:
      '我要建一个数据量大需要分页的账表(名字"OD E2E 分页账表"),建完后挂一个 Python 服务端插件' +
      '类 SmokeReportPlugin(继承 AbstractSysReportServicePlugIn,只做 OnPreparePropertys 空实现)。' +
      '选适合分页查询的 BOS 模板,两步都做完再给我总结,中间不要停下问我。',
    expectedTool: 'k3cloud_create_from_template',
    acceptableTemplateIds: ['BOS_MoveSysReport'],
    expectedDisplayName: /账表|分页/,
    extraRequiredTool: 'k3cloud_register_sysreport_python_plugins',
    expectedClassName: 'SmokeReportPlugin',
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

// ─── Run one scenario ─────────────────────────────────────────────────────────

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
  let extraToolCalled = false;
  let classNameUsed = '';

  // ── Agent loop ────────────────────────────────────────────────────────────
  const initialMessages: Message[] = [
    {
      id: 'u_test',
      role: 'user',
      content: sc.userPrompt,
      createdAt: new Date().toISOString(),
    },
  ];

  let agentError: Error | null = null;
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
      conversationId: `drive_7_6_${sc.name}_${Date.now()}`,
      onEvent: (e) => {
        if (e.type === 'tool_call') {
          calledTools.push(e.toolCall.name);
          const argsStr = JSON.stringify(e.toolCall.arguments).slice(0, 400);
          console.log(`  [tool_call ${calledTools.length}] ${e.toolCall.name}(${argsStr}...)`);

          if (e.toolCall.name === sc.expectedTool) {
            const a = e.toolCall.arguments as Record<string, unknown>;
            const tid = String(a.templateId ?? '');
            templateIdUsed = tid;

            if (sc.acceptableTemplateIds.includes(tid)) {
              routedCorrectly = true;
            }

            // Capture newFormId for cleanup/readback
            const nfid = String(a.newFormId ?? '');
            if (nfid && /^k[a-f0-9]{32}$/.test(nfid)) {
              if (!result.createdFormIds.includes(nfid)) {
                result.createdFormIds.push(nfid);
              }
            }
          }

          if (sc.extraRequiredTool && e.toolCall.name === sc.extraRequiredTool) {
            extraToolCalled = true;
            const a = e.toolCall.arguments as Record<string, unknown>;
            classNameUsed = String(a.className ?? '');
          }
        } else if (e.type === 'tool_result') {
          const preview = String(e.content).slice(0, 500);
          console.log(`  [tool_result] ${e.isError ? '✗ ERROR' : '✓ ok'} ${preview}`);
        } else if (e.type === 'delta') {
          process.stdout.write(e.content);
        } else if (e.type === 'error') {
          console.log(`\n  [ERROR] ${e.error}`);
        }
      },
    });
  } catch (err) {
    agentError = err instanceof Error ? err : new Error(String(err));
    console.error(`  [AGENT ERROR] ${agentError.message}`);
    result.notes.push(`agent loop threw: ${agentError.message}`);
  }

  console.log(`\n  tools called: ${calledTools.join(' → ')}`);

  // ── Route check ───────────────────────────────────────────────────────────
  if (!routedCorrectly) {
    const acceptable = sc.acceptableTemplateIds.join(' | ');
    result.notes.push(
      `[ROUTE FAIL] expected ${sc.expectedTool} with templateId in [${acceptable}], got templateIdUsed="${templateIdUsed}", tools=${calledTools.join(',')}`,
    );
    console.log(
      `  [ROUTE FAIL] expected tool=${sc.expectedTool} templateId in [${acceptable}]`,
    );
    console.log(`    actual tools: ${calledTools.join(', ')}`);
    console.log(`    actual templateId: ${templateIdUsed || '(none)'}`);
    return result;
  }
  console.log(
    `  [ROUTE PASS] selected ${sc.expectedTool} with templateId="${templateIdUsed}"`,
  );

  // ── Extra tool check (scenario 4) ─────────────────────────────────────────
  if (sc.extraRequiredTool) {
    if (!extraToolCalled) {
      result.notes.push(
        `[EXTRA TOOL FAIL] expected ${sc.extraRequiredTool} to be called, but it wasn't.`,
      );
      console.log(
        `  [EXTRA TOOL FAIL] expected ${sc.extraRequiredTool}, tools=${calledTools.join(',')}`,
      );
      return result;
    }
    if (sc.expectedClassName && classNameUsed !== sc.expectedClassName) {
      result.notes.push(
        `[CLASSNAME FAIL] expected className="${sc.expectedClassName}", got "${classNameUsed}"`,
      );
      console.log(
        `  [CLASSNAME WARN] className="${classNameUsed}" (expected "${sc.expectedClassName}") — treating as PASS if substring`,
      );
      // Treat as pass if substring match (LLM may prefix)
      if (!classNameUsed.includes(sc.expectedClassName)) {
        return result;
      }
    }
    console.log(`  [EXTRA TOOL PASS] ${sc.extraRequiredTool} called with className="${classNameUsed}"`);
  }

  // ── Readback ──────────────────────────────────────────────────────────────
  // Use the LAST captured formId — if the first create attempt was rejected
  // by the server (ID conflict), the LLM will retry with a new formId. The
  // final formId in the list is the one that actually got created.
  if (result.createdFormIds.length === 0) {
    result.notes.push('[EXEC FAIL] no valid newFormId captured from tool_calls');
    console.log('  [EXEC FAIL] no valid newFormId captured from tool_calls');
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
    console.log(`  [READBACK FAIL] oid="${expectedOid}" not found in FKERNELXML`);
    return result;
  }
  console.log(`  [READBACK PASS] oid="${expectedOid}" found in FKERNELXML`);

  result.pass = true;
  result.notes.push(`PASS templateId=${templateIdUsed} formId=${formId}`);
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════════');
console.log('  Plan 7.6 Task 8 — agent loop e2e: create metaobjects (4 scenarios)');
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
    // Always cleanup — even on failure
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

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n\n════════════════════════════════════════════════════');
console.log(`  Summary: ${totalPass} PASS / ${totalFail} FAIL / ${SCENARIOS.length} total`);
console.log('════════════════════════════════════════════════════');
for (const s of summary) {
  const icon = s.pass ? '✓' : '✗';
  console.log(`  ${icon} ${s.name}${s.pass ? '' : ': ' + s.notes.join('; ')}`);
}

await connector.disconnect();
process.exit(totalFail > 0 ? 1 : 0);
