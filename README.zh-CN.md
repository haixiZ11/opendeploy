<p align="center">
  <img src="./resources/icon.svg" alt="开达 OpenDeploy" width="96" />
</p>

<h1 align="center">开达 OpenDeploy</h1>

> 面向 ERP 实施顾问的开源 AI 智能体 —— 让"一个人的交付团队"成为可能。

[English](./README.md) | [简体中文](./README.zh-CN.md)

---

大部分 "AI 辅助工具" 现在长这样:

> **顾问**: 客户要加个 xxx 功能
>
> **AI**: 好,我帮你写 Python 插件
>
> **顾问**: ……但字段得先在系统里建,审批流也得改
>
> **AI**: 那个你自己去配

**开达想做的是: 这一整串,AI 全干。**

## 演示

<p align="center">
  <img src="./assets/wizard.gif" alt="开达首次配置" width="720" />
  <br/><sub>首次配置 —— 配置你的 LLM</sub>
</p>

<p align="center">
  <img src="./assets/project.gif" alt="开达创建项目" width="720" />
  <br/><sub>创建项目 —— 接入 金蝶云星空 标准版/企业版 V9</sub>
</p>

<p align="center">
  <img src="./assets/skills.gif" alt="开达 skills 知识库" width="720" />
  <br/><sub>Skills 知识库 —— 实施方法论 + BOS 手册按需加载</sub>
</p>

<p align="center">
  <img src="./assets/case.gif" alt="开达真实定制闭环" width="720" />
  <br/><sub>真实定制闭环 —— 业务需求 → 插件落地</sub>
</p>

## 已支持的功能

**LLM 适配**(自带 API Key 即用):Claude · GPT · DeepSeek · Qwen · GLM · Kimi · 豆包 · 混元 · MiniMax · 百川 · Ollama 本地

**金蝶云星空 V9 二开**(全程走 BOS HTTP RPC,不接客户数据库):

- **新建 metaobject(BOS 模板继承)** —— 27 个模板覆盖 4 大 ModelType(单据 / 基础资料 / 账表 / 动态表单),wire 等价 BOS Designer "新建向导 → 模板继承"(**v0.2 新增**)
- 扩展生命周期 —— 新建 / 删除 / 列举
- 字段 —— 12 类(文本 / 数值 / 金额 / 数量 / 日期 / 复选 / 下拉 / 基础资料 / 助记码 / 计量单位 / 公式 / 物料属性等)
- 单据体 —— EntryEntity / TabPage / TabControl 的 创建 / 删除 / 改名
- Python 插件 —— 表单插件(30+ 事件)、列表插件、操作服务插件、账表服务端插件,批量挂载,产物落项目目录
- 业务规则 —— Calculate / GetInvStock 等
- 自定义操作 + 工具栏按钮 + 列表菜单按钮
- 单据转换规则 —— 通用化覆盖任意源/目标对象,扩展 + 转换插件
- 属性面板 —— 必填 / 默认值 / 显示行号 / 组织字段绑定 / 实体必填

**知识库**(11 个 skill / 67 份 markdown / 14933 行,GitHub 直拉,Gitee 镜像兜底):实施流程方法 + 二开决策树 + BOS 各类元素手册 + 客户实证案例

**架构**:零自营服务器 · 凭据全部本地(明文存 `settings.json`,renderer 进程不接触)· 单顾问本地工具

## 怎么开始

需要 Windows 10/11 + 一个 LLM API Key。

**下载安装包(推荐)**

[**👉 v0.2.4-alpha 安装包**](https://github.com/qiaolei227/opendeploy/releases/latest) —— 下载 `OpenDeploy-*-x64-setup.exe` 双击安装。

**本地开发**

```bash
pnpm install
pnpm dev
```

## 当前状态

**v0.2.4-alpha 已发布** —— 三处用户可见改动。(1) 小米 MiMo 作为第 10 家 LLM provider 加入 —— OpenAI 兼容, 3 个模型含 MiMo V2.5 Omni 全模态。(2) Wizard 引导流程现在选完 provider 后可以通过下拉框挑具体模型, 不再只能默认 recommended。(3) LLM 流式错误 (HTTP 402 余额不足 / 401 / 429 等) 现在以可见错误气泡显示在对话里 —— 此前 assistant 气泡一闪而过, 用户无法判断是否真的发出去过。另外: 全 9 家 provider 模型目录按 2026-05-29 当天官方价目/规格刷新 —— DeepSeek maxOutput 16K → 384K + v4-pro 永久 1/4 价; 豆包 seed-2.0 系列上调 2-3 倍 + 新增 mini 档; 混元 turbos-latest 上下文修正 224K → 32K; Kimi K2.6 上下文 256K → 262_144 + 重定价; Claude Opus 4.7 → 4.8; OpenAI 不存在的 `gpt-5.5-pro` 删除, 换成真实的 `gpt-5.4`; 新增 Qwen3.7-max 旗舰。基于 v0.2.3-alpha 的密码 advisory 容错 + LocaleValue fail-fast + Plan 7.8 SysReport 工具构建。前序: v0.2.3-alpha → v0.2.2-alpha (SysReport 工具) → v0.2.1-alpha (验证码连接修复) → v0.2.0-alpha (Plan 7 BOS 覆盖面)。面向 BOS 二开顾问的内部预览版, 功能 / API / UX 仍可能变动。

- 目标: 金蝶云星空 V9 私有部署版(标准版 / 企业版,V8 暂不兼容 —— 登录协议差异)
- 平台: 仅 Windows x64(macOS / Linux 视用户反馈)
- 11 个 skill / 69 份 markdown / 15310 行行业知识
- 910 单元/wire-replay 测试,lint clean,真服务器 smoke + agent loop e2e 全覆盖

## 开源协议

MIT —— 详见 [LICENSE](./LICENSE)
