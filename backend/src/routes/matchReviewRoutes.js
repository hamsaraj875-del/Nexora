import { Router } from 'express';
import { getMatchReviewQueue, confirmMatch, rejectMatch } from '../controllers/matchReviewController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = Router();

router.use(authenticate);

// Data operators, bureau officers, super admins can review
router.get('/', getMatchReviewQueue);
router.post('/:caseId/confirm', authorize(['super_admin', 'bureau_officer', 'data_operator']), confirmMatch);
router.post('/:caseId/reject', authorize(['super_admin', 'bureau_officer', 'data_operator']), rejectMatch);

export default router;
