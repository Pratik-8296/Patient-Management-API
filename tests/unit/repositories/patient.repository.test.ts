// tests/unit/repositories/patient.repository.test.ts

import { PatientRepository } from '../../../src/repositories/patient.repository';

// Mock AWS SDK DynamoDB commands
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn(),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn(),
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn(),
    })),
  },
}));

jest.mock('../../../src/config/dynamodb', () => ({
  docClient: {
    send: jest.fn(),
  },
  PATIENTS_TABLE: 'test-patients',
  ADDRESS_INDEX: 'AddressIndex',
}));

jest.mock('../../../src/utils/uuid', () => ({
  generateUUID: jest.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
}));

const mockDocClient = jest.requireMock('../../../src/config/dynamodb').docClient;

const mockPatient = {
  patientId: '123e4567-e89b-12d3-a456-426614174000',
  name: 'John Doe',
  address: '123 Main St, Springfield',
  conditions: ['diabetes'],
  allergies: ['penicillin'],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('PatientRepository', () => {
  let repository: PatientRepository;

  beforeEach(() => {
    repository = new PatientRepository();
    jest.clearAllMocks();
  });

  // ─── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create and return a new patient', async () => {
      mockDocClient.send.mockResolvedValue({});

      const result = await repository.create({
        name: 'John Doe',
        address: '123 Main St, Springfield',
        conditions: ['diabetes'],
        allergies: ['penicillin'],
      });

      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      expect(result.patientId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.name).toBe('John Doe');
      expect(result.conditions).toEqual(['diabetes']);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should propagate DynamoDB errors', async () => {
      mockDocClient.send.mockRejectedValue(
        new Error('ConditionalCheckFailedException')
      );

      await expect(
        repository.create({
          name: 'John Doe',
          address: '123 Main St',
          conditions: [],
          allergies: [],
        })
      ).rejects.toThrow();
    });
  });

  // ─── findById ──────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('should return a patient when found', async () => {
      mockDocClient.send.mockResolvedValue({ Item: mockPatient });

      const result = await repository.findById(mockPatient.patientId);

      expect(result).toEqual(mockPatient);
    });

    it('should return null when patient not found', async () => {
      mockDocClient.send.mockResolvedValue({ Item: undefined });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated results with scan', async () => {
      mockDocClient.send.mockResolvedValue({
        Items: [mockPatient],
        Count: 1,
        LastEvaluatedKey: undefined,
      });

      const result = await repository.findAll({ limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.count).toBe(1);
    });

    it('should use GSI query when address is provided', async () => {
      mockDocClient.send.mockResolvedValue({
        Items: [mockPatient],
        Count: 1,
      });

      const result = await repository.findAll({
        address: '123 Main St',
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
    });

    it('should decode lastEvaluatedKey for pagination', async () => {
      const key = { patientId: 'some-id' };
      const encodedKey = Buffer.from(JSON.stringify(key)).toString('base64');

      mockDocClient.send.mockResolvedValue({
        Items: [],
        Count: 0,
      });

      await repository.findAll({ limit: 20, lastEvaluatedKey: encodedKey });

      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should encode LastEvaluatedKey in response', async () => {
      const lastKey = { patientId: 'last-item-id' };
      mockDocClient.send.mockResolvedValue({
        Items: [mockPatient],
        Count: 1,
        LastEvaluatedKey: lastKey,
      });

      const result = await repository.findAll({ limit: 1 });

      expect(result.lastEvaluatedKey).toBeDefined();
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update a patient and return updated data', async () => {
      const updatedPatient = { ...mockPatient, name: 'Jane Doe' };
      // First call is findById, second is UpdateCommand
      mockDocClient.send
        .mockResolvedValueOnce({ Item: mockPatient })
        .mockResolvedValueOnce({ Attributes: updatedPatient });

      const result = await repository.update(mockPatient.patientId, {
        name: 'Jane Doe',
      });

      expect(result).toEqual(updatedPatient);
    });

    it('should return null if patient not found', async () => {
      mockDocClient.send.mockResolvedValueOnce({ Item: undefined });

      const result = await repository.update('non-existent', { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────
  describe('delete', () => {
    it('should delete a patient and return true', async () => {
      mockDocClient.send
        .mockResolvedValueOnce({ Item: mockPatient })
        .mockResolvedValueOnce({});

      const result = await repository.delete(mockPatient.patientId);

      expect(result).toBe(true);
    });

    it('should return false if patient not found', async () => {
      mockDocClient.send.mockResolvedValueOnce({ Item: undefined });

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });
});
