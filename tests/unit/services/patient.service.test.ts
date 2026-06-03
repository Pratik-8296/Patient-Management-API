// tests/unit/services/patient.service.test.ts

import { PatientService } from '../../../src/services/patient.service';
import { PatientRepository } from '../../../src/repositories/patient.repository';
import { OpenSearchRepository } from '../../../src/repositories/opensearch.repository';
import { Patient } from '../../../src/models/patient.model';

// Mock the repositories
jest.mock('../../../src/repositories/patient.repository');
jest.mock('../../../src/repositories/opensearch.repository');

const mockPatient: Patient = {
  patientId: '123e4567-e89b-12d3-a456-426614174000',
  name: 'John Doe',
  address: '123 Main St, Springfield',
  conditions: ['diabetes', 'hypertension'],
  allergies: ['penicillin'],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('PatientService', () => {
  let patientService: PatientService;
  let mockPatientRepo: jest.Mocked<PatientRepository>;
  let mockSearchRepo: jest.Mocked<OpenSearchRepository>;

  beforeEach(() => {
    mockPatientRepo = new PatientRepository() as jest.Mocked<PatientRepository>;
    mockSearchRepo = new OpenSearchRepository() as jest.Mocked<OpenSearchRepository>;
    patientService = new PatientService(mockPatientRepo, mockSearchRepo);
  });

  // ─── createPatient ─────────────────────────────────────────────────────────
  describe('createPatient', () => {
    it('should create a patient and trigger OpenSearch indexing', async () => {
      mockPatientRepo.create.mockResolvedValue(mockPatient);
      mockSearchRepo.indexPatient.mockResolvedValue(undefined);

      const result = await patientService.createPatient({
        name: 'John Doe',
        address: '123 Main St, Springfield',
        conditions: ['diabetes'],
        allergies: ['penicillin'],
      });

      expect(mockPatientRepo.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockPatient);
    });

    it('should return patient even if OpenSearch indexing fails', async () => {
      mockPatientRepo.create.mockResolvedValue(mockPatient);
      mockSearchRepo.indexPatient.mockRejectedValue(new Error('OpenSearch down'));

      const result = await patientService.createPatient({
        name: 'John Doe',
        address: '123 Main St',
        conditions: [],
        allergies: [],
      });

      expect(result).toEqual(mockPatient);
    });

    it('should propagate DynamoDB errors', async () => {
      mockPatientRepo.create.mockRejectedValue(new Error('DynamoDB error'));

      await expect(
        patientService.createPatient({
          name: 'John Doe',
          address: '123 Main St',
          conditions: [],
          allergies: [],
        })
      ).rejects.toThrow('DynamoDB error');
    });
  });

  // ─── getPatientById ────────────────────────────────────────────────────────
  describe('getPatientById', () => {
    it('should return a patient when found', async () => {
      mockPatientRepo.findById.mockResolvedValue(mockPatient);

      const result = await patientService.getPatientById(mockPatient.patientId);

      expect(mockPatientRepo.findById).toHaveBeenCalledWith(mockPatient.patientId);
      expect(result).toEqual(mockPatient);
    });

    it('should return null when patient not found', async () => {
      mockPatientRepo.findById.mockResolvedValue(null);

      const result = await patientService.getPatientById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  // ─── listPatients ──────────────────────────────────────────────────────────
  describe('listPatients', () => {
    it('should return paginated list of patients', async () => {
      const paginatedResult = {
        items: [mockPatient],
        count: 1,
      };
      mockPatientRepo.findAll.mockResolvedValue(paginatedResult);

      const result = await patientService.listPatients({ limit: 10 });

      expect(mockPatientRepo.findAll).toHaveBeenCalledWith({ limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.count).toBe(1);
    });

    it('should pass address filter to repository', async () => {
      mockPatientRepo.findAll.mockResolvedValue({ items: [], count: 0 });

      await patientService.listPatients({ address: '123 Main St', limit: 20 });

      expect(mockPatientRepo.findAll).toHaveBeenCalledWith({
        address: '123 Main St',
        limit: 20,
      });
    });
  });

  // ─── updatePatient ─────────────────────────────────────────────────────────
  describe('updatePatient', () => {
    it('should update patient and re-index in OpenSearch', async () => {
      const updatedPatient = { ...mockPatient, name: 'Jane Doe' };
      mockPatientRepo.update.mockResolvedValue(updatedPatient);
      mockSearchRepo.indexPatient.mockResolvedValue(undefined);

      const result = await patientService.updatePatient(mockPatient.patientId, {
        name: 'Jane Doe',
      });

      expect(mockPatientRepo.update).toHaveBeenCalledWith(mockPatient.patientId, {
        name: 'Jane Doe',
      });
      expect(result).toEqual(updatedPatient);
    });

    it('should return null if patient not found', async () => {
      mockPatientRepo.update.mockResolvedValue(null);

      const result = await patientService.updatePatient('non-existent', {
        name: 'New Name',
      });

      expect(result).toBeNull();
    });
  });

  // ─── deletePatient ─────────────────────────────────────────────────────────
  describe('deletePatient', () => {
    it('should delete patient from DB and OpenSearch', async () => {
      mockPatientRepo.delete.mockResolvedValue(true);
      mockSearchRepo.deletePatient.mockResolvedValue(undefined);

      const result = await patientService.deletePatient(mockPatient.patientId);

      expect(mockPatientRepo.delete).toHaveBeenCalledWith(mockPatient.patientId);
      expect(result).toBe(true);
    });

    it('should return false if patient not found', async () => {
      mockPatientRepo.delete.mockResolvedValue(false);

      const result = await patientService.deletePatient('non-existent');

      expect(result).toBe(false);
    });
  });

  // ─── searchByCondition ─────────────────────────────────────────────────────
  describe('searchByCondition', () => {
    it('should delegate to OpenSearch repository', async () => {
      const searchResult = {
        patients: [
          {
            patientId: mockPatient.patientId,
            name: mockPatient.name,
            address: mockPatient.address,
            conditions: mockPatient.conditions,
            allergies: mockPatient.allergies,
            createdAt: mockPatient.createdAt,
            updatedAt: mockPatient.updatedAt,
          },
        ],
        total: 1,
      };
      mockSearchRepo.searchByCondition.mockResolvedValue(searchResult);

      const result = await patientService.searchByCondition('diabetes', 20, 0);

      expect(mockSearchRepo.searchByCondition).toHaveBeenCalledWith(
        'diabetes',
        20,
        0
      );
      expect(result.total).toBe(1);
      expect(result.patients).toHaveLength(1);
    });
  });
});
