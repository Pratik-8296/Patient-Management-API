// src/models/patient.model.ts
// Patient domain model and DynamoDB item types

export interface Patient {
  patientId: string;
  name: string;
  address: string;
  conditions: string[];
  allergies: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreatePatientInput {
  name: string;
  address: string;
  conditions: string[];
  allergies: string[];
}

export interface UpdatePatientInput {
  name?: string;
  address?: string;
  conditions?: string[];
  allergies?: string[];
}

// DynamoDB item shape (PK = patientId)
export interface PatientDynamoItem extends Patient {
  // For GSI AddressIndex
  address: string;
}

// OpenSearch document shape
export interface PatientSearchDocument {
  patientId: string;
  name: string;
  address: string;
  conditions: string[];
  allergies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  count: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

export interface QueryPatientsInput {
  address?: string;
  limit?: number;
  lastEvaluatedKey?: string; // base64-encoded JSON
}
