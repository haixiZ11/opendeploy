/**
 * Plan 7.8 — agent tool(s) for configuring existing SysReport (账表) objects.
 *
 * k3cloud_add_sysreport_filter_parameters: appends a batch of filter
 * parameters (RptKeyWordField) to an existing SysReport's KeyWordList.
 * Equivalent to BOS Designer "过滤参数面板 → 添加参数" — once this tool
 * succeeds, users do not need to add the parameters by hand.
 *
 * Companion tools (same domain, separate file):
 *   - k3cloud_create_from_template — create the SysReport object first
 *     (`create-metaobject-tools.ts`)
 *   - k3cloud_register_sysreport_python_plugins — register Python service
 *     plugins after creation (`create-metaobject-tools.ts`)
 *
 * Filter parameters added here become SQL placeholders (e.g. "@CustomerId")
 * that registered Python plugins can read via `e.Filter.GetValue("@CustomerId")`
 * in `BuilderReportSqlAndTempTable` / `BeginFilter` events.
 */

import type { ToolHandler } from './tools';
import type { K3CloudConnector } from '../erp/k3cloud/connector';
import type { BosRptKeyWordFieldElement } from '../erp/k3cloud/rpc/sysreport-keyword-types';

export function addSysReportFilterParametersTool(c: K3CloudConnector): ToolHandler {
  return {
    parallelSafe: false,
    definition: {
      name: 'k3cloud_add_sysreport_filter_parameters',
      description:
        '给已有 SysReport(账表)对象追加一组过滤参数,等价 BOS Designer "过滤参数面板" 配置。\n' +
        '\n' +
        '**前置**:formId 必须是 modelTypeId=900 的 SysReport(通常由 k3cloud_create_from_template 创建)。\n' +
        '\n' +
        '**支持 5 种 kind**:\n' +
        '- `date` — 日期(单值或起止区间,defaultValue 支持 "today" / "month_start" / "year_start" 或字面 ISO 日期)\n' +
        '- `base_data` — 基础资料 F7(refObjectId 必填,例如 "BD_Customer";multiSelect 默认 false)\n' +
        '- `text` — 文本输入(maxLength 可选,默认 50;设非 50 才写入 wire)\n' +
        '- `combo` — 下拉枚举(enumTypeId 必填,**调用前必先调 k3cloud_list_enum_types 确认 enum 存在**,不存在用 k3cloud_create_enum_type 建)\n' +
        '- `decimal` — 数字(precision / scale 可选)\n' +
        '\n' +
        '**与 register_sysreport_python_plugins 的协作**:这里加的 keyWord(例如 "@CustomerId")是 SQL placeholder,Python 插件可以在 BuilderReportSqlAndTempTable / BeginFilter 事件里通过 `e.Filter.GetValue("@CustomerId")` 读到 — 字符串严格匹配。\n' +
        '\n' +
        '**内部模型**(供调试):每条对外的 filter parameter 在 BOS wire 里是单一 `RptKeyWordField`,kind 由 `ValueType` long 数值 + 内嵌 `<Field>` ElementType 决定,无 5 类派生子类(2026-05-20 Phase 0 spike 实证)。\n' +
        '\n' +
        '**写后用户操作**:BOS Designer F5 即可看到新过滤参数;不需要重登客户端(参数面板是 metadata 驱动,客户端运行时实时拉取)。这就是 BOS Designer "过滤参数面板 → 添加参数" 的程序化等价,**用户不需要再去 BOS Designer 手工加**。',
      parameters: {
        type: 'object',
        properties: {
          formId: {
            type: 'string',
            description: '目标 SysReport 的 FormID(k + 32 位 lowercase hex,共 33 字符)。',
          },
          filterParameters: {
            type: 'array',
            description:
              '一组过滤参数。每条是 BosRptKeyWordFieldElement(discriminated by `kind`)。必填字段:kind / keyWord / name / seq。kind-specific 字段见工具 description。',
            items: {
              type: 'object',
              description:
                '单条过滤参数。kind 取值之一:date / base_data / text / combo / decimal。kind-specific 字段:base_data 需 refObjectId;combo 需 enumTypeId;text 可选 maxLength;decimal 可选 precision/scale;date 可选 defaultValue。',
            },
          },
        },
        required: ['formId', 'filterParameters'],
      },
    },
    async execute(args) {
      const formId = String(args.formId ?? '').trim();
      if (!formId || !/^k[a-f0-9]{32}$/.test(formId)) {
        throw new Error(
          'k3cloud_add_sysreport_filter_parameters: formId 必须是 k + 32 位 lowercase hex 格式(共 33 字符)。',
        );
      }
      const fpRaw = args.filterParameters;
      if (!Array.isArray(fpRaw) || fpRaw.length === 0) {
        throw new Error(
          'k3cloud_add_sysreport_filter_parameters: filterParameters 必须是非空数组。',
        );
      }
      // Validate kind only — TS typedef + emitter cover schema details.
      for (const fp of fpRaw) {
        const kind = (fp as { kind?: unknown })?.kind;
        if (
          kind !== 'date' &&
          kind !== 'base_data' &&
          kind !== 'text' &&
          kind !== 'combo' &&
          kind !== 'decimal'
        ) {
          throw new Error(
            `k3cloud_add_sysreport_filter_parameters: 不支持的 kind "${String(kind)}"。支持:date / base_data / text / combo / decimal。`,
          );
        }
      }

      const result = await c.addSysReportFilterParameters({
        formId,
        keyWordFields: fpRaw as BosRptKeyWordFieldElement[],
      });

      return JSON.stringify(
        {
          ok: true,
          formId,
          added: result.added,
          message:
            `已成功为 SysReport ${formId} 注册 ${result.added} 条过滤参数(写入 SysReportForm.SQLDataSource.KeyWordList)。\n` +
            `**这就是 BOS Designer "过滤参数面板 → 添加参数" 的程序化等价 — 用户不需要再去 BOS Designer 手工加,F5 刷新即可。**`,
        },
        null,
        2,
      );
    },
  };
}
