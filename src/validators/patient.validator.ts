// src/validators/patient.validator.ts
// Zod schemas for patient request validation

import { z } from 'zod';

// Reusable field schemas
const nameSchema = z
  .string({ required_error: 'Name is required' })
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must not exceed 100 characters')
  .trim();

const addressSchema = z
  .string({ required_error: 'Address is required' })
  .min(5, 'Address must be at least 5 characters')
  .max(255, 'Address must not exceed 255 characters')
  .trim();

const conditionsSchema = z
  .array(z.string().min(1, 'Condition cannot be empty').trim())
  .min(0)
  .max(50, 'Maximum 50 conditions allowed')
  .default([]);

const allergiesSchema = z
  .array(z.string().min(1, 'Allergy cannot be empty').trim())
  .min(0)
  .max(50, 'Maximum 50 allergies allowed')
  .default([]);

// Create patient schema
export const createPatientSchema = z.object({
  name: nameSchema,
  address: addressSchema,
  conditions: conditionsSchema,
  allergies: allergiesSchema,
});

// Update patient schema (all fields optional)
export const updatePatientSchema = z
  .object({
    name: nameSchema.optional(),
    address: addressSchema.optional(),
    conditions: conditionsSchema.optional(),
    allergies: allergiesSchema.optional(),
  })
  .refine(
    // Explicitly type data as the object shape so strict mode is satisfied
    (data: { name?: string; address?: string; conditions?: string[]; allergies?: string[] }) =>
      Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
  );

// Query patients schema
export const queryPatientsSchema = z.object({
  address: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val: string | undefined) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),
  lastEvaluatedKey: z.string().optional(),
});

// Search patients schema
export const searchPatientsSchema = z.object({
  condition: z.string({ required_error: 'condition query param is required' }).min(1),
  limit: z
    .string()
    .optional()
    .transform((val: string | undefined) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),
  from: z
    .string()
    .optional()
    .transform((val: string | undefined) => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().min(0)),
});

// Path param schema
export const patientIdSchema = z.object({
  id: z.string().uuid('Invalid patient ID format'),
});

// Exported types
export type CreatePatientDto = z.infer<typeof createPatientSchema>;
export type UpdatePatientDto = z.infer<typeof updatePatientSchema>;
export type QueryPatientsDto = z.infer<typeof queryPatientsSchema>;
export type SearchPatientsDto = z.infer<typeof searchPatientsSchema>;
export type PatientIdParam = z.infer<typeof patientIdSchema>;
