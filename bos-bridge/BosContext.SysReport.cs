using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

namespace OpenDeploy.BosBridge
{
    // ── SysReport filter + columns probe (Plan 7.8 Phase 0 Task 0.2/0.3) ──
    //
    // Spike-only — these ops construct sample SysReportForm / RptKeyWordField
    // / RptFilterGridField instances purely through reflection and ship them
    // through the same DcxmlSerializer that ConvertRule + BusinessRule ops
    // use. Output DCXML is the **real wire format** that SaveForIDEV9 would
    // accept — equivalent to what BOS Designer would have produced if a
    // human dragged the same parameters in.
    //
    // Used by `scripts/bos-recon/probe-sysreport-wire.ts` to materialize
    // §2 (ValueType + ElementType numbers) and §3 (5 KeyWord + 1 GridField
    // sub-section DCXML samples) of
    // `docs/recon/2026-05-20-sysreport-filter-columns-wire.md` — replaces
    // the original "user runs Designer capture-proxy" Phase 0 plan per
    // memory `feedback_decompile_for_unknowns`.
    //
    // NB: nothing here writes to a K/3 server. The op constructs an object
    // tree → serializer prints DCXML → returns string. No HTTP, no DB.

    internal sealed partial class BosContext
    {
        public string ProbeSysReportWire(string kind)
        {
            if (string.IsNullOrEmpty(kind)) throw new ArgumentException("kind is empty", nameof(kind));

            // Find the Core assembly via an already-known type (Field), then
            // resolve all SysReport-related types by full name. Loading
            // assemblies again would risk pulling a second copy.
            var coreAsm = typeof(Kingdee.BOS.Orm.Metadata.DataEntity.IDataEntityType).Assembly;
            // Actually need Kingdee.BOS.Core — the IDataEntityType is in
            // DataEntity. Walk loaded assemblies instead.
            var formAsm = AppDomain.CurrentDomain.GetAssemblies()
                .FirstOrDefault(a => a.GetName().Name == "Kingdee.BOS.Core")
                ?? throw new InvalidOperationException("Kingdee.BOS.Core not loaded");
            var bosAsm = AppDomain.CurrentDomain.GetAssemblies()
                .FirstOrDefault(a => a.GetName().Name == "Kingdee.BOS")
                ?? Assembly.Load("Kingdee.BOS");

            var sysReportFormType = formAsm.GetType("Kingdee.BOS.Core.Metadata.FormElement.SysReportForm", true)!;
            var sqlDataSourceType = formAsm.GetType("Kingdee.BOS.Core.Report.SQLDataSource", true)!;
            var kwFieldType       = formAsm.GetType("Kingdee.BOS.Core.Report.RptKeyWordField", true)!;
            var gridFieldType     = formAsm.GetType("Kingdee.BOS.Core.Report.RptFilterGridField", true)!;
            var fieldApprType     = formAsm.GetType("Kingdee.BOS.Core.Metadata.FieldElement.FieldAppearance", true)!;
            var localeValueType   = bosAsm.GetType("Kingdee.BOS.LocaleValue", true)!;

            // Field subclasses (per §1.6 reference; ElementType supplied by
            // the subclass itself in its [DefaultValue(N)] override so we
            // don't set it manually).
            var textFieldType    = formAsm.GetType("Kingdee.BOS.Core.Metadata.FieldElement.TextField", true)!;
            var dateFieldType    = formAsm.GetType("Kingdee.BOS.Core.Metadata.FieldElement.DateField", true)!;
            var comboFieldType   = formAsm.GetType("Kingdee.BOS.Core.Metadata.FieldElement.ComboField", true)!;
            var baseDataFieldType= formAsm.GetType("Kingdee.BOS.Core.Metadata.FieldElement.BaseDataField", true)!;
            var decimalFieldType = formAsm.GetType("Kingdee.BOS.Core.Metadata.FieldElement.DecimalField", true)!;
            var integerFieldType = formAsm.GetType("Kingdee.BOS.Core.Metadata.FieldElement.IntegerField", true)!;

            // Build host SysReportForm — empty Key/Name; what matters is the
            // child SQLDataSource collections, not the form metadata.
            var form = Activator.CreateInstance(sysReportFormType, "k_probe_sysreport");
            SetProperty(form, "Name", MakeLocaleValue(localeValueType, "样例账表 probe"));
            var sqlDS = Activator.CreateInstance(sqlDataSourceType);
            SetProperty(sqlDS, "SQL", "SELECT 1 AS FId");
            SetProperty(form, "SQLDataSource", sqlDS);

            switch (kind)
            {
                case "date":
                    AddKw(sqlDS, kwFieldType, fieldApprType, localeValueType,
                          keyWord: "@DateSample",
                          name: "日期参数",
                          valueType: 4,
                          dSeq: 1,
                          field: MakeField(dateFieldType, "FDateSample", "日期参数", localeValueType));
                    break;

                case "base_data":
                {
                    var bdField = MakeField(baseDataFieldType, "FCustomerSample", "客户参数", localeValueType);
                    SetProperty(bdField, "LookUpObjectID", "BD_Customer");
                    AddKw(sqlDS, kwFieldType, fieldApprType, localeValueType,
                          keyWord: "@CustomerSample",
                          name: "客户参数",
                          valueType: 13,
                          dSeq: 1,
                          field: bdField,
                          assistantId: "BD_Customer",
                          isMultiSelect: true);
                    break;
                }

                case "text":
                {
                    var txt = MakeField(textFieldType, "FTextSample", "文本参数", localeValueType);
                    TrySetProperty(txt, "MaxLength", 200);
                    AddKw(sqlDS, kwFieldType, fieldApprType, localeValueType,
                          keyWord: "@TextSample",
                          name: "文本参数",
                          valueType: 1,
                          dSeq: 1,
                          field: txt);
                    break;
                }

                case "combo":
                {
                    var cmb = MakeField(comboFieldType, "FComboSample", "枚举参数", localeValueType);
                    // ComboItems list left empty — schema-driven shape suffices.
                    AddKw(sqlDS, kwFieldType, fieldApprType, localeValueType,
                          keyWord: "@ComboSample",
                          name: "枚举参数",
                          valueType: 9,
                          dSeq: 1,
                          field: cmb);
                    break;
                }

                case "decimal":
                {
                    var dec = MakeField(decimalFieldType, "FDecimalSample", "数量参数", localeValueType);
                    TrySetProperty(dec, "Precision", 18);
                    TrySetProperty(dec, "Scale", 2);
                    AddKw(sqlDS, kwFieldType, fieldApprType, localeValueType,
                          keyWord: "@DecimalSample",
                          name: "数量参数",
                          // DecimalField default ElementType=2 (per .scratch/decompile
                          // grep). Mirror into ValueType.
                          valueType: 2,
                          dSeq: 1,
                          field: dec);
                    break;
                }

                case "gridfields":
                {
                    AddGrid(sqlDS, gridFieldType, fieldApprType, localeValueType,
                            field: MakeField(textFieldType, "FCustomerName", "客户名", localeValueType),
                            seq: 1, width: 150);
                    AddGrid(sqlDS, gridFieldType, fieldApprType, localeValueType,
                            field: MakeField(textFieldType, "FBillNo", "单据编号", localeValueType),
                            seq: 2, width: 120);
                    {
                        var qty = MakeField(integerFieldType, "FQty", "数量", localeValueType);
                        AddGrid(sqlDS, gridFieldType, fieldApprType, localeValueType,
                                field: qty, seq: 3, width: 100);
                    }
                    {
                        var amount = MakeField(decimalFieldType, "FAmount", "金额", localeValueType);
                        TrySetProperty(amount, "Precision", 18);
                        TrySetProperty(amount, "Scale", 2);
                        AddGrid(sqlDS, gridFieldType, fieldApprType, localeValueType,
                                field: amount, seq: 4, width: 120);
                    }
                    break;
                }

                default:
                    throw new ArgumentException($"unknown kind '{kind}'. expected one of: date|base_data|text|combo|decimal|gridfields", nameof(kind));
            }

            return _serializer.SerializeToString(form, null);
        }

