using System;
using Kingdee.BOS.Core.Metadata.FieldElement;
using Kingdee.BOS.Orm.DataEntity;

namespace Kingdee.BOS.Core.Report;

[Serializable]
public class RptFilterGridField
{
	protected string id;

	protected int elementTypeId;

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
	public bool Visible { get; set; }

	[SimpleProperty]
	public int Seq { get; set; }

	[ComplexProperty]
	public Field Field { get; set; }

	[ComplexProperty]
	public FieldAppearance FieldAppearance { get; set; }

	public int ElementTypeId
	{
		get
		{
			return Field.ElementType;
		}
		set
		{
			elementTypeId = value;
		}
	}

	public string Caption => Field.Name;

	public string FieldName => Field.Key;

	[SimpleProperty]
	public int DefaultColWidth { get; set; }

	public int? ColAlignType { get; set; }
}
