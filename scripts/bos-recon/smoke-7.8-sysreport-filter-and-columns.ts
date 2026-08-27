/**
 * Plan 7.8 Task 4.1 smoke — verifies k3cloud_add_sysreport_filter_parameters +
 * k3cloud_add_sysreport_columns against a live K/3 Cloud server, end-to-end.
 *
 * What gets verified:
 *   1. createFromTemplate(BOS_SimpleSysReport) — throwaway baseline
 *   2. addSysReportFilterParameters — 4 kinds (date/base_data/text/decimal,
 *      combo skipped — needs pre-existing enumTypeId; covered separately by
 *      driver if customer has one)
 *   3. addSysReportColumns — 4 columns (text/text/integer/decimal)
 *   4. readback FKERNELXML — assert RptKeyWordField / RptFilterGridField
 *      land in SysReportForm.SQLDataSource.{KeyWordList,FieldList} with
 *      correct ValueType + Field.ElementType per Phase 0 §2 table
 *   5. cleanup deleteExtension (always, even on partial failure)
 *
 * Usage:
 *   pnpm tsx --tsconfig tsconfig.node.json scripts/bos-recon/smoke-7.8-sysreport-filter-and-columns.ts
 *
 * Reads creds from ~/.opendeploy/settings.json — first project with BOS creds.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  K3CloudConnector,
  setBundledConvertRuleTemplate,
} from '../../src/main/erp/k3cloud/connector';
import { deleteExtension } from '../../src/main/erp/k3cloud/rpc/delete-extension';
import type { Project } from '@shared/erp-types';
import type { BosRptKeyWordFieldElement } from '../../src/main/erp/k3cloud/rpc/sysreport-keyword-types';
import type { BosRptFilterGridFieldElement } from '../../src/main/erp/k3cloud/rpc/sysreport-gridfield-types';

setBundledConvertRuleTemplate(
  readFileSync(
    resolve('src/main/erp/k3cloud/rpc/baselines/convert-rule-extension-template.xml'),
    'utf-8',
  ),
);

(async () => {
  const settings = JSON.parse(
    readFileSync(resolve(homedir(), '.opendeploy/settings.json'), 'utf-8'),
  );
  const project: Project = settings.projects.find((p: Project) => p.bos != null);
  if (!project?.bos) {
    console.error('✗ no project with BOS creds in ~/.opendeploy/settings.json');
    process.exit(1);
  }

  const connector = new K3CloudConnector(project.bos, project.id);
  await connector.connect();
  console.log(`✓ connected to ${project.bos.baseUrl} (project=${project.id})\n`);

  const newFormId = 'k' + randomUUID().replace(/-/g, '');
  const reportName = `OD_smoke_7.8_${Date.now() % 100000}`;
  const cleanup = async () => {
    try {
      await deleteExtension(connector['session'] ?? (connector as any).session, newFormId, {
        devCode: project.bos!.devCode,
      });
      console.log(`  · cleanup: deleted ${newFormId}`);
    } catch (err) {
      console.warn(
        `  · cleanup error (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  // ─── Step 1: create throwaway SysReport ────────────────────────────────
  console.log('=== Step 1: createFromTemplate(BOS_SimpleSysReport) ===');
  let createRes;
  try {
    createRes = await connector.createFromTemplate({
      templateId: 'BOS_SimpleSysReport',
      newFormId,
      name: reportName,
      subSystemId: '23',
    });
  } catch (err) {
    console.error(`✗ createFromTemplate threw: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  if (!createRes.isSuccess) {
    console.error(
      `✗ createFromTemplate failed: ${createRes.messageTitle ?? ''} ${createRes.messageDetail ?? ''}`,
    );
    process.exit(1);
  }
  console.log(`  ✓ SysReport created: ${newFormId} name="${reportName}"\n`);

  // ─── Step 2: addSysReportFilterParameters (4 kinds) ────────────────────
  console.log('=== Step 2: addSysReportFilterParameters (4 kinds) ===');
  const keyWordFields: BosRptKeyWordFieldElement[] = [
    {
      kind: 'date',
      keyWord: '@StartDate',
      name: [{ localeId: 2052, value: '起始日期' }],
      seq: 1,
      mustInput: true,
    },
    {
      kind: 'base_data',
      keyWord: '@CustomerId',
      name: [{ localeId: 2052, value: '客户' }],
      seq: 2,
      refObjectId: 'BD_Customer',
      multiSelect: false,
    },
    {
      kind: 'text',
      keyWord: '@RemarkLike',
      name: [{ localeId: 2052, value: '备注关键字' }],
      seq: 3,
      maxLength: 200,
    },
    {
      kind: 'decimal',
      keyWord: '@MinAmount',
      name: [{ localeId: 2052, value: '最小金额' }],
      seq: 4,
      precision: 18,
      scale: 2,
    },
  ];
  try {
    const r = await connector.addSysReportFilterParameters({
      formId: newFormId,
      keyWordFields,
    });
    console.log(`  ✓ added ${r.added} filter parameters (4 kinds: date / base_data / text / decimal)\n`);
  } catch (err) {
    console.error(
      `✗ addSysReportFilterParameters failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    await cleanup();
    process.exit(1);
  }

  // ─── Step 3: addSysReportColumns (4 columns) ───────────────────────────
  console.log('=== Step 3: addSysReportColumns (4 columns) ===');
  const filterGridFields: BosRptFilterGridFieldElement[] = [
    { cellType: 'text', fieldKey: 'FCustName', caption: [{ localeId: 2052, value: '客户名称' }], seq: 1 },
    { cellType: 'text', fieldKey: 'FMonth', caption: [{ localeId: 2052, value: '月份' }], seq: 2 },
    { cellType: 'integer', fieldKey: 'FOrderCount', caption: [{ localeId: 2052, value: '订单数' }], seq: 3 },
    {
      cellType: 'decimal',
      fieldKey: 'FTotalAmount',
      caption: [{ localeId: 2052, value: '金额合计' }],
      seq: 4,
      precision: 18,
      scale: 2,
    },
  ];
  try {
    const r = await connector.addSysReportColumns({
      formId: newFormId,
      filterGridFields,
    });
    console.log(`  ✓ added ${r.added} columns (4 cellTypes: text x2 / integer / decimal)\n`);
  } catch (err) {
    console.error(
      `✗ addSysReportColumns failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    await cleanup();
    process.exit(1);
  }

  // ─── Step 4: readback FKERNELXML + verify wire shape ──────────────────
  console.log('=== Step 4: readback FKERNELXML + verify wire ===');
  const persistedXml = await connector.getKernelXml(newFormId);
  if (!persistedXml) {
    console.error('  ✗ cannot read back FKERNELXML');
    await cleanup();
    process.exit(1);
  }

  // Save full readback for debugging
  const outDir = resolve('.scratch/captures');
  try {
    const fs = await import('node:fs');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      resolve(outDir, `smoke-7.8-${newFormId.slice(0, 9)}.xml`),
      persistedXml,
      'utf8',
    );
    console.log(`  · readback XML saved (${persistedXml.length} chars)`);
  } catch {}

  // ─── Step 5: assertions ────────────────────────────────────────────────
  const assertions: Array<{ name: string; pass: boolean; detail?: string }> = [];

  // KeyWordList container exists
  const hasKwList = /<KeyWordList>[\s\S]*<\/KeyWordList>/.test(persistedXml);
  assertions.push({ name: 'KeyWordList container present', pass: hasKwList });

  // FieldList container exists
  const hasFlList = /<FieldList>[\s\S]*<\/FieldList>/.test(persistedXml);
  assertions.push({ name: 'FieldList container present', pass: hasFlList });

  // Each KeyWord persisted with correct ValueType
  for (const kw of keyWordFields) {
    const valueTypeMap: Record<string, number> = {
      date: 4,
      base_data: 13,
      text: 1,
      decimal: 2,
    };
    const vt = valueTypeMap[kw.kind];
    const re = new RegExp(
      `<RptKeyWordField>[\\s\\S]*?<KeyWord>${kw.keyWord.replace('@', '@')}</KeyWord>[\\s\\S]*?<ValueType>${vt}</ValueType>`,
    );
    assertions.push({
      name: `${kw.kind} kind (${kw.keyWord}) → ValueType=${vt}`,
      pass: re.test(persistedXml),
    });
  }

  // base_data carries AssistantID = refObjectId
  const baseDataKw = keyWordFields.find((k) => k.kind === 'base_data')!;
  const reAssistantId = new RegExp(
    `<KeyWord>${baseDataKw.keyWord}</KeyWord>[\\s\\S]*?<AssistantID>BD_Customer</AssistantID>`,
  );
  assertions.push({
    name: 'base_data carries AssistantID=BD_Customer',
    pass: reAssistantId.test(persistedXml),
  });

  // text carries Editlen=200 (non-default)
  const reEditlen = /<TextField[^>]*>[\s\S]*?<Editlen>200<\/Editlen>/;
  assertions.push({ name: 'text kind ships <Editlen>200</Editlen>', pass: reEditlen.test(persistedXml) });

  // decimal carries FieldPrecision/FieldScale on the @MinAmount KeyWord's
  // DecimalField. Server reserializes in property-declaration order
  // (FieldScale before FieldPrecision); assert presence in the @MinAmount
  // KeyWord's DecimalField block regardless of ordering. Anchor on the
  // FieldName so we capture the full DecimalField content.
  const reMinAmountBlock =
    /<KeyWord>@MinAmount<\/KeyWord>[\s\S]*?<DecimalField[^>]*>([\s\S]*?<FieldName>FMinAmount<\/FieldName>)/;
  const minAmountMatch = reMinAmountBlock.exec(persistedXml);
  const minAmountBlock = minAmountMatch?.[1] ?? '';
  assertions.push({
    name: 'decimal kind ships <FieldPrecision>18 + <FieldScale>2',
    pass:
      /<FieldPrecision>18<\/FieldPrecision>/.test(minAmountBlock) &&
      /<FieldScale>2<\/FieldScale>/.test(minAmountBlock),
    detail: minAmountBlock ? undefined : '@MinAmount DecimalField block not found',
  });

  // Each column persisted (cellType → embedded Field tag)
  const colChecks: Array<[string, string]> = [
    ['FCustName', 'TextField'],
    ['FMonth', 'TextField'],
    ['FOrderCount', 'IntegerField'],
    ['FTotalAmount', 'DecimalField'],
  ];
  for (const [key, tag] of colChecks) {
    const re = new RegExp(`<RptFilterGridField>[\\s\\S]*?<${tag}[^>]*>[\\s\\S]*?<Key>${key}</Key>`);
    assertions.push({ name: `column ${key} → <${tag}>`, pass: re.test(persistedXml) });
  }

  // FTotalAmount carries FieldPrecision/FieldScale on DecimalField. Server
  // reserializes in property-declaration order (FieldScale **before**
  // FieldPrecision — opposite of our emitter's output order). The
  // DecimalField block has Precision/Scale BEFORE FieldName/Key, so anchor
  // backwards: capture the DecimalField block by walking back from the
  // FTotalAmount FieldName.
  const reFTotalAmountBlock =
    /<DecimalField[^>]*>([\s\S]*?<FieldName>FTotalAmount<\/FieldName>)/;
  const fTotalMatch = reFTotalAmountBlock.exec(persistedXml);
  const fTotalBlock = fTotalMatch?.[1] ?? '';
  assertions.push({
    name: 'FTotalAmount column carries FieldPrecision + FieldScale',
    pass:
      /<FieldPrecision>18<\/FieldPrecision>/.test(fTotalBlock) &&
      /<FieldScale>2<\/FieldScale>/.test(fTotalBlock),
    detail: fTotalBlock ? undefined : 'FTotalAmount DecimalField block not found',
  });

  // ─── Step 6: cleanup ──────────────────────────────────────────────────
  console.log('\n=== Step 5: cleanup ===');
  await cleanup();

  // ─── Summary ──────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Plan 7.8 Task 4.1 smoke — summary');
  console.log('═══════════════════════════════════════════════════════════');
  let passN = 0;
  let failN = 0;
  for (const a of assertions) {
    if (a.pass) {
      console.log(`  ✓ ${a.name}`);
      passN++;
    } else {
      console.error(`  ✗ ${a.name}${a.detail ? ` — ${a.detail}` : ''}`);
      failN++;
    }
  }
  console.log(`\n  ${passN} PASS / ${failN} FAIL / ${assertions.length} total`);
  if (failN > 0) {
    console.error('\n  Check readback XML in .scratch/captures/ for diagnosis.');
    process.exit(1);
  }
  console.log('\n  ✅ Phase 4 wire-correctness verified end-to-end against live K/3 server.');
})();
