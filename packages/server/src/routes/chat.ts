// 
// chat routes.ts
// Sundance project, server part
//
// Created by: Oleg Kleiman on  26/07/2025
// 

import express from 'express';
import { ingest, completion, init } from '../controllers/chatController.js';

const router = express.Router();
         
router.post('/ingest', ingest);
router.get('/completion', completion);
router.post('/init', init);

export default router;