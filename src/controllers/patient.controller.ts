// src/controllers/patient.controller.ts
// HTTP request handlers — delegates to PatientService

import { Request, Response, NextFunction } from 'express';
import { patientService } from '../services/patient.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  QueryPatientsDto,
  SearchPatientsDto,
  PatientIdParam,
} from '../validators/patient.validator';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendNoContent,
} from '../utils/response';
import { logger } from '../utils/logger';

export class PatientController {
  /**
   * POST /patients
   * Create a new patient
   */
  async create(
    req: Request<Record<string, never>, unknown, CreatePatientDto>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const patient = await patientService.createPatient(req.body);
      logger.info({ patientId: patient.patientId }, 'POST /patients - created');
      sendCreated(res, patient, 'Patient created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /patients
   * List patients with optional query filters
   */
  async findAll(
    req: Request<Record<string, never>, unknown, unknown, QueryPatientsDto>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { address, limit, lastEvaluatedKey } = req.query;

      const result = await patientService.listPatients({
        address,
        limit,
        lastEvaluatedKey,
      });

      sendSuccess(res, result.items, 'Patients retrieved successfully', 200, {
        count: result.count,
        lastEvaluatedKey: result.lastEvaluatedKey,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /patients/search?condition=diabetes
   * Search patients by medical condition
   */
  async search(
    req: Request<Record<string, never>, unknown, unknown, SearchPatientsDto>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { condition, limit, from } = req.query;

      const result = await patientService.searchByCondition(
        condition,
        limit,
        from
      );

      sendSuccess(res, result.patients, 'Search completed successfully', 200, {
        total: result.total,
        from,
        limit,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /patients/:id
   * Get a patient by ID
   */
  async findById(
    req: Request<PatientIdParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const patient = await patientService.getPatientById(id);

      if (!patient) {
        sendNotFound(res, `Patient with ID '${id}' not found`);
        return;
      }

      sendSuccess(res, patient, 'Patient retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /patients/:id
   * Update a patient
   */
  async update(
    req: Request<PatientIdParam, unknown, UpdatePatientDto>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await patientService.updatePatient(id, req.body);

      if (!updated) {
        sendNotFound(res, `Patient with ID '${id}' not found`);
        return;
      }

      sendSuccess(res, updated, 'Patient updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /patients/:id
   * Delete a patient
   */
  async delete(
    req: Request<PatientIdParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await patientService.deletePatient(id);

      if (!deleted) {
        sendNotFound(res, `Patient with ID '${id}' not found`);
        return;
      }

      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }
}

export const patientController = new PatientController();
