import { debuglog } from 'util';
import { IExecuteFunctions } from 'n8n-core';
import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
} from 'n8n-workflow';

import {
	INetSuiteCredentials,
	INetSuiteOperationOptions,
	INetSuitePagedBody,
	INetSuiteRequestOptions,
	INetSuiteResponse,
	NetSuiteRequestType,
} from './NetSuite.node.types';

import {
	nodeDescription,
} from './NetSuite.node.options';

import { makeRequest } from '@fye/netsuite-rest-api';

import * as pLimit from 'p-limit';
import { response } from 'express';

const debug = debuglog('n8n-nodes-netsuite');

const handleNetsuiteResponse = (fns: IExecuteFunctions, response: INetSuiteResponse) => {
	// debug(response);
	debug(`Netsuite response:`, response.statusCode, response.body);
	let body: JsonObject = {};
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
			body = typeof body === 'object' ? response.body : {};
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
	// debug(body);
	return { json: body };
};

const getConfig = (credentials: INetSuiteCredentials) => ({
	netsuiteApiHost: credentials.hostname,
	consumerKey: credentials.consumerKey,
	consumerSecret: credentials.consumerSecret,
	netsuiteAccountId: credentials.accountId,
	netsuiteTokenKey: credentials.tokenKey,
	netsuiteTokenSecret: credentials.tokenSecret,
	netsuiteQueryLimit: 1000,
});

export class NetSuite implements INodeType {
	description: INodeTypeDescription = nodeDescription;

	static getRecordType({ fns, itemIndex }: INetSuiteOperationOptions): string {
		let recordType = fns.getNodeParameter('recordType', itemIndex) as string;
		if (recordType === 'custom') {
			recordType = fns.getNodeParameter('customRecordTypeScriptId', itemIndex) as string;
		}
		return recordType;
	}

