import { IExecuteFunctions } from 'n8n-core';
import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger,
	NodeApiError,
} from 'n8n-workflow';

import {
	INetSuiteCredentials, INetSuiteOperationOptions, INetSuiteRequestOptions, NetSuiteRequestType,
} from './NetSuite.node.types';

import { makeRequest } from '@fye/netsuite-rest-api';

const handleNetsuiteResponse = function (fns: IExecuteFunctions, response: any) {
	// console.log(response);
	console.log(`Netsuite response:`, response.statusCode, response.body);
	let body: any = {};
	const {
		title: webTitle = undefined,
		code: restletCode = undefined,
		'o:errorCode': webCode,
		'o:errorDetails': webDetails,
		message: restletMessage = undefined,
	} = response.body;
	if (!(response.statusCode && response.statusCode >= 200 && response.statusCode < 400)) {
		let message = webTitle || restletMessage || webCode || response.statusText;
		if (webDetails && webDetails.length > 0) {
			message = webDetails[0].detail || message;
		}
		if (fns.continueOnFail() !== true) {
			const code = webCode || restletCode;
			const error = new NodeApiError(fns.getNode(), response.body);
			error.message = message;
			throw error;
		} else {
			body = {
				error: message,
			};
		}
	} else {
		body = response.body;
		if ([ 'POST', 'PATCH', 'DELETE' ].includes(response.request.options.method)) {
			body = {};
			if (response.headers['x-netsuite-propertyvalidation']) {
				body.propertyValidation = response.headers['x-netsuite-propertyvalidation'].split(',');
			}
			if (response.headers['x-n-operationid']) {
				body.operationId = response.headers['x-n-operationid'];
			}
			if (response.headers['x-netsuite-jobid']) {
				body.jobId = response.headers['x-netsuite-jobid'];
			}
			if (response.headers['location']) {
				body.links = [
					{
						rel: 'self',
						href: response.headers['location'],
					},
				];
				body.id = response.headers['location'].split('/').pop();
			}
			body.success = response.statusCode === 204;
		}
	}
	// console.log(body);
	return { json: body };
};

const getConfig = (credentials: INetSuiteCredentials) => ({
	netsuiteApiHost: credentials.hostname,
	consumerKey: credentials.consumerKey,
	consumerSecret: credentials.consumerSecret,
	netsuiteAccountId: credentials.accountId,
	netsuiteTokenKey: credentials.tokenKey,
	netsuiteTokenSecret: credentials.tokenSecret,
});

