import { Router } from 'express';
import {
  getCases,
  getCaseById,
  getCaseHistory,
  assignCase,
  escalateCase,
  linkCases,
} from '../controllers/caseController.js';
import {
  getDashboardSummary,
  getBureauWorkload,
  getInstitutionStatus,
} from '../controllers/dashboardController.js';
import {
  getInstitutions,
  getInstitutionById,
} from '../controllers/institutionController.js';
import {
  getOverlaps,
  getOverlapById,
  resolveOverlap,
  linkOverlapCases,
} from '../controllers/overlapController.js';
import {
  getMatchReviewQueue,
  confirmMatch,
  rejectMatch,
} from '../controllers/matchReviewController.js';
import {
  getAlerts,
  markAlertAsRead,
} from '../controllers/alertController.js';
import { getReport } from '../controllers/reportController.js';
import {
  getSlaRules,
  updateSlaRule,
  getUsers,
  getBureaus,
} from '../controllers/adminController.js';
import { authorize } from '../middleware/roles.js';

const router = Router();

// ============================================================================
// DASHBOARD
// ============================================================================
router.get('/dashboard', async (req, res, next) => {
  // Can serve combined or summary
  return getDashboardSummary(req, res, next);
});
router.get('/dashboard/summary', getDashboardSummary);
router.get('/dashboard/bureau-workload', getBureauWorkload);
router.get('/dashboard/institution-status', getInstitutionStatus);

// ============================================================================
// CASES
// ============================================================================
router.get('/cases', getCases);
router.get('/cases/:id', getCaseById);
router.get('/cases/:id/history', getCaseHistory);

// Senior management is read-only EXCEPT assign/escalate; regional_officer / super_admin can also assign/escalate
router.post('/cases/:id/assign', assignCase);
router.post('/cases/:id/escalate', escalateCase);
router.post('/cases/link', linkCases);

// ============================================================================
// OVERLAPS
// ============================================================================
router.get('/overlaps', getOverlaps);
router.get('/overlaps/:id', getOverlapById);
router.post('/overlaps/:id/resolve', resolveOverlap);
router.post('/overlaps/link', linkOverlapCases);

// ============================================================================
// MATCH REVIEW
// ============================================================================
router.get('/match-review', getMatchReviewQueue);
router.post('/match-review/:caseId/confirm', confirmMatch);
router.post('/match-review/:caseId/reject', rejectMatch);

// ============================================================================
// ALERTS
// ============================================================================
router.get('/alerts', getAlerts);
router.post('/alerts/:id/read', markAlertAsRead);

// ============================================================================
// REPORTS
// ============================================================================
router.get('/reports/:type', getReport);

// ============================================================================
// INSTITUTIONS & BUREAUS
// ============================================================================
router.get('/institutions', getInstitutions);
router.get('/institutions/:id', getInstitutionById);
router.get('/bureaus', getBureaus);

// ============================================================================
// ADMINISTRATION (super_admin only for edits & users)
// ============================================================================
router.get('/admin/sla-rules', getSlaRules);
router.put('/admin/sla-rules', authorize(['super_admin']), updateSlaRule);
router.get('/admin/users', authorize(['super_admin']), getUsers);
router.get('/admin/bureaus', getBureaus);

export default router;
