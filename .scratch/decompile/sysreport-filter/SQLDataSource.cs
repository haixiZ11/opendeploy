using System;
using System.Collections.Generic;
using System.ComponentModel;
using Kingdee.BOS.Core.Metadata.FieldElement;
using Kingdee.BOS.Orm.DataEntity;
using Kingdee.BOS.Util;
using SmartAssembly.Delegates;
using SmartAssembly.HouseOfCards;

namespace Kingdee.BOS.Core.Report;

[Serializable]
public class SQLDataSource : ICloneable
{
	private const string SQL_DIALECT = "/*dialect*/";

	public const string GROUP_LEVEL_FIELD_NAME = "FGROUPLEVEL";

	public const string GROUPING_FIELD_NAME = "FGROUPING";

	public const string IDENTITYID_FIELD_NAME = "FIDENTITYID";

	[NonSerialized]
	internal static GetString _0080;

	[DefaultValue("")]
	[SimpleProperty]
	public string SQL { get; set; }

	[SimpleProperty]
	public int SQLType { get; set; }

	public List<TextField> TextFieldList { get; set; }

	public string ExecutableSql
	{
		get
		{
			do
			{
				if (4u != 0 && SQLType != 3)
				{
					return _0080(107352157) + SQL;
				}
			}
			while (false);
			return SQL;
		}
	}

	[CollectionProperty]
	public List<RptFilterGridField> FieldList { get; private set; }

	[CollectionProperty]
	public List<RptKeyWordField> KeyWordList { get; set; }

	[CollectionProperty]
	public List<RptFilterGroupField> GroupFieldList { get; set; }

	[DefaultValue(false)]
	[SimpleProperty]
	public bool IsStoredProc { get; set; }

	public SQLDataSource()
	{
		FieldList = new List<RptFilterGridField>();
		KeyWordList = new List<RptKeyWordField>();
		GroupFieldList = new List<RptFilterGroupField>();
		TextFieldList = new List<TextField>();
		SQL = _0080(107412753);
		SQLType = 1;
	}

	public object Clone()
	{
		return ObjectUtils.CreateCopy(this);
	}

	static SQLDataSource()
	{
		Strings.CreateGetStringDelegate(typeof(SQLDataSource));
	}
}
