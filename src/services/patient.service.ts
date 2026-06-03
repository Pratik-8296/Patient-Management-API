// src/services/patient.service.ts
// Business logic layer — orchestrates repositories

import { patientRepository, PatientRepository } from '../repositories/patient.repository';
import { openSearchRepository, OpenSearchRepository } from '../repositories/opensearch.repository';
import {
  Patient,
  CreatePatientInput,
  UpdatePatientInput,
  PaginatedResult,
  QueryPatientsInput,
} from '../models/patient.model';
import { SearchResult } from '../repositories/opensearch.repository';
import { logger } from '../utils/logger';

export class PatientService {
  constructor(
    private readonly patientRepo: PatientRepository,
    private readonly searchRepo: OpenSearchRepository
  ) {}

  /**
   * Create a new patient and index it in OpenSearch
   */
  async createPatient(input: CreatePatientInput): Promise<Patient> {
    logger.info({ name: input.name }, 'Creating patient');

    const patient = await this.patientRepo.create(input);

    // Index in OpenSearch asynchronously (non-blocking)
    void this.searchRepo.indexPatient(patient).catch((err: unknown) => {
      logger.error({ err, patientId: patient.patientId }, 'OpenSearch indexing failed');
    });

    logger.info({ patientId: patient.patientId }, 'Patient created successfully');
    return patient;
  }

  /**
   * Get a patient by ID
   */
  async getPatientById(patientId: string): Promise<Patient | null> {
    logger.debug({ patientId }, 'Fetching patient by ID');
    return this.patientRepo.findById(patientId);
  }

  /**
   * List patients with pagination and optional address filter
   */
  async listPatients(input: QueryPatientsInput): Promise<PaginatedResult<Patient>> {
    logger.debug({ input }, 'Listing patients');
    return this.patientRepo.findAll(input);
  }

  /**
   * Update a patient and re-index in OpenSearch
   */
  async updatePatient(
    patientId: string,
    input: UpdatePatientInput
  ): Promise<Patient | null> {
    logger.info({ patientId }, 'Updating patient');

    const updated = await this.patientRepo.update(patientId, input);

    if (updated) {
      void this.searchRepo.indexPatient(updated).catch((err: unknown) => {
        logger.error({ err, patientId }, 'OpenSearch re-indexing failed after update');
      });
      logger.info({ patientId }, 'Patient updated successfully');
    }

    return updated;
  }

  /**
   * Delete a patient from DB and OpenSearch
   */
  async deletePatient(patientId: string): Promise<boolean> {
    logger.info({ patientId }, 'Deleting patient');

    const deleted = await this.patientRepo.delete(patientId);

    if (deleted) {
      void this.searchRepo.deletePatient(patientId).catch((err: unknown) => {
        logger.error({ err, patientId }, 'OpenSearch delete failed');
      });
      logger.info({ patientId }, 'Patient deleted successfully');
    }

    return deleted;
  }

  /**
   * Search patients by medical condition via OpenSearch
   */
  async searchByCondition(
    condition: string,
    limit: number,
    from: number
  ): Promise<SearchResult> {
    logger.debug({ condition, limit, from }, 'Searching patients by condition');
    return this.searchRepo.searchByCondition(condition, limit, from);
  }
}

export const patientService = new PatientService(
  patientRepository,
  openSearchRepository
);
