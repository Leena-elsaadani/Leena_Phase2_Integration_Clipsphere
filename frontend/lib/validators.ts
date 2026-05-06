import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const uploadSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(150, 'Title too long'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  visibility: z.enum(['public', 'private', 'unlisted']),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Please select a rating').max(5),
  comment: z.string().max(500, 'Comment cannot exceed 500 characters').optional(),
});

export const tipSchema = z.object({
  amount: z.number().min(1, 'Minimum tip is $1').max(500, 'Maximum tip is $500'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type UploadFormData = z.infer<typeof uploadSchema>;
export type ReviewFormData = z.infer<typeof reviewSchema>;
export type TipFormData = z.infer<typeof tipSchema>;