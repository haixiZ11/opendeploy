# SaveForIDEV9 Wire Format — 创建 metaobject

> 本文件是 `metaobject-creation-index` 的子文件。按需加载。
>
> 来源:Task 4 (`create-from-template.ts`) + Task 5 (`register-sysreport-plugin.ts`) 实现,
> 反编译 `AbstractBusinessMetadata.DeserExtendProperties` + `DomainModleDcxmlBinder`(2026-05-13)。

---

## 1. 顶层 Envelope 结构(Task 4 修正后)

```
POST  /k3cloud/<database>/Kingdee.BOS.ServiceFacade.ServicesStub.Metadata.MetadataService/SaveForIDEV9
Content-Type: application/x-www-form-urlencoded

ap0=<base64+zlib encoded ap0Plain JSON>
```

**ap0Plain 对象形状**:

```json
{
  "__source__": "<DCXML 字符串>",
  "__paras__": "<JSON.stringify 后的参数对象字符串>",
  "2052": ""
}
```

关键：
- `__source__` = DCXML XML 内容字符串(不是 base64,是明文 XML)
- `__paras__` = **二次 JSON.stringify**:先把参数对象 `JSON.stringify`,然后整个字符串作为 `__paras__` 的值放入 ap0Plain 对象里,再整体 `JSON.stringify` + 编码。服务端 `GetString("__paras__")` 拿到字符串后再次 `DeserializeObject` 解析。
- **没有 `ap1` 字段** — 原始 bug 就是多传了 ap1;Task 4 修正后只有 ap0。
- `"2052": ""` — 语言区域 slot,始终为空字符串

---

## 2. `__paras__` 必填字段

来源:反编译 `AbstractBusinessMetadata.DeserExtendProperties`(2026-05-13):

| 字段 | 类型 | 说明 |
|---|---|---|
| `Id` | string | 目标对象 FormID(新建 = newFormId;编辑 = formId) |
| `Name` | string | **JSON.stringify 的 LocaleValue 数组**,例 `"[{\"Key\":2052,\"Value\":\"质量账表\"}]"` |
| `ModelTypeId` | number | 100 / 400 / 500 / 900(不是 DomainModelType 枚举,是数字) |
| `BaseObjectId` | string | 模板 formId(创建时 = templateId,如 `"BOS_SimpleSysReport"`) |
| `SubSystemId` | string | 子系统 ID 字符串数字,未知传 `"23"` |
| `DevType` | number | `0` = 创建/直接编辑(create-from-template 和 register-plugin 都用 0);`2` = 扩展(create_extension 路径) |
| `UpdateIdToKey` | boolean | `false`(创建路径) |
| `HasExtends` | boolean | `false`(create-from-template 创建的对象不是扩展) |
| `MainVersion` | string | 必须传字符串;JSON null → K/3 内部 JSONObject cast failure。传 `""` 或实际版本字符串 |
| `FirstNonExtendObjectID` | string | 创建时等于 `BaseObjectId`(= templateId) |
| `OldId` | string \| null | **创建**时 = `null`;**编辑已有对象**时 = formId(null 触发服务端"唯一标识已经存在"创建校验) |
| `ISV` | object \| null | null = 不注册 ISV 身份(create-from-template 用此值)。扩展路径用含 ISVSignal 的对象 |

可选字段(null 安全,服务端用 GetString → 允许 null):
`Version` / `PackageId` / `LayoutViewId` / `OldLayoutViewId` / `LayoutViewVersion` / `DependencyObjectId` / `SourceFormId` / `InheritPath`

---

## 3. DCXML 根标签始终是 `<Form>`

来源:反编译 `DomainModleDcxmlBinder`(2026-05-13 验证)。

**重要**:`<Form>` 是写入 DCXML 的通用根标签,无论 ModelType 是什么。
- 写单据 → `<Form>`,不是 `<BillForm>`
- 写基础资料 → `<Form>`,不是 `<BaseDataForm>`
- 写账表 → `<Form>`,不是 `<SysReportForm>`

