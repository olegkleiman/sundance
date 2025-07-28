import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

// Login request schema
export const loginSchema = z.object({
    phoneNumber: z.string()
      .min(9, "ID number must be at least 9 characters"),
      // .regex(/^(?:\+972|0)(5[0-8]\d{7})$/, "Invalid ID number format"),
    otp: z.string()
      .min(3, "OTP must be at least 3 characters")
      .regex(/^\d{3,6}$/, "OTP must be 3-6 digits")
  });

// Refresh token schema
export const refreshTokenSchema = z.object({});

// Validation middleware
export const validate = (schema: z.ZodSchema) => 
    (req: Request, res: Response, next: NextFunction) => {
      try {
        schema.parse(req.body);
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            errors: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message
            }))
          });
        }
        next(error);
      }
    };