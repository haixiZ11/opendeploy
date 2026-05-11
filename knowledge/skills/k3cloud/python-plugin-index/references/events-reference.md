# 表单插件事件签名参考

`AbstractDynamicFormPlugIn`(动态表单基类,115 个 virtual 方法)+ `AbstractBillPlugIn`(单据专属基类,19 个额外方法)。**精确签名以 `D:\K3Cloud\WebSite\Bin\Kingdee.BOS.Core.dll` 为准**——本表对不上时以 DLL 为准(2026-05-11 反编译实证)。

下表标注:
- 🟢 **客户实战已验证**:`D:\Project\天宇药业产销协同\` + `D:\Project\sarcah\JSJXCloud2025\` 真实 C# 项目 override 次数(2026-05-11 统计)
- 🟡 反编译可用 + 主流程文档列出
- 🔴 反编译可用但实施场景罕见

---

## 表单生命周期

### `OnInitialize(self, e)` 🟢 (1)
- 触发:**插件实例化时**(`AbstractDynamicFormPlugIn`)。最早的钩子,此时还没 BusinessInfo / Model。
- 常用:绑定上下文(`self.SomeFlag = False`)初始化插件级状态
- `e.Cancel`:**不支持**

### `OnLoad(self, e)` 🟢 (1)
- 触发:Form 控件加载完(`AbstractDynamicFormPlugIn`)。BusinessInfo 已就绪但数据未绑定
- 常用:动态加按钮 / 控件 / 注册事件
- `e.Cancel`:**不支持**

### `BeforeBindData(self, e)` 🟡
- 触发:数据绑定前。`Model.DataObject` 有值但控件未显示
- 常用:基于业务字段初始化默认值
- `e.Cancel`:**不支持**

### `AfterBindData(self, e)` 🟢 (49 — 最高频)
- 触发:数据绑定后。控件已显示,字段值都可读
- 常用:读初始字段值决定界面显隐 / 只读 / 提示信息
- `e.Cancel`:**不支持**

### `BeforeClosed(self, e)` 🟢 (5)
- 触发:表单关闭前
- 常用:未保存提醒 / 阻止关闭
- `e.Cancel`:**支持**,设 True 阻止关闭

### `FormClosed(self, e)` 🔴
- 触发:表单关闭后(已脱离 UI 线程)
- 常用:清理插件级 timer / 注销事件
- `e.Cancel`:**不支持**

---

## 数据加载 / 复制

### `CreateNewData(self, e)` 🟡
- 触发:点击"新建"按钮,空数据对象创建后
- 常用:为新单据预填默认字段
- `e.Cancel`:**不支持**

### `AfterCreateNewData(self, e)` 🟡
- 触发:新建后(`CreateNewData` 之后)
- 常用:依赖完整 DataObject 的二次默认值
- `e.Cancel`:**不支持**

### `LoadData(self, e)` 🟡 (Bill 专属)
- 触发:加载已有单据,`e.DataObject` 已可用
- 常用:加载后字段重算 / 旧数据兼容
- `e.Cancel`:**不支持**

### `AfterLoadData(self, e)` 🟢 (1, Bill 专属)
- 触发:加载完成后
- 常用:基于已加载数据初始化插件状态
- `e.Cancel`:**不支持**

### `CopyData(self, e)` / `AfterCopyData(self, e)` 🟢 (2, Bill 专属)
- 触发:复制单据流程,前者执行复制,后者复制完成
- 常用:复制后重置字段(单号 / 状态 / 复制了不该复制的字段)
- `e.Cancel`:`CopyData` 支持 / `AfterCopyData` 不支持

---

## 字段值变化

### `DataChanged(self, e)` 🟢 (30)
- 触发:头字段 / 明细字段值**变化后**
- `e.Field.Key` — 字段 Key,如 `"FCustId"`
- `e.OldValue` / `e.NewValue` — 变化前后值
- `e.Row` — 明细行索引(头字段 = -1)
- `e.Cancel`:**不支持**(已经变了,无法回滚)

```python
def DataChanged(self, e):
    if e.Field.Key == "FCustId":
        cust = self.Model.GetValue("FCustId")
        if cust:
            self.Model.SetValue("FSalerId", cust["FSellerId"])
