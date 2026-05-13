import { describe, it, expect } from 'vitest';
import { buildRegisterSysReportPluginEnvelope } from '@main/erp/k3cloud/rpc/register-sysreport-plugin';

import fixture from './wire-replay/__snapshots__/route-b/register-sysreport-plugin.json';

const FIXED_FORM_ID = 'kf1111111111111111111111111111111';
const FIXED_BASE_OBJECT_ID = 'BOS_SimpleSysReport';

describe('register-sysreport-plugin wire envelope', () => {
  it('produces wire matching fixture', () => {
    const envelope = buildRegisterSysReportPluginEnvelope({
      formId: FIXED_FORM_ID,
      baseObjectId: FIXED_BASE_OBJECT_ID,
      className: 'TestReportPlugin',
      pyBody: 'import clr\npass',
    });
    expect(envelope).toEqual(fixture);
  });
});
