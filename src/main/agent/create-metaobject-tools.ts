/**
 * Plan 7.6 — agent tools for creating new K/3 Cloud metaobjects via BOS template inheritance.
 *
 * k3cloud_create_from_template: inherits from any BOS_* template (accounts table /
 * bill form / base data / dynamic form) via the same SaveForIDEV9 wire path used
 * by existing extension tools. Mirrors BOS Designer "New Wizard → Template Inheritance".
 *
 * k3cloud_register_sysreport_python_plugins: appends a Python plugin to an existing
 * SysReport's SysReportServicePlugins collection. Requires an existing SysReport formId
 * (typically created by k3cloud_create_from_template).
 *
 * Tool descriptions carry the contract and UX hints so LLM routing is
 * reliable without consulting SKILL.md first.
 */

import type { ToolHandler } from './tools';
import type { K3CloudConnector } from '../erp/k3cloud/connector';

export function createFromTemplateTool(c: K3CloudConnector): ToolHandler {
  return {
    parallelSafe: false,
    definition: {
      name: 'k3cloud_create_from_template',
      description:
        '从 BOS 自带模板继承创建新 metaobject(账表/单据/基础资料/动态表单)。\n' +
        '\n' +
        '**核心约束:templateId 必须从 metaobject-creation-index skill 的 template-catalog 选,不要乱猜。**\n' +
        '\n' +
        '常用模板:\n' +
        '- BOS_SimpleSysReport — 简单账表(单表查询型)\n' +
        '- BOS_MoveSysReport — 分页账表(数据量大需分页)\n' +
        '- BOS_BillModel — 单据(无分录)\n' +
        '- BOS_BillWithEntryModel — 单据(带分录)\n' +
        '- BOS_BaseDataModel — 基础资料(根模板,minimal)\n' +
        '- BOS_OrgControlBDModel — 基础资料(组织控制,K3 客户最常用)\n' +
        '- BOS_NoOrgControlBDModel — 基础资料(无组织控制)\n' +
        '\n' +
        '完整列表见 metaobject-creation-index skill 的 references/template-catalog。\n' +
        '\n' +
        'newFormId 格式约定:k + 32 位 lowercase hex(例如 k + randomUUID().replace(/-/g, ""))。\n' +
        '\n' +
        '执行后:新对象会出现在 BOS Designer "对象浏览器"对应子系统下。客户端需要 F5 刷新或关闭客户端重登才能看到(memory bos_client_cache_relogin)。\n' +
        '账表对象后续可用 k3cloud_register_sysreport_python_plugins 挂 Python 服务插件。',
      parameters: {
        type: 'object',
        properties: {
          templateId: {
            type: 'string',
            description:
              '要继承的 BOS 模板 ID,必须 BOS_ 开头。常用:BOS_SimpleSysReport / BOS_MoveSysReport / BOS_BillModel / BOS_BillWithEntryModel / BOS_OrgControlBDModel。完整列表见 metaobject-creation-index skill。',
          },
          newFormId: {
            type: 'string',
            description:
              '新对象的 FormID。BOS 约定格式:k + 32 位 lowercase hex(共 33 字符)。例如 "kf9157e0f0a034534be3f6a6ab01699d1"。必须全局唯一,用 crypto.randomUUID().replace(/-/g, "") 生成。',
          },
          name: {
            type: 'string',
            description: '新对象的中文显示名,1-80 字符。例如"质量追溯账表"。',
          },
          subSystemId: {
            type: 'string',
            description:
              '子系统 ID(字符串数字)。用 k3cloud_list_subsystems 获取。未知时传 "23"(BOS 通用开发子系统)。',
          },
        },
        required: ['templateId', 'newFormId', 'name', 'subSystemId'],
      },
    },
    async execute(args) {
      const templateId = args.templateId;
      const newFormId = args.newFormId;
      const name = args.name;
      const subSystemId = args.subSystemId;

      if (typeof templateId !== 'string' || !templateId.startsWith('BOS_')) {
        throw new Error(
          'k3cloud_create_from_template: templateId 必须是 BOS_ 开头的模板对象 ID。' +
            '用 metaobject-creation-index skill 的 references/template-catalog 选正确模板。',
        );
      }
      if (
        typeof newFormId !== 'string' ||
        !/^k[a-f0-9]{32}$/.test(newFormId)
      ) {
        throw new Error(
          'k3cloud_create_from_template: newFormId 必须是 k + 32 位 lowercase hex 格式(共 33 字符)。' +
            '例如:"k" + crypto.randomUUID().replace(/-/g, "") 生成。',
        );
      }
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('k3cloud_create_from_template: name 不能为空。');
      }
      if (name.trim().length > 80) {
        throw new Error('k3cloud_create_from_template: name 不能超过 80 字符。');
      }
      if (typeof subSystemId !== 'string' || subSystemId.trim() === '') {
        throw new Error(
          'k3cloud_create_from_template: subSystemId 是字符串数字,用 k3cloud_list_subsystems 获取,未知传 "23"。',
        );
      }

      const result = await c.createFromTemplate({
        templateId: templateId.trim(),
        newFormId: newFormId.trim(),
        name: name.trim(),
        subSystemId: subSystemId.trim(),
      });

      if (!result.isSuccess) {
        throw new Error(
          `k3cloud_create_from_template 失败:${result.messageTitle ?? ''} ${result.messageDetail ?? '<no detail>'}`,
        );
      }

      return JSON.stringify(
        {
          ok: true,
          templateId: templateId.trim(),
          newFormId: newFormId.trim(),
          name: name.trim(),
          message:
            `新 metaobject ${newFormId.trim()} 已通过模板 ${templateId.trim()} 继承创建成功。` +
            '请让用户在 BOS Designer 里 F5 刷新,或关闭客户端重登以看到新对象。',
        },
        null,
        2,
      );
    },
  };
}