```

### `DataChanging(self, e)` 🟡
- 触发:字段值变化**前**(验证用,`IBillModelPlugIn`)
- 同上属性,多一个 `e.Cancel`
- `e.Cancel`:**支持**,设 True 拒绝这次值变化

### `BeforeUpdateValue(self, e)` 🟢 (10)
- 触发:值更新前(更细粒度,触发于 SetValue/SetItemValue 调用前)
- `e.Key` — 字段 Key / `e.NewValue` — 新值 / `e.Row` — 行索引
- 常用:截断 / 规范化用户输入(去空格 / 大小写 / 单位换算)
- `e.Cancel`:**支持**

### `BeforeSetItemValueByNumber(self, e)` 🟢 (1)
- 触发:通过基础资料 number(编码)设值前(典型:F7 弹窗选完之后赋值)
- 常用:根据编码改写 / 反查其他字段
- `e.Cancel`:**支持**

---

## 单据体行操作

### `BeforeCreateNewEntryRow(self, e)` / `AfterCreateNewEntryRow(self, e)` 🟢 (1 after)
- 触发:单据体新增行前/后
- `e.EntryKey` — 单据体 Key / `e.Row` — 行索引(新行)
- 常用:阻止超过 N 行 / 给新行预填默认值
- `e.Cancel`:`Before` 支持 / `After` 不支持

### `BeforeDeleteEntry(self, e)` / `AfterDeleteEntry(self, e)` 🟡
- 触发:删除整个单据体的所有行前/后
- `e.Cancel`:`Before` 支持

### `BeforeDeleteRow(self, e)` / `AfterDeleteRow(self, e)` 🟡
- 触发:删除单行前/后
- `e.EntryKey, e.Row`
- `e.Cancel`:`Before` 支持

### `AfterCopyRow(self, e)` 🟡
- 触发:复制行后
- 常用:复制后清空敏感字段(如行号)

### `AfterEntryBatchFill(self, e)` 🟡
- 触发:批量填充单据体行后(典型:从其他单据下推填进来)
- 常用:批量填充后重算 / 校验

### `EntityRowClick(self, e)` / `EntityRowDoubleClick(self, e)` 🔴
- 触发:点击 / 双击单据体行
- 常用:行级交互(很少在 Python 用)

---

## 保存 / 提交 / 审核

### `BeforeSave(self, e)` 🟢 (2)
- 触发:保存前,客户端 UI 线程
- 常用:业务规则校验,金额 / 数量合理性检查
- `e.Cancel`:**支持**。拦截姿势:同时 `e.Cancel = True` 且 `raise KDException(...)`,详见 `prompts/error-handling`

```python
def BeforeSave(self, e):
    amount = self.Model.GetValue("FAllAmount")
    if amount is None or amount <= 0:
        e.Cancel = True
        raise KDException("OPD-SAL-001", u"金额必须大于 0")
```

### `AfterSave(self, e)` 🟡
- 触发:保存后,带 `e.Result`
- 常用:日志 / 通知,**不能取消**,只能副作用
- `e.Cancel`:**不支持**

### `SaveBillFailed(self, e)` / `AfterSaveFailed(self, e)` 🟡 (Bill 专属)
- 触发:保存失败时
- `e.Result` — 失败原因
- 常用:失败重试 / 错误友好化

### `BeforeSubmit(self, e)` / `AfterSubmit(self, e)` 🟡 (Bill 专属)
- 触发:提交流程(单据从"暂存"进入"已提交"状态)
- 常用:提交前最终校验
- `e.Cancel`:`Before` 支持

### `BeforeUpdate(self, e)` / `AfterUpdate(self, e)` 🟡
- 同 Save 系列,但触发于"修改已有单据"(而非新建)
- 细节同上

### `BeforeSetStatus(self, e)` / `AfterSetStatus(self, e)` 🟡 (Bill 专属)
- 触发:单据状态变更前/后(暂存/已提交/已审核)
- `e.Status` — 目标状态
- `e.Cancel`:`Before` 支持

### 审核 / 反审核 / 弃审
**表单插件拿不到**。这些拦截需要**操作插件**(`T_META_OPERATESERVICEPLUGIN`),OpenDeploy v0.1 不支持。

遇到用户要求"审核时校验",告知:
> "审核拦截需要操作插件,当前 OpenDeploy 工具链不支持。建议:
> 1. 在 BOS Designer 手工注册 C# 操作插件
> 2. 或者把校验时机改到'保存前',保存通过即意味着合规
> 3. 未来 OpenDeploy v0.2+ 会覆盖操作插件"

---

## 按钮事件

### `BarItemClick(self, e)` 🟡
- 触发:工具栏按钮点击前
- `e.BarItemKey` — 按钮 Key
- `e.Cancel`:**支持**(可阻止默认行为)

### `AfterBarItemClick(self, e)` 🟢 (32 — 第二高频)
- 触发:工具栏按钮点击后(已经走完默认行为)
- `e.BarItemKey` — 按钮 Key
- 常用:**自定义按钮**最常用挂点
- `e.Cancel`:**不支持**

```python
def AfterBarItemClick(self, e):
    if e.BarItemKey == "tbCalcBtn":
        self._recalculate_total()
