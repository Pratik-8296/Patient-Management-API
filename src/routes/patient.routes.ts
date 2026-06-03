// src/routes/patient.routes.ts
// Express router for patient endpoints

import { Router, RequestHandler } from 'express';
import { patientController } from '../controllers/patient.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createPatientSchema,
  updatePatientSchema,
  queryPatientsSchema,
  searchPatientsSchema,
  patientIdSchema,
} from '../validators/patient.validator';

const router = Router();

/**
 * @swagger
 * /patients/search:
 *   get:
 *     summary: Search patients by medical condition
 *     tags: [Patients]
 *     parameters:
 *       - in: query
 *         name: condition
 *         required: true
 *         schema:
 *           type: string
 *         example: diabetes
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Missing condition parameter
 */
// IMPORTANT: /search must come BEFORE /:id to avoid route conflict
router.get(
  '/search',
  validate(searchPatientsSchema, 'query'),
  patientController.search.bind(patientController) as unknown as RequestHandler
);

/**
 * @swagger
 * /patients:
 *   post:
 *     summary: Create a new patient
 *     tags: [Patients]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePatientRequest'
 *     responses:
 *       201:
 *         description: Patient created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authMiddleware,
  validate(createPatientSchema, 'body'),
  patientController.create.bind(patientController)
);

/**
 * @swagger
 * /patients:
 *   get:
 *     summary: List all patients
 *     tags: [Patients]
 *     parameters:
 *       - in: query
 *         name: address
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: lastEvaluatedKey
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of patients
 */
router.get(
  '/',
  validate(queryPatientsSchema, 'query'),
  patientController.findAll.bind(patientController) as unknown as RequestHandler
);

/**
 * @swagger
 * /patients/{id}:
 *   get:
 *     summary: Get a patient by ID
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Patient data
 *       404:
 *         description: Patient not found
 */
router.get(
  '/:id',
  validate(patientIdSchema, 'params'),
  patientController.findById.bind(patientController)
);

/**
 * @swagger
 * /patients/{id}:
 *   put:
 *     summary: Update a patient
 *     tags: [Patients]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePatientRequest'
 *     responses:
 *       200:
 *         description: Updated patient
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Patient not found
 */
router.put(
  '/:id',
  authMiddleware,
  validate(patientIdSchema, 'params'),
  validate(updatePatientSchema, 'body'),
  patientController.update.bind(patientController)
);

/**
 * @swagger
 * /patients/{id}:
 *   delete:
 *     summary: Delete a patient
 *     tags: [Patients]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Patient deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Patient not found
 */
router.delete(
  '/:id',
  authMiddleware,
  validate(patientIdSchema, 'params'),
  patientController.delete.bind(patientController)
);

export default router;
