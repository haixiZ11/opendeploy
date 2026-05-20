using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using Kingdee.BOS.Apm;
using Kingdee.BOS.Core.Bill.PlugIn;
using Kingdee.BOS.Core.BosCheck;
using Kingdee.BOS.Core.CommonFilter.PlugIn;
using Kingdee.BOS.Core.Designer;
using Kingdee.BOS.Core.DynamicForm;
using Kingdee.BOS.Core.DynamicForm.PlugIn;
using Kingdee.BOS.Core.List.PlugIn;
using Kingdee.BOS.Core.Metadata.EntityElement;
using Kingdee.BOS.Core.Metadata.Expression;
using Kingdee.BOS.Core.Metadata.FormValidationElement;
using Kingdee.BOS.Core.Metadata.StateTracker;
using Kingdee.BOS.Core.NotePrint;
using Kingdee.BOS.Core.Objects.Permission.Objects;
using Kingdee.BOS.Core.Report.PlugIn;
using Kingdee.BOS.Log;
using Kingdee.BOS.Orm.DataEntity;
using Kingdee.BOS.Orm.Metadata.DataEntity;
using Kingdee.BOS.Resource;
using Kingdee.BOS.Util;
using Newtonsoft.Json;
using SmartAssembly.Delegates;
using SmartAssembly.HouseOfCards;

namespace Kingdee.BOS.Core.Metadata.FormElement;

[Serializable]
public class Form : Element
{
	private string _formServiceName;

	private string inheritId;

	private PermissionConfig permissionConfig;

	private LinkTableSet _EntryLinkSet;

	[NonSerialized]
	internal static GetString _000F;

	[DefaultValue(100)]
	[SimpleProperty]
	public override int ElementType
	{
		get
		{
			return base.ElementType;
		}
		set
		{
			base.ElementType = value;
		}
	}

	[SimpleProperty]
	public override string Id
	{
		get
		{
			return id;
		}
		set
		{
			id = value;
		}
	}

	[SimpleProperty(true)]
	public virtual string InheritId
	{
		get
		{
			do
			{
				if (4u != 0)
				{
					inheritId = (string.IsNullOrEmpty(inheritId) ? Id : inheritId);
				}
			}
			while (false);
			return inheritId;
		}
		set
		{
			inheritId = value;
		}
	}

	[CollectionProperty]
	public List<PlugIn> FormPlugins { get; set; }

	[CollectionProperty]
	public List<PlugIn> ListPlugins { get; set; }

	[CollectionProperty]
	public List<ExprotFileName> ExprotFileNames { get; set; }

	[CollectionProperty]
	public List<PlugIn> WebFormBuilderPlugins { get; set; }

	[CollectionProperty]
	public List<PlugIn> MetadataCheckPlugIns { get; set; }

	[SimpleProperty]
	public string FormIdFieldName { get; set; }

	[DefaultValue("FDocumentStatus")]
	[SimpleProperty]
	public string DocumentStatusFieldKey { get; set; }

	[SimpleProperty]
	[DefaultValue(0)]
	public int IsNotUseFormIdForFilter { get; set; }

	[SimpleProperty]
	public string MasterPKFieldName { get; set; }

	[SimpleProperty]
	public string PkFieldName { get; set; }

	[SimpleProperty]
	public EnumPkFieldType PkFieldType { get; set; }

	[ComplexProperty]
	public AttachmentMenuControlInfo AttachmentMenuControlInfo { get; set; }

	[SimpleProperty]
	public string IndexFieldName { get; set; }

	[SimpleProperty]
	public string NumberFieldKey { get; set; }

	[SimpleProperty]
	public string NameFieldKey { get; set; }

	public int BaseDataSeqType { get; set; }

	[CollectionProperty]
	public List<QKFField> ListQKFFields { get; set; }

	[CollectionProperty]
	public List<F8DisplayField> F8MulSelSetList { get; set; }

	[SimpleProperty]
	public string BillTypePara { get; set; }

	[SimpleProperty]
	public string CreateOrgFieldKey { get; set; }

	[SimpleProperty]
	public string UseOrgFieldKey { get; set; }

	[SimpleProperty]
	public string FilterObject { get; set; }

	[SimpleProperty]
	[DefaultValue("BOS_List")]
	public string ListObject { get; set; }

	[SimpleProperty]
	public string Note { get; set; }