	static async listRecords(options: INetSuiteOperationOptions): Promise<INodeExecutionData[]> {
		const { fns, credentials, itemIndex } = options;
		const nodeContext = fns.getContext('node');
		const apiVersion = fns.getNodeParameter('version', itemIndex) as string;
		const recordType = NetSuite.getRecordType(options);
		const returnAll = fns.getNodeParameter('returnAll', itemIndex) as boolean;
		const query = fns.getNodeParameter('query', itemIndex) as string;
		let limit = 100;
		let offset = 0;
		let hasMore = true;
		const method = 'GET';
		let nextUrl;
		const requestType = NetSuiteRequestType.Record;
		const params = new URLSearchParams();
		const returnData: INodeExecutionData[] = [];
		let prefix = query ? `?${query}` : '';
		if (returnAll !== true) {
			prefix = query ? `${prefix}&` : '?';
			limit = fns.getNodeParameter('limit', itemIndex) as number || limit;
			offset = fns.getNodeParameter('offset', itemIndex) as number || offset;
			params.set('limit', String(limit));
			params.set('offset', String(offset));
			prefix += params.toString();
		}
		const requestData: INetSuiteRequestOptions = {
			method,
			requestType,
			path: `services/rest/record/${apiVersion}/${recordType}${prefix}`,
		};
		nodeContext.hasMore = hasMore;
		nodeContext.count = limit;
		nodeContext.offset = offset;
		// debug('requestData', requestData);
		while ((returnAll || returnData.length < limit) && hasMore === true) {			
			const response = await makeRequest(getConfig(credentials), requestData);
			const body: JsonObject = handleNetsuiteResponse(fns, response);
			const { hasMore: doContinue, items, links, offset, count, totalResults } = (body.json as INetSuitePagedBody);
			if (doContinue) {
				nextUrl = (links.find((link) => link.rel === 'next') || {}).href;
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
			nodeContext.hasMore = doContinue;
			nodeContext.count = count;
			nodeContext.offset = offset;
			nodeContext.totalResults = totalResults;
			if (requestData.nextUrl) {
				nodeContext.nextUrl = requestData.nextUrl;
			}
		}
		return returnData;
	}

	static async runSuiteQL(options: INetSuiteOperationOptions): Promise<INodeExecutionData[]> {
		const { fns, credentials, itemIndex } = options;
		const nodeContext = fns.getContext('node');
		const apiVersion = fns.getNodeParameter('version', itemIndex) as string;
		const returnAll = fns.getNodeParameter('returnAll', itemIndex) as boolean;
		const query = fns.getNodeParameter('query', itemIndex) as string;
		let limit = 1000;
		let offset = 0;
		let hasMore = true;
		const method = 'POST';
		let nextUrl;
		const requestType = NetSuiteRequestType.SuiteQL;
		const params = new URLSearchParams();
		const returnData: INodeExecutionData[] = [];
		const config = getConfig(credentials);
		let prefix = '?';
		if (returnAll !== true) {
			limit = fns.getNodeParameter('limit', itemIndex) as number || limit;
			offset = fns.getNodeParameter('offset', itemIndex) as number || offset;
			params.set('offset', String(offset));
		}
		params.set('limit', String(limit));
		config.netsuiteQueryLimit = limit;
		prefix += params.toString();
		const requestData: INetSuiteRequestOptions = {
			method,
			requestType,
			query,
			path: `services/rest/query/${apiVersion}/suiteql${prefix}`,
		};
		nodeContext.hasMore = hasMore;
		nodeContext.count = limit;
		nodeContext.offset = offset;
		debug('requestData', requestData);
		while ((returnAll || returnData.length < limit) && hasMore === true) {			
			const response = await makeRequest(config, requestData);
			const body: JsonObject = handleNetsuiteResponse(fns, response);
			const { hasMore: doContinue, items, links, count, totalResults, offset } = (body.json as INetSuitePagedBody);
			if (doContinue) {
				nextUrl = (links.find((link) => link.rel === 'next') || {}).href;
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
			nodeContext.hasMore = doContinue;
			nodeContext.count = count;
			nodeContext.offset = offset;
			nodeContext.totalResults = totalResults;
			if (requestData.nextUrl) {
				nodeContext.nextUrl = requestData.nextUrl;
			}
		}
		return returnData;
	}

	static async getRecord(options: INetSuiteOperationOptions): Promise<INodeExecutionData> {
		const { item, fns, credentials, itemIndex } = options;
		const params = new URLSearchParams();
		const expandSubResources = fns.getNodeParameter('expandSubResources', itemIndex) as boolean;
		const simpleEnumFormat = fns.getNodeParameter('simpleEnumFormat', itemIndex) as boolean;
		const apiVersion = fns.getNodeParameter('version', itemIndex) as string;
		const recordType = NetSuite.getRecordType(options);
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
		if (item) response.body.orderNo = item.json.orderNo;
		return handleNetsuiteResponse(fns, response);
	}

	static async removeRecord(options: INetSuiteOperationOptions): Promise<INodeExecutionData> {
		const { fns, credentials, itemIndex } = options;
		const apiVersion = fns.getNodeParameter('version', itemIndex) as string;
		const recordType = NetSuite.getRecordType(options);
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
		const recordType = NetSuite.getRecordType(options);
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
		const nodeContext = fns.getContext('node');
		let path = fns.getNodeParameter('path', itemIndex) as string;
		const method = fns.getNodeParameter('method', itemIndex) as string;
		const body = fns.getNodeParameter('body', itemIndex) as string;
		const requestType = fns.getNodeParameter('requestType', itemIndex) as NetSuiteRequestType;
		const query = body || (item ? item.json : undefined);
		const nodeOptions = fns.getNodeParameter('options', 0) as IDataObject;

		if (path && (path.startsWith('https://') || path.startsWith('http://'))) {
			const url = new URL(path);
			path = `${url.pathname.replace(/^\//, '')}${url.search || ''}`;
		}

		const requestData: INetSuiteRequestOptions = {
			method,
			requestType,
			path,
		};
		if (query && !['GET', 'HEAD', 'OPTIONS'].includes(method)) requestData.query = query;
		// debug('requestData', requestData);
		const response = await makeRequest(getConfig(credentials), requestData);

		if (response.body) {
			nodeContext.hasMore = response.body.hasMore;
			nodeContext.count = response.body.count;
			nodeContext.offset = response.body.offset;
			nodeContext.totalResults = response.body.totalResults;
		}

		if (nodeOptions.fullResponse) {
			return { 
				json: {
					statusCode: response.statusCode,
					headers: response.headers,
					body: response.body,
				},
			};
		} else {
			return { json: response.body };
		}
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials: INetSuiteCredentials = (await this.getCredentials('netsuite')) as INetSuiteCredentials;
		const operation = this.getNodeParameter('operation', 0) as string;
		const items: INodeExecutionData[] = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const promises = [];
		const options = this.getNodeParameter('options', 0) as IDataObject;
		const concurrency = options.concurrency as number || 1;
		const limit = pLimit(concurrency);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item: INodeExecutionData = items[itemIndex];
			let data: INodeExecutionData | INodeExecutionData[];

			promises.push(limit(async () =>{
				debug(`Processing ${operation} for ${itemIndex+1} of ${items.length}`);
				if (operation === 'getRecord') {
					data = await NetSuite.getRecord({ item, fns: this, credentials, itemIndex});
				} else if (operation === 'listRecords') {
					data = await NetSuite.listRecords({ item, fns: this, credentials, itemIndex});
				} else if (operation === 'removeRecord') {
					data = await NetSuite.removeRecord({ item, fns: this, credentials, itemIndex});
				} else if (operation === 'insertRecord') {
					data = await NetSuite.insertRecord({ item, fns: this, credentials, itemIndex});
				} else if (operation === 'updateRecord') {
					data = await NetSuite.updateRecord({ item, fns: this, credentials, itemIndex});
				} else if (operation === 'rawRequest') {
					data = await NetSuite.rawRequest({ item, fns: this, credentials, itemIndex});
				} else if (operation === 'runSuiteQL') {
					data = await NetSuite.runSuiteQL({ item, fns: this, credentials, itemIndex});
				} else {
					const error = `The operation "${operation}" is not supported!`;
					if (this.continueOnFail() !== true) {
						throw new Error(error);
					} else {
						data = { json: { error } };
					}
				}
				return data;
			}));
		}

		const results = await Promise.all(promises);
		for await (const result of results) {
			if (result) {
				if (Array.isArray(result)) {
					returnData.push(...result);
				} else {
					returnData.push(result);
				}
			}
		}

		return this.prepareOutputData(returnData);
	}
}
