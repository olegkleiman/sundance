// 
// chat routes.ts
// Sundance project, server part
//
// Created by: Oleg Kleiman on  26/07/2025
// 

import express from 'express';
import { completion, init } from '../controllers/chatController.js';
import { search } from '../controllers/searchController.js';
import { ingest } from '../controllers/ingestController.js';

const router = express.Router();
         
router.post('/ingest', ingest);
router.get('/completion', completion);
router.post('/init', init);
router.post('/search', search);

export default router;