export class NetSuite implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NetSuite',
		name: 'netsuite',
		group: ['netsuite', 'erp'],
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
					// {
					// 	name: 'Execute SuiteQL',
					// 	value: 'runSuiteQL',
					// },
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
						],
					},
				},
				default: true,
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
						],
					},
				},
				default: 'v1',
			},
		],
	};

	static async listRecords(options: INetSuiteOperationOptions): Promise<INodeExecutionData[]> {
		const { fns, credentials, itemIndex } = options;
		const apiVersion = fns.getNodeParameter('version', itemIndex) as string;
		const recordType = fns.getNodeParameter('recordType', itemIndex) as string;
		const returnAll = fns.getNodeParameter('returnAll', itemIndex) as boolean;
		const query = fns.getNodeParameter('query', itemIndex) as string;
		let limit = 100;
		let offset = 0;
		let hasMore = true;
		let method = 'GET';
		let nextUrl;
		let requestType = NetSuiteRequestType.Record;
		const params = new URLSearchParams();
		const returnData: INodeExecutionData[] = [];
		let prefix = query ? `?${query}` : '';
		if (returnAll !== true) {
			prefix = query ? `${prefix}&` : '?';
			limit = fns.getNodeParameter('limit', itemIndex) as number;
			offset = fns.getNodeParameter('offset', itemIndex) as number;
			params.set('limit', String(limit));
			params.set('offset', String(offset));
			prefix += params.toString();
		}
		const requestData: INetSuiteRequestOptions = {
			method,
			requestType,
			path: `services/rest/record/${apiVersion}/${recordType}${prefix}`,
		};
		// console.log('requestData', requestData);
		while ((returnAll || returnData.length < limit) && hasMore === true) {			
			const response = await makeRequest(getConfig(credentials), requestData);
			const body: any = handleNetsuiteResponse(fns, response);
			const { hasMore: doContinue, items, links } = body.json;
			if (doContinue) {
			  nextUrl = links.find((link: any) => link.rel === 'next').href;
			  requestData.nextUrl = nextUrl;
			}
			if (Array.isArray(items)) {
				for (const json of items) {
					if (returnAll || returnData.length < limit) {
						returnData.push({ json });
					}
				}
			}
			hasMore = doContinue && (returnAll || returnData.length < limit);
		  }
		return returnData;
	}

	static async getRecord(options: INetSuiteOperationOptions): Promise<INodeExecutionData> {
		const { fns, credentials, itemIndex } = options;
		const params = new URLSearchParams();
		const expandSubResources = fns.getNodeParameter('expandSubResources', itemIndex) as boolean;
		const simpleEnumFormat = fns.getNodeParameter('simpleEnumFormat', itemIndex) as boolean;
		const apiVersion = fns.getNodeParameter('version', itemIndex) as string;
		const recordType = fns.getNodeParameter('recordType', itemIndex) as string;
		const internalId = fns.getNodeParameter('internalId', itemIndex) as string;
		if (expandSubResources) {
			params.append('expandSubResources', 'true');
		}
		if (simpleEnumFormat) {
			params.append('simpleEnumFormat', 'true');
		}
		const q = params.toString();
		const requestData = {
			method: 'GET',
			requestType: NetSuiteRequestType.Record,
			path: `services/rest/record/${apiVersion}/${recordType}/${internalId}${q ? `?${q}` : ''}`,
		};
		const response = await makeRequest(getConfig(credentials), requestData);
		return handleNetsuiteResponse(fns, response);
	}

	static async removeRecord(options: INetSuiteOperationOptions): Promise<INodeExecutionData> {
		const { fns, credentials, itemIndex } = options;
		const apiVersion = fns.getNodeParameter('version', itemIndex) as string;
		const recordType = fns.getNodeParameter('recordType', itemIndex) as string;
		const internalId = fns.getNodeParameter('internalId', itemIndex) as string;
		const requestData = {
			method: 'DELETE',
			requestType: NetSuiteRequestType.Record,
			path: `services/rest/record/${apiVersion}/${recordType}/${internalId}`,
		};
		const response = await makeRequest(getConfig(credentials), requestData);
		return handleNetsuiteResponse(fns, response);
	}

	static async insertRecord(options: INetSuiteOperationOptions): Promise<INodeExecutionData> {
		const { fns, credentials, itemIndex, item } = options;
		const apiVersion = fns.getNodeParameter('version', itemIndex) as string;
		const recordType = fns.getNodeParameter('recordType', itemIndex) as string;
		const query = item ? item.json : undefined;
		const requestData: INetSuiteRequestOptions = {
			method: 'POST',
			requestType: NetSuiteRequestType.Record,
			path: `services/rest/record/${apiVersion}/${recordType}`,
		};
		if (query) requestData.query = query;
		const response = await makeRequest(getConfig(credentials), requestData);
		return handleNetsuiteResponse(fns, response);
	}

	static async updateRecord(options: INetSuiteOperationOptions): Promise<INodeExecutionData> {
		const { fns, credentials, itemIndex, item } = options;
		const apiVersion = fns.getNodeParameter('version', itemIndex) as string;
		const recordType = fns.getNodeParameter('recordType', itemIndex) as string;
		const internalId = fns.getNodeParameter('internalId', itemIndex) as string;
		const query = item ? item.json : undefined;
		const requestData: INetSuiteRequestOptions = {
			method: 'PATCH',
			requestType: NetSuiteRequestType.Record,
			path: `services/rest/record/${apiVersion}/${recordType}/${internalId}`,
		};
		if (query) requestData.query = query;
		const response = await makeRequest(getConfig(credentials), requestData);
		return handleNetsuiteResponse(fns, response);
	}

	static async rawRequest(options: INetSuiteOperationOptions): Promise<INodeExecutionData> {
		const { fns, credentials, itemIndex, item } = options;
		const path = fns.getNodeParameter('path', itemIndex) as string;
		const method = fns.getNodeParameter('method', itemIndex) as string;
		const body = fns.getNodeParameter('body', itemIndex) as string;
		const requestType = fns.getNodeParameter('requestType', itemIndex) as NetSuiteRequestType;
		const query = body || (item ? item.json : undefined);
		const requestData: INetSuiteRequestOptions = {
			method,
			requestType,
			path,
		};
		if (query && !['GET', 'HEAD', 'OPTIONS'].includes(method)) requestData.query = query;
		// console.log('requestData', requestData);
		const response = await makeRequest(getConfig(credentials), requestData);
		return { 
			json: {
				statusCode: response.statusCode,
				headers: response.headers,
				body: response.body,
			},
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials: INetSuiteCredentials = (await this.getCredentials('netsuite')) as INetSuiteCredentials;
		const operation = this.getNodeParameter('operation', 0) as string;
		let items: INodeExecutionData[] = this.getInputData();
		let returnData: INodeExecutionData[] = [];

		for (let itemIndex: number = 0; itemIndex < items.length; itemIndex++) {
			console.log(`Processing ${operation} for ${itemIndex+1} of ${items.length}`);
			const item: INodeExecutionData = items[itemIndex];
			if (operation === 'getRecord') {
				const record = await NetSuite.getRecord({ item, fns: this, credentials, itemIndex});
				record.json.orderNo = item.json.orderNo;
				returnData.push(record);
			} else if (operation === 'listRecords') {
				const records = await NetSuite.listRecords({ item, fns: this, credentials, itemIndex});
				returnData.push(...records);
			} else if (operation === 'removeRecord') {
				const record = await NetSuite.removeRecord({ item, fns: this, credentials, itemIndex});
				returnData.push(record);
			} else if (operation === 'insertRecord') {
				const record = await NetSuite.insertRecord({ item, fns: this, credentials, itemIndex});
				console.log(record);
				returnData.push(record);
			} else if (operation === 'updateRecord') {
				const record = await NetSuite.updateRecord({ item, fns: this, credentials, itemIndex});
				returnData.push(record);
			} else if (operation === 'rawRequest') {
				const record = await NetSuite.rawRequest({ item, fns: this, credentials, itemIndex});
				returnData.push(record);
			}
		}

		return this.prepareOutputData(returnData);
	}
}
