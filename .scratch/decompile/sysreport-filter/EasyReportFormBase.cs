using System;
using Kingdee.BOS.Core.Report.EasyReport;
using Kingdee.BOS.Orm.DataEntity;
using SmartAssembly.Delegates;
using SmartAssembly.HouseOfCards;

namespace Kingdee.BOS.Core.Metadata.FormElement;

[Serializable]
public class EasyReportFormBase : SysReportForm
{
	[NonSerialized]
	internal static GetString _001A;

	[ComplexProperty]
	public EasyReportSettingInfo SettingInfo { get; set; }

	public EasyReportFormBase()
		: this(_001A(107410646))
	{
	}

	public EasyReportFormBase(string key)
		: base(key)
	{
	}

	static EasyReportFormBase()
	{
		Strings.CreateGetStringDelegate(typeof(EasyReportFormBase));
	}
}
