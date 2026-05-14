import { describe, it, expect } from 'vitest';
import { buildCreateFromTemplateEnvelope } from '@main/erp/k3cloud/rpc/create-from-template';

import simpleFixture from './wire-replay/__snapshots__/route-b/create-from-template-simple-sysreport.json';
import pagedFixture from './wire-replay/__snapshots__/route-b/create-from-template-paged-sysreport.json';
import billFixture from './wire-replay/__snapshots__/route-b/create-from-template-bill-with-entry.json';
import basedataFixture from './wire-replay/__snapshots__/route-b/create-from-template-basedata-org-control.json';
import dfCommonFilterFixture from './wire-replay/__snapshots__/route-b/create-from-template-dynamicform-common-filter.json';
import dfStandardFilterFixture from './wire-replay/__snapshots__/route-b/create-from-template-dynamicform-standard-filter.json';
import dfBillTypeParamFixture from './wire-replay/__snapshots__/route-b/create-from-template-dynamicform-billtype-param.json';
import dfListFixture from './wire-replay/__snapshots__/route-b/create-from-template-dynamicform-list.json';

const FIXED_NEW_ID = 'kf0000000000000000000000000000000';
const FIXED_LAYOUT_OID = '00000000-0000-0000-0000-000000000001';
const FIXED_APPEARANCE_OID = '00000000-0000-0000-0000-000000000002';

const scenarios = [
  { name: 'simple-sysreport', templateId: 'BOS_SimpleSysReport', displayName: 'TESTA', subSystemId: '23', expected: simpleFixture },
  // differs from simple only by <ModeTypeSubId>902</ModeTypeSubId> emitted by builder (per template-specific wire spec)
  { name: 'paged-sysreport', templateId: 'BOS_MoveSysReport', displayName: 'TESTB', subSystemId: '23', expected: pagedFixture },
  { name: 'bill-with-entry', templateId: 'BOS_BillWithEntryModel', displayName: 'TESTC', subSystemId: '23', expected: billFixture },
  { name: 'basedata-org-control', templateId: 'BOS_OrgControlBDModel', displayName: 'TESTD', subSystemId: '23', expected: basedataFixture },
  // Plan 7.7 — DynamicForm (ModelType=500) 4 个代表性场景
  { name: 'dynamicform-common-filter', templateId: 'BOS_CommonFilter', displayName: 'TESTE', subSystemId: '23', expected: dfCommonFilterFixture },
  { name: 'dynamicform-standard-filter', templateId: 'BOS_StandardFilter', displayName: 'TESTF', subSystemId: '23', expected: dfStandardFilterFixture },
  { name: 'dynamicform-billtype-param', templateId: 'BOS_BILLTYPEPARAMODEL', displayName: 'TESTG', subSystemId: '23', expected: dfBillTypeParamFixture },
  { name: 'dynamicform-list', templateId: 'BOS_List', displayName: 'TESTH', subSystemId: '23', expected: dfListFixture },
];

describe('create-from-template wire envelope', () => {
  for (const sc of scenarios) {
    it(`produces wire matching fixture for ${sc.name}`, () => {
      const envelope = buildCreateFromTemplateEnvelope({
        templateId: sc.templateId,
        newFormId: FIXED_NEW_ID,
        name: sc.displayName,
        subSystemId: sc.subSystemId,
        mainVersion: '<live>',
        layoutOid: FIXED_LAYOUT_OID,
        appearanceOid: FIXED_APPEARANCE_OID,
      });
      expect(envelope).toEqual(sc.expected);
    });
  }
});