	[SimpleProperty]
	public string ParameterObjectId { get; set; }

	[SimpleProperty]
	public string AllocateTableName { get; set; }

	[SimpleProperty]
	[DefaultValue("")]
	public string ListQueryFilter { get; set; }

	[DefaultValue("")]
	[SimpleProperty]
	public string ListFixedFilter { get; set; }

	[SimpleProperty]
	public string ListSortField { get; set; }

	[DefaultValue("")]
	[SimpleProperty]
	public string ListDefaultScheme { get; set; }

	[DefaultValue("")]
	[SimpleProperty]
	public string ElementIsolateKey { get; set; }

	[DefaultValue(1)]
	[SimpleProperty]
	public int SupportPermissionControl { get; set; }

	[SimpleProperty]
	public string PermissionObjectId { get; set; }

	[SimpleProperty]
	[DefaultValue("SEC_DataRule")]
	public string DataRuleObject { get; set; }

	[CollectionProperty]
	public List<PlugIn> DataRuleServicePlugins { get; set; }

	[ComplexProperty]
	public PermissionConfig PermissionConfig
	{
		get
		{
			if (permissionConfig == null)
			{
				permissionConfig = new PermissionConfig();
			}
			return permissionConfig;
		}
		set
		{
			permissionConfig = value;
		}
	}

	[CollectionProperty]
	public List<PlugIn> OrgChangeServicePlugins { get; set; }

	[CollectionProperty]
	public List<FormBusinessService> ListDbClickActions { get; set; }

	[CollectionProperty]
	public List<FormatCondition> ListFormatConditions { get; set; }

	[SimpleProperty]
	public bool IsBaseDataTypeControl { get; set; }

	[SimpleProperty]
	public bool IsDisableCache { get; set; }

	[CollectionProperty]
	public List<FormOperation> FormOperations { get; set; }

	[CollectionProperty]
	public List<AbstractValidation> SaveRules { get; set; }

	[SimpleProperty]
	public string SubsysId { get; set; }

	[ComplexProperty]
	public LinkTableSet LinkSet
	{
		get
		{
			if (_EntryLinkSet == null)
			{
				_EntryLinkSet = new LinkTableSet();
			}
			return _EntryLinkSet;
		}
		set
		{
			_EntryLinkSet = value;
		}
	}

	[CollectionProperty]
	public List<BillTrackerElement> BillTrackers { get; set; }

	[SimpleProperty]
	public int ModeTypeSubId { get; set; }

	[SimpleProperty]
	public string SpecId { get; set; }

	[SimpleProperty]
	public int IsTemplate { get; set; }

	[SimpleProperty]
	public int IsCanIssue { get; set; }

	[SimpleProperty]
	public string SLClientFormType { get; set; }

	[SimpleProperty]
	public string FSrcFormID { get; set; }

	[SimpleProperty]
	public bool IsUsedCustomInPrintExport { get; set; }

	[DefaultValue(1)]
	[SimpleProperty]
	public int WriteOperateLog { get; set; }

	[DefaultValue(1)]
	[SimpleProperty]
	public int IsBulkInsert { get; set; }

	[DefaultValue(false)]
	[SimpleProperty]
	public bool IsShowTitleDefault { get; set; }

	[JsonIgnore]
	public DynamicProperty FormIdDynamicProperty { get; private set; }

	[JsonIgnore]
	public DynamicProperty MasterIdDynamicProperty { get; private set; }

	public bool DataMonitorEnabled { get; set; }

	[SimpleProperty(ExtendUnDeser = true)]
	public string ExtCtrl { get; set; }

	public string FormServiceName
	{
		get
		{
			if (string.IsNullOrWhiteSpace(_formServiceName))
			{
				_formServiceName = _000F(107231970) + ElementType;
			}
			return _formServiceName;
		}
		set
		{
			_formServiceName = value;
		}
	}

	public string ModelClass { get; set; }

	public string ViewClass { get; set; }

	public string Controller { get; set; }

	public string ModelEventProxy { get; set; }

	public string ViewEventProxy { get; set; }

	public List<FormGroup> FormGroups { get; set; }

	public ObjectFuncInterfaces FuncInterfaces { get; set; }

	[SimpleProperty]
	public bool UseTreeModel { get; set; }

	[SimpleProperty]
	public string ListDefaultFilter { get; set; }

	[SimpleProperty]
	public string BillCodeRule { get; set; }

