import {
	INodeTypeDescription,
} from 'n8n-workflow';

/**
 * Options to be displayed
 */
export const nodeDescription: INodeTypeDescription = {
	displayName: 'NetSuite',
	name: 'netsuite',
	group: ['input'],
	version: 1,
	description: 'NetSuite REST API',
	defaults: {
		name: 'NetSuite',
		color: '#125580',
	},
	icon: 'file:netSuite.svg',
	inputs: ['main'],
	outputs: ['main'],
	credentials: [
		{
			name: 'netsuite',
			required: true,
		},
	],
	properties: [
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			options: [
				{
					name: 'List Records',
					value: 'listRecords',
				},
				{
					name: 'Get Record',
					value: 'getRecord',
				},
				{
					name: 'Insert Record',
					value: 'insertRecord',
				},
				{
					name: 'Update Record',
					value: 'updateRecord',
				},
				{
					name: 'Remove Record',
					value: 'removeRecord',
				},
				{
					name: 'Execute SuiteQL',
					value: 'runSuiteQL',
				},
				// {
				// 	name: 'Get Workbook',
				// 	value: 'getWorkbook',
				// },
				{
					name: 'Raw Request',
					value: 'rawRequest',
				},
			],
			default: 'getRecord',
		},
		{
			displayName: 'Request Type',
			name: 'requestType',
			type: 'options',
			options: [
				{
					name: 'Record',
					value: 'record',
				},
				{
					name: 'SuiteQL',
					value: 'suiteql',
				},
				{
					name: 'Workbook',
					value: 'workbook',
				},
				{
					name: 'Dataset',
					value: 'dataset',
				},
			],
			displayOptions: {
				show: {
					operation: [
						'rawRequest',
					],
				},
			},
			required: true,
			default: 'record',
		},
		{
			displayName: 'HTTP Method',
			name: 'method',
			type: 'options',
			options: [
				{
					name: 'DELETE',
					value: 'DELETE',
				},
				{
					name: 'GET',
					value: 'GET',
				},
				{
					name: 'HEAD',
					value: 'HEAD',
				},
				{
					name: 'OPTIONS',
					value: 'OPTIONS',
				},
				{
					name: 'PATCH',
					value: 'PATCH',
				},
				{
					name: 'POST',
					value: 'POST',
				},
				{
					name: 'PUT',
					value: 'PUT',
				},
			],
			default: 'GET',
			description: 'The request method to use.',
			displayOptions: {
				show: {
					operation: [
						'rawRequest',
					],
				},
			},
			required: true,
		},
		{
			displayName: 'Path',
			name: 'path',
			type: 'string',
			required: true,
			default: 'services/rest/record/v1/salesOrder',
			displayOptions: {
				show: {
					operation: [
						'rawRequest',
					],
				},
			},
		},
		{
			displayName: 'Record Type',
			name: 'recordType',
			type: 'options',
			options: [
				{ name: 'Assembly Item', value: 'assemblyItem' },
				{ name: 'Billing Account', value: 'billingAccount' },
				{ name: 'Calendar Event', value: 'calendarEvent' },
				{ name: 'Cash Sale', value: 'cashSale' },
				{ name: 'Charge', value: 'charge' },
				{ name: 'Classification (BETA)', value: 'classification' },
				{ name: 'Contact', value: 'contact' },
				{ name: 'Contact Category', value: 'contactCategory' },
				{ name: 'Contact Role', value: 'contactRole' },
				{ name: 'Credit Memo', value: 'creditMemo' },
				{ name: 'Custom Record (*)', value: 'custom' },
				{ name: 'Customer', value: 'customer' },
				{ name: 'Customer Subsidiary Relationship', value: 'customerSubsidiaryRelationship' },
				{ name: 'Email Template', value: 'emailTemplate' },
				{ name: 'Employee', value: 'employee' },
				{ name: 'Inventory Item', value: 'inventoryItem' },
				{ name: 'Invoice', value: 'invoice' },
				{ name: 'Item Fulfillment', value: 'itemFulfillment' },
				{ name: 'Journal Entry', value: 'journalEntry' },
				{ name: 'Message', value: 'message' },
				{ name: 'Non-Inventory Sale Item', value: 'nonInventorySaleItem' },
				{ name: 'Opportunity (BETA)', value: 'opportunity'},
				{ name: 'Phone Call', value: 'phoneCall' },
				{ name: 'Price Book', value: 'priceBook' },
				{ name: 'Price Plan', value: 'pricePlan' },
				{ name: 'Purchase Order', value: 'purchaseOrder' },
				{ name: 'Sales Order', value: 'salesOrder' },
				{ name: 'Subscription', value: 'subscription' },
				{ name: 'Subscription Change Order', value: 'subscriptionChangeOrder' },
				{ name: 'Subscription Line', value: 'subscriptionLine' },
				{ name: 'Subscription Plan', value: 'subscriptionPlan' },
				{ name: 'Subscription Term', value: 'subscriptionTerm' },
				{ name: 'Subsidiary', value: 'subsidiary' },
				{ name: 'Task', value: 'task' },
				{ name: 'Time Bill', value: 'timeBill' },
				{ name: 'Usage', value: 'usage' },
				{ name: 'Vendor', value: 'vendor' },
				{ name: 'Vendor Bill', value: 'vendorBill' },
				{ name: 'Vendor Subsidiary Relationship', value: 'vendorSubsidiaryRelationship' },
			],
			displayOptions: {
				show: {
					operation: [
						'getRecord',
						'updateRecord',
						'removeRecord',
						'listRecords',
						'insertRecord',
					],
				},
			},
			default: 'salesOrder',
		},
		{
			displayName: 'Custom Record Script ID',
			name: 'customRecordTypeScriptId',
			type: 'string',
			required: true,
			default: '',
			displayOptions: {
				show: {
					operation: [
						'getRecord',
						'updateRecord',
						'removeRecord',
						'listRecords',
						'insertRecord',
					],
					recordType: [
						'custom',
					],
				},
			},
			description: 'The internal identifier of the Custom Record type. These normally start with customrecord',
		},
		{
			displayName: 'ID',
			name: 'internalId',
			type: 'string',
			required: true,
			default: '',
			displayOptions: {
				show: {
					operation: [
						'getRecord',
						'updateRecord',
						'removeRecord',
					],
				},
			},
			description: 'The internal identifier of the record. Prefix with eid: to use the external identifier.',
		},
		{
			displayName: 'Query',
			name: 'query',
			type: 'string',
			required: false,
			default: '',
			displayOptions: {
				show: {
					operation: [
						'listRecords',
						'runSuiteQL',
					],
				},
			},
		},
		{
			displayName: 'Body',
			name: 'body',
			type: 'string',
			required: false,
			default: '',
			displayOptions: {
				show: {
					operation: [
						'rawRequest',
					],
				},
			},
		},
		{
			displayName: 'Restrict Returned Fields',
			name: 'fields',
			type: 'string',
			required: false,
			default: '',
			displayOptions: {
				show: {
					operation: [
						'getRecord',
					],
				},
			},
			description: 'Optionally return only the specified fields and sublists in the response.',
		},
		{
			displayName: 'Replace Sublists',
			name: 'replace',
			type: 'string',
			required: false,
			default: '',
			displayOptions: {
				show: {
					operation: [
						'insertRecord',
						'updateRecord',
					],
				},
			},
			description: 'The names of sublists on this record. All sublist lines will be replaced with lines specified in the request. The sublists not specified here will have lines added to the record. The names are delimited by comma.',
		},
		{
			displayName: 'Replace Selected Fields',
			name: 'replaceSelectedFields',
			type: 'boolean',
			required: true,
			default: false,
			displayOptions: {
				show: {
					operation: [
						'updateRecord',
					],
				},
			},
			description: 'If true, all fields that should be deleted in the update request, including body fields, must be included in the replace query parameter.',
		},
		{
			displayName: 'Expand Sub-resources',
			name: 'expandSubResources',
			type: 'boolean',
			required: true,
			default: false,
			displayOptions: {
				show: {
					operation: [
						'getRecord',
					],
				},
			},
			description: 'If true, automatically expands all sublists, sublist lines, and subrecords on this record.',
		},
		{
			displayName: 'Simple Enum Format',
			name: 'simpleEnumFormat',
			type: 'boolean',
			required: true,
			// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-simplify
			default: false,
			displayOptions: {
				show: {
					operation: [
						'getRecord',
					],
				},
			},
			description: 'If true, returns enumeration values in a format that only shows the internal ID value.',
		},
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			displayOptions: {
				show: {
					operation: [
						'listRecords',
						'runSuiteQL',
					],
				},
			},
			default: false,
			description: 'Whether all results should be returned or only up to a given limit',
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			displayOptions: {
				show: {
					operation: [
						'listRecords',
						'runSuiteQL',
					],
					returnAll: [
						false,
					],
				},
			},
			typeOptions: {
				minValue: 1,
				maxValue: 1000,
			},
			default: 100,
			description: 'How many records to return',
		},
		{
			displayName: 'Offset',
			name: 'offset',
			type: 'number',
			displayOptions: {
				show: {
					operation: [
						'listRecords',
						'runSuiteQL',
					],
					returnAll: [
						false,
					],
				},
			},
			typeOptions: {
				minValue: 0,
			},
			default: 0,
			description: 'How many records to return',
		},
		{
			displayName: 'API Version',
			name: 'version',
			type: 'options',
			options: [
				{
					name: 'v1',
					value: 'v1',
				},
			],
			displayOptions: {
				show: {
					operation: [
						'getRecord',
						'listRecords',
						'insertRecord',
						'updateRecord',
						'removeRecord',
						'createRecord',
						'runSuiteQL',
					],
				},
			},
			default: 'v1',
		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			default: {},
			placeholder: 'Add options',
			description: 'Add options',
			options: [
				{
					displayName: 'Concurrency',
					name: 'concurrency',
					type: 'number',
					default: 1,
					typeOptions: {
						minValue: 1,
					},					// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-limit
					description: 'Use control the maximum number of REST requests sent to NetSuite at the same time. The default is 1.',
				},
				{
					displayName: 'Full Response',
					name: 'fullResponse',
					type: 'boolean',
					default: false,
					description: 'Returns the full reponse data instead of only the body',
				},
			],
		},
	],
};
