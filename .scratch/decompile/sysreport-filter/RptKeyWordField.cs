using System;
using Kingdee.BOS.Core.Metadata.FieldElement;
using Kingdee.BOS.Orm.DataEntity;

namespace Kingdee.BOS.Core.Report;

[Serializable]
public class RptKeyWordField
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
	public string DataSource { get; set; }

	[SimpleProperty]
	public string FilterBDFieldName { get; set; }

	[SimpleProperty]
	public bool IsAllowInput { get; set; }

	[SimpleProperty]
	public bool IsMustInput { get; set; }

	[SimpleProperty]
	public string KeyWord { get; set; }

	[SimpleProperty]
	public LocaleValue Name { get; set; }

	[SimpleProperty]
	public long ValueType { get; set; }

	[SimpleProperty]
	public string DefaultValue { get; set; }

	[SimpleProperty]
	public string AssistantID { get; set; }

	[SimpleProperty]
	public bool IsMultiSelect { get; set; }

	[SimpleProperty]
	public bool IsAllowNull { get; set; }

	[SimpleProperty]
	public long DSeq { get; set; }

	[SimpleProperty]
	public string CustomerBindKey { get; set; }

	[ComplexProperty]
	public Field Field { get; set; }

	[ComplexProperty]
	public FieldAppearance FieldAppearance { get; set; }

	[SimpleProperty]
	public bool IsUseOrgFilter { get; set; }

	public void Add(RptKeyWord keyWord)
	{
		if (0 == 0)
		{
			FilterBDFieldName = keyWord.FFILTERBDFIELDNAME;
		}
		string fDataSource = keyWord.FDataSource;
		if (2u != 0)
		{
			DataSource = fDataSource;
		}
		Name = keyWord.FName;
		ValueType = keyWord.FValueType;
		if (2u != 0)
		{
			KeyWord = keyWord.FKEYWORD;
		}
		IsAllowInput = keyWord.FISALLOWINPUT;
		IsMustInput = keyWord.FISMUSTINPUT;
		DefaultValue = keyWord.FDefaultValue;
		AssistantID = keyWord.FAssistantID;
		IsMultiSelect = keyWord.FIsMultiSelect;
		IsAllowNull = keyWord.IsAllowNull;
		IsUseOrgFilter = keyWord.FIsUseOrgFilter;
	}
}