	public int StrategyType { get; set; }

	public override int BusinessServiceType => 1;

	public Entity MultiApprovalEntity { get; set; }

	[JsonIgnore]
	public EntityAppearance MultiApprovalEntityAppearance { get; set; }

	public Entity VchEntity { get; set; }

	public EntityAppearance VchEntityAppearance { get; set; }

	public Form()
		: this(_000F(107407312))
	{
	}

	public Form(string key)
		: base(key)
	{
		FormPlugins = new List<PlugIn>();
		ListPlugins = new List<PlugIn>();
		OrgChangeServicePlugins = new List<PlugIn>();
		WebFormBuilderPlugins = new List<PlugIn>();
		MetadataCheckPlugIns = new List<PlugIn>();
		ListQKFFields = new List<QKFField>();
		ListDbClickActions = new List<FormBusinessService>();
		ListFormatConditions = new List<FormatCondition>();
		FormGroups = new List<FormGroup>();
		FormOperations = new List<FormOperation>();
		BillTrackers = new List<BillTrackerElement>();
		ElementType = 100;
		WriteOperateLog = 1;
		ListObject = _000F(107232000);
		IsBulkInsert = 1;
		DataRuleObject = _000F(107232019);
		DataRuleServicePlugins = new List<PlugIn>();
		SupportPermissionControl = 1;
		PermissionConfig = new PermissionConfig();
		DocumentStatusFieldKey = _000F(107429857);
		F8MulSelSetList = new List<F8DisplayField>();
		ExprotFileNames = new List<ExprotFileName>();
	}

	internal void RegisterFormIdDynamicProperty(DynamicObjectType dt)
	{
		if (!string.IsNullOrEmpty(FormIdFieldName))
		{
			FormIdDynamicProperty = dt.RegisterSimpleProperty(_000F(107392771), typeof(string), null, false, new SimplePropertyAttribute
			{
				Alias = FormIdFieldName
			});
		}
	}

	internal void RegisterMasterIdDynamicProperty(DynamicObjectType dt, Type fieldType)
	{
		if (!string.IsNullOrWhiteSpace(MasterPKFieldName))
		{
			MasterIdDynamicProperty = dt.RegisterSimpleProperty(FormConst.MASTER_ID, fieldType, null, false, new SimplePropertyAttribute
			{
				Alias = MasterPKFieldName
			});
		}
	}

	public FormGroup GetFormGroup(string groupId)
	{
		FormGroup result = null;
		if (FormGroups != null && FormGroups.Count > 0)
		{
			List<FormGroup>.Enumerator enumerator = FormGroups.GetEnumerator();
			try
			{
				while (enumerator.MoveNext())
				{
					FormGroup current = enumerator.Current;
					if (7 == 0 || current.Id.EqualsIgnoreCase(groupId))
					{
						result = current;
						break;
					}
				}
			}
			finally
			{
				do
				{
					((IDisposable)enumerator/*cast due to .constrained prefix*/).Dispose();
				}
				while (false);
			}
		}
		return result;
	}

	public FormOperation GetOperation(string operation)
	{
		return FormOperations.FirstOrDefault((FormOperation o) => o.Operation.EqualsIgnoreCase(operation));
	}

	public virtual IResourceServiceProvider GetFormServiceProvider(bool isWebService = false)
	{
		FormServiceProvider formServiceProvider = new FormServiceProvider();
		AddViewEventProxy(formServiceProvider);
		AddModelEventProxy(formServiceProvider);
		AddModel(formServiceProvider);
		AddView(formServiceProvider, isWebService);
		Type orRegister = TypesContainer.GetOrRegister(_000F(107231957));
		formServiceProvider.Add(typeof(IDefaultValueCalculator), Activator.CreateInstance(orRegister));
		orRegister = TypesContainer.GetOrRegister(_000F(107231851));
		formServiceProvider.Add(typeof(ISysParamterService), Activator.CreateInstance(orRegister));
		orRegister = TypesContainer.GetOrRegister(_000F(107231205));
		formServiceProvider.Add(typeof(IDBModelService), Activator.CreateInstance(orRegister));
		orRegister = TypesContainer.GetOrRegister(_000F(107231084));
		formServiceProvider.Add(typeof(IExprFuncService), Activator.CreateInstance(orRegister));
		return formServiceProvider;
	}

