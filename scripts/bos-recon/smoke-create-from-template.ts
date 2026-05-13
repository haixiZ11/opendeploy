/**
 * Plan 7.6 Task 4 smoke — create-from-template against live K/3 server.
 * 4 scenarios cover 3 ModelTypes:
 *   - BOS_SimpleSysReport  (ModelType=900 SysReport, simple)
 *   - BOS_MoveSysReport    (ModelType=900 SysReport, paged)
 *   - BOS_BillWithEntryModel (ModelType=100 BillForm)
 *   - BOS_OrgControlBDModel  (ModelType=400 BaseDataForm)
 *
 * Each scenario: create → assert isSuccess → readback FKERNELXML → assert
 * oid="${templateId}" present → cleanup (delete) → PASS/FAIL log.
 *
 * Usage:
 *   pnpm tsx --tsconfig tsconfig.node.json scripts/bos-recon/smoke-create-from-template.ts
 *
 * Env (defaults match dev settings.json):
 *   K3_BASE_URL  — http://localhost/K3Cloud/
 *   K3_ACCT_ID   — 69a531ee82525a
 *   K3_USERNAME  — administrator
 *   K3_PASSWORD  — 1qaz@WSX
 *   K3_DEVCODE   — PAIJ
 */

import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import { login } from '../../src/main/erp/k3cloud/rpc/login';
import { callCreateFromTemplate, getExpectedReadbackOid } from '../../src/main/erp/k3cloud/rpc/create-from-template';
import { callRegisterSysReportPlugin } from '../../src/main/erp/k3cloud/rpc/register-sysreport-plugin';
import { getBusinessObjectMetaData } from '../../src/main/erp/k3cloud/rpc/metadata';
import { extractKernelXml } from '../../src/main/erp/k3cloud/rpc/metadata-xml';
import { deleteExtension } from '../../src/main/erp/k3cloud/rpc/delete-extension';
import type { KdSession } from '../../src/main/erp/k3cloud/rpc/http-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = process.env.K3_BASE_URL ?? 'http://localhost/K3Cloud/';
const acctId = process.env.K3_ACCT_ID ?? '69a531ee82525a';
const username = process.env.K3_USERNAME ?? 'administrator';
const password = process.env.K3_PASSWORD ?? '1qaz@WSX';
const devCode = process.env.K3_DEVCODE ?? 'PAIJ';

const ISV = {
  devCode,
  name: devCode,
  isvSignal: 'Kingdee' as const,
  packageSignal: '',
  id: devCode,
};

interface Scenario {
  name: string;
  templateId: string;
  subSystemId: string;
}

const SCENARIOS: Scenario[] = [
  { name: 'simple-sysreport',  templateId: 'BOS_SimpleSysReport',    subSystemId: '23' },
  { name: 'paged-sysreport',   templateId: 'BOS_MoveSysReport',      subSystemId: '23' },
  { name: 'bill-with-entry',   templateId: 'BOS_BillWithEntryModel', subSystemId: '23' },
  { name: 'basedata-org-ctrl', templateId: 'BOS_OrgControlBDModel',  subSystemId: '23' },
];

const OUT_DIR = path.resolve(__dirname, '../../.scratch/captures');

