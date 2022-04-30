import { IExecuteFunctions } from "n8n-core";

export type INetSuiteCredentials = {
    hostname: string;
    accountId: string;
    consumerKey: string;
    consumerSecret: string;
    tokenKey: string;
    tokenSecret: string;
};

export type INetSuiteOperationOptions = {
    fns: IExecuteFunctions;
    credentials: INetSuiteCredentials;
    itemIndex: number;
}