	private void AddView(FormServiceProvider provider, bool isWebService)
	{
		if (!isWebService)
		{
			goto IL_0042;
		}
		if (false)
		{
			goto IL_0021;
		}
		string text = _000F(107231471);
		goto IL_0053;
		IL_0053:
		string type = text;
		Type orRegister = TypesContainer.GetOrRegister(type);
		goto IL_0021;
		IL_0021:
		if (0 == 0)
		{
			provider.Add(typeof(IDynamicFormView), Activator.CreateInstance(orRegister));
			if (0 == 0)
			{
				return;
			}
		}
		goto IL_0042;
		IL_0042:
		text = ViewClass;
		goto IL_0053;
	}

	protected virtual void AddViewEventProxy(FormServiceProvider provider)
	{
		Type orRegister = default(Type);
		while (true)
		{
			if (true && 0 == 0)
			{
				orRegister = TypesContainer.GetOrRegister(ViewEventProxy);
			}
			while (true)
			{
				provider.Add(typeof(DynamicFormViewPlugInProxy), Activator.CreateInstance(orRegister));
				if (false)
				{
					break;
				}
				if (false)
				{
					continue;
				}
				return;
			}
		}
	}

	protected virtual void AddModelEventProxy(FormServiceProvider provider)
	{
		Type orRegister = default(Type);
		while (true)
		{
			if (true && 0 == 0)
			{
				orRegister = TypesContainer.GetOrRegister(ModelEventProxy);
			}
			while (true)
			{
				provider.Add(typeof(DynamicFormModelPlugInProxy), Activator.CreateInstance(orRegister));
				if (false)
				{
					break;
				}
				if (false)
				{
					continue;
				}
				return;
			}
		}
	}

	protected virtual void AddModel(FormServiceProvider provider)
	{
		Type orRegister = default(Type);
		while (true)
		{
			if (true && 0 == 0)
			{
				orRegister = TypesContainer.GetOrRegister(ModelClass);
			}
			while (true)
			{
				provider.Add(typeof(IDynamicFormModelService), Activator.CreateInstance(orRegister));
				if (false)
				{
					break;
				}
				if (false)
				{
					continue;
				}
				return;
			}
		}
	}

	public virtual List<AbstractDynamicFormPlugIn> CreateFormPlugIns()
	{
		return CreateFormPlugIns(this, FormPlugins);
	}

	public static List<AbstractDynamicFormPlugIn> CreateFormPlugIns(Form form, List<PlugIn> plugins)
	{
		List<AbstractDynamicFormPlugIn> list = new List<AbstractDynamicFormPlugIn>();
		AbstractDynamicFormPlugIn abstractDynamicFormPlugIn = default(AbstractDynamicFormPlugIn);
		do
		{
			List<PlugIn>.Enumerator enumerator = plugins.GetEnumerator();
			try
			{
				while (enumerator.MoveNext())
				{
					if (8u != 0)
					{
						if (0 == 0)
						{
							PlugIn current = enumerator.Current;
							if (!current.IsEnabled)
							{
								continue;
							}
							abstractDynamicFormPlugIn = CreateFormPlugIn(form, current);
						}
						if (abstractDynamicFormPlugIn == null)
						{
							continue;
						}
					}
					list.Add(abstractDynamicFormPlugIn);
				}
			}
			finally
			{
				do
				{
					if (0 == 0)
					{
						((IDisposable)enumerator/*cast due to .constrained prefix*/).Dispose();
					}
				}
				while (false);
			}
		}
		while (3 == 0);
		return list;
	}

