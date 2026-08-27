using System;
using System.Collections.Generic;
using System.ComponentModel;
using Kingdee.BOS.Core.Metadata.GroupElement;
using Kingdee.BOS.Orm.DataEntity;
using Kingdee.BOS.Util;

namespace Kingdee.BOS.Core.Report.EasyReport;

[Serializable]
public class EasyReportSettingInfo : ICloneable
{
	[SimpleProperty]
	[DefaultValue(EasyReportType.Summary)]
	public EasyReportType ReportType { get; set; }

	[SimpleProperty]
	public string SourceFormId { get; set; }

	[CollectionProperty]
	public List<PickedFieldInfo> SelectedFields { get; set; }

	[CollectionProperty]
	public List<PickedFieldInfo> SortedFields { get; set; }

	[ComplexProperty]
	public GroupColumnInfo GroupColumnInfo { get; set; }

	[CollectionProperty]
	public List<PickedFieldInfo> RowTitleFields { get; set; }

	[CollectionProperty]
	public List<PickedFieldInfo> ColTitleFields { get; set; }

	[CollectionProperty]
	public List<PickedFieldInfo> AggregateFields { get; set; }

	public object Clone()
	{
		return ObjectUtils.CreateCopy(this);
	}
}
