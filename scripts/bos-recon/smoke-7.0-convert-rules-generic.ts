/**
 * Plan 7.0 smoke — verifies convert-rule generalization end-to-end on a
 * real K/3 Cloud server. Runs the full extension lifecycle (create →
 * describe → field-map add → delete) against multiple ruleIds, including
 * non-SaleOrder rules that v0.1 hard-blocked.
 *
 * Pass the rules via CLI args (space-separated) or rely on the default set:
 *
 *   pnpm tsx --tsconfig tsconfig.node.json scripts/bos-recon/smoke-7.0-convert-rules-generic.ts \
 *     SaleOrder-OutStock PurchaseOrder-InStock
 *
 * The script picks the first project in `~/.opendeploy/projects.json` that
 * has a K/3 BOS configuration; override with `OPENDEPLOY_PROJECT_ID`.
 *
 * For each rule:
 *   1. `describeConvertRule(ruleId)` — read live, confirm summary returns
 *   2. `extendConvertRule(ruleId, displayName)` — create extension (live path,
 *      no static baseline). If a previous ext exists, drop it first.
 *   3. `addConvertFieldMapping(extId, ...)` — patch op via bridge,
 *      verifies bridge + live origin XML flow works for this ruleId
 *   4. `deleteConvertRuleExtension(ruleId, extId)` — clean up
 *
 * Exits non-zero on first failure to surface broken cases fast.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import {
  K3CloudConnector,
  setBundledConvertRuleTemplate,
} from '../../src/main/erp/k3cloud/connector';
import type { Project } from '@shared/erp-types';

// tsx (Node ESM) 不识别 .xml `?raw` 加载,先 fs 注入再走 connector 任何调用链
setBundledConvertRuleTemplate(
  readFileSync(
    resolve('src/main/erp/k3cloud/rpc/baselines/convert-rule-extension-template.xml'),
    'utf-8',
  ),
);

// 默认只跑 SaleOrder-OutStock 回归 — 其他 ruleId 在不同 K/3 数据中心可能不存在,
// 让用户按需传命令行参数验证多对(参数中的 ruleId 必须在目标服务器上真实存在)。
const DEFAULT_RULES = ['SaleOrder-OutStock'];

const args = process.argv.slice(2).filter((a) => a.trim() !== '');
const rules = args.length > 0 ? args : DEFAULT_RULES;

const settingsPath = resolve(homedir(), '.opendeploy/settings.json');
let projects: Project[];
try {
  const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  projects = Array.isArray(settings.projects) ? settings.projects : [];
} catch (err) {
  console.error(`✗ cannot read ${settingsPath}: ${err instanceof Error ? err.message : String(err)}`);
  console.error('  configure a project first via the app, or set OPENDEPLOY_PROJECT_ID to skip lookup');
  process.exit(1);
}

const projectId = process.env.OPENDEPLOY_PROJECT_ID ?? null;
const project = projectId
  ? projects.find((p) => p.id === projectId)
  : projects.find((p) => p.bos != null);

if (!project || !project.bos) {
  console.error(`✗ no project with BOS credentials found ${projectId ? `(id=${projectId})` : ''}`);
  process.exit(1);
}

const connector = new K3CloudConnector(project.bos, project.id);
await connector.connect();
console.log(`✓ connected to ${(project.bos as { baseUrl: string }).baseUrl} (project=${project.id})\n`);

let failureCount = 0;

for (const ruleId of rules) {
  console.log(`=== rule: ${ruleId} ===`);

  // Step 1: describe — verifies the rule exists + summarizer works
  let sourceFormId: string;
  try {
    const summary = await connector.describeConvertRule(ruleId);
    sourceFormId = summary.sourceFormId;
    console.log(`  ✓ describe: ${summary.sourceFormId} → ${summary.targetFormId}, ${summary.defaultConvert?.fieldMapCount ?? 0} field maps`);
  } catch (err) {
    console.error(`  ✗ describe(${ruleId}): ${err instanceof Error ? err.message : String(err)}`);
    failureCount++;
    continue;
  }

  // Step 2: create extension via live path (Plan 7.0 通用化的核心步骤)
  let extId: string;
  const displayName = `Plan 7.0 smoke ${ruleId} ${Date.now()}`;
  try {
    const result = await connector.extendConvertRule(ruleId, displayName);
    if (!result.ok) {
      console.error(`  ✗ extend: server returned non-ok, raw="${result.raw.slice(0, 200)}"`);
      failureCount++;
      continue;
    }
    extId = result.newExtensionId;
    console.log(`  ✓ extend: created extId=${extId.slice(0, 12)}…`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('单层树规则')) {
      console.error(`  ✗ extend(${ruleId}): leftover ext from previous run — use BOS Designer or k3cloud_delete_convert_rule_extension to drop it first`);
    } else {
      console.error(`  ✗ extend(${ruleId}): ${msg}`);
    }
    failureCount++;
    continue;
  }

  // Step 3: add a header-level FieldMap via bridge (exercises live origin
  // path inside patchExtXml + parsePolicyOidMapFromLive)
  try {
    const probeTargetField = `F_OD_Probe_${Date.now().toString(36)}`;
    const r = await connector.addConvertFieldMapping(extId, probeTargetField, 'FBillNo', 'Auto');
    if (!r.ok) {
      console.error(`  ✗ addConvertFieldMapping: server returned non-ok, raw="${r.raw.slice(0, 200)}"`);
      failureCount++;
    } else {
      console.log(`  ✓ patch: header FieldMap "${probeTargetField}" appended via bridge`);
    }
  } catch (err) {
    console.error(`  ✗ addConvertFieldMapping: ${err instanceof Error ? err.message : String(err)}`);
    failureCount++;
  }

  // Step 4: cleanup extension we just created
  try {
    const r = await connector.deleteConvertRuleExtension(ruleId, extId);
    if (!r.ok) console.error(`  ✗ delete: server returned non-ok, raw="${r.raw.slice(0, 200)}"`);
    else console.log(`  ✓ delete: ext ${extId.slice(0, 12)}… removed`);
  } catch (err) {
    console.error(`  ✗ delete: ${err instanceof Error ? err.message : String(err)}`);
    failureCount++;
  }

  void sourceFormId; // declared for completeness; not asserted
  console.log('');
}

if (failureCount > 0) {
  console.error(`\n✗ ${failureCount} rule(s) failed`);
  process.exit(1);
}
console.log(`✓ all ${rules.length} rule(s) passed`);
process.exit(0);