	public virtual List<AbstractMetadataBosCheckPlugIn> CreateMetadataCheckPlugIns()
	{
		List<AbstractMetadataBosCheckPlugIn> list = new List<AbstractMetadataBosCheckPlugIn>();
		if (!MetadataCheckPlugIns.IsEmpty())
		{
			using (List<PlugIn>.Enumerator enumerator = MetadataCheckPlugIns.GetEnumerator())
			{
				AbstractMetadataBosCheckPlugIn abstractMetadataBosCheckPlugIn = default(AbstractMetadataBosCheckPlugIn);
				while (true)
				{
					bool num = enumerator.MoveNext();
					PlugIn current;
					do
					{
						if (!num)
						{
							return list;
						}
						current = enumerator.Current;
						num = current.IsEnabled;
					}
					while (7 == 0);
					if (num)
					{
						try
						{
							if (current.PlugInType == 1)
							{
								if (1 == 0)
								{
									goto IL_00a7;
								}
								if (false)
								{
									goto IL_00b0;
								}
								PythonMetadataBosCheckPlugIn item = new PythonMetadataBosCheckPlugIn(current.GenerateCompiledPython(), current.GetBaseCode(), current.PyScript);
								list.Add(item);
							}
							else
							{
								Type orRegister = TypesContainer.GetOrRegister(current.ClassName);
								if (!(orRegister == null))
								{
									abstractMetadataBosCheckPlugIn = Activator.CreateInstance(orRegister) as AbstractMetadataBosCheckPlugIn;
									goto IL_00a7;
								}
							}
							goto end_IL_0050;
							IL_00a7:
							if (abstractMetadataBosCheckPlugIn != null)
							{
								goto IL_00b0;
							}
							goto end_IL_0050;
							IL_00b0:
							list.Add(abstractMetadataBosCheckPlugIn);
							end_IL_0050:;
						}
						catch (Exception ex)
						{
							do
							{
								IL_00bf:
								if (current.PlugInType == 1)
								{
									if (false)
									{
										break;
									}
									Logger.Error(_000F(107422879), string.Format(_000F(107231402), base.Name, ex.Message, current.PyScript), ex);
								}
								else
								{
									if (false)
									{
										goto IL_00bf;
									}
									if (0 == 0)
									{
										Logger.Error(_000F(107422879), string.Format(_000F(107230716), base.Name, ex.Message, current.ClassName), ex);
										break;
									}
								}
							}
							while (false);
						}
					}
				}
			}
		}
		return list;
	}

	public virtual List<AbstractDynamicFormPlugIn> CreateListPlugIns()
	{
		List<AbstractDynamicFormPlugIn> list = new List<AbstractDynamicFormPlugIn>();
		List<PlugIn>.Enumerator enumerator = ListPlugins.GetEnumerator();
		List<PlugIn>.Enumerator enumerator2;
		if (7u != 0)
		{
			enumerator2 = enumerator;
		}
		try
		{
			if (false)
			{
				goto IL_0022;
			}
			goto IL_0046;
			IL_0046:
			if (!enumerator2.MoveNext())
			{
				return list;
			}
			goto IL_0022;
			IL_0022:
			AbstractListPlugIn abstractListPlugIn;
			if (uint.MaxValue != 0)
			{
				PlugIn current = enumerator2.Current;
				if (!current.IsEnabled)
				{
					goto IL_0046;
				}
				abstractListPlugIn = CreateListPlugIn(current);
			}
			if (abstractListPlugIn != null)
			{
				list.Add(abstractListPlugIn);
			}
			goto IL_0046;
		}
		finally
		{
			((IDisposable)enumerator2/*cast due to .constrained prefix*/).Dispose();
		}
	}

	private AbstractListPlugIn CreateListPlugIn(PlugIn plugin)
	{
		AbstractListPlugIn result;
		try
		{
			if (plugin.PlugInType == 1)
			{
				result = ApmProxyHelper.CreateWebProxy<PythonListPlugIn>(typeof(PythonListPlugIn), new object[3]
				{
					plugin.GenerateCompiledPython(),
					plugin.GetBaseCode(),
					plugin.PyScript
				});
			}
			else
			{
				while (true)
				{
					Type orRegister = TypesContainer.GetOrRegister(plugin.ClassName);
					if (orRegister == null)
					{
						result = null;
						break;
					}
					if (0 == 0)
					{
						result = ApmProxyHelper.CreateWebProxy<AbstractListPlugIn>(orRegister);
						break;
					}
				}
			}
		}
		catch (Exception ex)
		{
			if (plugin.PlugInType == 1)
			{
				Logger.Error(_000F(107422879), string.Format(_000F(107230598), base.Name, ex.Message, plugin.PyScript), ex);
			}
			else
			{
				Logger.Error(_000F(107422879), string.Format(_000F(107230948), base.Name, ex.Message, plugin.ClassName), ex);
			}
			do
			{
				result = null;
			}
			while (3 == 0);
		}
		return result;
	}