async function runScenario(
  session: KdSession,
  sc: Scenario,
): Promise<{ pass: boolean; formId: string | null; note: string }> {
  const newFormId = 'k' + randomUUID().replace(/-/g, '');
  const name = `OD_smoke_${sc.name}_${Date.now() % 100000}`;

  console.log(`\n===== ${sc.name} (template=${sc.templateId}) =====`);
  console.log(`  newFormId: ${newFormId}`);
  console.log(`  name:      ${name}`);

  // ── Step 1: Create ────────────────────────────────────────────────
  try {
    const result = await callCreateFromTemplate(session, {
      templateId: sc.templateId,
      newFormId,
      name,
      subSystemId: sc.subSystemId,
      mainVersion: null,
    });
    if (!result.isSuccess) {
      const msg = `${result.messageTitle ?? ''}: ${result.messageDetail ?? ''}`.trim();
      console.error(`  [CREATE FAIL] ${msg}`);
      return { pass: false, formId: null, note: `create failed: ${msg}` };
    }
    console.log(`  [CREATE PASS] isSuccess=true funcResult=${result.funcResult}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  [CREATE ERROR] ${msg}`);
    return { pass: false, formId: null, note: `create threw: ${msg}` };
  }

  // ── Step 2: Readback + assert oid ─────────────────────────────────
  let readbackOk = false;
  let actualRootTag = '?';
  try {
    const md = await getBusinessObjectMetaData(session, newFormId);
    const xml = extractKernelXml(md.metaData) ?? '';

    // Use getExpectedReadbackOid: sub-templates (e.g. BOS_BillWithEntryModel)
    // resolve to their root ancestor (e.g. BOS_BillModel) in server readback.
    const expectedOid = getExpectedReadbackOid(sc.templateId);
    const escapedOid = expectedOid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const oidRegex = new RegExp(`oid="${escapedOid}"`);

    if (!oidRegex.test(xml)) {
      console.error(`  [READBACK FAIL] expected oid="${expectedOid}" (template=${sc.templateId}) not found in ${xml.length}-char XML`);
      console.error(`  XML head (400 chars): ${xml.slice(0, 400)}`);
      // Save full XML for debugging even on failure
      const outFile = path.join(OUT_DIR, `smoke-${sc.name}-FAIL-${newFormId.slice(0, 9)}.xml`);
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(outFile, xml, 'utf8');
      console.error(`  Full XML saved: ${outFile}`);
      return { pass: false, formId: newFormId, note: `readback missing oid="${expectedOid}"` };
    }

    // Extract root tag to verify TEMPLATE_REGISTRY rootTag was correct
    const rootTagMatch = xml.match(/<(\w+)\s+action="edit"\s+oid="[^"]+"\s+ElementType=/);
    actualRootTag = rootTagMatch?.[1] ?? '?';
    const oidLabel = expectedOid !== sc.templateId ? `${expectedOid} (resolved from ${sc.templateId})` : expectedOid;
    console.log(`  [READBACK PASS] oid="${oidLabel}" found. Root tag = ${actualRootTag}`);

    // Save XML for reference
    const outFile = path.join(OUT_DIR, `smoke-${sc.name}-${newFormId.slice(0, 9)}.xml`);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(outFile, xml, 'utf8');
    console.log(`  XML saved: ${outFile}`);

    readbackOk = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  [READBACK ERROR] ${msg}`);
    return { pass: false, formId: newFormId, note: `readback threw: ${msg}` };
  }

  // ── Step 3: Plugin attach (simple-sysreport only, Task 5 smoke) ──────────
  let pluginAttachNote = '';
  if (sc.name === 'simple-sysreport' && readbackOk) {
    try {
      const pluginResult = await callRegisterSysReportPlugin(session, {
        formId: newFormId,
        baseObjectId: sc.templateId,   // template OID = DCXML baseline oid
        className: 'SmokeReportPlugin',
        pyBody:
          'import clr\n' +
          'clr.AddReference("Kingdee.BOS.Core")\n' +
          'from Kingdee.BOS.Core.Report.PlugIn import AbstractSysReportServicePlugIn\n' +
          'class SmokeReportPlugin(AbstractSysReportServicePlugIn):\n' +
          '    pass\n',
      });
      if (!pluginResult.isSuccess) {
        console.error(`  [PLUGIN ATTACH FAIL] ${pluginResult.messageTitle ?? ''}: ${pluginResult.messageDetail ?? ''}`);
        return { pass: false, formId: newFormId, note: `plugin attach failed: ${pluginResult.messageTitle}` };
      }
      console.log(`  [PLUGIN ATTACH PASS] isSuccess=true funcResult=${pluginResult.funcResult}`);

      // Readback verify
      const md2 = await getBusinessObjectMetaData(session, newFormId);
      const xml2 = extractKernelXml(md2.metaData) ?? '';
      if (!xml2.includes('SmokeReportPlugin')) {
        console.error(`  [PLUGIN READBACK FAIL] className "SmokeReportPlugin" not found in readback XML`);
        console.error(`  XML head (400 chars): ${xml2.slice(0, 400)}`);
        return { pass: false, formId: newFormId, note: 'plugin className not in readback XML' };
      }
      console.log(`  [PLUGIN READBACK PASS] "SmokeReportPlugin" found in FKERNELXML`);
      pluginAttachNote = '+plugin';
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  [PLUGIN ATTACH ERROR] ${msg}`);
      return { pass: false, formId: newFormId, note: `plugin attach threw: ${msg}` };
    }
  }

  return {
    pass: readbackOk,
    formId: newFormId,
    note: readbackOk ? `rootTag=${actualRootTag}${pluginAttachNote}` : 'readback failed',
  };
}

async function tryDelete(session: KdSession, formId: string): Promise<void> {
  try {
    const r = await deleteExtension(session, formId, ISV);
    if (r.ok) {
      console.log(`  [CLEANUP] deleted ${formId}`);
    } else {
      console.warn(`  [CLEANUP WARN] delete returned not-ok: ${r.message ?? r.responseBody}`);
    }
  } catch (e) {
    console.warn(`  [CLEANUP FAILED] ${formId}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Plan 7.6 Task 4 smoke — create-from-template (4 scenarios)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  server:  ${baseUrl}`);
  console.log(`  account: ${acctId} / ${username}`);
  console.log(`  devCode: ${devCode}`);

  const loginResult = await login({ baseUrl, acctId, username, password, devCode, lcid: 2052 });
  if (!loginResult.isSuccess || !loginResult.session) {
    throw new Error(`login failed: ${loginResult.message ?? 'unknown'}`);
  }
  const session = loginResult.session;
  console.log(`  [login ok] user=${loginResult.userName}`);

  let totalPass = 0;
  let totalFail = 0;

  for (const sc of SCENARIOS) {
    const { pass, formId, note } = await runScenario(session, sc);
    if (pass) {
      totalPass++;
      console.log(`  => PASS (${note})`);
    } else {
      totalFail++;
      console.log(`  => FAIL (${note})`);
    }
    // Always cleanup any created object
    if (formId) {
      await tryDelete(session, formId);
    }
  }

  console.log('\n════════════════════════════════════════════════════');
  console.log(`  Summary: ${totalPass} PASS / ${totalFail} FAIL / ${SCENARIOS.length} total`);
  console.log('════════════════════════════════════════════════════');

  if (totalFail > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[FATAL]', e);
  process.exit(1);
});
