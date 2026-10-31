import { Case } from '../models/Case.js';
import { SlaRule } from '../models/SlaRule.js';
import { Alert } from '../models/Alert.js';
import { createOrUpdateAlert } from './alerts.js';

export const runSlaChecks = async () => {
  const now = new Date();

  // 1. Clean up open alerts for already disposed or rejected cases
  const closedCases = await Case.find({ status: { $in: ['disposed', 'rejected'] } }).select('_id');
  if (closedCases.length > 0) {
    await Alert.updateMany(
      {
        case: { $in: closedCases.map((c) => c._id) },
        alertType: { $in: ['pending_reminder', 'due_soon', 'breach', 'escalation'] },
        resolvedAt: { $exists: false },
      },
      { resolvedAt: now }
    );
  }

  // 2. Fetch all active cases
  const openCases = await Case.find({
    status: { $in: ['pending', 'under_process', 'needs_info', 'transferred', 'escalated'] },
  }).populate('currentBureau');

  // Load default SLA rules
  const rules = await SlaRule.find();
  const rulesByCategory = new Map(rules.map((r) => [r.category, r]));

  const stats = {
    checked: openCases.length,
    reminders: 0,
    dueSoon: 0,
    breaches: 0,
    escalations: 0,
  };

  for (const c of openCases) {
    const rule = rulesByCategory.get(c.category) || {
      daysToDispose: 30,
      reminderAfterDays: 7,
      dueSoonDays: 3,
      escalateAfterDaysOverdue: 7,
    };

    const lastAction = c.lastActionDate || c.receivedDate || now;
    const daysSinceLastAction = Math.floor(
      (now.getTime() - new Date(lastAction).getTime()) / (1000 * 60 * 60 * 24)
    );

    const msUntilExpected = new Date(c.expectedDisposalDate).getTime() - now.getTime();
    const daysUntilExpected = Math.ceil(msUntilExpected / (1000 * 60 * 60 * 24));

    // 1. Pending reminder: no action for X days
    if (daysSinceLastAction >= rule.reminderAfterDays) {
      await createOrUpdateAlert({
        alertType: 'pending_reminder',
        caseId: c._id,
        institutionId: c.institution,
        message: `Pending Reminder: Case ${c.caseId} has had no progress recorded for ${daysSinceLastAction} days.`,
        severity: 'low',
        targetRoles: ['bureau_officer'],
        assignedOfficerId: c.assignedOfficer,
        bureauId: c.currentBureau?._id,
      });
      stats.reminders++;
    }

    // 2. Due soon: 3 days or fewer before expected disposal date
    if (daysUntilExpected >= 0 && daysUntilExpected <= rule.dueSoonDays) {
      await createOrUpdateAlert({
        alertType: 'due_soon',
        caseId: c._id,
        institutionId: c.institution,
        message: `Due Soon: Case ${c.caseId} disposal due in ${daysUntilExpected} day(s).`,
        severity: 'medium',
        targetRoles: ['bureau_officer'],
        assignedOfficerId: c.assignedOfficer,
        bureauId: c.currentBureau?._id,
      });
      stats.dueSoon++;
    }

    // 3. Breach & Escalation: expected date passed
    if (daysUntilExpected < 0) {
      const daysOverdue = Math.abs(daysUntilExpected);

      // Resolve stale 'due_soon' alert now that case has breached
      await Alert.updateMany(
        { case: c._id, alertType: 'due_soon', resolvedAt: { $exists: false } },
        { resolvedAt: now }
      );

      if (daysOverdue > rule.escalateAfterDaysOverdue || c.status === 'escalated') {
        // Resolve breach in favor of critical escalation
        await Alert.updateMany(
          { case: c._id, alertType: 'breach', resolvedAt: { $exists: false } },
          { resolvedAt: now }
        );

        await createOrUpdateAlert({
          alertType: 'escalation',
          caseId: c._id,
          institutionId: c.institution,
          message: `ESCALATION: Case ${c.caseId} is critically overdue by ${daysOverdue} days. Senior management intervention requested.`,
          severity: 'high',
          targetRoles: ['senior_management', 'super_admin'],
          assignedOfficerId: c.assignedOfficer,
          bureauId: c.currentBureau?._id,
        });
        stats.escalations++;
      } else {
        // Overdue <= 7 days: standard SLA breach
        await createOrUpdateAlert({
          alertType: 'breach',
          caseId: c._id,
          institutionId: c.institution,
          message: `SLA Breach: Case ${c.caseId} has passed its expected disposal date by ${daysOverdue} day(s).`,
          severity: 'high',
          targetRoles: ['bureau_officer', 'super_admin'],
          assignedOfficerId: c.assignedOfficer,
          bureauId: c.currentBureau?._id,
        });
        stats.breaches++;
      }
    }
  }

  return stats;
};
