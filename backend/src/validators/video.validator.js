// src/validators/video.validator.js
/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
import { z } from 'zod';

// ==================== CREATE VIDEO ====================
const createVideoSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(3, 'Title must be at least 3 characters')
    .max(150, 'Title cannot exceed 150 characters')
    .trim(),

  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional(),

  duration: z
    .number({ required_error: 'Duration is required' })
    .int('Duration must be a whole number')
    .min(1, 'Duration must be at least 1 second')
    .max(300, 'Duration cannot exceed 300 seconds (5 minutes)'),
});

// ==================== UPDATE VIDEO ====================
const updateVideoSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(150, 'Title cannot exceed 150 characters')
    .trim()
    .optional(),

  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Provide at least one field to update' }
);

// ==================== CREATE REVIEW ====================
const createReviewSchema = z.object({
  rating: z
    .number({ required_error: 'Rating is required' })
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5'),

  comment: z
    .string()
    .max(500, 'Comment cannot exceed 500 characters')
    .trim()
    .optional(),
});

// ==================== REGISTER SCHEMA ====================
const registerSchema = z.object({
  username: z
    .string({ required_error: 'Username is required' })
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .trim(),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
});

// ==================== LOGIN SCHEMA ====================
const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
});

// ES6 exports
export { createVideoSchema, updateVideoSchema, createReviewSchema, registerSchema, loginSchema };