```

### `ButtonClick(self, e)` / `AfterButtonClick(self, e)` 🟢 (2 after)
- 触发:单据体内按钮(非工具栏)点击前/后
- `e.Key` — 按钮 Key
- `e.Cancel`:`ButtonClick` 支持

### `EntryBarItemClick(self, e)` / `AfterEntryBarItemClick(self, e)` 🟢 (3 after)
- 触发:单据体工具栏按钮(单据体 toolbar)前/后
- `e.BarItemKey, e.EntryKey, e.Row`

### `ToolBarItemClick(self, e)` / `AfterToolBarItemClick(self, e)` 🔴
- 触发:列表工具栏(主要在列表插件里用)

### `ContextMenuItemClick(self, e)` 🔴
- 触发:右键菜单点击
- `e.MenuItemKey`

---

## 基础资料(F7)选择

### `BeforeF7Select(self, e)` 🟡
- 触发:点击基础资料字段的放大镜前,弹出选择器前(`IBillModelPlugIn`)
- 常用:动态过滤基础资料列表(比如选客户时只列当前组织的)
- `e.FilterString` — 可赋值,SQL 式过滤表达式
- `e.Cancel`:**支持**,阻止弹出

```python
def BeforeF7Select(self, e):
    if e.FieldKey == "FCustId":
        org_id = self.Context.CurrentOrganizationInfo.ID
        e.FilterString = "FUseOrgId.FOrgId = %d" % org_id