        // ── helpers ────────────────────────────────────────────────────

        private static object MakeLocaleValue(Type localeValueType, string zhCn)
        {
            // LocaleValue has a (string value, int localeId) ctor — used
            // because SetByLocaleId is `protected virtual`. 2052 = zh-CN.
            // (Skipping en-US slot for probe — real Designer emits both
            // but the DCXML schema is the same single LocaleValue with
            // multiple <LocaleValue LCID="..."> children.)
            var lv = Activator.CreateInstance(localeValueType, zhCn, 2052)
                ?? throw new InvalidOperationException("failed to construct LocaleValue(string,int)");
            return lv;
        }

        private static object MakeField(Type fieldType, string key, string captionZhCn, Type localeValueType)
        {
            // Field/Element ctor: (string key) — same shape Convert ops use.
            var field = Activator.CreateInstance(fieldType, key)
                ?? throw new InvalidOperationException($"failed to instantiate {fieldType.FullName}");
            SetProperty(field, "Name", MakeLocaleValue(localeValueType, captionZhCn));
            SetProperty(field, "FieldName", key); // physical column name = field key by convention
            return field;
        }

        private static void AddKw(
            object sqlDS,
            Type kwFieldType,
            Type fieldApprType,
            Type localeValueType,
            string keyWord,
            string name,
            long valueType,
            long dSeq,
            object field,
            string assistantId = "",
            bool isMultiSelect = false)
        {
            var kw = Activator.CreateInstance(kwFieldType)!;
            SetProperty(kw, "KeyWord", keyWord);
            SetProperty(kw, "Name", MakeLocaleValue(localeValueType, name));
            SetProperty(kw, "ValueType", valueType);
            SetProperty(kw, "DSeq", dSeq);
            SetProperty(kw, "IsMustInput", false);
            SetProperty(kw, "IsAllowInput", true);
            SetProperty(kw, "IsAllowNull", true);
            SetProperty(kw, "IsMultiSelect", isMultiSelect);
            SetProperty(kw, "DataSource", "");
            SetProperty(kw, "AssistantID", assistantId);
            SetProperty(kw, "DefaultValue", "");
            SetProperty(kw, "FilterBDFieldName", "");
            SetProperty(kw, "CustomerBindKey", "");
            SetProperty(kw, "IsUseOrgFilter", false);
            SetProperty(kw, "Field", field);
            SetProperty(kw, "FieldAppearance", Activator.CreateInstance(fieldApprType));

            var list = (IList)sqlDS.GetType().GetProperty("KeyWordList")!.GetValue(sqlDS)!;
            list.Add(kw);
        }

