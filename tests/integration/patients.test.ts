// tests/integration/patients.test.ts
// Integration tests using supertest against the Express app

import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

// Mock all external dependencies
jest.mock('../../src/repositories/patient.repository');
jest.mock('../../src/repositories/opensearch.repository');
jest.mock('../../src/config/cognito');
jest.mock('../../src/middleware/auth.middleware', () => ({
  authMiddleware: jest.fn((req: { headers: { authorization?: string } }, res: { status: (n: number) => { json: (b: unknown) => void } }, next: () => void) => {
    // Simulate auth: if header is present, pass; otherwise 401
    if (req.headers.authorization === 'Bearer valid-token') {
      next();
    } else {
      res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  }),
  optionalAuthMiddleware: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

// Require mocked modules
const { patientRepository } = jest.requireMock('../../src/repositories/patient.repository');
const { openSearchRepository } = jest.requireMock('../../src/repositories/opensearch.repository');
const { authMiddleware } = jest.requireMock('../../src/middleware/auth.middleware');

const mockPatient = {
  patientId: '123e4567-e89b-12d3-a456-426614174000',
  name: 'John Doe',
  address: '123 Main St, Springfield, IL 62701',
  conditions: ['diabetes', 'hypertension'],
  allergies: ['penicillin'],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('Patient API Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply authMiddleware mock — resetMocks can wipe implementations
    // causing requests to hang (neither next() nor res.end() called)
    authMiddleware.mockImplementation(
      (req: { headers: { authorization?: string } }, res: { status: (n: number) => { json: (b: unknown) => void } }, next: () => void) => {
        if (req.headers.authorization === 'Bearer valid-token') {
          next();
        } else {
          res.status(401).json({ success: false, message: 'Unauthorized' });
        }
      }
    );
    // Default mock implementations
    openSearchRepository.ensureIndex = jest.fn().mockResolvedValue(undefined);
    openSearchRepository.indexPatient = jest.fn().mockResolvedValue(undefined);
    openSearchRepository.deletePatient = jest.fn().mockResolvedValue(undefined);
    openSearchRepository.searchByCondition = jest.fn().mockResolvedValue({
      patients: [mockPatient],
      total: 1,
    });
  });

  // ─── Health Check ──────────────────────────────────────────────────────────
  describe('GET /health', () => {
    it('should return 200 with health status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('healthy');
    });
  });

  // ─── POST /patients ────────────────────────────────────────────────────────
  describe('POST /patients', () => {
    it('should create a patient with valid auth and body', async () => {
      patientRepository.create = jest.fn().mockResolvedValue(mockPatient);

      const res = await request(app)
        .post('/patients')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'John Doe',
          address: '123 Main St, Springfield, IL 62701',
          conditions: ['diabetes'],
          allergies: ['penicillin'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('John Doe');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/patients')
        .send({
          name: 'John Doe',
          address: '123 Main St',
          conditions: [],
          allergies: [],
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 with invalid body (missing name)', async () => {
      const res = await request(app)
        .post('/patients')
        .set('Authorization', 'Bearer valid-token')
        .send({
          address: '123 Main St, Springfield, IL 62701',
          conditions: [],
          allergies: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should return 400 with short address', async () => {
      const res = await request(app)
        .post('/patients')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'John Doe',
          address: '123',
          conditions: [],
          allergies: [],
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /patients ─────────────────────────────────────────────────────────
  describe('GET /patients', () => {
    it('should return a list of patients', async () => {
      patientRepository.findAll = jest.fn().mockResolvedValue({
        items: [mockPatient],
        count: 1,
      });

      const res = await request(app).get('/patients');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by address query param', async () => {
      patientRepository.findAll = jest.fn().mockResolvedValue({
        items: [],
        count: 0,
      });

      const res = await request(app)
        .get('/patients')
        .query({ address: '123 Main St' });

      expect(res.status).toBe(200);
      expect(patientRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ address: '123 Main St' })
      );
    });
  });

  // ─── GET /patients/search ──────────────────────────────────────────────────
  describe('GET /patients/search', () => {
    it('should search patients by condition', async () => {
      const res = await request(app)
        .get('/patients/search')
        .query({ condition: 'diabetes' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(openSearchRepository.searchByCondition).toHaveBeenCalledWith(
        'diabetes',
        20,
        0
      );
    });

    it('should return 400 without condition param', async () => {
      const res = await request(app).get('/patients/search');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /patients/:id ─────────────────────────────────────────────────────
  describe('GET /patients/:id', () => {
    it('should return a patient by valid UUID', async () => {
      patientRepository.findById = jest.fn().mockResolvedValue(mockPatient);

      const res = await request(app).get(
        `/patients/${mockPatient.patientId}`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.patientId).toBe(mockPatient.patientId);
    });

    it('should return 404 when patient not found', async () => {
      patientRepository.findById = jest.fn().mockResolvedValue(null);

      const res = await request(app).get(
        '/patients/123e4567-e89b-12d3-a456-426614174999'
      );

      expect(res.status).toBe(404);
    });

    it('should return 400 with invalid UUID', async () => {
      const res = await request(app).get('/patients/invalid-uuid');

      expect(res.status).toBe(400);
    });
  });

  // ─── PUT /patients/:id ─────────────────────────────────────────────────────
  describe('PUT /patients/:id', () => {
    it('should update a patient with valid auth', async () => {
      const updated = { ...mockPatient, name: 'Jane Doe' };
      patientRepository.update = jest.fn().mockResolvedValue(updated);

      const res = await request(app)
        .put(`/patients/${mockPatient.patientId}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Jane Doe' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Jane Doe');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .put(`/patients/${mockPatient.patientId}`)
        .send({ name: 'Jane Doe' });

      expect(res.status).toBe(401);
    });

    it('should return 404 when patient not found', async () => {
      patientRepository.update = jest.fn().mockResolvedValue(null);

      const res = await request(app)
        .put('/patients/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Jane Doe' });

      expect(res.status).toBe(404);
    });

    it('should return 400 with empty body', async () => {
      const res = await request(app)
        .put(`/patients/${mockPatient.patientId}`)
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /patients/:id ──────────────────────────────────────────────────
  describe('DELETE /patients/:id', () => {
    it('should delete a patient with valid auth', async () => {
      patientRepository.delete = jest.fn().mockResolvedValue(true);

      const res = await request(app)
        .delete(`/patients/${mockPatient.patientId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).delete(
        `/patients/${mockPatient.patientId}`
      );

      expect(res.status).toBe(401);
    });

    it('should return 404 when patient not found', async () => {
      patientRepository.delete = jest.fn().mockResolvedValue(false);

      const res = await request(app)
        .delete('/patients/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  // ─── 404 Route ─────────────────────────────────────────────────────────────
  describe('Unknown Routes', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/unknown-route');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
