/**
 * One-shot spike for Plan 7.6 paradigm-shift:
 *   "新建账表"in BOS Designer is 模板继承 (template inheritance),
 *   NOT zero-state creation. Same wire path as k3cloud_create_extension,
 *   just with BaseObjectId pointing to a built-in template object.
 *
 * Goal: read user's two sample sysreports (created via 模板继承 in BOS Designer)
 *       → extract BaseObjectId / DomainModelType / element type
 *       → reverse-engineer the 2 template formIds (simple + paged)
 *       → confirm wire path is plain SaveForIDEV9 + parent=template.
 *
 * User-provided sample formIds (2026-05-13):
 *   - 简单账表: kf9157e0f0a034534be3f6a6ab01699d1
 *   - 分页账表: kfbc4bd57c8174758977c39af409b0a85
 *
 * Output: .scratch/captures/sysreport-templates-spike.json
 *         + console summary
 *
 * Usage:
 *   pnpm tsx --tsconfig tsconfig.node.json scripts/bos-recon/spike-read-sysreport-templates.ts
 *
 * Env (defaults match dev settings.json):
 *   K3_BASE_URL / K3_ACCT_ID / K3_USERNAME / K3_PASSWORD / K3_DEVCODE
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { login } from '../../src/main/erp/k3cloud/rpc/login';
import { getBusinessObjectMetaData } from '../../src/main/erp/k3cloud/rpc/metadata';
import { extractKernelXml } from '../../src/main/erp/k3cloud/rpc/metadata-xml';

const baseUrl = process.env.K3_BASE_URL ?? 'http://localhost/K3Cloud/';
const acctId = process.env.K3_ACCT_ID ?? '69a531ee82525a';
const username = process.env.K3_USERNAME ?? 'administrator';
const password = process.env.K3_PASSWORD ?? '1qaz@WSX';
const devCode = process.env.K3_DEVCODE ?? 'PAIJ';

const SAMPLES = [
  { name: '简单账表', formId: 'kf9157e0f0a034534be3f6a6ab01699d1' },
  { name: '分页账表', formId: 'kfbc4bd57c8174758977c39af409b0a85' },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '../../.scratch/captures');

async function main() {
  console.log(`[spike] login as ${username}@${acctId} → ${baseUrl}`);
  const { session } = await login({ baseUrl, acctId, username, password, devCode, lcid: 2052 });
  if (!session) throw new Error('login failed');
  console.log(`[spike] session ok`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const summaries: Array<Record<string, unknown>> = [];
  for (const s of SAMPLES) {
    console.log(`\n========================================`);
    console.log(`[${s.name}] formId=${s.formId}`);
    console.log(`========================================`);

    const md = await getBusinessObjectMetaData(session, s.formId);
    const xml = extractKernelXml(md.metaData) ?? '';

    const baseObjectIdMatch = xml.match(/<BaseObjectId[^>]*>([^<]+)<\/BaseObjectId>/);
    const formKeyMatch = xml.match(/<Form\s+[^>]*Key="([^"]+)"/);
    const elementTypeMatch = xml.match(/<Form\s+[^>]*ElementType="([^"]+)"/);
    const subSystemMatch = xml.match(/<SubSystem[^>]*>([^<]+)<\/SubSystem>/);
    const nameMatch = xml.match(/<Name[^>]*>([^<]+)<\/Name>/);

    const summary = {
      sample: s.name,
      formId: s.formId,
      formKey: formKeyMatch?.[1] ?? null,
      baseObjectId: baseObjectIdMatch?.[1] ?? null,
      elementType: elementTypeMatch?.[1] ?? null,
      subSystem: subSystemMatch?.[1] ?? null,
      displayName: nameMatch?.[1] ?? null,
      kernelXmlLength: xml.length,
      kernelXmlHead: xml.slice(0, 800),
    };

    console.log(`  formKey:      ${summary.formKey}`);
    console.log(`  baseObjectId: ${summary.baseObjectId}   ← 模板 formId (核心结论)`);
    console.log(`  elementType:  ${summary.elementType}`);
    console.log(`  subSystem:    ${summary.subSystem}`);
    console.log(`  displayName:  ${summary.displayName}`);
    console.log(`  kernelXml:    ${summary.kernelXmlLength} chars`);

    const outFile = path.join(OUT_DIR, `sysreport-template-${s.name.replace(/[^a-z0-9]/gi, '')}-${s.formId.slice(0, 8)}.xml`);
    fs.writeFileSync(outFile, xml, 'utf8');
    console.log(`  full XML →    ${outFile}`);

    summaries.push(summary);
  }

  const outJson = path.join(OUT_DIR, 'sysreport-templates-spike.json');
  fs.writeFileSync(outJson, JSON.stringify(summaries, null, 2), 'utf8');
  console.log(`\n[spike] summary → ${outJson}`);

  console.log(`\n=========================================`);
  console.log(`[spike] CONCLUSION:`);
  console.log(`=========================================`);
  const simpleBase = summaries[0].baseObjectId;
  const pagedBase = summaries[1].baseObjectId;
  if (simpleBase && pagedBase) {
    console.log(`  简单账表模板 formId = ${simpleBase}`);
    console.log(`  分页账表模板 formId = ${pagedBase}`);
    if (simpleBase === pagedBase) {
      console.log(`  ⚠️ 两个模板 formId 相同 — paging 差异在 DCXML 字段层,不在 parent`);
    } else {
      console.log(`  ✅ 两个模板 formId 不同 — paged 用独立模板,Plan 7.6 工具只需要列对模板表`);
    }
  } else {
    console.log(`  ⚠️ baseObjectId 没找到 — XML 结构可能不同,看 sysreport-templates-spike.json 全量`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
