/**
 * List ALL BOS template objects via getObjectTypes(onlyTemplate=true).
 * Plan 7.6 paradigm shift: "新建账表/单据/基础资料" = 继承模板, not zero-state creation.
 * Need full template ID dictionary keyed by ModelType (100/400/500/900).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { login } from '../../src/main/erp/k3cloud/rpc/login';
import { getObjectTypes } from '../../src/main/erp/k3cloud/rpc/metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = process.env.K3_BASE_URL ?? 'http://localhost/K3Cloud/';
const acctId = process.env.K3_ACCT_ID ?? '69a531ee82525a';
const username = process.env.K3_USERNAME ?? 'administrator';
const password = process.env.K3_PASSWORD ?? '1qaz@WSX';
const devCode = process.env.K3_DEVCODE ?? 'PAIJ';

const OUT = path.resolve(__dirname, '../../.scratch/captures/bos-templates.json');

const MODEL_TYPE_LABEL: Record<number, string> = {
  100: 'KdBillForm (单据)',
  400: 'KdBaseForm (基础资料)',
  500: 'KdDynamicForm (动态表单)',
  900: 'KdReportForm (账表)',
};

async function main() {
  const { session } = await login({ baseUrl, acctId, username, password, devCode, lcid: 2052 });
  if (!session) throw new Error('login failed');

  // Try multiple filter combinations to find templates
  // Note: onlyTemplate=true is broken on this server (FIsTempalte column missing)
  const attempts: Array<{ label: string; opts: any }> = [
    { label: 'modelTypes=[900] (reports)', opts: { modelTypeIds: [900] } },
    { label: 'modelTypes=[100] (bills)', opts: { modelTypeIds: [100] } },
    { label: 'modelTypes=[400] (basedata)', opts: { modelTypeIds: [400] } },
    { label: 'modelTypes=[500] (dynamic)', opts: { modelTypeIds: [500] } },
  ];

  let all: Awaited<ReturnType<typeof getObjectTypes>> = [];
  for (const att of attempts) {
    try {
      const r = await getObjectTypes(session, att.opts);
      console.log(`[${att.label}] → ${r.length} rows`);
      // Look for BOS_* (template-like) prefix
      const templates = r.filter(o => /^BOS_/.test(o.id));
      console.log(`    └─ ${templates.length} BOS_* (template candidates)`);
      all.push(...r);
    } catch (e) {
      console.log(`[${att.label}] ERROR: ${(e as Error).message.slice(0, 80)}`);
    }
  }
  // de-dup
  const seen = new Set<string>();
  all = all.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
  console.log(`\nTotal unique: ${all.length} objects\n`);
  if (all.length === 0) return;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(all, null, 2), 'utf8');
  console.log(`Full dump → ${OUT}\n`);

  const byModel = new Map<number, typeof all>();
  for (const t of all) {
    if (!byModel.has(t.modelTypeId)) byModel.set(t.modelTypeId, []);
    byModel.get(t.modelTypeId)!.push(t);
  }

  for (const [modelType, items] of [...byModel.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`\n=== ModelType ${modelType}  ${MODEL_TYPE_LABEL[modelType] ?? '(unknown)'} — ${items.length} templates ===`);
    for (const t of items.sort((a, b) => a.id.localeCompare(b.id))) {
      console.log(`  ${t.id.padEnd(40)} ${t.name}    base=${t.baseObjectId ?? '-'}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
