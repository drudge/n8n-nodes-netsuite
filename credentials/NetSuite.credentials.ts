import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NetSuite implements ICredentialType {
	name = 'netsuite';
	displayName = 'NetSuite';
	documentationUrl = 'netsuite';
	properties: INodeProperties[] = [
		{
			displayName: 'Hostname',
			name: 'hostname',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Account ID',
			name: 'accountId',
			type: 'string',
			default: '',
			required: true,
			description: 'NetSuite Account ID',
		},
		{
			displayName: 'Consumer Key',
			name: 'consumerKey',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Consumer Secret',
			name: 'consumerSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
		{
			displayName: 'Token Key',
			name: 'tokenKey',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Token Secret',
			name: 'tokenSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
	];
}
