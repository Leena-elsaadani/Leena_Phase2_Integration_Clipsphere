// src/middleware/validate.middleware.js
import { z } from 'zod';

// Higher-order function that returns validation middleware
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      // Parse and validate the request body
      schema.parse(req.body);
      // If valid, proceed
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Zod exposes issues[] (Zod v3/v4); avoid error.errors which is undefined.
        const issues = error.issues ?? error.errors;
        const errors = (issues || []).map((err) => ({
          field: (err.path ?? []).join('.'),
          message: err.message,
        }));
        return res.status(400).json({
          status: 'fail',
          message: 'Validation failed',
          errors,
        });
      }
      // Unexpected error
      next(error);
    }
  };
};