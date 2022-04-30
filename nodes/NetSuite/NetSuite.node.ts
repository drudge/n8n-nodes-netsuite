import { IExecuteFunctions } from 'n8n-core';
import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRunExecutionData,
	NodeApiError,
	LoggerProxy as Logger,
} from 'n8n-workflow';
import {
	INetSuiteCredentials, INetSuiteOperationOptions,
} from './NetSuite.node.types';

import { makeRequest } from '@fye/netsuite-rest-api';
import { fsync } from 'fs';
import { connected } from 'process';

const handleNetsuiteResponse = function (fns: IExecuteFunctions, response: any) {
	// console.log(`Netsuite response:`, response.body);
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
			const error = new Error(code);
			error.message = message;
			throw error;
		} else {
			body = {
				error: message,
			};
		}
	} else {
		body = response.body;
	}
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
						name: 'Get Records',
						value: 'getRecords',
					},
					{
						name: 'Get Record',
						value: 'getRecord',
					},
					{
						name: 'Update Record',
						value: 'updateRecord',
					},
					{
						name: 'Delete Record',
						value: 'deleteRecord',
					},
					{
						name: 'Execute SuiteQL',
						value: 'runSuiteQL',
					},
					{
						name: 'Get Workbook',
						value: 'getWorkbook',
					},
					{
						name: 'Raw Request',
						value: 'rawRequest',
					},
				],
				default: 'getRecords',
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
							'deleteRecord',
							'getRecords',
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
							'getRecords',
							'runSuiteQL',
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
							'getRecords',
							'updateRecord',
							'deleteRecord',
						],
					},
				},
				default: 'v1',
			},
		],
	};

	static async getRecords(options: INetSuiteOperationOptions): Promise<INodeExecutionData[]> {
		const { fns, credentials, itemIndex } = options;
		const apiVersion = fns.getNodeParameter('version', itemIndex) as string;
		const recordType = fns.getNodeParameter('recordType', itemIndex) as string;
		const queryLimit = fns.getNodeParameter('queryLimit', itemIndex, 10) as string;
		let hasMore = true;
		let nextUrl = `services/rest/record/${apiVersion}/${recordType}?limit=${queryLimit}&offset=0`;
		let method = 'POST';
		let requestType = 'suiteql';
		const requestData = {
			method: 'GET',
			requestType: 'record',
			nextUrl,
		};
		const returnData: INodeExecutionData[] = [];

		while (hasMore === true) {
			const response = await makeRequest(getConfig(credentials), {
			  method,
			  requestType,
			  nextUrl,
			});
			const body: any = handleNetsuiteResponse(fns, response);
			const { hasMore: doContinue, items, links } = body;
			if (doContinue) {
			  nextUrl = links.find((link: any) => link.rel === 'next').href;
			}
			if (Array.isArray(items)) {
				returnData.push(...items.map(item => ({ json: item })));
			}
			hasMore = doContinue;
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
			requestType: 'record',
			path: `services/rest/record/${apiVersion}/${recordType}/${internalId}${q ? `?${q}` : ''}`,
		};
		const response = await makeRequest(getConfig(credentials), requestData);
		return handleNetsuiteResponse(fns, response);
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
				const record = await NetSuite.getRecord({fns: this, credentials, itemIndex});
				record.json.orderNo = item.json.orderNo;
				returnData.push(record);
			} else if (operation == 'getRecords') {
				const records = await NetSuite.getRecords({fns: this, credentials, itemIndex});
				returnData.push(...records);
			}
		}

		return this.prepareOutputData(returnData);
	}
}
