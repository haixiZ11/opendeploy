using System;
using Kingdee.BOS.Core.Metadata.FieldElement;
using Kingdee.BOS.Orm.DataEntity;

namespace Kingdee.BOS.Core.Report;

[Serializable]
public class RptFilterGroupField
{
	protected string id;

	[SimpleProperty(true)]
	public string Id
	{
		get
		{
			id = (string.IsNullOrEmpty(id) ? Guid.NewGuid().ToString() : id);
			return id;
		}
		set
		{
			id = value;
		}
	}

	[SimpleProperty]
	public int Seq { get; set; }

	[ComplexProperty]
	public Field Field { get; set; }

	public string FieldKey => Field.Key;

	public string FieldName => Field.Name;
}