	public static AbstractDynamicFormPlugIn CreateFormPlugIn(Form form, PlugIn plugin)
	{
		try
		{
			if (plugin.PlugInType == 1)
			{
				int elementType = form.ElementType;
				if (elementType == 100 || elementType == 400)
				{
					return ApmProxyHelper.CreateWebProxy<PythonBillPlugIn>(typeof(PythonBillPlugIn), new object[3]
					{
						plugin.GenerateCompiledPython(),
						plugin.GetBaseCode(),
						plugin.PyScript
					});
				}
				int num = elementType;
				do
				{
					switch (num)
					{
					case 900:
					case 901:
					case 902:
					case 903:
						return ApmProxyHelper.CreateWebProxy<PythonReportPlugIn>(typeof(PythonReportPlugIn), new object[3]
						{
							plugin.GenerateCompiledPython(),
							plugin.GetBaseCode(),
							plugin.PyScript
						});
					}
					num = form.ModeTypeSubId;
				}
				while (5 == 0);
				if (num == 502)
				{
					return ApmProxyHelper.CreateWebProxy<PythonCommonFilterPlugIn>(typeof(PythonCommonFilterPlugIn), new object[3]
					{
						plugin.GenerateCompiledPython(),
						plugin.GetBaseCode(),
						plugin.PyScript
					});
				}
				return ApmProxyHelper.CreateWebProxy<PythonPlugIn>(typeof(PythonPlugIn), new object[3]
				{
					plugin.GenerateCompiledPython(),
					plugin.GetBaseCode(),
					plugin.PyScript
				});
			}
			Type orRegister = TypesContainer.GetOrRegister(plugin.ClassName);
			if (orRegister == null)
			{
				return null;
			}
			return ApmProxyHelper.CreateWebProxy<AbstractDynamicFormPlugIn>(orRegister);
		}
		catch (Exception ex)
		{
			if (plugin.PlugInType == 1)
			{
				Logger.Error(_000F(107422879), string.Format(_000F(107230810), form.Name, ex.Message, plugin.PyScript), ex);
			}
			else
			{
				Logger.Error(_000F(107422879), string.Format(_000F(107230168), form.Name, ex.Message, plugin.ClassName), ex);
			}
			return null;
		}
	}

	public virtual List<AbstractDynamicWebFormBuilderPlugIn> CreateWebFormBuilderPlugIns()
	{
		List<AbstractDynamicWebFormBuilderPlugIn> list = new List<AbstractDynamicWebFormBuilderPlugIn>();
		List<PlugIn>.Enumerator enumerator = WebFormBuilderPlugins.GetEnumerator();
		List<PlugIn>.Enumerator enumerator2;
		if (7u != 0)
		{
			enumerator2 = enumerator;
		}
		try
		{
			if (false)
			{
				goto IL_0022;
			}
			goto IL_0046;
			IL_0046:
			if (!enumerator2.MoveNext())
			{
				return list;
			}
			goto IL_0022;
			IL_0022:
			AbstractDynamicWebFormBuilderPlugIn abstractDynamicWebFormBuilderPlugIn;
			if (uint.MaxValue != 0)
			{
				PlugIn current = enumerator2.Current;
				if (!current.IsEnabled)
				{
					goto IL_0046;
				}
				abstractDynamicWebFormBuilderPlugIn = CreateWebFormBuilderPlugIn(current);
			}
			if (abstractDynamicWebFormBuilderPlugIn != null)
			{
				list.Add(abstractDynamicWebFormBuilderPlugIn);
			}
			goto IL_0046;
		}
		finally
		{
			((IDisposable)enumerator2/*cast due to .constrained prefix*/).Dispose();
		}
	}

	protected AbstractDynamicWebFormBuilderPlugIn CreateWebFormBuilderPlugIn(PlugIn plugin)
	{
		AbstractDynamicWebFormBuilderPlugIn result = default(AbstractDynamicWebFormBuilderPlugIn);
		try
		{
			do
			{
				if (plugin.PlugInType == 1)
				{
					do
					{
						if (8u != 0)
						{
							result = new PythonFormBuilderPlugIn(plugin.GenerateCompiledPython(), plugin.GetBaseCode(), plugin.PyScript);
						}
					}
					while (false);
					break;
				}
				Type orRegister = TypesContainer.GetOrRegister(plugin.ClassName);
				AbstractDynamicWebFormBuilderPlugIn abstractDynamicWebFormBuilderPlugIn = (AbstractDynamicWebFormBuilderPlugIn)Activator.CreateInstance(orRegister);
				result = abstractDynamicWebFormBuilderPlugIn;
			}
			while (false);
		}
		catch (Exception ex)
		{
			if (plugin.PlugInType != 1)
			{
				Logger.Error(_000F(107422879), string.Format(_000F(107230400), base.Name, ex.Message, plugin.ClassName), ex);
				goto IL_0100;
			}
			if (6 == 0)
			{
				goto IL_0100;
			}
			Logger.Error(_000F(107422879), string.Format(_000F(107230062), base.Name, ex.Message, plugin.PyScript), ex);
			if (0 == 0)
			{
				goto IL_0100;
			}
			goto end_IL_0078;
			IL_0100:
			result = null;
			end_IL_0078:;
		}
		return result;
	}

