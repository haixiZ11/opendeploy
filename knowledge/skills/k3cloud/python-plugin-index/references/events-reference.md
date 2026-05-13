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

### 审核 / 反审核 / 弃审拦截 (两条路径都通)

OpenDeploy v0.1 已实证支持两种姿势,挑哪个看场景:

**A. Form plugin 路径(推荐用于内置操作:Audit / UnAudit / Delete / Submit)**

用 `register_python_plugins` 挂 form plugin,在 `BeforeDoOperation(self, e)` 里判 `e.Operation.OperationName == "UnAudit"` 等,设 `e.Cancel = True` 拦截。最常见。

```python
class UnAuditBlocker(AbstractDynamicFormPlugIn):
    def BeforeDoOperation(self, e):
        if e.Operation.OperationName == "UnAudit":
            amount = self.Model.GetValue("FEndAmount")
            if amount and amount > 100000:
                e.Cancel = True
                raise KDException("OPD-001", u"金额 > 10 万不允许直接反审核")
```

**B. Service plugin 路径(推荐用于自定义操作 inline)**

`add_custom_operation(pluginClassName=..., pyBody=...)` 一次性建 operation + inline ServicePlugin,逻辑挂在 `BeginOperationTransaction` / `OnAddValidators` 等服务端事件。优点:校验在服务端事务上下文执行,跨调用方一致(WebAPI / REST / 移动端调同一 operation 都跑)。

选 A 还是 B:
- **内置操作** + 单纯客户端拦截 → A(轻量,UI 弹窗友好)
- **自定义操作** + 一段 inline 逻辑 → B(跟操作生命周期绑死)
- 跨多操作共享 / 涉及服务端事务一致性 → B

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

---

## 列表插件事件(`AbstractListPlugIn`,Plan 7.2)

挂在 `<ListPlugins>` 节点,通过 `k3cloud_register_list_python_plugins` 工具注册。继承 `Kingdee.BOS.Core.List.PlugIn.AbstractListPlugIn`(反编译 28 个 virtual 方法,2026-05-11)。

客户实战 2 项目频次(`SS.PCB.ListPlugin` + `JSJXCloud.Plugin.List`):

### `AfterBarItemClick(self, e)` 🟢 **17**(列表最高频)
- 触发:列表工具栏按钮点击后
- `e.BarItemKey` — 按钮 Key
- 常用:自定义按钮触发批量操作 / 导出 / 弹自定义页
- `e.Cancel`:**不支持**

```python
def AfterBarItemClick(self, e):
    if e.BarItemKey == "tbCustExport":
        self._do_custom_export()
```

### `BarItemClick(self, e)` 🟢 (4)
- 触发:列表工具栏按钮点击前
- `e.Cancel`:**支持**(可阻止默认行为)

### `EntryButtonCellClick(self, e)` 🟢 (3)
- 触发:列表行内按钮单元格点击
- `e.RowIndex, e.Key`
- 常用:行级操作(行详情 / 行级动作)

### `PrepareFilterParameter(self, e)` 🟢 (2)
- 触发:查询参数装配前(过滤条件 / 排序条件被读取)
- 常用:动态注入过滤条件(基于当前用户 / 组织 / 时间)
- `e.FilterString` / `e.OrderString` — 可赋值

### `ListRowDoubleClick(self, e)` 🟢 (2)
- 触发:双击列表行(默认行为是打开单据)
- 常用:覆盖默认打开行为 / 自定义跳转
- `e.Cancel`:**支持**(阻止默认打开)

### `FormatCellValue(self, e)` 🟢 (2)
- 触发:单元格显示格式化前
- `e.RowIndex, e.Key, e.OriginalValue`
- `e.FormatValue` — 可赋值,改单元格显示文本
- 常用:染色 / 改显示 / 隐藏敏感字段

### `AfterDoOperation(self, e)` 🟢 (1)
- 触发:列表操作(审核 / 反审核 / 删除 / 自定义操作)执行后
- `e.OperateKey, e.OperationResult`

### `BeforeSaveImportData(self, e)` 🟢 (1)
- 触发:列表导入数据保存前
- `e.Cancel`:**支持**

### `AfterBindData(self, e)` 🟢 (1)
- 触发:列表数据绑定后(列表本身也有 BindData 生命周期)

### 其他反编译可用但实战未见 🟡 / 🔴

`ListInitialize / OnGetConvertRule / OnShowConvertOpForm / OnShowTrackResult / OnTargetBillChanged / CellFormat / CellDbClick / ListCreateColumns / CreateListHeader / BatchCopyData / AfterBatchCopyData / BeforeMenuClick / AfterMenuClick / OnFormatRowConditions / ReplaceEntityTable / BeforeButtonClick / AfterButtonClick / AfterGetData / BeforeFilterSchemeChanged / FormatCellValue / CreateFilterEditorControl / PrepareFuncPermissionDataRule / AfterCreateSqlBuilderParameter / AfterCreateFilterField / BeforeGetDataForTempTableAccess / EntryHyperlinkButtonClick / ListRowDoubleClick`

