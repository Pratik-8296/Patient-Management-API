// src/repositories/patient.repository.ts
// DynamoDB data access layer for patients

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  GetCommandOutput,
  PutCommandOutput,
  UpdateCommandOutput,
  DeleteCommandOutput,
  QueryCommandOutput,
  ScanCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { docClient, PATIENTS_TABLE, ADDRESS_INDEX } from '../config/dynamodb';
import {
  Patient,
  CreatePatientInput,
  UpdatePatientInput,
  PaginatedResult,
  QueryPatientsInput,
} from '../models/patient.model';
import { generateUUID } from '../utils/uuid';
import { logger } from '../utils/logger';

export class PatientRepository {
  /**
   * Create a new patient record in DynamoDB
   */
  async create(input: CreatePatientInput): Promise<Patient> {
    const now = new Date().toISOString();
    const patient: Patient = {
      patientId: generateUUID(),
      name: input.name,
      address: input.address,
      conditions: input.conditions,
      allergies: input.allergies,
      createdAt: now,
      updatedAt: now,
    };

    const cmd = new PutCommand({
      TableName: PATIENTS_TABLE,
      Item: patient,
      ConditionExpression: 'attribute_not_exists(patientId)',
    });
    const _result: PutCommandOutput = await docClient.send(cmd);
    void _result; // suppress unused var

    logger.debug({ patientId: patient.patientId }, 'Patient created in DynamoDB');
    return patient;
  }

  /**
   * Get a patient by ID
   */
  async findById(patientId: string): Promise<Patient | null> {
    const cmd = new GetCommand({
      TableName: PATIENTS_TABLE,
      Key: { patientId },
    });
    const result: GetCommandOutput = await docClient.send(cmd);

    if (!result.Item) {
      return null;
    }

    return result.Item as Patient;
  }

  /**
   * List all patients with optional pagination
   */
  async findAll(input: QueryPatientsInput): Promise<PaginatedResult<Patient>> {
    const { limit = 20, lastEvaluatedKey } = input;

    const exclusiveStartKey = lastEvaluatedKey
      ? (JSON.parse(
          Buffer.from(lastEvaluatedKey, 'base64').toString('utf-8')
        ) as Record<string, unknown>)
      : undefined;

    // If filtering by address, use the GSI
    if (input.address) {
      return this.findByAddress(input.address, limit, exclusiveStartKey);
    }

    const cmd = new ScanCommand({
      TableName: PATIENTS_TABLE,
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
    });
    const result: ScanCommandOutput = await docClient.send(cmd);

    const nextKey = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return {
      items: (result.Items ?? []) as Patient[],
      count: result.Count ?? 0,
      ...(nextKey ? { lastEvaluatedKey: { nextKey } } : {}),
    };
  }

  /**
   * Query patients by address using the AddressIndex GSI
   */
  async findByAddress(
    address: string,
    limit = 20,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<PaginatedResult<Patient>> {
    const cmd = new QueryCommand({
      TableName: PATIENTS_TABLE,
      IndexName: ADDRESS_INDEX,
      KeyConditionExpression: '#addr = :addr',
      ExpressionAttributeNames: { '#addr': 'address' },
      ExpressionAttributeValues: { ':addr': address },
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
    });
    const result: QueryCommandOutput = await docClient.send(cmd);

    const nextKey = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return {
      items: (result.Items ?? []) as Patient[],
      count: result.Count ?? 0,
      ...(nextKey ? { lastEvaluatedKey: { nextKey } } : {}),
    };
  }

  /**
   * Update a patient by ID
   */
  async update(
    patientId: string,
    input: UpdatePatientInput
  ): Promise<Patient | null> {
    const existing = await this.findById(patientId);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    const updateExpressions: string[] = ['#updatedAt = :updatedAt'];
    const expressionAttributeNames: Record<string, string> = {
      '#updatedAt': 'updatedAt',
    };
    const expressionAttributeValues: Record<string, unknown> = {
      ':updatedAt': now,
    };

    if (input.name !== undefined) {
      updateExpressions.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = input.name;
    }

    if (input.address !== undefined) {
      updateExpressions.push('#address = :address');
      expressionAttributeNames['#address'] = 'address';
      expressionAttributeValues[':address'] = input.address;
    }

    if (input.conditions !== undefined) {
      updateExpressions.push('#conditions = :conditions');
      expressionAttributeNames['#conditions'] = 'conditions';
      expressionAttributeValues[':conditions'] = input.conditions;
    }

    if (input.allergies !== undefined) {
      updateExpressions.push('#allergies = :allergies');
      expressionAttributeNames['#allergies'] = 'allergies';
      expressionAttributeValues[':allergies'] = input.allergies;
    }

    const cmd = new UpdateCommand({
      TableName: PATIENTS_TABLE,
      Key: { patientId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(patientId)',
      ReturnValues: 'ALL_NEW',
    });
    const result: UpdateCommandOutput = await docClient.send(cmd);

    logger.debug({ patientId }, 'Patient updated in DynamoDB');
    return (result.Attributes as Patient) ?? null;
  }

  /**
   * Delete a patient by ID
   */
  async delete(patientId: string): Promise<boolean> {
    const existing = await this.findById(patientId);
    if (!existing) {
      return false;
    }

    const cmd = new DeleteCommand({
      TableName: PATIENTS_TABLE,
      Key: { patientId },
      ConditionExpression: 'attribute_exists(patientId)',
    });
    const _result: DeleteCommandOutput = await docClient.send(cmd);
    void _result;

    logger.debug({ patientId }, 'Patient deleted from DynamoDB');
    return true;
  }
}

export const patientRepository = new PatientRepository();
