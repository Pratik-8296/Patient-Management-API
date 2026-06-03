// src/repositories/opensearch.repository.ts
// OpenSearch data access layer for patient indexing and search

import { getOpenSearchClient, PATIENTS_INDEX } from '../config/opensearch';
import { Patient, PatientSearchDocument } from '../models/patient.model';
import { logger } from '../utils/logger';

export interface SearchResult {
  patients: PatientSearchDocument[];
  total: number;
}

export class OpenSearchRepository {
  /**
   * Ensure the patients index exists with the correct mapping
   */
  async ensureIndex(): Promise<void> {
    const client = getOpenSearchClient();
    if (!client) {
      logger.warn('OpenSearch not configured — skipping index creation');
      return;
    }
    try {
      const exists = await client.indices.exists({
        index: PATIENTS_INDEX,
      });

      if (!exists.body) {
        await client.indices.create({
          index: PATIENTS_INDEX,
          body: {
            mappings: {
              properties: {
                patientId: { type: 'keyword' },
                name: { type: 'text', analyzer: 'standard' },
                address: { type: 'text', analyzer: 'standard' },
                conditions: { type: 'keyword' },
                allergies: { type: 'keyword' },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' },
              },
            },
            settings: {
              number_of_shards: 1,
              number_of_replicas: 1,
            },
          },
        });
        logger.info('Created OpenSearch patients index');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to ensure OpenSearch index');
      // Non-fatal: don't throw, allow the app to continue
    }
  }

  /**
   * Index or update a patient document in OpenSearch
   */
  async indexPatient(patient: Patient): Promise<void> {
    const client = getOpenSearchClient();
    if (!client) {
      logger.warn('OpenSearch not configured — skipping patient indexing');
      return;
    }
    try {
      const document: PatientSearchDocument = {
        patientId: patient.patientId,
        name: patient.name,
        address: patient.address,
        conditions: patient.conditions,
        allergies: patient.allergies,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
      };

      await client.index({
        index: PATIENTS_INDEX,
        id: patient.patientId,
        body: document,
        refresh: 'wait_for',
      });

      logger.debug({ patientId: patient.patientId }, 'Patient indexed in OpenSearch');
    } catch (error) {
      logger.error({ error, patientId: patient.patientId }, 'Failed to index patient in OpenSearch');
      // Non-fatal: don't throw so primary DB operation still succeeds
    }
  }

  /**
   * Search patients by condition using OpenSearch
   */
  async searchByCondition(
    condition: string,
    limit = 20,
    from = 0
  ): Promise<SearchResult> {
    const client = getOpenSearchClient();
    if (!client) {
      logger.warn('OpenSearch not configured — returning empty search results');
      return { patients: [], total: 0 };
    }
    try {
      const response = await client.search({
        index: PATIENTS_INDEX,
        body: {
          from,
          size: limit,
          query: {
            bool: {
              should: [
                {
                  match: {
                    conditions: {
                      query: condition,
                      fuzziness: 'AUTO',
                    },
                  },
                },
                {
                  term: {
                    conditions: condition.toLowerCase(),
                  },
                },
              ],
              minimum_should_match: 1,
            },
          },
          sort: [{ updatedAt: { order: 'desc' } }],
        },
      });

      const hits = response.body.hits;
      const patients = (hits.hits as Array<{ _source: PatientSearchDocument }>).map(
        (hit) => hit._source
      );

      return {
        patients,
        total: typeof hits.total === 'number' ? hits.total : hits.total?.value ?? 0,
      };
    } catch (error) {
      logger.error({ error, condition }, 'OpenSearch search failed');
      throw error;
    }
  }

  /**
   * Delete a patient document from OpenSearch
   */
  async deletePatient(patientId: string): Promise<void> {
    const client = getOpenSearchClient();
    if (!client) {
      logger.warn('OpenSearch not configured — skipping patient deletion from index');
      return;
    }
    try {
      await client.delete({
        index: PATIENTS_INDEX,
        id: patientId,
      });
      logger.debug({ patientId }, 'Patient deleted from OpenSearch');
    } catch (error) {
      logger.error({ error, patientId }, 'Failed to delete patient from OpenSearch');
      // Non-fatal
    }
  }
}

export const openSearchRepository = new OpenSearchRepository();
