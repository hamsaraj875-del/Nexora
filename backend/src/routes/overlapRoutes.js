import { Router } from 'express';
import {
  getOverlaps,
  getOverlapById,
  resolveOverlap,
} from '../controllers/overlapController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getOverlaps);
router.get('/:id', getOverlapById);

// Authorization is checked against the OverlapGroup inside the controller.
// Do not use canEditCase here: this route receives an OverlapGroup ID.
router.post('/:id/resolve', resolveOverlap);

export default router;