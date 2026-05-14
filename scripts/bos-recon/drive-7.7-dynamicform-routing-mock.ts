/**
 * Plan 7.7 — agent loop routing-only test for DynamicForm scenarios.
 *
 * Validates that DeepSeek can route Chinese natural-language requests to
 * `k3cloud_create_from_template` with the correct ModelType=500 templateId,
 * given:
 *   - tool description (create-metaobject-tools.ts) listing DynamicForm templates
 *   - metaobject-creation-index skill catalog (template-catalog.md)
 *
 * Unlike `drive-create-metaobjects-via-agent.ts`, this script does NOT require
 * a running K/3 server — connector.createFromTemplate is stubbed to return
 * isSuccess=true so the agent loop completes without HTTP. Wire correctness
 * is already covered by `tests/erp/create-from-template.test.ts` (wire-replay).
 *
 * 3 scenarios:
 *   1. dynamicform-common-filter   → BOS_CommonFilter
 *   2. dynamicform-wizard          → BOS_WIZARDFORMTPL
 *   3. dynamicform-billtype-param  → BOS_BILLTYPEPARAMODEL
 *
 * Cost: ~$0.005–0.01 per scenario × 3 ≈ $0.015–0.03 total.
 *
 * Usage:
 *   pnpm tsx --tsconfig tsconfig.node.json scripts/bos-recon/drive-7.7-dynamicform-routing-mock.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { ToolRegistry } from '../../src/main/agent/tools';
import { BUILTIN_TOOLS } from '../../src/main/agent/builtin-tools';
import { createFromTemplateTool } from '../../src/main/agent/create-metaobject-tools';
import { buildSkillsContext } from '../../src/main/agent/skills-integration';
import { runAgentLoop } from '../../src/main/agent/loop';
import { createLlmClient } from '../../src/main/llm/factory';
import { erpRulesFragment } from '../../src/main/agent/erp-rules';
import type { Message } from '../../src/shared/llm-types';
import type { Project } from '../../src/shared/erp-types';
import type { K3CloudConnector } from '../../src/main/erp/k3cloud/connector';

// ─── Settings (we use project + deepseek key only, no real server) ───────────

const settingsPath = path.join(os.homedir(), '.opendeploy', 'settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const project: Project =
  settings.projects.find((p: Project) => p.id === settings.activeProjectId) ??
  settings.projects.find((p: Project) => p.bos != null);
if (!project?.bos) {
  console.error('✗ no project with bos creds — even mock needs project context for active-project-tag');
  process.exit(1);
}
const apiKey: string = settings.apiKeys?.deepseek;
if (!apiKey) {
  console.error('✗ no deepseek API key in settings.apiKeys.deepseek');
  process.exit(1);
}

// ─── Mock connector ──────────────────────────────────────────────────────────
// Only `createFromTemplate` is exercised by these scenarios. Other methods
// are not stubbed — if the LLM tries to call them (it shouldn't), the call
// will surface as `(intermediate value).method is not a function`.

const mockConnector = {
  async createFromTemplate(input: {
    templateId: string;
    newFormId: string;
    name: string;
    subSystemId: string;
  }) {
    console.log(
      `  [MOCK createFromTemplate] templateId=${input.templateId} newFormId=${input.newFormId} name="${input.name}"`,
    );
    return {
      isSuccess: true,
      funcResult: true,
      messageTitle: null,
      messageDetail: null,
    };
  },
} as unknown as K3CloudConnector;

// ─── Tool registry ───────────────────────────────────────────────────────────

const registry = new ToolRegistry();
for (const t of BUILTIN_TOOLS) registry.register(t);
registry.register(createFromTemplateTool(mockConnector));

// Skills context — gives LLM access to load_skill/load_skill_file + catalog.
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
console.log(`registered ${registry.definitions().length} tools (mock connector + skills loader)`);
console.log();

// ─── System prompt (same composition as production ipc-llm.ts) ────────────────

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
  expectedDisplayName: RegExp;
}

const SCENARIOS: ScenarioSpec[] = [
  {
    name: 'dynamicform-common-filter',
    userPrompt:
      '帮我建一个动态表单,用作给我们家的销售订单账表挂的"公共过滤面板",名字叫"OD E2E 销售公共过滤"。' +
      '选最合适的 BOS 模板直接建,不用询问确认,建完告诉我 FormID。',
    acceptableTemplateIds: ['BOS_CommonFilter'],
    expectedDisplayName: /过滤|销售/,
  },
  {
    name: 'dynamicform-wizard',
    userPrompt:
      '帮我建一个动态表单,要做成多步骤向导(下一步/上一步那种界面)用,名字叫"OD E2E 数据导入向导"。' +
      '选最合适的 BOS 模板直接建,不用询问确认,建完告诉我 FormID。',
    acceptableTemplateIds: ['BOS_WIZARDFORMTPL'],
    expectedDisplayName: /向导|导入/,
  },
  {
    name: 'dynamicform-billtype-param',
    userPrompt:
      '帮我建一个动态表单,作为"单据类型参数配置对话框"用(给业务单据设参数那种),名字叫"OD E2E 单据类型参数面板"。' +
      '选最合适的 BOS 模板直接建,不用询问确认,建完告诉我 FormID。',
    acceptableTemplateIds: ['BOS_BILLTYPEPARAMODEL'],
    expectedDisplayName: /单据类型|参数/,
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

interface ScenarioResult {
  pass: boolean;
  templateIdUsed: string;
  toolsCalled: string[];
  notes: string[];
}

async function runScenario(sc: ScenarioSpec): Promise<ScenarioResult> {
  const result: ScenarioResult = {
    pass: false,
    templateIdUsed: '',
    toolsCalled: [],
    notes: [],
  };

  const initialMessages: Message[] = [
    {
      id: 'u_test',
      role: 'user',
      content: sc.userPrompt,
      createdAt: new Date().toISOString(),
    },
  ];

  let routedCorrectly = false;
  let displayNameUsed = '';
  let newFormIdValid = false;

  try {
    await runAgentLoop({
      client: createLlmClient('deepseek'),
      tools: registry,
      initialMessages,
      providerId: 'deepseek',
      apiKey,
      model: 'deepseek-v4-flash',
      systemPrompt,
      maxIterations: 15,
      conversationId: `drive_7_7_${sc.name}_${Date.now()}`,
      onEvent: (e) => {
        if (e.type === 'tool_call') {
          result.toolsCalled.push(e.toolCall.name);
          const argsStr = JSON.stringify(e.toolCall.arguments).slice(0, 300);
          console.log(`  [tool_call ${result.toolsCalled.length}] ${e.toolCall.name}(${argsStr}...)`);

          if (e.toolCall.name === 'k3cloud_create_from_template') {
            const a = e.toolCall.arguments as Record<string, unknown>;
            const tid = String(a.templateId ?? '');
            result.templateIdUsed = tid;
            displayNameUsed = String(a.name ?? '');
            const nfid = String(a.newFormId ?? '');
            newFormIdValid = /^k[a-f0-9]{32}$/.test(nfid);

            if (sc.acceptableTemplateIds.includes(tid)) {
              routedCorrectly = true;
            }
          }
        } else if (e.type === 'tool_result') {
          const preview = String(e.content).slice(0, 200);
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
    return result;
  }

  console.log(`\n  tools called: ${result.toolsCalled.join(' → ')}`);

  if (!routedCorrectly) {
    result.notes.push(
      `[ROUTE FAIL] expected templateId in [${sc.acceptableTemplateIds.join('|')}], got "${result.templateIdUsed}"`,
    );
    return result;
  }
  console.log(`  [ROUTE PASS] templateId="${result.templateIdUsed}"`);

  if (!newFormIdValid) {
    result.notes.push('[NEWFORMID FAIL] newFormId does not match k+32hex pattern');
    return result;
  }
  console.log('  [NEWFORMID PASS] format matches k+32hex');

  if (!sc.expectedDisplayName.test(displayNameUsed)) {
    result.notes.push(
      `[NAME WARN] displayName "${displayNameUsed}" doesn't match expected ${sc.expectedDisplayName}; treating as PASS — LLM has latitude`,
    );
  }

  result.pass = true;
  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════════');
console.log('  Plan 7.7 — DynamicForm agent loop routing (mock connector)');
console.log('═══════════════════════════════════════════════════════════════');
console.log();

let totalPass = 0;
let totalFail = 0;
const summary: Array<{ name: string; pass: boolean; notes: string[]; templateIdUsed: string }> = [];

for (const sc of SCENARIOS) {
  console.log(`\n===== Scenario: ${sc.name} =====`);
  console.log(`  User prompt: "${sc.userPrompt.slice(0, 100)}..."`);
  console.log();

  const r = await runScenario(sc);
  if (r.pass) {
    totalPass++;
    console.log(`\n  => PASS (templateId=${r.templateIdUsed})`);
  } else {
    totalFail++;
    console.log(`\n  => FAIL: ${r.notes.join('; ')}`);
  }
  summary.push({ name: sc.name, pass: r.pass, notes: r.notes, templateIdUsed: r.templateIdUsed });
}

console.log('\n\n════════════════════════════════════════════════════');
console.log(`  Summary: ${totalPass} PASS / ${totalFail} FAIL / ${SCENARIOS.length} total`);
console.log('════════════════════════════════════════════════════');
for (const s of summary) {
  const icon = s.pass ? '✓' : '✗';
  const tip = s.pass ? ` (${s.templateIdUsed})` : `: ${s.notes.join('; ')}`;
  console.log(`  ${icon} ${s.name}${tip}`);
}

process.exit(totalFail > 0 ? 1 : 0);