按需反编译 `D:\K3Cloud\WebSite\Bin\Kingdee.BOS.Core.dll` 取精确签名。

---

## 操作服务插件事件(`AbstractOperationServicePlugIn`,Plan 7.3)

挂在 `<FormOperation>` 内的 `<ServicePlugins>` 节点(跟 form / list 插件是**完全不同的挂载点** — service plugin 是 operation-level,跟着某个具体 FormOperation 走)。通过 `k3cloud_add_custom_operation(pyBody=..., pluginClassName=...)` 工具 inline 注册 — **没有单独的 register_service_plugin 工具**。继承 `Kingdee.BOS.Core.DynamicForm.PlugIn.AbstractOperationServicePlugIn`(反编译 11 个 virtual 方法 + Python 路径走 `PythonOperationServicePlugIn`,2026-05-11)。

**何时用 service plugin** vs **form plugin**:
- **service plugin**:绑定到具体 operation,**只在那个按钮被触发时执行**。典型场景:点"反审核"按钮跑反审核校验。挂载点 `<FormOperation><ServicePlugins>`。
- **form plugin**:挂表单全局,所有 operation 都通过 BeforeDoOperation / AfterDoOperation 路径监听。典型场景:跨多按钮共享逻辑(信用额度任何操作前都校验)。挂载点 `<Form><FormPlugins>`。
- **两个都挂等于跑两次** — 按场景二选一。

客户实战 2 项目频次(`SS.PCB.ServicesPlugin` + `JSJXCloud.Plugin.Service`):

### `OnPreparePropertys(self, e)` 🟢 **36**(服务插件最高频)
- 触发:操作执行前,准备业务对象需要 Load 的属性集合
- 常用:声明本操作需要读哪些字段(BOS 默认只 load 标准字段,自定义字段需 explicit append `e.FieldKeys.Add("F_PAIJ_X")`)
- `e.Cancel`:**不支持**

```python
def OnPreparePropertys(self, e):
    e.FieldKeys.Add("F_PAIJ_Custom1")
    e.FieldKeys.Add("F_PAIJ_Custom2")
```

### `BeginOperationTransaction(self, e)` 🟢 (28)
- 触发:**事务开始时**(每一批操作单据进入事务前)
- `e.DataEntitys` — 本次操作的所有数据对象数组
- 常用:批量校验/反写关联单据(在同一事务内)
- `e.Cancel`:**支持**(取消整个操作)

```python
def BeginOperationTransaction(self, e):
    for bill in e.DataEntitys:
        if bill["FTotalAmount"] > 100000:
            self._add_error(bill, u"金额超 10 万需主管审核")
```

### `BeforeExecuteOperationTransaction(self, e)` 🟢 (10)
- 触发:事务**即将执行核心动作**(默认动作之前)
- 常用:在默认核心动作之前注入逻辑(典型:审核前修字段)
- `e.Cancel`:**支持**

### `OnAddValidators(self, e)` 🟢 (8)
- 触发:验证器集合装配时
- 常用:注册自定义 `IValidator` 到 `e.Validators`,让 BOS 引擎在验证阶段调用
- 跟 `IValidator.Validate(self, ctx)` 配合,**Validate 是 IValidator 接口的方法**(客户实战 7 处)

### `EndOperationTransaction(self, e)` 🟢 (1)
- 触发:事务**结束时**(标准动作完成后)
- 常用:成功后副作用(写日志/触发下一步操作链)
- `e.Cancel`:**不支持**(事务已结束)

### `AfterExecuteOperationTransaction(self, e)` 🟡
- 类似 EndOperationTransaction,但触发更早(标准动作完成,事务还在)

### `OnPrepareOperationServiceOption(self, e)` 🟡
- 触发:服务选项配置时(在最早期),可以改 `e.OperationServiceOption`
- 常用:控制本次操作是否需要事务/锁/校验等元行为

### `BeforeDoSaveExecute(self, e)` 🟡
- 触发:保存类操作的前置 hook(特定于 Save 操作)
- `e.Cancel`:支持

### `RollbackData(self, e)` 🔴
- 触发:事务回滚时
- 常用:回滚副作用(已发送的通知/已变更的外部状态)

### `AfterExecuteValidate(self, e)` 🟡
- 触发:验证器执行完毕后(在 BeginOperationTransaction 前)

### `InitializeOperationResult(self, result)` 🔴
- 触发:OperationResult 对象初始化时
- 常用:挂自定义 result 字段

