---
name: metaobject-creation-index
title: K/3 Cloud 创建新 metaobject (模板继承) 索引
description: 创建新单据 / 基础资料 / 账表 / 动态表单(过滤器/列表/向导/参数对话框)时加载。BOS Designer "新建向导 → 模板继承"功能的等价实现 — 实际是从一个 BOS 自带的模板对象继承,wire 跟 k3cloud_create_extension 同款 SaveForIDEV9 路径。本 skill 是索引,具体子主题按需 load_skill_file。
version: 1.0.0
category: metadata
---

# K/3 Cloud 创建新 metaobject

> **首先问自己**:真的需要新建吗?**99% 的实施需求应该扩展已有标准对象**,不要新建。
> 判断规则见 `prompts/when-to-create-new-vs-extend`。

## 两个工具概览

| 工具 | 用途 | 前置条件 |
|---|---|---|
| `k3cloud_create_from_template` | 从 BOS_* 模板继承创建新 metaobject(账表 / 单据 / 基础资料 / 动态表单) | 无(先选模板) |
| `k3cloud_register_sysreport_python_plugins` | 给已有账表挂 Python 服务插件(`SysReportServicePlugins`) | 必须已有 SysReport formId(通常由上面创建) |

## ModelType 总览

| ModelType | 对应类型 | 工具支持 | 已注册模板 |
|---|---|---|---|
| **100** | 单据(BillForm) | `k3cloud_create_from_template` | 5 个 |
| **400** | 基础资料(BaseDataForm) | `k3cloud_create_from_template` | 7 个 |
| **500** | 动态表单(DynamicForm) | `k3cloud_create_from_template` | 9 个(Plan 7.7) |
| **900** | 账表(SysReport) | `k3cloud_create_from_template` + `k3cloud_register_sysreport_python_plugins` | 6 个(简单/分页/树形/明细/汇总/交叉) |

完整模板字典见 `references/template-catalog`。

## 何时新建 vs 何时扩展

**扩展已有对象(`k3cloud_create_extension` + 加字段 + Python 插件)几乎总是正确答案。**

只有在以下情况才新建:

1. 客户有真正全新对象,标准 K/3 里完全没有对应物(如特有的"质量追溯卡片")
2. 客户需要的是独立账表查询,挂哪个标准账表都不合适
3. 标准对象的生命周期 / 权限模型不匹配,且扩展无法解决

决策树(含反模式)见 `prompts/when-to-create-new-vs-extend`。

## 工具调用流程

**典型场景:新建账表 + 挂 Python 插件**

```
Step 1  k3cloud_create_from_template(
            templateId  = "BOS_SimpleSysReport",  ← 从 template-catalog 选
            newFormId   = "k" + randomUUID().replace(/-/g, ""),
            name        = "质量追溯账表",
            subSystemId = "23"                     ← 未知时用 23
        )
        → 返回 { ok: true, newFormId, ... }

Step 2  k3cloud_register_sysreport_python_plugins(
            formId    = <Step 1 的 newFormId>,
            className = "QualityTracePlugin",
            pyBody    = <完整 IronPython 2.7 源码>
        )
        → 返回 { ok: true, formId, className, ... }
```

**典型场景:新建基础资料(无插件)**

```
Step 1 only:  k3cloud_create_from_template(
                  templateId  = "BOS_OrgControlBDModel",
                  newFormId   = "k" + randomUUID().replace(/-/g, ""),
                  name        = "供应商档案(自定义)",
                  subSystemId = "23"
              )
```

**典型场景:新建单据**

```
Step 1 only:  k3cloud_create_from_template(
                  templateId  = "BOS_BillWithEntryModel",  ← 带分录
                  newFormId   = "k" + randomUUID().replace(/-/g, ""),
                  name        = "客户特有质量追溯单",
                  subSystemId = "23"
              )
  ← 之后可用 k3cloud_register_python_plugins 挂表单插件
```

## 客户端缓存提示

BOS 写入成功后客户端**不会自动刷新**:

- **BOS Designer 刷新**:F5 可以看到新对象出现在对象浏览器
- **K/3 Cloud 客户端**:必须**关闭客户端 → 完全登出 → 重新登录**才能访问新单据/账表
- 详见 memory `bos_client_cache_relogin`

## 子文件导航(按需 load_skill_file)

| 何时拉 | path 传给 `load_skill_file` |
|---|---|
| 不确定要新建还是扩展,需要决策树 | `prompts/when-to-create-new-vs-extend` |
| 选哪个模板,场景 → 模板对照表 | `references/template-catalog` |
| SaveForIDEV9 envelope 结构,DCXML root tag,`__paras__` 字段 | `references/wire-format` |
| 账表建好后配过滤参数 + 报表列(Plan 7.8 工具:add_sysreport_filter_parameters / add_sysreport_columns) | `references/sysreport-filter-and-columns` |

**不要一次性全拉**。每份 150-350 行,按需加载即可。
