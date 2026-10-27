import { Router } from 'express';
import {
  getBureauCases,
  getBureauCaseById,
  getBureauCaseHistory,
  updateBureauCaseStatus,
  addBureauCaseAction,
  requestInfoFromStudent,
  transferBureauCase,
  escalateBureauCase,
} from '../controllers/caseController.js';
import { getBureauDashboard } from '../controllers/dashboardController.js';
import { getOverlaps } from '../controllers/overlapController.js';
import {
  uploadBulkFile,
  runManualSync,
  uploadMiddleware,
} from '../controllers/importSyncController.js';
import {
  getAlerts,
  markAlertAsRead,
} from '../controllers/alertController.js';
import { getBureaus } from '../controllers/adminController.js';
import {
  getMatchReviewQueue,
  confirmMatch,
  rejectMatch,
} from '../controllers/matchReviewController.js';

const router = Router();

// ============================================================================
// DASHBOARD
// ============================================================================
router.get('/dashboard', getBureauDashboard);

// ============================================================================
// CASES (SCOPED TO USER'S BUREAU ONLY)
// ============================================================================
router.get('/cases', getBureauCases);
router.get('/cases/:id', getBureauCaseById);
router.get('/cases/:id/history', getBureauCaseHistory);
router.patch('/cases/:id/status', updateBureauCaseStatus);
router.post('/cases/:id/actions', addBureauCaseAction);
router.post('/cases/:id/request-info', requestInfoFromStudent);
router.post('/cases/:id/transfer', transferBureauCase);
router.post('/cases/:id/escalate', escalateBureauCase);

// ============================================================================
// OVERLAPS (READ-ONLY, MY BUREAU CASES)
// ============================================================================
router.get('/overlaps', (req, res, next) => {
  // Always enforce mine=true for bureau
  req.query.mine = 'true';
  return getOverlaps(req, res, next);
});

// ============================================================================
// IMPORT & DATA SYNC (bureau_officer & data_operator)
// ============================================================================
router.post('/import/upload', uploadMiddleware.single('file'), uploadBulkFile);
router.post('/import/sync/run', runManualSync);

// ============================================================================
// MATCH REVIEW (data_operator & bureau_officer)
// ============================================================================
router.get('/match-review', getMatchReviewQueue);
router.post('/match-review/:caseId/confirm', confirmMatch);
router.post('/match-review/:caseId/reject', rejectMatch);

// ============================================================================
// ALERTS (MY BUREAU ONLY)
// ============================================================================
router.get('/alerts', getAlerts);
router.post('/alerts/:id/read', markAlertAsRead);

// Helper for transfer target bureau options
router.get('/bureaus', getBureaus);

export default router;
