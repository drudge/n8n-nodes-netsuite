import { IExecuteFunctions } from "n8n-core";
import { INodeExecutionData } from "n8n-workflow";

export type INetSuiteCredentials = {
    hostname: string;
    accountId: string;
    consumerKey: string;
    consumerSecret: string;
    tokenKey: string;
    tokenSecret: string;
};

export type INetSuiteOperationOptions = {
    item?: INodeExecutionData;
    fns: IExecuteFunctions;
    credentials: INetSuiteCredentials;
    itemIndex: number;
}

export enum NetSuiteRequestType {
    Record = 'record',
    SuiteQL = 'suiteql',
    Workbook = 'workbook',
}
export type INetSuiteRequestOptions = {
    nextUrl?: string;
    method: string;
    body?: any;
    headers?: any;
    query?: any;
    path?: string;
    requestType: NetSuiteRequestType;
}