```

### `BeforeF7ViewSelect(self, e)` 🟡
- 触发:选择面板里的候选项被选中前
- 常用:根据当前行内容限制可选项
- `e.Cancel`:**支持**

---

## 操作(Action)前后

### `BeforeDoOperation(self, e)` 🟡
- 触发:任意操作(保存/提交/审核/自定义操作)执行前
- `e.OperateKey` / `e.OperationStatus`
- 常用:跨操作的统一校验
- `e.Cancel`:**支持**

### `AfterDoOperation(self, e)` 🟡
- 触发:任意操作执行后
- `e.OperateKey, e.OperationResult`
- 常用:操作完成后副作用(日志 / 通知 / 联动其他单据)

---

## 其他较少用但有 idiom 的

### `OnQueryProgressValue(self, e)` 🟢 (1)
- 触发:长操作期间查询进度
- 常用:自定义进度条 update

### `TabItemSelectedChange(self, e)` 🔴
- 触发:Tab 页切换
- `e.SelectedTabKey`
- 常用:Tab 切换时懒加载 / 重算

### `OnTimerElapsed(self, e)` 🔴
- 触发:Form Timer 触发(需要预先设置 Timer)
- 常用:定时刷新数据

### `LanguageChanged(self, e)` 🔴
- 触发:用户切多语言
- 常用:多语言重算 UI 文案

---

## 事件属性总表(实施常用 30 个)

| 事件 | 时机 | `e.Cancel` | 常用 `e.*` | 客户实战 |
|---|---|---|---|---|
| `OnInitialize` | 插件实例化 | ❌ | - | 🟢 |
| `OnLoad` | Form 加载完 | ❌ | - | 🟢 |
| `BeforeBindData` | 绑定前 | ❌ | - | 🟡 |
| `AfterBindData` | 绑定后 | ❌ | - | 🟢 **49** |
| `BeforeClosed` | 关闭前 | ✅ | - | 🟢 (5) |
| `CreateNewData` | 新建后 | ❌ | - | 🟡 |
| `LoadData` | 加载已有单据 | ❌ | `DataObject` | 🟡 |
| `AfterLoadData` | 加载完 | ❌ | - | 🟢 (1) |
| `CopyData` / `AfterCopyData` | 复制单据 | ✅ / ❌ | - | 🟢 (2) |
| `DataChanging` | 值变化前 | ✅ | `Field.Key, OldValue, NewValue, Row` | 🟡 |
| `DataChanged` | 值变化后 | ❌ | 同上 | 🟢 **30** |
| `BeforeUpdateValue` | 值更新前 | ✅ | `Key, NewValue, Row` | 🟢 (10) |
| `BeforeSetItemValueByNumber` | 编码赋值前 | ✅ | - | 🟢 (1) |
| `BeforeCreateNewEntryRow` / `AfterCreateNewEntryRow` | 单据体新行前/后 | ✅ / ❌ | `EntryKey, Row` | 🟢 (1) |
| `BeforeDeleteEntry` / `AfterDeleteEntry` | 删整个单据体前/后 | ✅ / ❌ | - | 🟡 |
| `BeforeDeleteRow` / `AfterDeleteRow` | 删单行前/后 | ✅ / ❌ | `EntryKey, Row` | 🟡 |
| `AfterCopyRow` | 复制行后 | ❌ | - | 🟡 |
| `AfterEntryBatchFill` | 批量填充行后 | ❌ | - | 🟡 |
| `BeforeSave` | 保存前 | ✅ | - | 🟢 (2) |
| `AfterSave` | 保存后 | ❌ | `Result` | 🟡 |
| `SaveBillFailed` / `AfterSaveFailed` | 保存失败 | ❌ | `Result` | 🟡 |
| `BeforeSubmit` / `AfterSubmit` | 提交前/后 | ✅ / ❌ | - | 🟡 |
| `BeforeUpdate` / `AfterUpdate` | 更新前/后 | ✅ / ❌ | `Result` | 🟡 |
| `BeforeSetStatus` / `AfterSetStatus` | 状态变更 | ✅ / ❌ | `Status` | 🟡 |
| `BarItemClick` / `AfterBarItemClick` | 工具栏按钮 | ✅ / ❌ | `BarItemKey` | 🟢 **32** (after) |
| `ButtonClick` / `AfterButtonClick` | 单据体内按钮 | ✅ / ❌ | `Key` | 🟢 (2) |
| `EntryBarItemClick` / `AfterEntryBarItemClick` | 单据体 toolbar | ✅ / ❌ | `BarItemKey, EntryKey, Row` | 🟢 (3) |
| `BeforeF7Select` | F7 弹窗前 | ✅ | `FieldKey, FilterString` | 🟡 |
| `BeforeF7ViewSelect` | F7 选中前 | ✅ | `FieldKey` | 🟡 |
| `BeforeDoOperation` / `AfterDoOperation` | 操作前/后 | ✅ / ❌ | `OperateKey, OperationResult` | 🟡 |
| `OnQueryProgressValue` | 进度查询 | ❌ | - | 🟢 (1) |

---

## 找不到的事件 → 查反编译

如果客户需求映射不到上述 30 个事件,完整列表(115 + 19 = 134 个 virtual 方法)需查:
- `Kingdee.BOS.Core.DynamicForm.PlugIn.AbstractDynamicFormPlugIn`(基类)
- `Kingdee.BOS.Core.Bill.PlugIn.AbstractBillPlugIn`(Bill 专属新增 19 个)
- `D:\K3Cloud\WebSite\Bin\Kingdee.BOS.Core.dll` 反编译

常见但本表未详细列的:`BeforeImportData / VerifyImportData`(导入流程)、`BeforeExportData / BeforeExportDataNew`(导出)、`BeforePrintExport / OnAfterPrint`(打印)、`OnGetConvertRule / OnTargetBillChanged`(下推链路)、`EntryCellFocued / FieldEditorFocued`(焦点)。

实施前先**用本表 → 客户实战频次 🟢 → 反编译完整集** 三层查找。