export function registerSysReportPythonPluginTool(c: K3CloudConnector): ToolHandler {
  return {
    parallelSafe: false,
    definition: {
      name: 'k3cloud_register_sysreport_python_plugins',
      description:
        '给已有 SysReport(账表)对象挂 Python 服务插件,写入 `SysReportServicePlugins` 集合。\n' +
        '\n' +
        '**前置条件**:formId 必须是已存在的 SysReport 对象 ID(通常由 `k3cloud_create_from_template` 创建)。\n' +
        '\n' +
        '**插件基类**:`AbstractSysReportServicePlugIn`(命名空间 `Kingdee.BOS.Core.Report.PlugIn`)。\n' +
        '**Python 代理类**:`PythonReportPlugIn` — BOS 用它在 IronPython 引擎中执行 `pyBody` 脚本。\n' +
        '\n' +
        '**常用事件**:\n' +
        '- `OnPreparePropertys(e)` — 注册需要加载的字段属性(账表取数前)\n' +
        '- `BeginFilter(e)` — 过滤参数准备完成后触发(可改查询条件)\n' +
        '- `OnLoadCell(e)` — 每个单元格加载时触发(可改显示值 / 格式)\n' +
        '\n' +
        '**pyBody 要求**:完整 IronPython 2.7 源码,包含 `import clr` + `clr.AddReference("Kingdee.BOS.Core")` + `from Kingdee.BOS.Core.Report.PlugIn import AbstractSysReportServicePlugIn` + 至少一个继承自它的类定义。\n' +
        '\n' +
        '**本工具每次调用覆盖**:BOS 服务端把每次 Save 当成账表对象的完整差异。如需挂多个插件,需将旧插件内容合入新的 pyBody 或分步骤调用(后续 call 会覆盖前次)。\n' +
        '\n' +
        '**写入后验证**:用 `k3cloud_get_object` 或 readback 检查 FKERNELXML 是否含 className。',
      parameters: {
        type: 'object',
        properties: {
          formId: {
            type: 'string',
            description:
              '目标 SysReport 的 FormID(k + 32 位 lowercase hex,共 33 字符)。必须是已存在的账表对象 ID。',
          },
          className: {
            type: 'string',
            description:
              '插件类名标识(合法 Python 类名,例 "QualityReportPlugin" / "CostReportPlugin")。BOS Designer SysReportServicePlugins 列表里显示此名称。',
          },
          pyBody: {
            type: 'string',
            description:
              '完整 IronPython 2.7 源码。须包含 import 块 + 继承 `AbstractSysReportServicePlugIn` 的类定义(至少覆盖 `OnPreparePropertys` / `BeginFilter` / `OnLoadCell` 之一)。代码中随便用 `<` / `>` / `&` — 工具用 CDATA 包裹,无需手动转义。',
          },
        },
        required: ['formId', 'className', 'pyBody'],
      },
    },
    async execute(args) {
      const formId = String(args.formId ?? '').trim();
      const className = String(args.className ?? '').trim();
      const pyBody = String(args.pyBody ?? '');

      if (!formId || !/^k[a-f0-9]{32}$/.test(formId)) {
        throw new Error(
          'k3cloud_register_sysreport_python_plugins: formId 必须是 k + 32 位 lowercase hex 格式(共 33 字符)。',
        );
      }
      if (!className || !/^[a-z_][a-z0-9_]*$/i.test(className)) {
        throw new Error(
          'k3cloud_register_sysreport_python_plugins: className 必须是合法 Python 标识符(字母/数字/下划线,不以数字开头)。',
        );
      }
      if (!pyBody.trim()) {
        throw new Error('k3cloud_register_sysreport_python_plugins: pyBody 不能为空。');
      }

      const result = await c.registerSysReportPythonPlugin({ formId, className, pyBody });

      if (!result.isSuccess) {
        throw new Error(
          `k3cloud_register_sysreport_python_plugins 失败:${result.messageTitle ?? ''} ${result.messageDetail ?? '<no detail>'}`,
        );
      }

      return JSON.stringify(
        {
          ok: true,
          formId,
          className,
          message:
            `Python 服务插件 "${className}" 已成功注册到账表 ${formId} 的 SysReportServicePlugins 集合。` +
            '请让用户在 BOS Designer 里 F5 刷新,或关闭客户端重登以看到新插件。',
        },
        null,
        2,
      );
    },
  };
}
