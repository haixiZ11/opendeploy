using System;
using System.Data;
using Kingdee.BOS.Core.DynamicForm;
using Kingdee.BOS.Core.Util;
using Kingdee.BOS.Orm.DataEntity;
using Kingdee.BOS.Orm.Metadata.DataEntity;
using SmartAssembly.Delegates;
using SmartAssembly.HouseOfCards;

namespace Kingdee.BOS.Core.Report;

[Serializable]
public class RptKeyWord : DynamicObjectView4Model
{
	public const string Datasource_SysVar = "-1";

	public const string SysVar_CurrentUserId = "_CurrentUserId_";

	public const string SysVar_CurrentOrgUnitId = "_CurrentOrgUnitId_";

	public const string SysVar_CurrentUserOrgIds = "_CurrentUserOrgIds_";

	public const string SysVar_LCID = "_LCID_";

	public const string CurrentDate = "CurrentDate";

	protected static readonly DynamicObjectType RPTKEYWORDSType;

	public static readonly DynamicProperty FDataSourceProperty;

	public static readonly DynamicProperty FFILTERBDFIELDNAMEProperty;

	public static readonly DynamicProperty FISALLOWINPUTProperty;

	public static readonly DynamicProperty FISMUSTINPUTProperty;

	public static readonly DynamicProperty FKEYWORDProperty;

	public static readonly DynamicProperty FNameProperty;

	public static readonly DynamicProperty FValueTypeProperty;

	public static readonly DynamicProperty IdProperty;

	public static readonly DynamicProperty FDefaultValueProperty;

	public static readonly DynamicProperty FAssistantIDProperty;

	public static readonly DynamicProperty FIsMultiSelectProperty;

	public static readonly DynamicProperty IsAllowNullProperty;

	public static readonly DynamicProperty FIsUseOrgFilterProperty;

	[NonSerialized]
	internal static GetString _0018;

	public string FDataSource
	{
		get
		{
			return (string)FDataSourceProperty.GetValue(base.DataEntity);
		}
		set
		{
			SetValue(FDataSourceProperty, _0018(107352226), base.DataEntity, value);
		}
	}

	public string FFILTERBDFIELDNAME
	{
		get
		{
			return (string)FFILTERBDFIELDNAMEProperty.GetValue(base.DataEntity);
		}
		set
		{
			SetValue(FFILTERBDFIELDNAMEProperty, _0018(107352177), base.DataEntity, value);
		}
	}

	public bool FISALLOWINPUT
	{
		get
		{
			return (bool)FISALLOWINPUTProperty.GetValue(base.DataEntity);
		}
		set
		{
			do
			{
				if (true && 0 == 0)
				{
					SetValue(FISALLOWINPUTProperty, _0018(107352152), base.DataEntity, value);
				}
			}
			while (false ? true : false);
		}
	}

	public bool FISMUSTINPUT
	{
		get
		{
			return (bool)FISMUSTINPUTProperty.GetValue(base.DataEntity);
		}
		set
		{
			do
			{
				if (true && 0 == 0)
				{
					SetValue(FISMUSTINPUTProperty, _0018(107352163), base.DataEntity, value);
				}
			}
			while (false ? true : false);
		}
	}

	public string FKEYWORD
	{
		get
		{
			return (string)FKEYWORDProperty.GetValue(base.DataEntity);
		}
		set
		{
			SetValue(FKEYWORDProperty, _0018(107352114), base.DataEntity, value);
		}
	}

	public LocaleValue FName
	{
		get
		{
			return (LocaleValue)FNameProperty.GetValue(base.DataEntity);
		}
		set
		{
			SetValue(FNameProperty, _0018(107405393), base.DataEntity, value);
		}
	}

	public long FValueType
	{
		get
		{
			return (long)FValueTypeProperty.GetValue(base.DataEntity);
		}
		set
		{
			do
			{
				if (true && 0 == 0)
				{
					SetValue(FValueTypeProperty, _0018(107335029), base.DataEntity, value);
				}
			}
			while (false ? true : false);
		}
	}

	public string Id
	{
		get
		{
			return (string)IdProperty.GetValue(base.DataEntity);
		}
		set
		{
			IdProperty.SetValue(base.DataEntity, value);
		}
	}

