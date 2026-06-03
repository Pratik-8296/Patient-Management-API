// src/config/dynamodb.ts
// DynamoDB DocumentClient singleton

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TranslateConfig } from '@aws-sdk/lib-dynamodb';
import { awsConfig } from './aws';

const isOffline =
  process.env['IS_OFFLINE'] === 'true' || process.env['NODE_ENV'] === 'local';

const dynamoDBClientConfig = {
  ...awsConfig,
  ...(isOffline
    ? { endpoint: process.env['DYNAMODB_ENDPOINT'] ?? 'http://localhost:8000' }
    : {}),
};

const baseClient = new DynamoDBClient(dynamoDBClientConfig);

const translateConfig: TranslateConfig = {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
};

// Export as DynamoDBDocumentClient explicitly so TypeScript resolves .send() overloads
export const docClient: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
  baseClient,
  translateConfig
);

export const PATIENTS_TABLE = process.env['DYNAMODB_TABLE_NAME'] ?? 'patients';
export const ADDRESS_INDEX = 'AddressIndex';