### IValidator 路径(客户实战 7 处) 🟢

ServicePlugin 通过 `OnAddValidators` 注册的 IValidator 类有自己的 `Validate(self, ctx)` 方法:

```python
from Kingdee.BOS.Core.Validation import AbstractValidator

class CustomCreditValidator(AbstractValidator):
    def Validate(self, dataEntities, validateContext, ctx):
        for de in dataEntities:
            # custom validation logic
            pass
```

由 ServicePlugin 的 `OnAddValidators` 注册:`e.Validators.Add(CustomCreditValidator())`。

---

## 账表插件事件(`AbstractSysReportPlugIn` + `AbstractSysReportServicePlugIn`,Plan 7.4)

挂在 **SysReport metaobject** 的 `<SysReportServicePlugins>` 节点(action="edit" 模式写入)。Python 走 `PythonReportPlugIn`(反编译实证存在)。

v0.2 起可通过 `k3cloud_register_sysreport_python_plugins` 自动注册,无需在 BOS Designer 手工建账表。新建账表走 `k3cloud_create_from_template(templateId='BOS_SimpleSysReport', ...)`。

两类基类(反编译 2026-05-11):

### `AbstractSysReportPlugIn`(UI 端,16 个 virtual 方法)
负责账表展示 / 交互 / 单元格格式化。常用事件:
- `ReportInitialize(self, e)` — 账表实例化(最早期 hook)
- `AfterBindData(self, e)` 🟢 (3) — 数据绑定后(类似单据)
- `BeforeButtonClick / AfterButtonClick(self, e)` — 按钮点击前/后
- `CellClick / CellDbClick(self, e)` — 单元格点击/双击
- `CellFormat / FormatCellValue(self, e)` — 单元格格式化 / 显示值改写
- `PrepareFilterParameter(self, e)` — 过滤参数装配(查询前注入额外条件)
- `OnFormatRowConditions(self, e)` — 行级条件格式
- `CreateFilterEditorControl` / `BeforeFilterSchemeChanged` / `BeforeCreateDynamicList`
- `AfterGetData / AfterGetAllPageDataSet` — 取数后 hook
- `BeforeBuildExcelSheet / AfterBuildExportReportTitle` — 导出 Excel hook

### `AbstractSysReportServicePlugIn`(服务端,5 个 virtual 方法)
**最关键**:负责拼 SQL 取数。客户实战这块最高频:
- `BuilderReportSqlAndTempTable(self, e)` 🟢 **6**(账表最高频) — **构造 SQL + 写临时表**,核心 hook
- `Initialize(self, e)` 🟢 (4) — 服务端实例化
- `CloseReport(self, e)` 🟢 (3) — 关闭账表清理
- `CloseReportInstance(self, e)` — 关单实例
- `DropTempTable(self, e)` — 删临时表(配合 BuilderReportSqlAndTempTable)

典型 BuilderReportSqlAndTempTable 模板:

```python
def BuilderReportSqlAndTempTable(self, e):
    filter = e.Filter
    # 从过滤条件取值
    start_date = filter.GetValue("FStartDate")
    end_date = filter.GetValue("FEndDate")
    org_id = filter.GetValue("FOrgId").Id

    sql = u"""
    SELECT FOrderID, FCustID, FAllAmount
    INTO #{0}
    FROM T_SAL_ORDERENTRY
    WHERE FOrgID = {1}
      AND FDate BETWEEN '{2}' AND '{3}'
    """.format(e.ReportTempTableName, org_id, start_date, end_date)

    DBUtils.Execute(self.Context, sql)
```

`e.ReportTempTableName` 是 BOS 注入的临时表名,所有数据写进去,BOS 后续 UI 端从这表 select。

---

## 找不到的事件 → 查反编译

如果客户需求映射不到上述 30 个事件,完整列表(115 + 19 = 134 个 virtual 方法)需查:
- `Kingdee.BOS.Core.DynamicForm.PlugIn.AbstractDynamicFormPlugIn`(基类)
- `Kingdee.BOS.Core.Bill.PlugIn.AbstractBillPlugIn`(Bill 专属新增 19 个)
- `D:\K3Cloud\WebSite\Bin\Kingdee.BOS.Core.dll` 反编译

常见但本表未详细列的:`BeforeImportData / VerifyImportData`(导入流程)、`BeforeExportData / BeforeExportDataNew`(导出)、`BeforePrintExport / OnAfterPrint`(打印)、`OnGetConvertRule / OnTargetBillChanged`(下推链路)、`EntryCellFocued / FieldEditorFocued`(焦点)。

实施前先**用本表 → 客户实战频次 🟢 → 反编译完整集** 三层查找。
