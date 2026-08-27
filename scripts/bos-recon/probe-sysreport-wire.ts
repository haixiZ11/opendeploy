/**
 * Plan 7.8 Phase 0 Task 0.2 — bridge-based SysReport DCXML probe.
 *
 * Replaces the original Phase 0 plan that asked the user to run BOS Designer
 * capture-proxy. Per memory `feedback_decompile_for_unknowns`, we route any
 * BOS private wire-format question through the .NET bridge's
 * DcxmlSerializer.SerializeToString — the same serializer K/3 uses, so its
 * output **is** the real wire (modulo no `action=` attrs on a fresh
 * baseline; see §1.10 of the recon doc).
 *
 * For each `kind` in {date, base_data, text, combo, decimal, gridfields}:
 *   - Call op `probe_sysreport_wire`
 *   - Write returned DCXML to `.scratch/captures/sysreport-filter-wire-probe/probe-<kind>.dcxml.txt`
 *
 * No K/3 server required — bridge schema build still loads BOS DLLs from
 * the customer DeskClient install (see DllResolver), so this script needs
 * a K/3 Cloud DeskClient installed but no running web/database server.
 *
 * Usage:
 *   pnpm tsx --tsconfig tsconfig.node.json scripts/bos-recon/probe-sysreport-wire.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getBridge, stopBridge, resolveBridgeExePath } from '../../src/main/erp/k3cloud/bridge';

const KINDS = ['date', 'base_data', 'text', 'combo', 'decimal', 'gridfields'] as const;
type Kind = (typeof KINDS)[number];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const OUT_DIR = path.join(PROJECT_ROOT, '.scratch', 'captures', 'sysreport-filter-wire-probe');

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const exePath = resolveBridgeExePath({ projectRoot: PROJECT_ROOT });
  // eslint-disable-next-line no-console
  console.log(`[probe] bridge exe: ${exePath}`);
  const bridge = await getBridge({ onLog: (l) => console.log(`[bridge] ${l}`) });

  const results: Array<{ kind: Kind; chars: number; outPath: string; ok: boolean; err?: string }> = [];

  for (const kind of KINDS) {
    try {
      const { xml } = await bridge.send<{ xml: string }>('probe_sysreport_wire', { kind });
      const outPath = path.join(OUT_DIR, `probe-${kind}.dcxml.txt`);
      fs.writeFileSync(outPath, xml, 'utf8');
      results.push({ kind, chars: xml.length, outPath, ok: true });
      // eslint-disable-next-line no-console
      console.log(`[probe] ${kind}: ${xml.length} chars -> ${outPath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ kind, chars: 0, outPath: '', ok: false, err: msg });
      // eslint-disable-next-line no-console
      console.error(`[probe] ${kind}: FAILED — ${msg}`);
    }
  }

  await stopBridge();

  // eslint-disable-next-line no-console
  console.log('\n=== Summary ===');
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`  ${r.ok ? 'OK ' : 'ERR'}  ${r.kind.padEnd(12)}  ${r.chars} chars  ${r.err ?? ''}`);
  }
  const fails = results.filter((r) => !r.ok).length;
  process.exitCode = fails === 0 ? 0 : 1;
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal:', err);
  process.exitCode = 2;
});