	public string FDefaultValue
	{
		get
		{
			return (string)FDefaultValueProperty.GetValue(base.DataEntity);
		}
		set
		{
			SetValue(FDefaultValueProperty, _0018(107352133), base.DataEntity, value);
		}
	}

	public string FAssistantID
	{
		get
		{
			return (string)FAssistantIDProperty.GetValue(base.DataEntity);
		}
		set
		{
			SetValue(FAssistantIDProperty, _0018(107352080), base.DataEntity, value);
		}
	}

	public bool FIsMultiSelect
	{
		get
		{
			return (bool)FIsMultiSelectProperty.GetValue(base.DataEntity);
		}
		set
		{
			do
			{
				if (true && 0 == 0)
				{
					SetValue(FIsMultiSelectProperty, _0018(107352095), base.DataEntity, value);
				}
			}
			while (false ? true : false);
		}
	}

	public bool IsAllowNull
	{
		get
		{
			return (bool)IsAllowNullProperty.GetValue(base.DataEntity);
		}
		set
		{
			do
			{
				if (true && 0 == 0)
				{
					SetValue(IsAllowNullProperty, _0018(107352074), base.DataEntity, value);
				}
			}
			while (false ? true : false);
		}
	}

	public long FDSeq { get; set; }

	public bool FIsUseOrgFilter
	{
		get
		{
			if (5u != 0 && base.DataEntity.TryGetValue(_0018(107352025), out var value))
			{
				goto IL_0019;
			}
			goto IL_0024;
			IL_0024:
			if (5u != 0)
			{
				return true;
			}
			goto IL_0019;
			IL_0019:
			if (0 == 0)
			{
				return (bool)value;
			}
			goto IL_0024;
		}
		set
		{
			if (base.DataEntity.DynamicObjectType.Properties.Contains(_0018(107352025)))
			{
				SetValue(FIsUseOrgFilterProperty, _0018(107352025), base.DataEntity, value);
			}
		}
	}

	public RptKeyWord(DynamicObject obj)
		: base(obj)
	{
	}

	public RptKeyWord(IDynamicFormModel model, DynamicObject dataEntity)
		: base(model, dataEntity)
	{
	}

	public static implicit operator RptKeyWord(DynamicObject obj)
	{
		if (obj == null)
		{
			return null;
		}
		return new RptKeyWord(obj);
	}

	static RptKeyWord()
	{
		Type typeFromHandle = typeof(RptKeyWord);
		if (0 == 0)
		{
			Strings.CreateGetStringDelegate(typeFromHandle);
		}
		RPTKEYWORDSType = new DynamicObjectType(_0018(107352036), null, null, DataEntityTypeFlag.Class, new DataEntityTypeAttribute
		{
			Alias = _0018(107351987)
		});
		FDataSourceProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107352226), typeof(string), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107351450)
		});
		FFILTERBDFIELDNAMEProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107352177), typeof(string), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107352177)
		});
		FISALLOWINPUTProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107352152), typeof(bool), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107352152),
			DbType = DbType.StringFixedLength
		});
		FISMUSTINPUTProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107352163), typeof(bool), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107352163),
			DbType = DbType.StringFixedLength
		});
		FKEYWORDProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107352114), typeof(string), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107459375)
		});
		FNameProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107405393), typeof(LocaleValue), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107417908)
		}, new DbIgnoreAttribute());
		FValueTypeProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107335029), typeof(long), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107351465)
		});
		IdProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107406965), typeof(string), null, false, new SimplePropertyAttribute(primaryKey: true)
		{
			Alias = _0018(107464589)
		});
		FDefaultValueProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107352133), typeof(string), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107352133)
		});
		FAssistantIDProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107352080), typeof(string), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107352080)
		});
		FIsMultiSelectProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107352095), typeof(bool), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107352095)
		});
		IsAllowNullProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107351416), typeof(bool), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107352074)
		});
		FIsUseOrgFilterProperty = RPTKEYWORDSType.RegisterSimpleProperty(_0018(107352025), typeof(bool), null, false, new SimplePropertyAttribute
		{
			Alias = _0018(107352025)
		});
	}
}
