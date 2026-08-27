using System;
using System.Collections.Generic;
using System.ComponentModel;
using Kingdee.BOS.Core.DynamicForm.PlugIn;
using Kingdee.BOS.Core.Report;
using Kingdee.BOS.JSON;
using Kingdee.BOS.Orm.DataEntity;
using SmartAssembly.Delegates;
using SmartAssembly.HouseOfCards;

namespace Kingdee.BOS.Core.Metadata.FormElement;

[Serializable]
public class SysReportForm : Form
{
	[NonSerialized]
	internal static GetString _001E;

	[CollectionProperty]
	public List<PlugIn> SysReportServicePlugins { get; set; }

	[ComplexProperty]
	public SQLDataSource SQLDataSource { get; set; }

	[SimpleProperty]
	public ScriptString ReportSQL { get; set; }

	[SimpleProperty]
	[DefaultValue("")]
	public string MergerHeaders { get; set; }

	[DefaultValue("")]
	[SimpleProperty]
	public string ReportSummarySetting { get; set; }

	[SimpleProperty]
	public string CustomDSFormIds { get; set; }

	public Dictionary<string, List<string>> CustomDSFields { get; set; }

	[SimpleProperty]
	public string CustDSFlds
	{
		get
		{
			return KDObjectConverter.SerializeObject(CustomDSFields);
		}
		set
		{
			CustomDSFields = KDObjectConverter.DeserializeObject<Dictionary<string, List<string>>>(value);
		}
	}

	public List<RptFieldRalation> RptFieldRalations { get; set; }

	[SimpleProperty]
	public string RptFieldRalationStr
	{
		get
		{
			return KDObjectConverter.SerializeObject(RptFieldRalations);
		}
		set
		{
			RptFieldRalations = KDObjectConverter.DeserializeObject<List<RptFieldRalation>>(value);
		}
	}

	[SimpleProperty]
	[DefaultValue("")]
	public string OrgIsolationKey { get; set; }

	public SysReportForm()
		: this(_001E(107410644))
	{
	}

	public SysReportForm(string key)
		: base(key)
	{
		SysReportServicePlugins = new List<PlugIn>();
		CustomDSFields = new Dictionary<string, List<string>>();
		RptFieldRalations = new List<RptFieldRalation>();
	}

	public override List<AbstractDynamicWebFormBuilderPlugIn> CreateWebFormBuilderPlugIns()
	{
		List<AbstractDynamicWebFormBuilderPlugIn> list = new List<AbstractDynamicWebFormBuilderPlugIn>();
		foreach (PlugIn webFormBuilderPlugin in base.WebFormBuilderPlugins)
		{
			AbstractDynamicWebFormBuilderPlugIn abstractDynamicWebFormBuilderPlugIn = CreateWebFormBuilderPlugIn(webFormBuilderPlugin);
			if (abstractDynamicWebFormBuilderPlugIn != null)
			{
				list.Add(abstractDynamicWebFormBuilderPlugIn);
			}
		}
		return list;
	}

	static SysReportForm()
	{
		Strings.CreateGetStringDelegate(typeof(SysReportForm));
	}
}