        private static void AddGrid(
            object sqlDS,
            Type gridFieldType,
            Type fieldApprType,
            Type localeValueType,
            object field,
            int seq,
            int width)
        {
            var grid = Activator.CreateInstance(gridFieldType)!;
            SetProperty(grid, "Visible", true);
            SetProperty(grid, "Seq", seq);
            SetProperty(grid, "DefaultColWidth", width);
            SetProperty(grid, "Field", field);
            SetProperty(grid, "FieldAppearance", Activator.CreateInstance(fieldApprType));

            var list = (IList)sqlDS.GetType().GetProperty("FieldList")!.GetValue(sqlDS)!;
            list.Add(grid);
        }

        private static void SetProperty(object target, string propName, object? value)
        {
            var prop = target.GetType().GetProperty(propName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy)
                ?? throw new InvalidOperationException($"{target.GetType().Name}.{propName} not found");
            prop.SetValue(target, value);
        }

        /// <summary>
        /// Best-effort property set — silently ignores missing properties.
        /// Used for fields whose subtype-specific knobs we don't want the
        /// probe to crash on if the DLL version disagrees.
        /// </summary>
        private static void TrySetProperty(object target, string propName, object? value)
        {
            var prop = target.GetType().GetProperty(propName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy);
            prop?.SetValue(target, value);
        }
    }
}