`SysReportForm` / `BillForm` / `BaseDataForm` 这些标签只出现在服务端返回的 **FKERNELXML readback**,是服务端序列化输出的格式,不是写入格式。

---

## 4. 创建 vs 编辑操作的差异

### 创建新对象(create-from-template)

```xml
<Form action="edit" oid="BOS_SimpleSysReport" ElementType="900" ElementStyle="0">
  <Id>kf9157e0f0a034534be3f6a6ab01699d1</Id>
  <SubsysId>23</SubsysId>
  <Name>质量追溯账表</Name>
</Form>
```

- `oid` = templateId(服务端以此加载 DCXML baseline)
- `action="edit"` — 注意没有 `action="add"`;BOS DCXML 通过"有 oid 的 edit"来做"从模板继承创建"
- `__paras__.OldId = null` — 触发创建路径(不是编辑路径)
- `__paras__.BaseObjectId = templateId`

### 编辑已有对象(register-sysreport-plugin)

```xml
<Form action="edit" oid="BOS_SimpleSysReport" ElementType="900" ElementStyle="0">
  <Id>kf9157e0f0a034534be3f6a6ab01699d1</Id>
  <SysReportServicePlugins>
    <PlugIn ElementType="0" ElementStyle="0">
      <ClassName>QualityTracePlugin</ClassName>
      <PlugInType>1</PlugInType>
      <PyScript><![CDATA[import clr
...]]></PyScript>
    </PlugIn>
  </SysReportServicePlugins>
</Form>
```

- `oid` = 该 SysReport 的模板 baseline OID(从 FKERNELXML readback 读取),**不是 formId**
  - 用 formId 当 oid → 服务端报"唯一标识已经存在"
- `__paras__.OldId = formId` — 非 null,表示这是编辑已有对象
- `__paras__.BaseObjectId = baseObjectId`(等于 DCXML 里的 oid)

---

## 5. PyScript 在 DCXML 中的转义

Python 代码包含 `<`、`>`、`&` 字符时,必须用 CDATA 包裹:

```xml
<PyScript><![CDATA[
import clr
clr.AddReference('Kingdee.BOS.Core')
from Kingdee.BOS.Core.Report.PlugIn import AbstractSysReportServicePlugIn

class MyPlugin(AbstractSysReportServicePlugIn):
    def OnPreparePropertys(self, e):
        # 用 < > 符号没问题,CDATA 保护
        if e.RowCount > 0:
            pass
]]></PyScript>
```

如果 Python 代码中含有字符序列 `]]>`,需要拆分:
- `]]>` → `]]` + `]]><![CDATA[` + `>`(工具内部自动处理,调用者无需手动处理)

---

## 6. 反编译来源清单

| 事实 | 来源 |
|---|---|
| `__paras__` 二次 JSON.stringify | `AbstractBusinessMetadata.DeserExtendProperties`(2026-05-13) |
| DCXML 根标签始终 `<Form>` | `DomainModleDcxmlBinder`(2026-05-13) |
| `SysReportServicePlugins` 集合名 | `SysReportForm.cs` 第 20 行(`.scratch/decompile/sysreport-types/SysReportForm.cs`) |
| `PythonReportPlugIn` 代理类 | `SysReportForm.cs` 同文件 |
| `OldId=null` 触发创建校验 | `register-sysreport-plugin.ts` 注释 + smoke 实证 |
| 无 `ap1` 字段 | Task 4 修正(原始 save-for-ide.ts 有 ap1,create-from-template 路径不用) |

---

## 7. 相关 Memory 引用

- `bos_save_for_ide_v9_wire_format` — 原始 wire format spike(Task 4 之前),部分结论被 Task 4 修正
- `feedback_decompile_for_unknowns` — 来源纪律:不确定的 BOS 私有属性必须反编译,不靠猜
- `bos_form_metadata_deserialize_quirks` — `action="edit"` 是 delta marker;无 baseline 静默 drop
