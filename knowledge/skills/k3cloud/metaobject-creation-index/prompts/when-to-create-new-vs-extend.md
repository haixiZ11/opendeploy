# 决策树:新建 metaobject vs 扩展已有对象

> 本文件是 `metaobject-creation-index` 的子文件。按需加载。

## 核心原则

**扩展已有对象几乎总是正确答案。**

K/3 Cloud 实施顾问的日常工作 99% 是在标准单据/基础资料上扩展字段、挂插件、配规则。
新建 metaobject 是例外,不是常规操作。

---

## 决策树

```
用户说"我想建一个 XX 功能"
        │
        ▼
1. K/3 标准模块里有没有对应的标准对象?
   (用 k3cloud_search_metadata / k3cloud_list_extensions 先查)
        │
   有 ──┼──────────────────────────────────────────────────────────────────┐
        │                                                                  ▼
        │                                           ✅ 走扩展路径
        │                                              k3cloud_create_extension
        │                                              → k3cloud_add_fields
        │                                              → k3cloud_register_python_plugins
        │                                              → 业务规则 / 转换规则(手工 BOS)
        │
   没有 ▼
2. 客户需要的是"全新实体",还是只是"标准对象的视图/报表"?
        │
   报表 ┼──────────────────────────────────────────────────────────────────┐
        │                                                                  ▼
        │                                           考虑账表(ModelType=900)
        │                                           BOS_SimpleSysReport / BOS_MoveSysReport
        │                                           → k3cloud_create_from_template
        │
   全新 ▼
3. 是否有接近的标准对象可以扩展字段覆盖?
   (关键问:生命周期 / 审核流 / 组织权限是否能复用标准对象的)
        │
   能   ┼──────────────────────────────────────────────────────────────────┐
        │                                                                  ▼
        │                                           ✅ 走扩展路径(强烈推荐)
        │
   真不能 ▼
4. ✅ 确认新建
   → 选 template-catalog 对应模板
   → k3cloud_create_from_template
```

---

## 反模式 — 不该新建的理由

以下理由**不构成新建 metaobject 的依据**:

| 用户说的话 | 正确姿势 |
|---|---|
| "扩展太多字段太丑了" | 实施惯例就是在标准对象上堆字段;BOS Designer 可以分 TabPage;扩展字段多≠建新对象 |
| "客户化需求很复杂" | 复杂 ≠ 全新对象。用扩展 + 操作 + 工具栏 + Python 插件组合可以实现 90% 的复杂逻辑 |
| "我不知道怎么找标准对象" | 先用 `k3cloud_search_metadata` / `k3cloud_list_extensions` 看看;让 agent 帮你找 |
| "客户说他们要自己建一个单据" | 问清楚业务场景:是真正全新单据(有独立单号、审批流、库存记账),还是只是"加几个字段" |
| "扩展里改不了标准字段的显示名" | 这是 BOS 限制,不是新建的理由;用字段属性面板 + Python 插件绕 |

---

## 什么情况下新建是合理的

以下情况下新建才有充分理由:

1. **真正全新对象** — 客户业务流程里有 K/3 完全没有对应的实体
   - 例:某制造企业要"质量追溯卡片",关联生产批次但完全独立于标准质检单
   - 不是例:客户想加字段,把销售订单"包装"成自己的"采购申请单"——这应该扩展销售订单或者找真正的采购申请单

2. **独立账表查询** — 客户想要一个完全自定义的数据查询视图
   - 例:跨多张表汇总的管理驾驶舱报表
   - 这时用 BOS_SimpleSysReport / BOS_MoveSysReport,Python 服务插件写查询逻辑

3. **标准对象生命周期完全不匹配** — 例如客户的流程不需要审核,但标准单据强制审核,且审核绕不开
   - 这种情况少见,通常操作插件 + 权限控制能解决

---

## 选型后的下一步

| 决策 | 下一步 |
|---|---|
| **扩展已有对象** | 加载 `k3cloud/bos-features-index` 了解完整扩展能力 |
| **新建账表** | 选模板 → 见 `references/template-catalog`,然后调 `k3cloud_create_from_template` + `k3cloud_register_sysreport_python_plugins` |
| **新建单据** | 选模板 → 见 `references/template-catalog`,调 `k3cloud_create_from_template` |
| **新建基础资料** | 选模板 → 见 `references/template-catalog`,调 `k3cloud_create_from_template` |
| **新建动态表单(过滤器/向导/参数对话框)** | 选模板 → 见 `references/template-catalog` 动态表单段,调 `k3cloud_create_from_template`。常用:`BOS_CommonFilter`(过滤器)、`BOS_WIZARDFORMTPL`(向导)、`BOS_BILLTYPEPARAMODEL`(参数面板) |
