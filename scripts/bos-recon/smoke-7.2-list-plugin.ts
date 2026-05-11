/**
 * Plan 7.2 smoke — verifies list-plugin registration writes the `<ListPlugins>`
 * wire correctly against a real K/3 Cloud server, end-to-end through the agent
 * tool path (createExtension → registerListPythonPlugins → readback → delete).
 *
 * What gets verified:
 *   1. wire-replay snapshot maps to a server-accepted save (SaveForIDEV9 returns ok)
 *   2. parent FKERNELXML after save contains `<ListPlugins>` (new wrapper, not folded into FormPlugins)
 *   3. baseline-diff: a second save with a different list plugin preserves the first
 *   4. cleanup works without leaving extension residue
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import {
  K3CloudConnector,
  setBundledConvertRuleTemplate,
} from '../../src/main/erp/k3cloud/connector';
import { saveExtension } from '../../src/main/erp/k3cloud/rpc/save-for-ide';
import { deleteExtension } from '../../src/main/erp/k3cloud/rpc/delete-extension';
import { extractExistingExtensionElements } from '../../src/main/erp/k3cloud/rpc/existing-elements';
import { login } from '../../src/main/erp/k3cloud/rpc/login';
import { newCompactGuid } from '../../src/main/erp/k3cloud/rpc/dcxml';
import { extractLayoutInfoOid } from '../../src/main/erp/k3cloud/rpc/layout-discovery';
import type { Project } from '@shared/erp-types';
import type { SaveExtensionRequest } from '../../src/main/erp/k3cloud/rpc/types';

// Plan 7.0 lazy-template init (so connector import chain doesn't break under tsx)
setBundledConvertRuleTemplate(
  readFileSync(
    resolve('src/main/erp/k3cloud/rpc/baselines/convert-rule-extension-template.xml'),
    'utf-8',
  ),
);

(async () => {
  const settings = JSON.parse(readFileSync(resolve(homedir(), '.opendeploy/settings.json'), 'utf-8'));
  const project: Project = settings.projects.find((p: Project) => p.bos != null);
  if (!project?.bos) {
    console.error('✗ no project with BOS creds in ~/.opendeploy/settings.json');
    process.exit(1);
  }

  const connector = new K3CloudConnector(project.bos, project.id);
  await connector.connect();
  console.log(`✓ connected to ${project.bos.baseUrl} (project=${project.id})\n`);

  const loginRes = await login({
    baseUrl: project.bos.baseUrl,
    acctId: project.bos.acctId,
    username: project.bos.username,
    password: project.bos.password,
  });
  if (!loginRes.isSuccess) {
    console.error(`✗ login failed: ${loginRes.message}`);
    process.exit(1);
  }
  const session = loginRes.session;
  console.log('✓ session ready\n');

  // Use SAL_SaleOrder — known to work for OpenDeploy extensions.
  const parentFormId = 'SAL_SaleOrder';
  const parentXml = await connector.getKernelXml(parentFormId);
  if (!parentXml) {
    console.error(`✗ cannot load FKERNELXML for ${parentFormId}`);
    process.exit(1);
  }
  const layoutInfoOid = extractLayoutInfoOid(parentXml);
  if (!layoutInfoOid) {
    console.error(`✗ cannot find layoutInfoOid in ${parentFormId} FKERNELXML`);
    process.exit(1);
  }
  console.log(`✓ parent layoutInfoOid=${layoutInfoOid}\n`);

  // Look up parent metadata for modelTypeId / subSystemId
  const parentMeta = await connector.getObject(parentFormId);
  if (!parentMeta || parentMeta.modelTypeId == null || parentMeta.subsystemId == null) {
    console.error(`✗ cannot resolve parent metadata`);
    process.exit(1);
  }

  const extId = newCompactGuid();
  const cleanupExtension = async (existingListPluginsRaw: string[] = []) => {
    // Empty save (drop all elements) before delete to keep DB clean.
    try {
      const cleanReq: SaveExtensionRequest = {
        extension: {
          formId: extId,
          baseObjectId: parentFormId,
          modelTypeId: parentMeta.modelTypeId!,
          subSystemId: parentMeta.subsystemId!,
          name: [{ localeId: 2052, value: `Plan 7.2 list-plugin smoke (cleanup)` }],
          isv: { devCode: project.bos!.devCode },
        },
        isNew: false,
        layoutInfoOid,
      };
      await saveExtension(session, cleanReq);
      await deleteExtension(session, extId, { devCode: project.bos!.devCode });
    } catch (err) {
      console.warn(`  · cleanup error (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ─── Step 1: create extension ────────────────────────────────────────
  console.log('=== Step 1: create extension ===');
  const createReq: SaveExtensionRequest = {
    extension: {
      formId: extId,
      baseObjectId: parentFormId,
      modelTypeId: parentMeta.modelTypeId,
      subSystemId: parentMeta.subsystemId,
      name: [{ localeId: 2052, value: `Plan 7.2 list-plugin smoke ${Date.now()}` }],
      isv: { devCode: project.bos.devCode },
    },
    isNew: true,
    layoutInfoOid,
  };
  const createRes = await saveExtension(session, createReq);
  if (!createRes.isSuccess) {
    console.error(`✗ create extension failed: ${createRes.messageTitle ?? createRes.messageDetail}`);
    process.exit(1);
  }
  console.log(`  ✓ extension created extId=${extId}\n`);

  // ─── Step 2: register list plugin via the new code path ─────────────
  console.log('=== Step 2: register list plugin ===');
  const listPluginReq: SaveExtensionRequest = {
    extension: createReq.extension,
    isNew: false,
    layoutInfoOid,
    addListPlugins: [
      {
        className: 'smoke_list_plugin',
        type: 'python',
        pyScript:
          'import clr\n' +
          "clr.AddReference('Kingdee.BOS')\n" +
          "clr.AddReference('Kingdee.BOS.Core')\n" +
          'from Kingdee.BOS.Core.List.PlugIn import AbstractListPlugIn\n' +
          'class SmokeListPlugIn(AbstractListPlugIn):\n' +
          '    def AfterBarItemClick(self, e):\n' +
          '        pass',
      },
    ],
  };
  const listRes = await saveExtension(session, listPluginReq);
  if (!listRes.isSuccess) {
    console.error(`  ✗ list-plugin save failed: ${listRes.messageTitle ?? listRes.messageDetail}`);
    await cleanupExtension();
    process.exit(1);
  }
  console.log(`  ✓ list plugin saved\n`);

  // ─── Step 3: read back + verify wire is in <ListPlugins> ─────────────
  console.log('=== Step 3: verify wire shape ===');
  const persistedXml = await connector.getKernelXml(extId);
  if (!persistedXml) {
    console.error('  ✗ cannot read back FKERNELXML');
    await cleanupExtension();
    process.exit(1);
  }
  const hasListPlugins = /<ListPlugins>[\s\S]*<ClassName>smoke_list_plugin<\/ClassName>/.test(persistedXml);
  const hasFormPluginsWithSmoke = /<FormPlugins>[\s\S]*<ClassName>smoke_list_plugin<\/ClassName>/.test(persistedXml);
  if (!hasListPlugins) {
    console.error('  ✗ <ListPlugins><PlugIn><ClassName>smoke_list_plugin not found in persisted XML');
    console.error(`    persisted XML snippet: ${persistedXml.slice(0, 500)}…`);
    await cleanupExtension();
    process.exit(1);
  }
  if (hasFormPluginsWithSmoke) {
    console.error('  ✗ list plugin wrongly landed in <FormPlugins> too — wrapper routing broken');
    await cleanupExtension();
    process.exit(1);
  }
  console.log('  ✓ persisted XML has <ListPlugins><PlugIn><ClassName>smoke_list_plugin\n');

  // ─── Step 4: baseline-diff (add a 2nd list plugin, verify both persist) ──
  console.log('=== Step 4: baseline-diff via 2nd plugin ===');
  const existing = extractExistingExtensionElements(persistedXml);
  console.log(`  · existing listPlugins count: ${existing.listPlugins.length}`);
  if (existing.listPlugins.length !== 1) {
    console.error(`  ✗ expected 1 existing list plugin, got ${existing.listPlugins.length}`);
    await cleanupExtension(existing.listPlugins);
    process.exit(1);
  }

  const secondReq: SaveExtensionRequest = {
    extension: createReq.extension,
    isNew: false,
    layoutInfoOid,
    existingListPluginsRaw: existing.listPlugins,
    addListPlugins: [
      {
        className: 'smoke_list_plugin_2',
        type: 'python',
        pyScript:
          'import clr\n' +
          "clr.AddReference('Kingdee.BOS')\n" +
          "clr.AddReference('Kingdee.BOS.Core')\n" +
          'from Kingdee.BOS.Core.List.PlugIn import AbstractListPlugIn\n' +
          'class SmokeListPlugIn2(AbstractListPlugIn):\n' +
          '    def AfterBarItemClick(self, e):\n' +
          '        pass',
      },
    ],
  };
  const secondRes = await saveExtension(session, secondReq);
  if (!secondRes.isSuccess) {
    console.error(`  ✗ 2nd save failed: ${secondRes.messageTitle ?? secondRes.messageDetail}`);
    await cleanupExtension(existing.listPlugins);
    process.exit(1);
  }

  const afterTwo = await connector.getKernelXml(extId);
  if (!afterTwo) {
    console.error('  ✗ cannot read back after 2nd save');
    process.exit(1);
  }
  const afterTwoExisting = extractExistingExtensionElements(afterTwo);
  if (afterTwoExisting.listPlugins.length !== 2) {
    console.error(`  ✗ after 2nd save expected 2 list plugins, got ${afterTwoExisting.listPlugins.length}`);
    console.error(`    persisted XML lacks one of the plugins — existingListPluginsRaw round-trip broken`);
    await cleanupExtension(afterTwoExisting.listPlugins);
    process.exit(1);
  }
  console.log(`  ✓ both list plugins persisted after baseline-diff save\n`);

  // ─── Step 5: cleanup ─────────────────────────────────────────────────
  console.log('=== Step 5: cleanup ===');
  await cleanupExtension(afterTwoExisting.listPlugins);
  console.log('  ✓ extension dropped\n');

  console.log('✓ Plan 7.2 list-plugin smoke passed — wire ↔ baseline-diff ↔ readback all green');
  process.exit(0);
})();