	public override string ToString()
	{
		return base.Name;
	}

	public string GetPkFieldDbType()
	{
		string result = default(string);
		while (true)
		{
			if (0 == 0)
			{
				if (PkFieldType == EnumPkFieldType.INT)
				{
					string text = _000F(107230282);
					if (0 == 0)
					{
						result = text;
					}
					goto IL_0046;
				}
				while (PkFieldType == EnumPkFieldType.STRING)
				{
					if (0 == 0)
					{
						if (false)
						{
							continue;
						}
						result = _000F(107411589);
					}
					goto IL_0046;
				}
			}
			result = _000F(107230277);
			goto IL_0046;
			IL_0046:
			while (true)
			{
				if (false)
				{
					continue;
				}
				return result;
			}
		}
	}

	public Type GetPkFieldType()
	{
		Type result = default(Type);
		while (5u != 0)
		{
			if (PkFieldType == EnumPkFieldType.STRING)
			{
				if (0 == 0)
				{
					result = typeof(string);
					break;
				}
				continue;
			}
			if (0 == 0)
			{
				Type typeFromHandle = typeof(long);
				if (5u != 0)
				{
					result = typeFromHandle;
				}
			}
			break;
		}
		while (5 == 0)
		{
		}
		return result;
	}

	public override PropertyCheckResult PropertyChangingCheck(AbstractBusinessMetadata info, Kingdee.BOS.Core.Designer.PropertyChangingEventArgs e)
	{
		PropertyCheckResult propertyCheckResult;
		FormMetadata formMetadata;
		if (4u != 0)
		{
			propertyCheckResult = base.PropertyChangingCheck(info, e);
			if (!e.PropertyName.EqualsIgnoreCase(_000F(107260336)) || e.Value.IsNullOrEmptyOrWhiteSpace())
			{
				goto IL_017c;
			}
			formMetadata = info as FormMetadata;
		}
		if (formMetadata != null)
		{
			using List<Entity>.Enumerator enumerator = formMetadata.BusinessInfo.Entrys.GetEnumerator();
			if (8 == 0)
			{
				goto IL_0108;
			}
			goto IL_0160;
			IL_0160:
			Entity current = default(Entity);
			while (true)
			{
				IL_0160_2:
				bool num = enumerator.MoveNext();
				while (num)
				{
					while (true)
					{
						current = enumerator.Current;
						num = current.EntryPkFieldName.IsNullOrEmptyOrWhiteSpace();
						if (false)
						{
							break;
						}
						if (num)
						{
							goto IL_0160_2;
						}
						if (2u != 0)
						{
							if (!current.EntryPkFieldName.EqualsIgnoreCase(e.Value.ToString()))
							{
								goto IL_0160_2;
							}
							if (false)
							{
								continue;
							}
							if (current is SubHeadEntity)
							{
								if (2 == 0)
								{
									continue;
								}
								propertyCheckResult.AddErrorMsg(string.Format(ResManager.LoadKDString(_000F(107229724), _000F(107229671), SubSystemType.BOS), current.Key, e.Value));
								goto IL_0160_2;
							}
							goto IL_0108;
						}
						goto IL_011f;
					}
				}
				break;
			}
			goto end_IL_006d;
			IL_011f:
			propertyCheckResult.AddErrorMsg(string.Format(ResManager.LoadKDString(_000F(107229646), _000F(107229533), SubSystemType.BOS), current.Key, e.Value));
			goto IL_0160;
			IL_0108:
			if (typeof(EntryEntity) == current.GetType())
			{
				goto IL_011f;
			}
			goto IL_0160;
			end_IL_006d:;
		}
		goto IL_017c;
		IL_017c:
		return propertyCheckResult;
	}

	static Form()
	{
		Strings.CreateGetStringDelegate(typeof(Form));
	}
}
