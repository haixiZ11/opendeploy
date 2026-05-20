using System;
using Kingdee.BOS.Core.Metadata.FieldElement;
using Kingdee.BOS.Orm.DataEntity;
using Kingdee.BOS.Util;

namespace Kingdee.BOS.Core.Report.EasyReport;

[Serializable]
public class PickedFieldInfo : ICloneable
{
	protected string id;

	[NonSerialized]
	private object _tag;

	[NonSerialized]
	private Field _refField;

	[NonSerialized]
	private Field _field;

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
	public int FieldElementType { get; set; }

	[SimpleProperty]
	public string FieldKey { get; set; }

	[SimpleProperty]
	public string FieldName { get; set; }

	[SimpleProperty]
	public string Caption { get; set; }

	[SimpleProperty]
	public int Seq { get; set; }

	public object Tag
	{
		get
		{
			return _tag;
		}
		set
		{
			_tag = value;
		}
	}

	[SimpleProperty]
	public string SelectKey { get; set; }

	[SimpleProperty]
	public string BindingFieldName { get; set; }

	[SimpleProperty]
	public string BaseDataFormId { get; set; }

	[SimpleProperty]
	public int SumType { get; set; }

	[SimpleProperty]
	public bool CanFilter { get; set; }

	public Field RefField
	{
		get
		{
			return _refField;
		}
		set
		{
			_refField = value;
		}
	}

	public Field Field
	{
		get
		{
			return _field;
		}
		set
		{
			_field = value;
		}
	}

	[SimpleProperty]
	public string DisplayFormatString { get; set; }

	[SimpleProperty]
	public int FieldVisibleType { get; set; }

	public PickedFieldInfo()
	{
	}

	public PickedFieldInfo(int fieldElementType, string fieldKey, string fieldName, string caption, int seq, object tag, string selectKey, string bindingFieldName, string baseDataFormId)
	{
		FieldElementType = fieldElementType;
		FieldKey = fieldKey;
		FieldName = fieldName;
		Caption = caption;
		Seq = seq;
		Tag = tag;
		SelectKey = selectKey;
		BindingFieldName = bindingFieldName;
		BaseDataFormId = baseDataFormId;
	}

	public PickedFieldInfo(int fieldElementType, string fieldKey, string fieldName, string caption, int seq, object tag, string selectKey, string bindingFieldName, string baseDataFormId, int sumType)
		: this(fieldElementType, fieldKey, fieldName, caption, seq, tag, selectKey, bindingFieldName, baseDataFormId)
	{
		SumType = sumType;
	}

	public override string ToString()
	{
		return Caption.ToString();
	}

	public object Clone()
	{
		return ObjectUtils.CreateCopy(this);
	}
}
