// 
// auth routes.ts
// Sundance project, server part
//
// Created by: Oleg Kleiman on  26/07/2025
// 

import express from 'express';
import { login, refresh_token } from '../controllers/authController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with phone number and OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - otp
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: User's phone number
 *               otp:
 *                 type: string
 *                 description: One-time password received by the user
 *     responses:
 *       200:
 *         description: Successfully logged in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   description: JWT access token
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/refresh_token:
 *   get:
 *     summary: Refresh access token using refresh token
 *     tags: [Auth]
 *     parameters:
 *       - in: cookie
 *         name: refreshToken
 *         schema:
 *           type: string
 *         required: true
 *         description: Refresh token from cookie
 *     responses:
 *       200:
 *         description: Successfully refreshed token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   description: New JWT access token
 *       401:
 *         description: Unauthorized - Invalid or expired refresh token
 *       500:
 *         description: Server error
 */
router.get('/refresh_token', refresh_token);

export default router;