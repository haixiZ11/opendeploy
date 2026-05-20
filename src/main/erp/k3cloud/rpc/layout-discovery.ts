/**
 * Discover the parent form's main `<LayoutInfo oid="...">` from its
 * FKERNELXML. Every BOS extension save needs this OID — it's the layout
 * view the new appearances merge into. BOS Designer reads it from the
 * parent's metadata at save time; we do the same.
 *
 * Empirical (2026-04-27 captures, SAL_SaleOrder): the OID lives at the
 * root level of the form's FKERNELXML inside `<LayoutInfos><LayoutInfo
 * oid="GUID">`. There's typically one main layout per form; if multiple
 * exist (variant layouts, locked-down printable forms), we take the first
 * one — that's what BOS Designer uses for the default editor view.
 */

const LAYOUT_INFO_OID_RE = /<LayoutInfo\b[^>]*\boid\s*=\s*"([^"]+)"/i;

/**
 * Extract the first `<LayoutInfo oid="...">` from raw FKERNELXML. Returns
 * `null` when none is found — caller decides whether that's an error
 * (typical) or skip (rare write modes that don't touch layout).
 */
export function extractLayoutInfoOid(kernelXml: string): string | null {
  const m = kernelXml.match(LAYOUT_INFO_OID_RE);
  return m ? m[1] : null;
}

const SYSREPORT_FORM_OID_RE = /<SysReportForm\b[^>]*\boid\s*=\s*"([^"]+)"/i;
const SQL_DATA_SOURCE_OID_RE = /<SQLDataSource\b[^>]*\boid\s*=\s*"([^"]+)"/i;

/**
 * Plan 7.8 Phase 1 — Extract the `<SysReportForm oid="...">` from a SysReport
 * parent template's FKERNELXML. Used to anchor the
 * `<SysReportForm action="edit" oid={X}>` envelope that carries the
 * `<KeyWordList>` baseline diff in `add_sysreport_filter_parameters`.
 *
 * The parent template (e.g. `BOS_SimpleSysReport`) carries this oid at the
 * Elements root level; `extractLayoutInfoOid` extracts its sibling
 * `<LayoutInfo>`. Both are required to build a valid SaveExtensionRequest
 * for a SysReport extension.
 */
export function extractSysReportFormOid(kernelXml: string): string | null {
  const m = kernelXml.match(SYSREPORT_FORM_OID_RE);
  return m ? m[1] : null;
}

/**
 * Plan 7.8 Phase 1 — Extract the `<SQLDataSource oid="...">` from a SysReport
 * parent template's FKERNELXML. Used to anchor the inner
 * `<SQLDataSource action="edit" oid={X}>` element that wraps the KeyWordList
 * baseline diff (the BOS shape is doubly-nested: SQLDataSource > SQLDataSource;
 * the outer one with oid + action is the diff anchor, the inner one is the
 * stable element-name nesting per Phase 0 spike §1.10).
 *
 * Note: the first `<SQLDataSource oid=...>` match is what we want — there
 * is exactly one SQLDataSource per SysReport template.
 */
export function extractSqlDataSourceOid(kernelXml: string): string | null {
  const m = kernelXml.match(SQL_DATA_SOURCE_OID_RE);
  return m ? m[1] : null;
}
